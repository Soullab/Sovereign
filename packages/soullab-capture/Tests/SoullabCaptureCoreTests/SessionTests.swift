import AVFAudio
import CryptoKit
import XCTest
@testable import SoullabCaptureCore
import SoullabCaptureTestSupport

func makeSession(root: URL, probe: FakeProbe = FakeProbe(), maxDataBytes: Int64? = nil) -> (CaptureSession, EventLog) {
    let log = EventLog()
    let session = CaptureSession(
        config: SessionConfig(root: root, probe: probe, helperVersion: "test", maxDataBytes: maxDataBytes,
                              automaticDrain: false),
        events: log.handler)
    return (session, log)
}

func startRecording(_ session: CaptureSession, _ source: AudioSource, name: String = "take",
                    member: MemberFields = MemberFields()) throws {
    try session.prepare(source: source, takeName: name, member: member)
    try session.start()
    XCTAssertTrue(eventually { session.status().state == .recording }, "session reaches recording")
}

func rampSamples(frames: Int, channels: Int, from start: Int64 = 0) -> [Int32] {
    var out: [Int32] = []
    out.reserveCapacity(frames * channels)
    for f in 0..<frames {
        for c in 0..<channels { out.append(TestSignal.ramp(frame: start + Int64(f), channel: c)) }
    }
    return out
}

final class SessionTests: XCTestCase {
    // T1 — every supported rate × mono/stereo, read back by an independent parser and AVAudioFile.
    func testT1FormatMatrix() throws {
        for rate in CaptureFormat.supportedSampleRates {
            for channels in 1...2 {
                let root = makeTempDirectory()
                let (session, _) = makeSession(root: root)
                let source = FakeSource(sampleRate: rate, channels: channels)
                try startRecording(session, source)
                let frames = Int(rate / 20) + 37
                source.pushRamp(frames: frames)
                session.drainForTesting()
                let take = try XCTUnwrap(session.stop())
                XCTAssertEqual(take.frames, Int64(frames))

                let url = URL(fileURLWithPath: take.path)
                let wav = try TestWAVReader(url: url)
                XCTAssertTrue(wav.riffSizeMatchesFile, "RIFF size \(rate)/\(channels)")
                XCTAssertEqual(wav.formatTag, 0xFFFE)
                XCTAssertEqual(wav.channels, channels)
                XCTAssertEqual(wav.sampleRate, Int(rate))
                XCTAssertEqual(wav.bitsPerSample, 24)
                XCTAssertEqual(wav.frames, frames)
                XCTAssertEqual(wav.samples, rampSamples(frames: frames, channels: channels), "samples \(rate)/\(channels)")

                let file = try AVAudioFile(forReading: url)
                XCTAssertEqual(file.length, AVAudioFramePosition(frames))
                XCTAssertEqual(file.fileFormat.sampleRate, rate)
                XCTAssertEqual(Int(file.fileFormat.channelCount), channels)
            }
        }
    }

    // T4 — the size limit stops and finalizes cleanly (RF64 is deferred to C2).
    func testT4SizeLimitStopsAndFinalizes() throws {
        let root = makeTempDirectory()
        let oneSecond = Int64(48_000 * 6)
        let (session, log) = makeSession(root: root, maxDataBytes: oneSecond)
        let source = FakeSource()
        try startRecording(session, source)
        source.pushRamp(frames: 72_000)
        session.drainForTesting()
        XCTAssertTrue(eventually { !log.finalized.isEmpty })
        let take = try XCTUnwrap(log.finalized.first)
        XCTAssertEqual(take.stopReason, .sizeLimit)
        XCTAssertEqual(take.frames, 48_000)
        XCTAssertEqual(session.status().state, .idle)
        XCTAssertEqual(try TestWAVReader(url: URL(fileURLWithPath: take.path)).samples, rampSamples(frames: 48_000, channels: 2))
    }

    func testT4LayoutLimitFitsRIFF() throws {
        for rate in CaptureFormat.supportedSampleRates {
            for channels in 1...2 {
                let format = try CaptureFormat(sampleRate: rate, channels: channels)
                let header = WAVLayout.header(.init(format: format, description: "x", originatorReference: "x",
                                                    originationDate: Date(), codingHistory: "x"))
                let max = WAVLayout.maxDataBytes(for: format, headerBytes: header.bytes.count)
                XCTAssertEqual(max % Int64(format.blockAlign), 0)
                let worstFile = Int64(header.bytes.count) + max + 1 + WAVLayout.trailingReserveBytes
                XCTAssertLessThanOrEqual(worstFile - 8, Int64(UInt32.max))
                XCTAssertGreaterThan(max, Int64(3_900_000_000))
            }
        }
    }

