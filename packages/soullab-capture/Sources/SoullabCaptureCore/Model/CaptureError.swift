import Foundation

/// Closed set of error codes. Codes cross the helper protocol; detail never does.
/// Detail is for local logs only and never contains file contents.
public enum CaptureErrorCode: String, Sendable, Codable, CaseIterable {
    case authFailed = "AUTH_FAILED"
    case protocolViolation = "PROTOCOL_VIOLATION"
    case invalidState = "INVALID_STATE"
    case alreadyStarting = "ALREADY_STARTING"
    case invalidName = "INVALID_NAME"
    case nameExists = "NAME_EXISTS"
    case outsideRoot = "OUTSIDE_ROOT"
    case rootInvalid = "ROOT_INVALID"
    case insufficientStorage = "INSUFFICIENT_STORAGE"
    case formatUnsupported = "FORMAT_UNSUPPORTED"
    case sourceNotFound = "SOURCE_NOT_FOUND"
    case permissionDenied = "PERMISSION_DENIED"
    case tapFailed = "TAP_FAILED"
    case ioFailed = "IO_FAILED"
    case writeFailed = "WRITE_FAILED"
    case unsupportedPlatform = "UNSUPPORTED_PLATFORM"
    case invalidRequest = "INVALID_REQUEST"
}

public struct CaptureError: Error, Sendable, CustomStringConvertible {
    public let code: CaptureErrorCode
    public let detail: String

    public init(_ code: CaptureErrorCode, _ detail: String = "") {
        self.code = code
        self.detail = detail
    }

    public var description: String { detail.isEmpty ? code.rawValue : "\(code.rawValue): \(detail)" }
}
