import Foundation

/// `<take>.provenance.json`, written after the take is final and its hash has been read back.
///
/// Follows the founder's Human Voice Source Library §8 ruling (2026-11-15): every sound
/// carries its origin. Capture grants no rights; library admission still goes through
/// the existing Sound Studio media gate and rights policy.
public struct ProvenanceRecord: Codable, Sendable, Equatable {
    public static let schema = "soullab.capture.provenance.v1"

    public struct Format: Codable, Sendable, Equatable {
        public let sampleRate: Double
        public let channels: Int
        public let bitsPerSample: Int
        public let encoding: String
        public let container: String
    }

    public struct Rights: Codable, Sendable, Equatable {
        /// Always "none": Soullab makes no rights claim about a capture.
        public let soullabClaim: String
        /// "member-asserted" when the member wrote a rights note, otherwise "none".
        public let attestation: String
    }

    public var schema: String = ProvenanceRecord.schema
    public let takeId: String
    public let file: String
    public let sha256: String
    public let bytes: Int64
    public let format: Format
    public let frames: Int64
    public let durationSeconds: Double
    public let source: SourceDescriptor
    public let upstreamConversion: String
    public let startedAt: Date
    public let endedAt: Date?
    public let stopReason: StopReason
    public let recovered: Bool
    public let discontinuities: [Discontinuity]
    public let clipSamples: Int64
    public let member: MemberFields
    public let rights: Rights
    public let helperVersion: String

    public init(takeId: String, file: String, sha256: String, bytes: Int64, format: CaptureFormat,
                frames: Int64, source: SourceDescriptor, startedAt: Date, endedAt: Date?,
                stopReason: StopReason, recovered: Bool, discontinuities: [Discontinuity],
                clipSamples: Int64, member: MemberFields, helperVersion: String) {
        self.takeId = takeId
        self.file = file
        self.sha256 = sha256
        self.bytes = bytes
        self.format = Format(sampleRate: format.sampleRate, channels: format.channels,
                             bitsPerSample: CaptureFormat.bitsPerSample, encoding: "pcm_s24le",
                             container: "wav-bwf")
        self.frames = frames
        self.durationSeconds = Double(frames) / format.sampleRate
        self.source = source
        self.upstreamConversion = CapturePolicy.upstreamConversion
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.stopReason = stopReason
        self.recovered = recovered
        self.discontinuities = discontinuities
        self.clipSamples = clipSamples
        self.member = member
        let note = member.rightsNote?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.rights = Rights(soullabClaim: CapturePolicy.rightsClaim, attestation: note.isEmpty ? "none" : "member-asserted")
        self.helperVersion = helperVersion
    }

    /// Writes without replacing an existing record.
    public func write(to url: URL) throws {
        let data = try TakeJournal.encoder.encode(self)
        try data.write(to: url, options: .withoutOverwriting)
    }

    public static func read(from url: URL) throws -> ProvenanceRecord {
        try TakeJournal.decoder.decode(ProvenanceRecord.self, from: Data(contentsOf: url))
    }
}

/// What the helper reports about a finished take.
public struct TakeResult: Codable, Sendable, Equatable {
    public let takeId: String
    public let path: String
    public let provenancePath: String
    public let sha256: String
    public let frames: Int64
    public let sampleRate: Double
    public let channels: Int
    public let bitsPerSample: Int
    public let durationSeconds: Double
    public let stopReason: StopReason
    public let recovered: Bool
    public let discontinuities: Int
    public let clipSamples: Int64

    public init(record: ProvenanceRecord, path: URL, provenancePath: URL) {
        takeId = record.takeId
        self.path = path.path
        self.provenancePath = provenancePath.path
        sha256 = record.sha256
        frames = record.frames
        sampleRate = record.format.sampleRate
        channels = record.format.channels
        bitsPerSample = record.format.bitsPerSample
        durationSeconds = record.durationSeconds
        stopReason = record.stopReason
        recovered = record.recovered
        discontinuities = record.discontinuities.count
        clipSamples = record.clipSamples
    }
}