    // T7 — a stalled writer drops whole blocks; the loss is counted and marked in the file.
    func testT7RingOverrunIsCountedAndMarked() throws {
        let root = makeTempDirectory()
        let (session, _) = makeSession(root: root)
        let source = FakeSource()
        try startRecording(session, source)
        source.pushRamp(frames: 48_000 * 7) // more than the ring holds, with no drain
        let sink = try XCTUnwrap(source.sink)
        XCTAssertGreaterThan(sink.overrunFrames.value, 0)
        let accepted = sink.framesAccepted.value
        session.drainForTesting()
        let take = try XCTUnwrap(session.stop())
        XCTAssertEqual(take.frames, accepted)

        let record = try ProvenanceRecord.read(from: URL(fileURLWithPath: take.provenancePath))
        let overruns = record.discontinuities.filter { $0.kind == .overrun }
        XCTAssertEqual(overruns.count, 1, "consecutive dropped blocks merge into one marker")
        XCTAssertEqual(overruns[0].framePosition, accepted)
        XCTAssertEqual(overruns[0].lostFrames, sink.overrunFrames.value)

        let wav = try TestWAVReader(url: URL(fileURLWithPath: take.path))
        XCTAssertEqual(wav.cuePositions, [Int(accepted)])
        XCTAssertTrue(wav.labels[0].contains("overrun"))
        XCTAssertTrue(wav.riffSizeMatchesFile)
    }

    // T8 — a jump in the source's sample clock is marked, not hidden.
    func testT8TimestampGapIsMarked() throws {
        let root = makeTempDirectory()
        let (session, log) = makeSession(root: root)
        let source = FakeSource()
        try startRecording(session, source)
        source.pushRamp(frames: 1000, sampleTime: 0)
        source.pushRamp(frames: 1000, sampleTime: 1500)
        session.drainForTesting()
        let take = try XCTUnwrap(session.stop())
        let record = try ProvenanceRecord.read(from: URL(fileURLWithPath: take.provenancePath))
        XCTAssertEqual(record.discontinuities, [Discontinuity(kind: .timestampGap, framePosition: 1000, lostFrames: 500)])
        XCTAssertTrue(log.all.contains { if case .discontinuity = $0 { return true } else { return false } })
        XCTAssertEqual(take.frames, 2000, "no silence is inserted")
    }

    // T9 — the source ending finalizes the take and nothing restarts.
    func testT9SourceEndFinalizesWithoutRestart() throws {
        for reason in [StopReason.sourceExited, .deviceChanged, .formatChanged, .sourceFailed] {
            let root = makeTempDirectory()
            let (session, log) = makeSession(root: root)
            let source = FakeSource()
            try startRecording(session, source)
            source.pushRamp(frames: 4800)
            source.end(reason)
            XCTAssertTrue(eventually { log.finalized.count == 1 })
            XCTAssertEqual(log.finalized[0].stopReason, reason)
            XCTAssertEqual(log.finalized[0].frames, 4800)
            Thread.sleep(forTimeInterval: 0.2)
            XCTAssertEqual(source.startCount.get(), 1, "no auto-resume after \(reason)")
            XCTAssertEqual(session.status().state, .idle)
        }
    }

    // T10 — storage guard: refuse to start, warn when low, stop when critical.
    func testT10StorageGuard() throws {
        let root = makeTempDirectory()
        let probe = FakeProbe(1024 * 1024 * 1024)
        let (session, log) = makeSession(root: root, probe: probe)
        XCTAssertThrowsError(try session.prepare(source: FakeSource(), takeName: "low")) {
            XCTAssertEqual(($0 as? CaptureError)?.code, .insufficientStorage)
        }
        probe.set(500 * 1024 * 1024 * 1024)
        let source = FakeSource()
        try startRecording(session, source)
        source.pushRamp(frames: 4800)
        probe.set(900 * 1024 * 1024)
        session.drainForTesting()
        XCTAssertEqual(log.storageLow, [Int64(900 * 1024 * 1024)])
        source.pushRamp(frames: 4800)
        probe.set(100 * 1024 * 1024)
        session.drainForTesting()
        XCTAssertTrue(eventually { log.finalized.count == 1 })
        XCTAssertEqual(log.finalized[0].stopReason, .storageCritical)
        XCTAssertEqual(log.finalized[0].frames, 9600)
    }

