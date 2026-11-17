import XCTest
import SoullabCaptureCore
import SoullabCaptureTestSupport

/// Runs the DEBUG helper binary in synthetic mode. No OS capture, no permission prompt.
final class HelperProcessTests: XCTestCase {
    private func waitRecording(_ h: HelperHarness, _ events: [[String: Any]]) -> Bool {
        let isRecording: ([String: Any]) -> Bool = { $0["event"] as? String == "state" && $0["state"] as? String == "recording" }
        return events.contains(where: isRecording) || h.waitForEvent(5, isRecording) != nil
    }

    // T5 — SIGKILL at random points, 50 times: every take is recovered, exact, and nothing is deleted.
    func testT5CrashRecoveryUnderSIGKILL() throws {
        var rng = SystemRandomNumberGenerator()
        for i in 0..<50 {
            let h = try HelperHarness()
            XCTAssertEqual(try h.hello()["ok"] as? Bool, true)
            let channels = i % 2 + 1
            var events: [[String: Any]] = []
            let prepared = try h.request("prepare", ["sourceId": "synthetic:ramp", "channels": channels,
                                                     "sampleRate": 48000, "takeName": "kill\(i)"], events: &events)
            XCTAssertEqual(prepared["ok"] as? Bool, true)
            try h.request("start", events: &events)
            XCTAssertTrue(waitRecording(h, events), "iteration \(i) reached recording")
            let began = Date()
            Thread.sleep(forTimeInterval: Double.random(in: 0.05...0.9, using: &rng))
            let elapsed = Date().timeIntervalSince(began)
            h.kill9()

            let partial = h.root.appendingPathComponent("kill\(i).partial.wav")
            XCTAssertTrue(FileManager.default.fileExists(atPath: partial.path), "iteration \(i) left a partial take")
            let report = TakeRecovery.recover(root: h.root, helperVersion: "test")
            XCTAssertEqual(report.quarantined, [], "iteration \(i)")
            let take = try XCTUnwrap(report.recovered.first, "iteration \(i)")
            let wav = try TestWAVReader(url: URL(fileURLWithPath: take.path))
            XCTAssertTrue(wav.riffSizeMatchesFile, "iteration \(i)")
            XCTAssertEqual(wav.channels, channels)
            let frames = wav.frames
            let floor = Int((elapsed - 1.0) * 48_000) - 32_768
            XCTAssertGreaterThanOrEqual(frames, max(0, floor), "iteration \(i): lost at most ~1 s + one chunk")
            let expected = (0..<frames).flatMap { f in (0..<channels).map { TestSignal.ramp(frame: Int64(f), channel: $0) } }
            XCTAssertEqual(wav.samples, expected, "iteration \(i): recovered audio is an exact prefix")
            let leftover = try FileManager.default.contentsOfDirectory(atPath: h.root.path).sorted()
            XCTAssertEqual(leftover, ["kill\(i).provenance.json", "kill\(i).wav"], "iteration \(i)")
        }
    }

    // T14 — protocol enforcement on the helper side.
    func testT14WrongTokenAndProtocolAreRefused() throws {
        let a = try HelperHarness()
        let refused = try a.hello(token: String(repeating: "z", count: 128))
        XCTAssertEqual((refused["error"] as? [String: Any])?["code"] as? String, "AUTH_FAILED")
        XCTAssertEqual(a.waitForExit(), 2)

        let b = try HelperHarness()
        let drift = try b.hello(protocolVersion: 2)
        XCTAssertEqual((drift["error"] as? [String: Any])?["code"] as? String, "AUTH_FAILED")
        XCTAssertEqual(b.waitForExit(), 2)
    }

    func testT14UnknownRequestMalformedAndOversize() throws {
        let h = try HelperHarness()
        let hello = try h.hello()
        let result = try XCTUnwrap(hello["result"] as? [String: Any])
        XCTAssertEqual(result["build"] as? String, "debug")
        XCTAssertEqual(result["mode"] as? String, "synthetic")
        var events: [[String: Any]] = []
        let unknown = try h.request("startEverything", events: &events)
        XCTAssertEqual((unknown["error"] as? [String: Any])?["code"] as? String, "INVALID_REQUEST")
        let tap = try h.request("prepare", ["sourceId": "pid:1", "takeName": "x"], events: &events)
        XCTAssertEqual((tap["error"] as? [String: Any])?["code"] as? String, "SOURCE_NOT_FOUND",
                       "the synthetic helper exposes no real processes")
        h.sendRaw("{not json")
        XCTAssertEqual(h.waitForExit(), 65)

        let o = try HelperHarness()
        _ = try o.hello()
        o.sendRaw(String(repeating: "a", count: CapturePolicy.maxMessageBytes + 100))
        XCTAssertEqual(o.waitForExit(), 65)
    }

    func testRecoveryReportedAtHello() throws {
        // A torn take from an earlier run is recovered before the host connects.
        let first = try HelperHarness()
        _ = try first.hello()
        var events: [[String: Any]] = []
        try first.request("prepare", ["sourceId": "synthetic:sine1k", "sampleRate": 48000, "takeName": "earlier"], events: &events)
        try first.request("start", events: &events)
        XCTAssertTrue(waitRecording(first, events))
        Thread.sleep(forTimeInterval: 0.3)
        first.kill9()

        let second = try HelperHarness(root: first.root)
        let hello = try second.hello()
        let report = try XCTUnwrap((hello["result"] as? [String: Any])?["recovery"] as? [String: Any])
        let recovered = try XCTUnwrap(report["recovered"] as? [[String: Any]])
        XCTAssertEqual(recovered.count, 1)
        XCTAssertEqual(recovered.first?["recovered"] as? Bool, true)
        XCTAssertTrue(FileManager.default.fileExists(atPath: first.root.appendingPathComponent("earlier.wav").path))
    }

    func testSIGTERMFinalizesTheTake() throws {
        let h = try HelperHarness()
        _ = try h.hello()
        var events: [[String: Any]] = []
        try h.request("prepare", ["sourceId": "synthetic:silence", "channels": 1, "sampleRate": 96000, "takeName": "term"], events: &events)
        try h.request("start", events: &events)
        XCTAssertTrue(waitRecording(h, events))
        Thread.sleep(forTimeInterval: 0.2)
        h.process.terminate()
        XCTAssertEqual(h.waitForExit(), 0)
        let record = try ProvenanceRecord.read(from: h.root.appendingPathComponent("term.provenance.json"))
        XCTAssertEqual(record.stopReason, .terminated)
        XCTAssertEqual(record.format.sampleRate, 96_000)
        XCTAssertFalse(record.recovered)
    }
}
