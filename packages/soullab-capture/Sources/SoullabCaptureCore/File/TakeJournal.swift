import Foundation

/// Identifies where a take's audio came from. Never contains audio or file contents.
public struct SourceDescriptor: Sendable, Codable, Equatable {
    public enum Kind: String, Sendable, Codable {
        case processTap
        case synthetic
        case test
    }

    public let kind: Kind
    public let id: String
    public let name: String
    public let bundleID: String?
    public let pid: Int32?

    public init(kind: Kind, id: String, name: String, bundleID: String? = nil, pid: Int32? = nil) {
        self.kind = kind
        self.id = id
        self.name = name
        self.bundleID = bundleID
        self.pid = pid
    }
}

/// Optional fields a member types in. Never inferred, never filled by Soullab.
public struct MemberFields: Sendable, Codable, Equatable {
    public var performer: String?
    public var consentRef: String?
    public var rightsNote: String?
    public var location: String?
    public var notes: String?

    public init(performer: String? = nil, consentRef: String? = nil, rightsNote: String? = nil,
                location: String? = nil, notes: String? = nil) {
        self.performer = performer
        self.consentRef = consentRef
        self.rightsNote = rightsNote
        self.location = location
        self.notes = notes
    }

    public func validate() throws {
        for value in [performer, consentRef, rightsNote, location, notes] {
            if let value, value.utf8.count > CapturePolicy.maxMemberFieldBytes {
                throw CaptureError(.invalidRequest, "member field too long")
            }
        }
    }
}

/// Sidecar written next to a `.partial.wav` while a take is open. Recovery reads it.
public struct TakeJournal: Codable, Sendable, Equatable {
    public enum State: String, Codable, Sendable {
        case recording
        case finalizing
    }

    public static let schema = "soullab.capture.journal.v1"

    public var schema: String = TakeJournal.schema
    public var takeId: String
    public var name: String
    public var state: State
    public var sampleRate: Double
    public var channels: Int
    public var dataOffset: Int
    public var source: SourceDescriptor
    public var member: MemberFields
    public var startedAt: Date
    public var helperVersion: String
    /// Set when finalizing starts: the exact audio byte count.
    public var finalDataBytes: Int64?
    public var markers: [Discontinuity]
    public var clipSamples: Int64

    public func write(to url: URL) throws {
        let data = try Self.encoder.encode(self)
        try data.write(to: url, options: .atomic)
    }

    public static func read(from url: URL) throws -> TakeJournal {
        try decoder.decode(TakeJournal.self, from: Data(contentsOf: url))
    }

    static var encoder: JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }

    static var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
}
