import Foundation
import SoullabCaptureCore

/// Control protocol v1. See PROTOCOL.md.
enum ControlProtocol {
    static let requestTypes: Set<String> = ["hello", "listSources", "prepare", "start", "stop", "status", "shutdown"]

    struct Request {
        let id: Int
        let type: String
        let body: [String: Any]
    }

    enum ParseError: Error {
        case malformed
    }

    static func parse(_ line: Data) throws -> Request {
        guard let object = try? JSONSerialization.jsonObject(with: line),
              let dict = object as? [String: Any],
              let id = dict["id"] as? Int, id >= 0,
              let type = dict["type"] as? String
        else { throw ParseError.malformed }
        return Request(id: id, type: type, body: dict)
    }

    static func ok(_ id: Int, _ result: Any = [String: Any]()) -> [String: Any] {
        ["id": id, "ok": true, "result": result]
    }

    static func failure(_ id: Int, _ code: CaptureErrorCode) -> [String: Any] {
        ["id": id, "ok": false, "error": ["code": code.rawValue]]
    }

    /// Codable → JSON object, for embedding in a message.
    static func json<T: Encodable>(_ value: T) -> Any {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(value),
              let object = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        else { return NSNull() }
        return object
    }

    static func event(_ event: CaptureEvent) -> [String: Any] {
        switch event {
        case .state(let state, let generation):
            return ["event": "state", "state": state.rawValue, "generation": generation]
        case .meter(let snapshot):
            var object = json(snapshot) as? [String: Any] ?? [:]
            object["event"] = "meter"
            return object
        case .discontinuity(let marker):
            var object = json(marker) as? [String: Any] ?? [:]
            object["event"] = "discontinuity"
            return object
        case .storageLow(let bytes):
            return ["event": "storageLow", "availableBytes": bytes]
        case .finalized(let take):
            return ["event": "finalized", "take": json(take)]
        case .error(let code):
            return ["event": "error", "code": code.rawValue]
        }
    }
}
