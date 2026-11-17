import Foundation

/// The format Soullab Capture writes in C1: 24-bit signed little-endian PCM WAV,
/// at the rate the source actually delivers. No sample-rate conversion happens inside
/// Soullab Capture. Conversion upstream of the tap is invisible to us and is reported
/// as `upstreamConversion: "unknown"`.
public struct CaptureFormat: Sendable, Equatable, Codable {
    public static let supportedSampleRates: [Double] = [44_100, 48_000, 88_200, 96_000, 176_400, 192_000]
    public static let supportedChannelCounts: ClosedRange<Int> = 1...2
    public static let bitsPerSample = 24
    public static let bytesPerSample = 3

    public let sampleRate: Double
    public let channels: Int

    public init(sampleRate: Double, channels: Int) throws {
        guard Self.supportedSampleRates.contains(sampleRate) else {
            throw CaptureError(.formatUnsupported, "sample rate \(sampleRate) is not supported")
        }
        guard Self.supportedChannelCounts.contains(channels) else {
            throw CaptureError(.formatUnsupported, "channel count \(channels) is not supported")
        }
        self.sampleRate = sampleRate
        self.channels = channels
    }

    public var blockAlign: Int { channels * Self.bytesPerSample }
    public var byteRate: Int { Int(sampleRate) * blockAlign }

    public func bytes(forSeconds seconds: Double) -> Int64 {
        Int64((Double(byteRate) * seconds).rounded(.up))
    }

    public var channelMask: UInt32 { channels == 1 ? 0x4 : 0x3 }
    public var channelLabel: String { channels == 1 ? "mono" : "stereo" }
}

/// What a source reports once it is running. Rate and layout come from the source itself.
public struct SourceFormat: Sendable, Equatable {
    public let sampleRate: Double
    public let channels: Int
    public let interleaved: Bool

    public init(sampleRate: Double, channels: Int, interleaved: Bool) {
        self.sampleRate = sampleRate
        self.channels = channels
        self.interleaved = interleaved
    }
}
