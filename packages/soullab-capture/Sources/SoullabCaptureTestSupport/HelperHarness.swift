import Darwin
import Foundation

/// Launches the DEBUG helper in synthetic mode and talks to it over its control socket.
/// Test-only: this file is the only place in the package that calls `connect`.
public final class HelperHarness {
    public let directory: URL
    public let root: URL
    public let socketPath: String
    public let token: String
    public let process: Process
    private var fd: Int32 = -1
    private var buffer = Data()
    private var nextID = 1

    public static func helperURL() -> URL {
        if let env = ProcessInfo.processInfo.environment["SOULLAB_CAPTURE_HELPER"] {
            return URL(fileURLWithPath: env)
        }
        // .build/<triple>/debug/SoullabCapturePackageTests.xctest → sibling helper binary.
        for bundle in Bundle.allBundles where bundle.bundleURL.pathExtension == "xctest" {
            let candidate = bundle.bundleURL.deletingLastPathComponent().appendingPathComponent("soullab-capture-helper")
            if FileManager.default.isExecutableFile(atPath: candidate.path) { return candidate }
        }
        return URL(fileURLWithPath: ".build/debug/soullab-capture-helper")
    }

    public init(root existingRoot: URL? = nil, token presented: String? = nil) throws {
        directory = URL(fileURLWithPath: "/tmp", isDirectory: true).appendingPathComponent("slc-h-\(UUID().uuidString.prefix(8))")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        chmod(directory.path, 0o700)
        if let existingRoot {
            root = existingRoot
        } else {
            root = directory.appendingPathComponent("takes")
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        }
        token = (0..<4).map { _ in UUID().uuidString.replacingOccurrences(of: "-", with: "") }.joined()
        let tokenURL = directory.appendingPathComponent("token")
        FileManager.default.createFile(atPath: tokenURL.path, contents: Data(token.utf8), attributes: [.posixPermissions: 0o600])
        socketPath = directory.appendingPathComponent("c.sock").path

        process = Process()
        process.executableURL = Self.helperURL()
        process.arguments = ["--root", root.path, "--socket", socketPath, "--token-file", tokenURL.path, "--synthetic"]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()

        let deadline = Date().addingTimeInterval(5)
        while !FileManager.default.fileExists(atPath: socketPath) {
            if Date() > deadline { throw NSError(domain: "HelperHarness", code: 1) }
            Thread.sleep(forTimeInterval: 0.005)
        }
        try connectSocket()
    }

    private func connectSocket() throws {
        fd = socket(AF_UNIX, SOCK_STREAM, 0)
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let bytes = Array(socketPath.utf8)
        withUnsafeMutableBytes(of: &addr.sun_path) { raw in
            raw.copyBytes(from: bytes)
            raw[bytes.count] = 0
        }
        let result = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard result == 0 else { throw NSError(domain: "HelperHarness", code: 2) }
        var tv = timeval(tv_sec: 10, tv_usec: 0)
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, socklen_t(MemoryLayout<timeval>.size))
    }

    public func sendRaw(_ line: String) {
        let data = Array((line + "\n").utf8)
        _ = data.withUnsafeBytes { write(fd, $0.baseAddress, $0.count) }
    }

    /// Sends a request and returns its response, collecting events seen meanwhile.
    @discardableResult
    public func request(_ type: String, _ body: [String: Any] = [:], events: inout [[String: Any]]) throws -> [String: Any] {
        let id = nextID
        nextID += 1
        var message = body
        message["id"] = id
        message["type"] = type
        let data = try JSONSerialization.data(withJSONObject: message)
        sendRaw(String(decoding: data, as: UTF8.self))
        while true {
            guard let msg = readMessage() else { throw NSError(domain: "HelperHarness", code: 3) }
            if msg["id"] as? Int == id { return msg }
            if msg["event"] != nil { events.append(msg) }
        }
    }

    public func hello(token override: String? = nil, protocolVersion: Int = 1) throws -> [String: Any] {
        var ignored: [[String: Any]] = []
        return try request("hello", ["protocol": protocolVersion, "token": override ?? token], events: &ignored)
    }

    /// Reads messages until an event matching `predicate` arrives or the timeout passes.
    public func waitForEvent(_ timeout: TimeInterval = 5, _ predicate: ([String: Any]) -> Bool) -> [String: Any]? {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            guard let msg = readMessage() else { return nil }
            if msg["event"] != nil, predicate(msg) { return msg }
        }
        return nil
    }

    public func readMessage() -> [String: Any]? {
        while true {
            if let nl = buffer.firstIndex(of: 0x0A) {
                let line = buffer[buffer.startIndex..<nl]
                buffer.removeSubrange(buffer.startIndex...nl)
                return (try? JSONSerialization.jsonObject(with: Data(line))) as? [String: Any]
            }
            var chunk = [UInt8](repeating: 0, count: 8192)
            let n = read(fd, &chunk, chunk.count)
            if n <= 0 { return nil }
            buffer.append(contentsOf: chunk[0..<n])
        }
    }

    public func closeSocket() {
        if fd >= 0 { close(fd); fd = -1 }
    }

    public func kill9() {
        Darwin.kill(process.processIdentifier, SIGKILL)
        process.waitUntilExit()
        closeSocket()
    }

    public func waitForExit(_ timeout: TimeInterval = 10) -> Int32? {
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning && Date() < deadline { Thread.sleep(forTimeInterval: 0.01) }
        return process.isRunning ? nil : process.terminationStatus
    }

    deinit {
        if process.isRunning { Darwin.kill(process.processIdentifier, SIGKILL) }
        closeSocket()
    }
}
