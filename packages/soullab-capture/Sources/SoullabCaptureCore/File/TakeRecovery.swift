import Foundation

/// Repairs takes that were cut off by a crash, kill or power loss.
///
/// Runs at helper start, before any request is served, and scans only the storage root
/// (not recursively). It never deletes audio. A take it cannot repair is renamed to
/// `<name>.unrecoverable` and reported.
public enum TakeRecovery {
    public struct Report: Sendable, Codable, Equatable {
        public var recovered: [TakeResult] = []
        public var quarantined: [String] = []
        public var provenanceCompleted: [TakeResult] = []

        public var isEmpty: Bool { recovered.isEmpty && quarantined.isEmpty && provenanceCompleted.isEmpty }
    }

    public static func recover(root: URL, helperVersion: String, now: Date = Date()) -> Report {
        var report = Report()
        let entries = (try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? []

        for entry in entries.sorted() where entry.hasSuffix(".partial.wav") && !entry.hasPrefix(".") {
            let name = String(entry.dropLast(".partial.wav".count))
            guard let paths = try? StorageGuard.paths(root: root, name: name) else {
                report.quarantined.append(quarantine(root.appendingPathComponent(entry)))
                continue
            }
            do {
                let result = try repair(paths: paths, name: name, helperVersion: helperVersion)
                report.recovered.append(result)
            } catch {
                report.quarantined.append(quarantine(paths.partial))
            }
        }

        // A take renamed to its final name whose provenance was not yet written.
        for entry in entries.sorted() where entry.hasSuffix(".journal.json") && !entry.hasPrefix(".") {
            let name = String(entry.dropLast(".journal.json".count))
            guard let paths = try? StorageGuard.paths(root: root, name: name),
                  !FileManager.default.fileExists(atPath: paths.partial.path),
                  FileManager.default.fileExists(atPath: paths.final.path),
                  !FileManager.default.fileExists(atPath: paths.provenance.path),
                  let journal = try? TakeJournal.read(from: paths.journal),
                  let format = try? CaptureFormat(sampleRate: journal.sampleRate, channels: journal.channels),
                  let bytes = journal.finalDataBytes
            else { continue }
            if let result = try? writeProvenance(paths: paths, journal: journal, format: format,
                                                 dataBytes: bytes, stopReason: .recovered, recovered: true,
                                                 markers: journal.markers, helperVersion: helperVersion) {
                try? FileManager.default.removeItem(at: paths.journal)
                report.provenanceCompleted.append(result)
            }
        }
        return report
    }

    static func repair(paths: StorageGuard.TakePaths, name: String, helperVersion: String) throws -> TakeResult {
        let journal = try TakeJournal.read(from: paths.journal)
        let format = try CaptureFormat(sampleRate: journal.sampleRate, channels: journal.channels)

        let fd = open(paths.partial.path, O_RDWR | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { throw CaptureError(.ioFailed, "open partial") }
        var closed = false
        defer { if !closed { close(fd) } }

        var st = stat()
        guard fstat(fd, &st) == 0 else { throw CaptureError(.ioFailed, "fstat") }
        let fileLength = Int64(st.st_size)

        // Validate the header against the journal before touching anything.
        let headerLength = min(Int(fileLength), journal.dataOffset)
        var header = [UInt8](repeating: 0, count: headerLength)
        guard pread(fd, &header, headerLength, 0) == headerLength,
              let parsed = WAVLayout.parse(header),
              parsed.dataOffset == journal.dataOffset,
              parsed.channels == format.channels,
              parsed.sampleRate == format.sampleRate,
              parsed.bitsPerSample == CaptureFormat.bitsPerSample
        else { throw CaptureError(.ioFailed, "header does not match journal") }

        // Audio bytes: exact when finalizing had begun; otherwise everything after the
        // header, rounded down to whole frames.
        var dataBytes = journal.finalDataBytes ?? (fileLength - Int64(journal.dataOffset))
        dataBytes = max(0, min(dataBytes, fileLength - Int64(journal.dataOffset)))
        dataBytes -= dataBytes % Int64(format.blockAlign)

        // Drop any partial frame or half-written trailing chunk.
        guard ftruncate(fd, off_t(Int64(journal.dataOffset) + dataBytes)) == 0 else {
            throw CaptureError(.writeFailed, "truncate")
        }

        // Mark the bext description as recovered.
        var description = ByteWriter()
        description.fixedASCII("Soullab Capture take \(journal.takeId) [recovered]", length: WAVLayout.bextDescriptionLength)
        try TakeWriter.pwriteAll(fd, description.storage, at: Int64(WAVLayout.bextDescriptionOffset))

        let frames = dataBytes / Int64(format.blockAlign)
        var markers = journal.markers
        markers.append(Discontinuity(kind: .recovered, framePosition: frames, lostFrames: 0))
        let trailing = WAVLayout.trailingChunks(markers: markers, dataBytes: dataBytes)
        let end = Int64(journal.dataOffset) + dataBytes
        try TakeWriter.pwriteAll(fd, trailing, at: end)

        var riff = WAVLayout.riffSize(fileLength: end + Int64(trailing.count)).littleEndian
        var data = UInt32(clamping: dataBytes).littleEndian
        try withUnsafeBytes(of: &riff) { try TakeWriter.pwriteAll(fd, $0, at: 4) }
        try withUnsafeBytes(of: &data) { try TakeWriter.pwriteAll(fd, $0, at: Int64(journal.dataOffset - 4)) }
        try TakeWriter.fullSync(fd)
        close(fd)
        closed = true

        try TakeWriter.renameExclusive(from: paths.partial, to: paths.final)
        try TakeWriter.syncDirectory(paths.final.deletingLastPathComponent())

        let result = try writeProvenance(paths: paths, journal: journal, format: format, dataBytes: dataBytes,
                                         stopReason: .recovered, recovered: true, markers: markers,
                                         helperVersion: helperVersion)
        try? FileManager.default.removeItem(at: paths.journal)
        return result
    }

    static func writeProvenance(paths: StorageGuard.TakePaths, journal: TakeJournal, format: CaptureFormat,
                                dataBytes: Int64, stopReason: StopReason, recovered: Bool,
                                markers: [Discontinuity], helperVersion: String) throws -> TakeResult {
        let sha = try StreamingHash.sha256(of: paths.final)
        let size = (try? FileManager.default.attributesOfItem(atPath: paths.final.path)[.size] as? NSNumber)?.int64Value ?? 0
        let record = ProvenanceRecord(
            takeId: journal.takeId, file: paths.final.lastPathComponent, sha256: sha, bytes: size,
            format: format, frames: dataBytes / Int64(format.blockAlign), source: journal.source,
            startedAt: journal.startedAt, endedAt: nil, stopReason: stopReason, recovered: recovered,
            discontinuities: markers, clipSamples: journal.clipSamples, member: journal.member,
            helperVersion: helperVersion)
        try record.write(to: paths.provenance)
        return TakeResult(record: record, path: paths.final, provenancePath: paths.provenance)
    }

    /// Renames, never deletes. Returns the new file name.
    static func quarantine(_ url: URL) -> String {
        let base = url.deletingPathExtension().deletingPathExtension().lastPathComponent
        let dir = url.deletingLastPathComponent()
        var candidate = dir.appendingPathComponent(base + ".unrecoverable")
        var n = 1
        while FileManager.default.fileExists(atPath: candidate.path) {
            n += 1
            candidate = dir.appendingPathComponent("\(base).unrecoverable.\(n)")
        }
        if renamex_np(url.path, candidate.path, UInt32(RENAME_EXCL)) == 0 {
            return candidate.lastPathComponent
        }
        return url.lastPathComponent
    }
}
