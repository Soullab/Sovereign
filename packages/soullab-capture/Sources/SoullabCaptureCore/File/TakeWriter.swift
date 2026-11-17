import Foundation

/// Writes one take to disk, crash-safely.
///
/// 1. Creates `<name>.partial.wav` with O_CREAT|O_EXCL|O_NOFOLLOW (never overwrites).
/// 2. Appends audio. About once a second `checkpoint()` rewrites the RIFF and data sizes
///    to the bytes written so far and issues F_FULLFSYNC, so a crash or power loss leaves
///    a valid file missing at most about one second.
/// 3. `finalize` records the exact size in the journal, appends cue/label chunks, syncs,
///    renames `.partial.wav` → `.wav` without replacing anything (RENAME_EXCL) and syncs
///    the directory.
public final class TakeWriter {
    public let paths: StorageGuard.TakePaths
    public let format: CaptureFormat
    public let dataOffset: Int
    public let maxDataBytes: Int64
    public private(set) var dataBytes: Int64 = 0
    public private(set) var journal: TakeJournal

    private let dataSizeFieldOffset: Int
    private var fd: Int32
    private var closed = false

    public init(paths: StorageGuard.TakePaths, header: WAVLayout.HeaderInfo, journal: TakeJournal,
                maxDataBytes: Int64? = nil) throws {
        self.paths = paths
        self.format = header.format
        let built = WAVLayout.header(header)
        dataOffset = built.dataOffset
        dataSizeFieldOffset = built.dataSizeFieldOffset
        let layoutMax = WAVLayout.maxDataBytes(for: header.format, headerBytes: built.bytes.count)
        let requested = min(maxDataBytes ?? layoutMax, layoutMax)
        self.maxDataBytes = requested - (requested % Int64(header.format.blockAlign))

        var j = journal
        j.dataOffset = built.dataOffset
        self.journal = j

        fd = open(paths.partial.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o644)
        guard fd >= 0 else {
            throw CaptureError(errno == EEXIST ? .nameExists : .writeFailed, "open partial: errno \(errno)")
        }
        do {
            try Self.pwriteAll(fd, built.bytes, at: 0)
            try self.journal.write(to: paths.journal)
            try checkpoint()
        } catch {
            close(fd)
            closed = true
            throw error
        }
    }

    deinit {
        if !closed { close(fd) }
    }

    public var framesWritten: Int64 { dataBytes / Int64(format.blockAlign) }

    /// Appends whole frames. Returns the number of bytes written; fewer than `bytes.count`
    /// means the size limit was reached and the caller must stop the take.
    @discardableResult
    public func append(_ bytes: UnsafeRawBufferPointer) throws -> Int {
        let room = maxDataBytes - dataBytes
        var count = min(Int64(bytes.count), room)
        count -= count % Int64(format.blockAlign)
        guard count > 0 else { return 0 }
        try Self.pwriteAll(fd, UnsafeRawBufferPointer(rebasing: bytes[0..<Int(count)]), at: Int64(dataOffset) + dataBytes)
        dataBytes += count
        return Int(count)
    }

    public var isAtSizeLimit: Bool { dataBytes >= maxDataBytes }

    /// Makes everything written so far durable and the file valid as it stands.
    public func checkpoint(markers: [Discontinuity]? = nil, clipSamples: Int64? = nil) throws {
        try writeSizes(fileLength: Int64(dataOffset) + dataBytes)
        try Self.fullSync(fd)
        if let markers, markers != journal.markers || clipSamples != journal.clipSamples {
            journal.markers = Array(markers.prefix(CapturePolicy.maxFileCuePoints))
            journal.clipSamples = clipSamples ?? journal.clipSamples
            try journal.write(to: paths.journal)
        }
    }

    /// Completes the file and moves it to its final name. Returns the final URL.
    public func finalize(markers: [Discontinuity], clipSamples: Int64) throws -> URL {
        journal.state = .finalizing
        journal.finalDataBytes = dataBytes
        journal.markers = Array(markers.prefix(CapturePolicy.maxFileCuePoints))
        journal.clipSamples = clipSamples
        try journal.write(to: paths.journal)

        let trailing = WAVLayout.trailingChunks(markers: markers, dataBytes: dataBytes)
        let end = Int64(dataOffset) + dataBytes
        if !trailing.isEmpty {
            try Self.pwriteAll(fd, trailing, at: end)
        }
        try writeSizes(fileLength: end + Int64(trailing.count))
        try Self.fullSync(fd)
        close(fd)
        closed = true

        try Self.renameExclusive(from: paths.partial, to: paths.final)
        try Self.syncDirectory(paths.final.deletingLastPathComponent())
        return paths.final
    }

    /// Closes without finalizing. The partial file and journal stay for recovery.
    public func abandon() {
        if !closed {
            try? writeSizes(fileLength: Int64(dataOffset) + dataBytes)
            try? Self.fullSync(fd)
            close(fd)
            closed = true
        }
    }

    private func writeSizes(fileLength: Int64) throws {
        var riff = WAVLayout.riffSize(fileLength: fileLength).littleEndian
        var data = UInt32(clamping: dataBytes).littleEndian
        try withUnsafeBytes(of: &riff) { try Self.pwriteAll(fd, $0, at: 4) }
        try withUnsafeBytes(of: &data) { try Self.pwriteAll(fd, $0, at: Int64(dataSizeFieldOffset)) }
    }

    // MARK: POSIX helpers (shared with recovery)

    static func pwriteAll(_ fd: Int32, _ bytes: [UInt8], at offset: Int64) throws {
        try bytes.withUnsafeBytes { try pwriteAll(fd, $0, at: offset) }
    }

    static func pwriteAll(_ fd: Int32, _ bytes: UnsafeRawBufferPointer, at offset: Int64) throws {
        var done = 0
        while done < bytes.count {
            let n = pwrite(fd, bytes.baseAddress! + done, bytes.count - done, off_t(offset) + off_t(done))
            if n < 0 {
                if errno == EINTR { continue }
                throw CaptureError(.writeFailed, "pwrite errno \(errno)")
            }
            done += n
        }
    }

    static func fullSync(_ fd: Int32) throws {
        if fcntl(fd, F_FULLFSYNC) != 0 {
            guard fsync(fd) == 0 else { throw CaptureError(.writeFailed, "fsync errno \(errno)") }
        }
    }

    static func renameExclusive(from: URL, to: URL) throws {
        guard renamex_np(from.path, to.path, UInt32(RENAME_EXCL)) == 0 else {
            throw CaptureError(errno == EEXIST ? .nameExists : .writeFailed, "rename errno \(errno)")
        }
    }

    static func syncDirectory(_ url: URL) throws {
        let dfd = open(url.path, O_RDONLY | O_CLOEXEC)
        guard dfd >= 0 else { throw CaptureError(.writeFailed, "open dir errno \(errno)") }
        defer { close(dfd) }
        try fullSync(dfd)
    }
}
