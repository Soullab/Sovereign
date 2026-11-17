import Foundation

/// Invariants of Soullab Capture C1. These are deliberately constants, not settings.
///
/// - Capture starts only on an explicit `start` request. There is no auto-start.
/// - Every stop finalizes what was captured. Nothing auto-resumes after any stop reason.
/// - A process tap is created only inside `start`, never to "check" permission.
/// - No network: the helper links no networking API and opens only a local Unix socket
///   that it serves (it never connects anywhere).
/// - No DSP: samples are written as delivered, apart from Float32 → 24-bit conversion
///   (round to nearest, hard clip, counted; no dither).
/// - No upload, sync, analysis, transcription or MAIA access.
/// - Takes carry no Soullab rights claim.
public enum CapturePolicy {
    public static let protocolVersion = 1
    public static let maxMessageBytes = 64 * 1024

    public static let ringSeconds = 4.0
    public static let drainInterval: DispatchTimeInterval = .milliseconds(20)
    public static let checkpointInterval: TimeInterval = 1.0
    public static let meterEventInterval: TimeInterval = 0.05
    public static let storageCheckInterval: TimeInterval = 1.0
    public static let rmsWindowSeconds = 0.3

    public static let maxTakeNameBytes = 128
    public static let maxMemberFieldBytes = 1024
    /// Cue points written into the file. All markers are kept in the provenance record.
    public static let maxFileCuePoints = 4096

    /// Free space needed before a take may start: max(2 GiB, 10 minutes of the format).
    public static let minimumStartBytes: Int64 = 2 * 1024 * 1024 * 1024
    public static let startMinutesOfAudio = 10.0
    public static let lowStorageBytes: Int64 = 1024 * 1024 * 1024
    public static let criticalStorageBytes: Int64 = 256 * 1024 * 1024

    /// Prefix for every Core Audio object Soullab Capture creates (aggregate UIDs, tap names).
    public static let objectPrefix = "life.soullab.capture."

    public static let orphanSweepEnabled = true
    public static let rightsClaim = "none"
    public static let upstreamConversion = "unknown"

    public static func startRequirement(for format: CaptureFormat?) -> Int64 {
        guard let format else { return minimumStartBytes }
        return max(minimumStartBytes, format.bytes(forSeconds: startMinutesOfAudio * 60))
    }
}
