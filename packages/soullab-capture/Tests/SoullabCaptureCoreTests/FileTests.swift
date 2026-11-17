import CryptoKit
import XCTest
@testable import SoullabCaptureCore
import SoullabCaptureTestSupport

private let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
private let regenerate = ProcessInfo.processInfo.environment["SOULLAB_REGENERATE_FIXTURES"] == "1"

private func hex(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

final class FileTests: XCTestCase {
    // T2 — Float32 → 24-bit: error ≤ 0.5 LSB; clipping counted.
    func testT2EncoderAccuracyAndClipping() {
        var rng = SystemRandomNumberGenerator()
        let n = 200_000
        var input = (0..<n).map { _ in Float.random(in: -1...1, using: &rng) }
        input += [1.0, -1.0, 0, Float.leastNonzeroMagnitude]
        var bytes = [UInt8](repeating: 0, count: input.count * 3)
        let clipped = input.withUnsafeBufferPointer { src in
            bytes.withUnsafeMutableBufferPointer { SampleEncoder.encodeS24(src.baseAddress!, count: src.count, into: $0.baseAddress!) }
        }
        XCTAssertEqual(clipped, 0)
        let decoded = bytes.withUnsafeBytes { SampleEncoder.decodeS24($0) }
        for (x, v) in zip(input, decoded) {
            XCTAssertLessThanOrEqual(abs(Double(x) * 8_388_607 - Double(v)), 0.5 + 1e-6)
        }

        let hot: [Float] = [1.5, -1.5, 1.0000001, .nan, .infinity, -.infinity]
        var out = [UInt8](repeating: 0, count: hot.count * 3)
        let hotClipped = hot.withUnsafeBufferPointer { src in
            out.withUnsafeMutableBufferPointer { SampleEncoder.encodeS24(src.baseAddress!, count: src.count, into: $0.baseAddress!) }
        }
        let hotDecoded = out.withUnsafeBytes { SampleEncoder.decodeS24($0) }
        XCTAssertEqual(hotDecoded, [8_388_607, -8_388_608, 8_388_607, 0, 8_388_607, -8_388_608])
        XCTAssertEqual(hotClipped, 6, "every out-of-range value, NaN and infinity is counted")
    }

    // T3 — golden header bytes, golden whole-file fixtures, and Apple's afinfo parses them.
    func testT3GoldenFixtures() throws {
        let date = ISO8601DateFormatter().date(from: "2026-11-17T12:34:56Z")!
        let utc = TimeZone(identifier: "UTC")!
        let cases: [(String, Double, Int, [Discontinuity])] = [
            ("take-48k-stereo", 48_000, 2, []),
            ("take-44k1-mono-markers", 44_100, 1, [Discontinuity(kind: .overrun, framePosition: 100, lostFrames: 512),
                                                   Discontinuity(kind: .timestampGap, framePosition: 900, lostFrames: 7)]),
            ("take-96k-stereo", 96_000, 2, []),
        ]
        var manifest: [String] = []
        for (name, rate, channels, markers) in cases {
            let format = try CaptureFormat(sampleRate: rate, channels: channels)
            let info = WAVLayout.HeaderInfo(format: format, description: "Soullab Capture take fixture-\(name)",
                                            originatorReference: "fixture", originationDate: date, timeZone: utc,
                                            codingHistory: "A=PCM,F=\(Int(rate)),W=24,M=\(format.channelLabel),T=Soullab Capture fixture\r\n")
            let root = makeTempDirectory()
            let paths = try StorageGuard.paths(root: root, name: name)
            let journal = TakeJournal(takeId: "fixture", name: name, state: .recording, sampleRate: rate, channels: channels,
                                      dataOffset: 0, source: SourceDescriptor(kind: .test, id: "fixture", name: "fixture"),
                                      member: MemberFields(), startedAt: date, helperVersion: "fixture",
                                      finalDataBytes: nil, markers: [], clipSamples: 0)
            let writer = try TakeWriter(paths: paths, header: info, journal: journal)
            let frames = 1000
            let samples = rampSamples(frames: frames, channels: channels).map { Float($0) / SampleEncoder.scale }
            var bytes = [UInt8](repeating: 0, count: samples.count * 3)
            samples.withUnsafeBufferPointer { s in
                bytes.withUnsafeMutableBufferPointer { _ = SampleEncoder.encodeS24(s.baseAddress!, count: s.count, into: $0.baseAddress!) }
            }
            try bytes.withUnsafeBytes { _ = try writer.append($0) }
            let final = try writer.finalize(markers: markers, clipSamples: 0)
            let produced = try Data(contentsOf: final)

            let fixture = fixtures.appendingPathComponent(name + ".wav")
            if regenerate { try produced.write(to: fixture) }
            XCTAssertEqual(produced, try Data(contentsOf: fixture), "\(name) bytes match the committed fixture")
            manifest.append("\(hex(produced))  \(name).wav")

            let headerFixture = fixtures.appendingPathComponent(name + ".header.bin")
            let header = Data(WAVLayout.header(info).bytes)
            if regenerate { try header.write(to: headerFixture) }
            XCTAssertEqual(header, try Data(contentsOf: headerFixture))
            manifest.append("\(hex(header))  \(name).header.bin")

            let afinfo = Process()
            afinfo.executableURL = URL(fileURLWithPath: "/usr/bin/afinfo")
            afinfo.arguments = [fixture.path]
            let pipe = Pipe()
            afinfo.standardOutput = pipe
            afinfo.standardError = Pipe()
            try afinfo.run()
            let text = String(decoding: pipe.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
            afinfo.waitUntilExit()
            XCTAssertEqual(afinfo.terminationStatus, 0, "afinfo parses \(name)")
            XCTAssertTrue(text.contains("\(Int(rate)) Hz"), "afinfo sees the rate of \(name)")
            XCTAssertTrue(text.contains("\(channels) ch"), "afinfo sees the channels of \(name)")

            let wav = try TestWAVReader(url: fixture)
            XCTAssertTrue(wav.riffSizeMatchesFile)
            XCTAssertEqual(wav.cuePositions, markers.map { Int($0.framePosition) })
            XCTAssertEqual(wav.labels.count, markers.count)
        }
        let manifestURL = fixtures.appendingPathComponent("MANIFEST_SHA256.txt")
        let manifestText = manifest.sorted().joined(separator: "\n") + "\n"
        if regenerate { try manifestText.write(to: manifestURL, atomically: true, encoding: .utf8) }
        XCTAssertEqual(manifestText, try String(contentsOf: manifestURL, encoding: .utf8))
    }

    // T6 — recovery repairs a torn take and never deletes what it cannot repair.
    func testT6RecoveryRepairsTornTake() throws {
        let root = makeTempDirectory()
        let format = try CaptureFormat(sampleRate: 48_000, channels: 2)
        let paths = try StorageGuard.paths(root: root, name: "torn")
        let info = WAVLayout.HeaderInfo(format: format, description: "Soullab Capture take t1", originatorReference: "t1",
                                        originationDate: Date(), codingHistory: "x\r\n")
        let journal = TakeJournal(takeId: "t1", name: "torn", state: .recording, sampleRate: 48_000, channels: 2, dataOffset: 0,
                                  source: SourceDescriptor(kind: .test, id: "t", name: "t"), member: MemberFields(performer: "P"),
                                  startedAt: Date(), helperVersion: "test", finalDataBytes: nil,
                                  markers: [Discontinuity(kind: .overrun, framePosition: 10, lostFrames: 3)], clipSamples: 0)
        let writer = try TakeWriter(paths: paths, header: info, journal: journal)
        let samples = rampSamples(frames: 4800, channels: 2).map { Float($0) / SampleEncoder.scale }
        var bytes = [UInt8](repeating: 0, count: samples.count * 3)
        samples.withUnsafeBufferPointer { s in
            bytes.withUnsafeMutableBufferPointer { _ = SampleEncoder.encodeS24(s.baseAddress!, count: s.count, into: $0.baseAddress!) }
        }
        try bytes.withUnsafeBytes { _ = try writer.append($0) }
        try writer.checkpoint(markers: journal.markers, clipSamples: 0)
        writer.abandon()
        // A torn final write: four stray bytes (less than one 6-byte frame).
        let handle = try FileHandle(forWritingTo: paths.partial)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data([1, 2, 3, 4]))
        try handle.close()

        let report = TakeRecovery.recover(root: root, helperVersion: "test")
        XCTAssertEqual(report.recovered.count, 1)
        XCTAssertEqual(report.quarantined, [])
        let take = report.recovered[0]
        XCTAssertEqual(take.frames, 4800)
        XCTAssertTrue(take.recovered)
        XCTAssertEqual(take.stopReason, .recovered)
        XCTAssertFalse(FileManager.default.fileExists(atPath: paths.partial.path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: paths.journal.path))

        let wav = try TestWAVReader(url: paths.final)
        XCTAssertTrue(wav.riffSizeMatchesFile)
        XCTAssertEqual(wav.samples, rampSamples(frames: 4800, channels: 2))
        XCTAssertTrue(wav.bextDescription.hasSuffix("[recovered]"))
        XCTAssertEqual(wav.cuePositions, [10, 4800])
        XCTAssertTrue(wav.labels[1].contains("recovered"))
        let record = try ProvenanceRecord.read(from: paths.provenance)
        XCTAssertTrue(record.recovered)
        XCTAssertNil(record.endedAt)
        XCTAssertEqual(record.member.performer, "P")
        XCTAssertEqual(record.sha256, try StreamingHash.sha256(of: paths.final))
    }

    func testT6RecoveryUsesExactSizeWhenFinalizingHadBegun() throws {
        let root = makeTempDirectory()
        let format = try CaptureFormat(sampleRate: 44_100, channels: 1)
        let paths = try StorageGuard.paths(root: root, name: "half")
        let info = WAVLayout.HeaderInfo(format: format, description: "d", originatorReference: "r",
                                        originationDate: Date(), codingHistory: "x\r\n")
        var journal = TakeJournal(takeId: "t2", name: "half", state: .recording, sampleRate: 44_100, channels: 1, dataOffset: 0,
                                  source: SourceDescriptor(kind: .test, id: "t", name: "t"), member: MemberFields(),
                                  startedAt: Date(), helperVersion: "test", finalDataBytes: nil, markers: [], clipSamples: 0)
        let writer = try TakeWriter(paths: paths, header: info, journal: journal)
        let samples = rampSamples(frames: 1000, channels: 1).map { Float($0) / SampleEncoder.scale }
        var bytes = [UInt8](repeating: 0, count: samples.count * 3)
        samples.withUnsafeBufferPointer { s in
            bytes.withUnsafeMutableBufferPointer { _ = SampleEncoder.encodeS24(s.baseAddress!, count: s.count, into: $0.baseAddress!) }
        }
        try bytes.withUnsafeBytes { _ = try writer.append($0) }
        writer.abandon()
        // Crash after finalizing began: half-written trailing chunk bytes past the audio.
        journal = writer.journal
        journal.state = .finalizing
        journal.finalDataBytes = 3000
        try journal.write(to: paths.journal)
        let handle = try FileHandle(forWritingTo: paths.partial)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data("cue \u{10}\0\0\0garbage".utf8))
        try handle.close()

        let report = TakeRecovery.recover(root: root, helperVersion: "test")
        XCTAssertEqual(report.recovered.first?.frames, 1000)
        let wav = try TestWAVReader(url: paths.final)
        XCTAssertTrue(wav.riffSizeMatchesFile)
        XCTAssertEqual(wav.samples, rampSamples(frames: 1000, channels: 1))
    }

    func testT6UnrecoverableIsQuarantinedNeverDeleted() throws {
        let root = makeTempDirectory()
        let garbage = Data((0..<5000).map { UInt8($0 % 251) })
        try garbage.write(to: root.appendingPathComponent("nojournal.partial.wav"))
        try garbage.write(to: root.appendingPathComponent("badheader.partial.wav"))
        try Data("{\"not\":\"a journal\"}".utf8).write(to: root.appendingPathComponent("badheader.journal.json"))

        let report = TakeRecovery.recover(root: root, helperVersion: "test")
        XCTAssertEqual(report.recovered, [])
        XCTAssertEqual(report.quarantined.sorted(), ["badheader.unrecoverable", "nojournal.unrecoverable"])
        for name in report.quarantined {
            XCTAssertEqual(try Data(contentsOf: root.appendingPathComponent(name)), garbage, "bytes are kept as they were")
        }
    }

    // T11 — names and paths stay inside the chosen root; nothing is overwritten.
    func testT11PathContainment() throws {
        let root = makeTempDirectory()
        for bad in ["", ".hidden", "..", "../up", "a/b", "a:b", "a\\b", "tab\tname", " lead", "trail ",
                    String(repeating: "x", count: 129), String(repeating: "é", count: 65)] {
            XCTAssertThrowsError(try StorageGuard.validateTakeName(bad), "rejects \(bad.debugDescription)") {
                XCTAssertEqual(($0 as? CaptureError)?.code, .invalidName)
            }
        }
        XCTAssertNoThrow(try StorageGuard.validateTakeName("Breath study 3 — Kelly"))

        // A symlink planted where the partial file would go is refused, not followed.
        let outside = makeTempDirectory()
        try FileManager.default.createSymbolicLink(atPath: root.appendingPathComponent("planted.partial.wav").path,
                                                   withDestinationPath: outside.appendingPathComponent("victim.wav").path)
        let (session, _) = makeSession(root: root)
        XCTAssertThrowsError(try session.prepare(source: FakeSource(), takeName: "planted")) {
            XCTAssertEqual(($0 as? CaptureError)?.code, .nameExists)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: outside.appendingPathComponent("victim.wav").path))

        // Existing takes are never overwritten, even by a direct writer.
        try Data("keep".utf8).write(to: root.appendingPathComponent("kept.partial.wav"))
        let paths = try StorageGuard.paths(root: root, name: "kept")
        let format = try CaptureFormat(sampleRate: 48_000, channels: 2)
        XCTAssertThrowsError(try TakeWriter(
            paths: paths,
            header: .init(format: format, description: "d", originatorReference: "r", originationDate: Date(), codingHistory: "x"),
            journal: TakeJournal(takeId: "k", name: "kept", state: .recording, sampleRate: 48_000, channels: 2, dataOffset: 0,
                                 source: SourceDescriptor(kind: .test, id: "t", name: "t"), member: MemberFields(),
                                 startedAt: Date(), helperVersion: "t", finalDataBytes: nil, markers: [], clipSamples: 0))) {
            XCTAssertEqual(($0 as? CaptureError)?.code, .nameExists)
        }
        XCTAssertEqual(try String(contentsOf: root.appendingPathComponent("kept.partial.wav"), encoding: .utf8), "keep")

        // A symlinked root resolves to its real directory; a file is not a root.
        let link = outside.appendingPathComponent("rootlink")
        try FileManager.default.createSymbolicLink(atPath: link.path, withDestinationPath: root.path)
        XCTAssertEqual(try StorageGuard.resolveRoot(link).path, root.path)
        XCTAssertThrowsError(try StorageGuard.resolveRoot(root.appendingPathComponent("kept.partial.wav"))) {
            XCTAssertEqual(($0 as? CaptureError)?.code, .rootInvalid)
        }
    }
}
