import Foundation

/// Session states. A take always ends by returning to `idle`. Nothing moves from `idle`
/// or `prepared` to `recording` without an explicit `start`.
public enum CaptureState: String, Sendable, Codable {
    case idle
    case prepared
    case starting
    case recording
    case finalizing
}

/// Why a take ended. Every reason finalizes what was captured; none restarts capture.
public enum StopReason: String, Sendable, Codable, CaseIterable {
    case memberStop
    case sourceExited
    case deviceChanged
    case formatChanged
    case storageCritical
    case sizeLimit
    case sleep
    case terminated
    case clientDisconnected
    case sourceFailed
    case recovered
}

/// A gap or loss inside a take. Count and mark, never hide.
public struct Discontinuity: Sendable, Codable, Equatable {
    public enum Kind: String, Sendable, Codable {
        case overrun          // ring buffer was full; the block was dropped
        case timestampGap     // the source's sample clock jumped
        case processorOverload
        case recovered        // marks the end of a take recovered after a crash
    }

    public let kind: Kind
    /// Position in the file, in frames, where the gap sits.
    public let framePosition: Int64
    /// Frames known to be lost at this point (0 when unknown).
    public let lostFrames: Int64

    public init(kind: Kind, framePosition: Int64, lostFrames: Int64) {
        self.kind = kind
        self.framePosition = framePosition
        self.lostFrames = lostFrames
    }
}