    // T12 — explicit start only; a denial leaves nothing behind; no auto-resume.
    func testT12PolicyExplicitStartOnly() throws {
        let root = makeTempDirectory()
        let (session, log) = makeSession(root: root)
        XCTAssertThrowsError(try session.start()) { XCTAssertEqual(($0 as? CaptureError)?.code, .invalidState) }

        let source = FakeSource()
        try session.prepare(source: source, takeName: "t")
        XCTAssertEqual(source.startCount.get(), 0, "prepare never starts a source")
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), [], "prepare creates no file")
        Thread.sleep(forTimeInterval: 0.1)
        XCTAssertEqual(session.status().state, .prepared)

        let denied = FakeSource(mode: .fail(CaptureError(.permissionDenied)))
        try session.prepare(source: denied, takeName: "denied")
        try session.start()
        XCTAssertTrue(eventually { log.errors.contains(.permissionDenied) })
        XCTAssertTrue(eventually { session.status().state == .prepared })
        XCTAssertGreaterThanOrEqual(denied.stopCount.get(), 1, "a failed start is cleaned up")
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), [], "a denial writes no file")
        Thread.sleep(forTimeInterval: 0.2)
        XCTAssertEqual(denied.startCount.get(), 1, "no retry after denial")
    }

    // T13 — provenance: hash matches the bytes on disk; nothing is inferred.
    func testT13Provenance() throws {
        let root = makeTempDirectory()
        let (session, _) = makeSession(root: root)
        let source = FakeSource()
        try startRecording(session, source, name: "plain")
        source.pushRamp(frames: 2400)
        session.drainForTesting()
        let take = try XCTUnwrap(session.stop())
        let record = try ProvenanceRecord.read(from: URL(fileURLWithPath: take.provenancePath))
        let digest = SHA256.hash(data: try Data(contentsOf: URL(fileURLWithPath: take.path)))
        XCTAssertEqual(record.sha256, digest.map { String(format: "%02x", $0) }.joined())
        XCTAssertEqual(record.schema, "soullab.capture.provenance.v1")
        XCTAssertEqual(record.member, MemberFields())
        XCTAssertEqual(record.rights.soullabClaim, "none")
        XCTAssertEqual(record.rights.attestation, "none")
        XCTAssertEqual(record.upstreamConversion, "unknown")
        XCTAssertEqual(record.format.encoding, "pcm_s24le")
        XCTAssertFalse(record.recovered)
        XCTAssertNotNil(record.endedAt)
        XCTAssertFalse(FileManager.default.fileExists(atPath: root.appendingPathComponent("plain.journal.json").path))

        let (session2, _) = makeSession(root: root)
        let source2 = FakeSource()
        try startRecording(session2, source2, name: "noted",
                           member: MemberFields(performer: "A singer", rightsNote: "own recording"))
        source2.pushRamp(frames: 10)
        session2.drainForTesting()
        let take2 = try XCTUnwrap(session2.stop())
        let record2 = try ProvenanceRecord.read(from: URL(fileURLWithPath: take2.provenancePath))
        XCTAssertEqual(record2.rights.attestation, "member-asserted")
        XCTAssertEqual(record2.member.performer, "A singer")
        XCTAssertNil(record2.member.location)

        XCTAssertThrowsError(try session2.prepare(source: FakeSource(), takeName: "x",
                                                  member: MemberFields(notes: String(repeating: "n", count: 2000))))
    }

    // T19 — a late start result for a cancelled start is discarded and cleaned up.
    func testT19GenerationDiscipline() throws {
        let root = makeTempDirectory()
        let (session, _) = makeSession(root: root)
        let source = FakeSource(mode: .deferred)
        try session.prepare(source: source, takeName: "late")
        try session.start()
        XCTAssertEqual(session.status().state, .starting)
        XCTAssertThrowsError(try session.start()) { XCTAssertEqual(($0 as? CaptureError)?.code, .alreadyStarting) }
        XCTAssertNil(session.stop())
        XCTAssertEqual(session.status().state, .prepared)
        let stopsAfterCancel = source.stopCount.get()
        XCTAssertGreaterThanOrEqual(stopsAfterCancel, 1)

        source.completeDeferredStart() // the OS answers late
        XCTAssertTrue(eventually { source.stopCount.get() > stopsAfterCancel }, "late result is cleaned up")
        Thread.sleep(forTimeInterval: 0.1)
        XCTAssertEqual(session.status().state, .prepared, "a stale result never starts recording")
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), [])
    }

    func testMetersReportSineLevels() throws {
        let meter = LevelMeter(channels: 1, sampleRate: 48_000)
        var samples = (0..<48_000).map { Float(0.5 * sin(2 * Double.pi * 1000 * Double($0) / 48_000)) }
        samples.withUnsafeMutableBufferPointer { meter.process($0.baseAddress!, frames: 48_000) }
        let snap = meter.snapshot()
        XCTAssertEqual(snap.peak[0], 0.5, accuracy: 0.001)
        XCTAssertEqual(snap.rms[0], 0.5 / 2.0.squareRoot(), accuracy: 0.005)
        XCTAssertEqual(snap.truePeak[0], 0.5, accuracy: 0.02)
        XCTAssertEqual(snap.clipSamples, 0)
    }
}
