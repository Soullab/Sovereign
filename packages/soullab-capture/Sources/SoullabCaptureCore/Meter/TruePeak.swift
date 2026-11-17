import Foundation

/// 4× oversampled true-peak estimate (in the spirit of ITU-R BS.1770 Annex 2):
/// a 48-tap windowed-sinc polyphase interpolator, 12 taps per phase.
/// For display only. Not a certified loudness or true-peak measurement.
public struct TruePeakDetector {
    static let phases = 4
    static let tapsPerPhase = 12
    static let coefficients: [[Float]] = {
        let total = phases * tapsPerPhase
        let center = Double(total - 1) / 2
        var table = [[Float]](repeating: [Float](repeating: 0, count: tapsPerPhase), count: phases)
        for p in 0..<phases {
            for t in 0..<tapsPerPhase {
                let n = Double(t * phases + p)
                let x = (n - center) / Double(phases)
                let sinc = x == 0 ? 1.0 : sin(Double.pi * x) / (Double.pi * x)
                let window = 0.5 - 0.5 * cos(2 * Double.pi * (n + 0.5) / Double(total))
                table[p][t] = Float(sinc * window)
            }
        }
        // Normalize each phase to unity DC gain.
        for p in 0..<phases {
            let sum = table[p].reduce(0, +)
            if sum != 0 { table[p] = table[p].map { $0 / sum } }
        }
        return table
    }()

    private var history = [Float](repeating: 0, count: tapsPerPhase)
    private var index = 0

    public init() {}

    /// Feeds one sample; returns the largest absolute interpolated value around it.
    public mutating func process(_ x: Float) -> Float {
        history[index] = x
        index = (index + 1) % Self.tapsPerPhase
        var best = abs(x)
        for p in 0..<Self.phases {
            let coeffs = Self.coefficients[p]
            var acc: Float = 0
            var h = index
            for t in 0..<Self.tapsPerPhase {
                acc += coeffs[Self.tapsPerPhase - 1 - t] * history[h]
                h = (h + 1) % Self.tapsPerPhase
            }
            let a = abs(acc)
            if a > best { best = a }
        }
        return best
    }
}
