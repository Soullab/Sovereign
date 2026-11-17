import Foundation

/// A source of audio for one take.
///
/// `start` is called only from an explicit member `start`. The source creates whatever it
/// needs (for a process tap: tap, aggregate device, IO proc), calls `makeSink` exactly once
/// with the format it will actually deliver (off the realtime thread), starts IO, then calls
/// `completion` exactly once. `stop` stops IO and releases every OS object; it is idempotent
/// and safe after a failed, cancelled or late start.
public protocol AudioSource: AnyObject, Sendable {
    var descriptor: SourceDescriptor { get }

    func start(
        makeSink: @escaping @Sendable (SourceFormat) throws -> RealtimeSink,
        onEnded: @escaping @Sendable (StopReason) -> Void,
        completion: @escaping @Sendable (Result<SourceFormat, CaptureError>) -> Void
    )

    func stop()
}

/// Describes a source the member can pick.
public struct SourceInfo: Sendable, Codable, Equatable {
    public let id: String
    public let name: String
    public let bundleID: String?
    public let pid: Int32?
    public let producingOutput: Bool

    public init(id: String, name: String, bundleID: String?, pid: Int32?, producingOutput: Bool) {
        self.id = id
        self.name = name
        self.bundleID = bundleID
        self.pid = pid
        self.producingOutput = producingOutput
    }
}

/// Lists sources and builds the matching `AudioSource`.
public protocol SourceCatalog: Sendable {
    func listSources() throws -> [SourceInfo]
    func makeSource(id: String, channels: Int, sampleRate: Double?) throws -> AudioSource
}
