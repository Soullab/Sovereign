import Darwin
import XCTest
@testable import SoullabCaptureCore
import SoullabCaptureTestSupport

private let packageRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

private func sources(in directory: String) throws -> [(String, String)] {
    let dir = packageRoot.appendingPathComponent(directory)
    let names = try FileManager.default.subpathsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".swift") }
    return try names.map { ($0, try String(contentsOf: dir.appendingPathComponent($0), encoding: .utf8)) }
}

/// Removes `//` comments so prose such as "never connects" does not trip the scans.
private func code(_ text: String) -> String {
    text.split(separator: "\n", omittingEmptySubsequences: false).map { line -> Substring in
        if let r = line.range(of: "//") { return line[line.startIndex..<r.lowerBound] }
        return line
    }.joined(separator: "\n")
}

/// The body of the first function whose signature contains `signature`, by brace matching.
private func functionBody(_ text: String, _ signature: String) -> String? {
    guard let start = text.range(of: signature), let open = text[start.upperBound...].firstIndex(of: "{") else { return nil }
    var depth = 0
    var i = open
    while i < text.endIndex {
        if text[i] == "{" { depth += 1 }
        if text[i] == "}" { depth -= 1; if depth == 0 { return String(text[open...i]) } }
        i = text.index(after: i)
    }
    return nil
}

final class HygieneTests: XCTestCase {
    // T15 (source half) — no networking API anywhere in the core or the helper.
    // The binary half (otool/nm on the release helper) is Scripts/verify-no-network.sh.
    func testT15NoNetworkingInSources() throws {
        let forbidden = ["URLSession", "NWConnection", "NWListener", "NWEndpoint", "import Network", "CFNetwork", "CFSocket",
                         "CFStream", "AF_INET", "getaddrinfo", "gethostbyname", "connect(", "sendto(", "http://", "https://",
                         "URLRequest", "NSURLConnection", "WKWebView"]
        var findings: [String] = []
        for directory in ["Sources/SoullabCaptureCore", "Sources/soullab-capture-helper"] {
            for (name, text) in try sources(in: directory) {
                let body = code(text)
                for token in forbidden where body.contains(token) {
                    findings.append("\(directory)/\(name): \(token)")
                }
            }
        }
        XCTAssertEqual(findings, [])
    }

    // T16 — the realtime path does not allocate, lock, log or do I/O.
    func testT16RealtimePathDoesNotAllocate() throws {
        XCTAssertTrue(AtomicCounter.isLockFree)
        let sink = RealtimeSink(format: try CaptureFormat(sampleRate: 48_000, channels: 2))
        let block = 256
        let input = UnsafeMutablePointer<Float>.allocate(capacity: block * 2)
        input.initialize(repeating: 0.25, count: block * 2)
        let output = UnsafeMutablePointer<Float>.allocate(capacity: block * 2)
        defer { input.deallocate(); output.deallocate() }
        for i in 0..<16 {
            sink.push(input, frames: block, sampleTime: Double(i * block))
            _ = sink.ring.read(into: output, maxCount: block * 2)
        }

        func blocksInUse() -> Int {
            var stats = malloc_statistics_t()
            malloc_zone_statistics(nil, &stats)
            return Int(stats.blocks_in_use)
        }
        let before = blocksInUse()
        for i in 16..<20_016 {
            sink.push(input, frames: block, sampleTime: Double(i * block))
            _ = sink.ring.read(into: output, maxCount: block * 2)
        }
        let after = blocksInUse()
        XCTAssertLessThan(after - before, 50, "20 000 realtime pushes allocate nothing (allowing unrelated threads a little noise)")
        XCTAssertEqual(sink.overrunFrames.value, 0)
    }

    func testT16RealtimeSourcesAvoidBlockingCalls() throws {
        let forbidden = ["lock(", "NSLock", "DispatchQueue", "DispatchSemaphore", "print(", "NSLog", "os_log", "Logger",
                         ".append(", "Array(", "[Float](", "String(", "try ", "await ", "malloc(", "allocate(", "FileHandle", "write(fd"]
        let engine = packageRoot.appendingPathComponent("Sources/SoullabCaptureCore/Engine")
        let ring = try String(contentsOf: engine.appendingPathComponent("RingBuffer.swift"), encoding: .utf8)
        let detector = try String(contentsOf: engine.appendingPathComponent("DiscontinuityDetector.swift"), encoding: .utf8)
        let tap = try String(contentsOf: engine.appendingPathComponent("ProcessTapSource.swift"), encoding: .utf8)
        let bodies: [(String, String?)] = [
            ("RingBuffer.write", functionBody(code(ring), "public func write(")),
            ("AtomicCounter.add", functionBody(code(ring), "public func add(")),
            ("MarkerQueue.push", functionBody(code(detector), "public func push(kind:")),
            ("RealtimeSink.push", functionBody(code(detector), "public func push(_ interleaved")),
            ("ProcessTapSource.render", functionBody(code(tap), "private func render(")),
        ]
        for (name, body) in bodies {
            let text = try XCTUnwrap(body, "found \(name)")
            for token in forbidden {
                XCTAssertFalse(text.contains(token), "\(name) contains \(token)")
            }
        }
        XCTAssertTrue(tap.contains("unowned(unsafe) var realtimeSink"), "render reads the sink without reference counting")
    }

    // T20 — the helper bundle carries none of MAIA Desktop's broad entitlements.
    func testT20HelperBundleFiles() throws {
        let bundle = packageRoot.appendingPathComponent("HelperBundle")
        let entitlements = try XCTUnwrap(PropertyListSerialization.propertyList(
            from: Data(contentsOf: bundle.appendingPathComponent("Helper.entitlements")), format: nil) as? [String: Any])
        for key in ["com.apple.security.network.client", "com.apple.security.network.server",
                    "com.apple.security.cs.allow-jit", "com.apple.security.cs.allow-unsigned-executable-memory",
                    "com.apple.security.cs.disable-library-validation", "com.apple.security.device.audio-input",
                    "com.apple.security.device.camera"] {
            XCTAssertNil(entitlements[key], "helper must not hold \(key)")
        }
        XCTAssertTrue(entitlements.isEmpty, "C1 needs no entitlement beyond the hardened runtime")

        let info = try XCTUnwrap(PropertyListSerialization.propertyList(
            from: Data(contentsOf: bundle.appendingPathComponent("Info.plist")), format: nil) as? [String: Any])
        XCTAssertEqual(info["LSUIElement"] as? Bool, true)
        XCTAssertEqual(info["CFBundleIdentifier"] as? String, "life.soullab.maia.desktop.capture")
        XCTAssertEqual(info["LSMinimumSystemVersion"] as? String, "14.2")
        let usage = try XCTUnwrap(info["NSAudioCaptureUsageDescription"] as? String)
        XCTAssertFalse(usage.isEmpty)
        XCTAssertNil(info["NSMicrophoneUsageDescription"], "C1 does not use the microphone")
    }

    func testPolicyConstants() {
        XCTAssertEqual(CapturePolicy.protocolVersion, 1)
        XCTAssertEqual(CapturePolicy.objectPrefix, "life.soullab.capture.")
        XCTAssertEqual(CapturePolicy.rightsClaim, "none")
        XCTAssertEqual(CaptureErrorCode.allCases.count, 17)
    }
}
