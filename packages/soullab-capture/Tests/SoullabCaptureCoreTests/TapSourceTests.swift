import XCTest
@testable import SoullabCaptureCore
import SoullabCaptureTestSupport

/// ProcessTapSource against a fake provider. No real tap is ever created in J2.
final class TapSourceTests: XCTestCase {
    private func tapSource(_ provider: FakeTapProvider, channels: Int = 2) -> ProcessTapSource {
        ProcessTapSource(provider: provider,
                         descriptor: SourceDescriptor(kind: .processTap, id: "pid:4242", name: "Test App",
                                                      bundleID: "com.example.test", pid: 4242),
                         pid: 4242, channels: channels)
    }

    private let creation = ["translatePID", "createTap", "tapFormat", "createAggregate", "createIOProc", "addListener", "startIO"]
    private let cleanup = ["removeListener", "stopIO", "destroyIOProc", "destroyAggregate:30", "destroyTap:20"]

    // T18 — every stop path releases listener → IO → IO proc → aggregate → tap, in that order.
    func testT18StopCleansUpInOrderAndInterleavesNonInterleavedBuffers() throws {
        let root = makeTempDirectory()
        let (session, _) = makeSession(root: root)
        let provider = FakeTapProvider()
        provider.format = SourceFormat(sampleRate: 48_000, channels: 2, interleaved: false)
        let source = tapSource(provider)

        try session.prepare(source: source, takeName: "tap")
        XCTAssertEqual(provider.log.get(), [], "T12: prepare creates no tap")
        try session.start()
        XCTAssertTrue(eventually { session.status().state == .recording })
        XCTAssertEqual(provider.log.get(), creation)

        let frames = 960
        let left = (0..<frames).map { Float(TestSignal.ramp(frame: Int64($0), channel: 0)) / SampleEncoder.scale }
        let right = (0..<frames).map { Float(TestSignal.ramp(frame: Int64($0), channel: 1)) / SampleEncoder.scale }
        provider.deliverNonInterleaved([left, right], sampleTime: 0)
        session.drainForTesting()
        let take = try XCTUnwrap(session.stop())

        XCTAssertEqual(provider.log.get(), creation + cleanup)
        let wav = try TestWAVReader(url: URL(fileURLWithPath: take.path))
        XCTAssertEqual(wav.samples, rampSamples(frames: frames, channels: 2), "planar buffers are interleaved correctly")
        let record = try ProvenanceRecord.read(from: URL(fileURLWithPath: take.provenancePath))
        XCTAssertEqual(record.source.kind, .processTap)
        XCTAssertEqual(record.source.bundleID, "com.example.test")
    }

    func testT18FailedStartCleansUpWhatItCreated() throws {
        for failure in ["createAggregate", "createIOProc", "addListener", "startIO"] {
            let root = makeTempDirectory()
            let (session, log) = makeSession(root: root)
            let provider = FakeTapProvider()
            provider.failAt = failure
            try session.prepare(source: tapSource(provider), takeName: "f")
            try session.start()
            XCTAssertTrue(eventually { log.errors.contains(.tapFailed) || log.errors.contains(.ioFailed) }, failure)
            XCTAssertTrue(eventually { session.status().state == .prepared })
            let calls = provider.log.get()
            XCTAssertEqual(calls.filter { $0.hasPrefix("destroyTap") }.count, 1, "tap released after \(failure)")
            let aggregateCreated = calls.contains("createAggregate") && failure != "createAggregate"
            XCTAssertEqual(calls.filter { $0.hasPrefix("destroyAggregate") }.count, aggregateCreated ? 1 : 0, failure)
            XCTAssertFalse(calls.contains("stopIO"), "IO never ran after \(failure)")
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), [], "no file after \(failure)")
        }
    }

    // T12 — a permission denial at tap creation: obvious error, zero samples, nothing left behind.
    func testT12DenialLeavesNothingBehind() throws {
        let root = makeTempDirectory()
        let (session, log) = makeSession(root: root)
        let provider = FakeTapProvider()
        provider.failAt = "createTap"
        provider.failCode = .permissionDenied
        try session.prepare(source: tapSource(provider), takeName: "denied")
        try session.start()
        XCTAssertTrue(eventually { log.errors == [.permissionDenied] })
        XCTAssertEqual(provider.log.get(), ["translatePID", "createTap"])
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), [])
        Thread.sleep(forTimeInterval: 0.2)
        XCTAssertEqual(provider.log.get().filter { $0 == "createTap" }.count, 1, "no retry")
    }

    // T9 — the tapped app exits / the output device changes: finalize, clean up, no restart.
    func testT9TapSourceEndedFinalizes() throws {
        for reason in [StopReason.sourceExited, .deviceChanged, .formatChanged] {
            let root = makeTempDirectory()
            let (session, log) = makeSession(root: root)
            let provider = FakeTapProvider()
            provider.format = SourceFormat(sampleRate: 48_000, channels: 2, interleaved: false)
            try session.prepare(source: tapSource(provider), takeName: "e")
            try session.start()
            XCTAssertTrue(eventually { session.status().state == .recording })
            provider.deliverNonInterleaved([[Float](repeating: 0.25, count: 480), [Float](repeating: -0.25, count: 480)], sampleTime: 0)
            provider.fireEnded(reason)
            XCTAssertTrue(eventually { log.finalized.count == 1 })
            XCTAssertEqual(log.finalized[0].stopReason, reason)
            XCTAssertEqual(log.finalized[0].frames, 480)
            XCTAssertEqual(Array(provider.log.get().suffix(cleanup.count)), cleanup)
            Thread.sleep(forTimeInterval: 0.2)
            XCTAssertEqual(provider.log.get().filter { $0 == "createTap" }.count, 1, "no restart after \(reason)")
        }
    }

    func testProcessorOverloadIsMarked() throws {
        let root = makeTempDirectory()
        let (session, _) = makeSession(root: root)
        let provider = FakeTapProvider()
        provider.format = SourceFormat(sampleRate: 48_000, channels: 2, interleaved: false)
        try session.prepare(source: tapSource(provider), takeName: "o")
        try session.start()
        XCTAssertTrue(eventually { session.status().state == .recording })
        provider.deliverNonInterleaved([[Float](repeating: 0, count: 480), [Float](repeating: 0, count: 480)], sampleTime: 0)
        provider.fireOverload()
        session.drainForTesting()
        let take = try XCTUnwrap(session.stop())
        let record = try ProvenanceRecord.read(from: URL(fileURLWithPath: take.provenancePath))
        XCTAssertEqual(record.discontinuities, [Discontinuity(kind: .processorOverload, framePosition: 480, lostFrames: 0)])
    }

    // T18 — the orphan sweep removes only Soullab Capture objects, aggregates before taps.
    func testT18OrphanSweepTouchesOnlyOwnObjects() {
        let provider = FakeTapProvider()
        provider.orphans = [
            OrphanObject(kind: .tap, objectID: 6, identifier: "life.soullab.capture.tap.A"),
            OrphanObject(kind: .aggregate, objectID: 5, identifier: "life.soullab.capture.aggregate.A"),
            OrphanObject(kind: .aggregate, objectID: 7, identifier: "com.other.vendor.aggregate"),
            OrphanObject(kind: .tap, objectID: 8, identifier: "life.soullab.maia.not-capture"),
        ]
        let removed = TapCleanup.sweep(provider)
        XCTAssertEqual(removed.map(\.objectID).sorted(), [5, 6])
        XCTAssertEqual(provider.log.get(), ["destroyAggregate:5", "destroyTap:6"])
    }
}
