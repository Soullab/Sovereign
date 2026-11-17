import Foundation
import SoullabCaptureCore

/// Routes control requests to the capture session and forwards session events.
final class HelperServer: @unchecked Sendable {
    let version: String
    let build: String
    let mode: String
    private let token: String
    private let catalog: SourceCatalog
    private let recovery: TakeRecovery.Report
    private let orphansRemoved: Int
    private let connection: Connection
    private var session: CaptureSession!
    private let exitLock = NSLock()
    private var exiting = false

    init(version: String, build: String, mode: String, token: String, root: URL, catalog: SourceCatalog,
         recovery: TakeRecovery.Report, orphansRemoved: Int, connection: Connection) {
        self.version = version
        self.build = build
        self.mode = mode
        self.token = token
        self.catalog = catalog
        self.recovery = recovery
        self.orphansRemoved = orphansRemoved
        self.connection = connection
        session = CaptureSession(config: SessionConfig(root: root, helperVersion: version)) { [weak self] event in
            self?.connection.send(ControlProtocol.event(event))
        }
    }

    /// Serves the connection until it closes. Never returns normally.
    func run() -> Never {
        connection.setReadTimeout(seconds: 10)
        guard authenticate() else { finish(code: 2, reason: nil) }
        connection.setReadTimeout(seconds: 0)

        while true {
            switch connection.readLine() {
            case .closed:
                finish(code: 0, reason: .clientDisconnected)
            case .oversize:
                finish(code: 65, reason: .clientDisconnected)
            case .line(let line):
                guard let request = try? ControlProtocol.parse(line) else {
                    connection.send(["id": -1, "ok": false, "error": ["code": CaptureErrorCode.protocolViolation.rawValue]])
                    finish(code: 65, reason: .clientDisconnected)
                }
                handle(request)
            }
        }
    }

    private func authenticate() -> Bool {
        guard case .line(let line) = connection.readLine(),
              let request = try? ControlProtocol.parse(line) else { return false }
        guard request.type == "hello",
              request.body["protocol"] as? Int == CapturePolicy.protocolVersion,
              let presented = request.body["token"] as? String,
              Self.constantTimeEqual(presented, token)
        else {
            connection.send(ControlProtocol.failure(request.id, .authFailed))
            return false
        }
        connection.send(ControlProtocol.ok(request.id, [
            "protocol": CapturePolicy.protocolVersion,
            "version": version,
            "build": build,
            "mode": mode,
            "recovery": ControlProtocol.json(recovery),
            "orphansRemoved": orphansRemoved,
        ]))
        return true
    }

    private func handle(_ request: ControlProtocol.Request) {
        do {
            switch request.type {
            case "listSources":
                let sources = try catalog.listSources()
                connection.send(ControlProtocol.ok(request.id, ["sources": ControlProtocol.json(sources)]))
            case "prepare":
                try prepare(request)
                connection.send(ControlProtocol.ok(request.id, ["state": "prepared"]))
            case "start":
                try session.start()
                connection.send(ControlProtocol.ok(request.id, ["state": "starting"]))
            case "stop":
                let take = session.stop(reason: .memberStop)
                connection.send(ControlProtocol.ok(request.id, ["take": take.map { ControlProtocol.json($0) } ?? NSNull()]))
            case "status":
                connection.send(ControlProtocol.ok(request.id, ControlProtocol.json(session.status())))
            case "shutdown":
                let take = session.stop(reason: .terminated)
                connection.send(ControlProtocol.ok(request.id, ["take": take.map { ControlProtocol.json($0) } ?? NSNull()]))
                finish(code: 0, reason: nil)
            default:
                connection.send(ControlProtocol.failure(request.id, .invalidRequest))
            }
        } catch let error as CaptureError {
            connection.send(ControlProtocol.failure(request.id, error.code))
        } catch {
            connection.send(ControlProtocol.failure(request.id, .invalidRequest))
        }
    }

    private func prepare(_ request: ControlProtocol.Request) throws {
        let body = request.body
        guard let sourceId = body["sourceId"] as? String,
              let takeName = body["takeName"] as? String else {
            throw CaptureError(.invalidRequest, "sourceId and takeName are required")
        }
        let channels = body["channels"] as? Int ?? 2
        guard CaptureFormat.supportedChannelCounts.contains(channels) else { throw CaptureError(.formatUnsupported) }
        var sampleRate: Double?
        if let rate = body["sampleRate"] {
            guard mode == "synthetic", let r = rate as? Double ?? (rate as? Int).map(Double.init) else {
                throw CaptureError(.invalidRequest, "sampleRate is set by the source")
            }
            sampleRate = r
        }
        var member = MemberFields()
        if let raw = body["member"] {
            guard let dict = raw as? [String: Any] else { throw CaptureError(.invalidRequest, "member") }
            let allowed: Set<String> = ["performer", "consentRef", "rightsNote", "location", "notes"]
            guard Set(dict.keys).isSubset(of: allowed), dict.values.allSatisfy({ $0 is String }) else {
                throw CaptureError(.invalidRequest, "member fields")
            }
            member = MemberFields(performer: dict["performer"] as? String, consentRef: dict["consentRef"] as? String,
                                  rightsNote: dict["rightsNote"] as? String, location: dict["location"] as? String,
                                  notes: dict["notes"] as? String)
        }
        let source = try catalog.makeSource(id: sourceId, channels: channels, sampleRate: sampleRate)
        try session.prepare(source: source, takeName: takeName, member: member)
    }

    /// System sleep: finalize the take. Nothing restarts on wake.
    func stopForSleep() {
        _ = session.stop(reason: .sleep)
    }

    /// Stops and finalizes any take, then exits. Safe to call from any thread, once.
    func finish(code: Int32, reason: StopReason?) -> Never {
        exitLock.lock()
        if exiting {
            exitLock.unlock()
            while true { sleep(60) }
        }
        exiting = true
        exitLock.unlock()
        if let reason { _ = session.stop(reason: reason) }
        connection.close()
        exit(code)
    }

    static func constantTimeEqual(_ a: String, _ b: String) -> Bool {
        let x = Array(a.utf8), y = Array(b.utf8)
        guard x.count == y.count else { return false }
        var diff: UInt8 = 0
        for i in 0..<x.count { diff |= x[i] ^ y[i] }
        return diff == 0
    }
}
