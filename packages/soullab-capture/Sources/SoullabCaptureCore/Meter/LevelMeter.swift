import Foundation

/// Display meters. Computed on the writer queue, never on the realtime thread.
/// Values are linear full-scale (1.0 = 0 dBFS). Never stored as analysis.
public struct MeterSnapshot: Sendable, Codable, Equatable {
    public let peak: [Double]
    public let rms: [Double]
    public let truePeak: [Double]
    public let clipSamples: Int64
    public let seconds: Double
}

public final class LevelMeter {
    public let channels: Int
    private let sampleRate: Double
    private let windowFrames: Int
    private var peak: [Float]
    private var sumSquares: [Double]
    private var windowCount = 0
    private var lastRMS: [Double]
    private var truePeaks: [TruePeakDetector]
    private var truePeakHold: [Float]
    public private(set) var clipSamples: Int64 = 0
    public private(set) var framesSeen: Int64 = 0

    public init(channels: Int, sampleRate: Double) {
        self.channels = channels
        self.sampleRate = sampleRate
        windowFrames = max(1, Int(sampleRate * CapturePolicy.rmsWindowSeconds))
        peak = [Float](repeating: 0, count: channels)
        sumSquares = [Double](repeating: 0, count: channels)
        lastRMS = [Double](repeating: 0, count: channels)
        truePeaks = (0..<channels).map { _ in TruePeakDetector() }
        truePeakHold = [Float](repeating: 0, count: channels)
    }

    /// Consumes interleaved samples.
    public func process(_ samples: UnsafePointer<Float>, frames: Int) {
        for f in 0..<frames {
            for c in 0..<channels {
                let x = samples[f * channels + c]
                let a = abs(x)
                if a > peak[c] { peak[c] = a }
                if a >= 1.0 { clipSamples += 1 }
                sumSquares[c] += Double(x) * Double(x)
                let tp = truePeaks[c].process(x)
                if tp > truePeakHold[c] { truePeakHold[c] = tp }
            }
            windowCount += 1
            if windowCount >= windowFrames {
                for c in 0..<channels {
                    lastRMS[c] = (sumSquares[c] / Double(windowCount)).squareRoot()
                    sumSquares[c] = 0
                }
                windowCount = 0
            }
        }
        framesSeen += Int64(frames)
    }

    /// Returns the current values and resets peak holds for the next interval.
    public func snapshot() -> MeterSnapshot {
        let snap = MeterSnapshot(
            peak: peak.map(Double.init),
            rms: lastRMS,
            truePeak: truePeakHold.map(Double.init),
            clipSamples: clipSamples,
            seconds: Double(framesSeen) / sampleRate
        )
        for c in 0..<channels {
            peak[c] = 0
            truePeakHold[c] = 0
        }
        return snap
    }
}
