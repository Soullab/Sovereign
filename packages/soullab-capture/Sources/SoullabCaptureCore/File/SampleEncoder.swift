import Foundation

/// Float32 → 24-bit signed little-endian PCM.
///
/// Scale by 8 388 607, round to nearest, hard-clip to [-8 388 608, 8 388 607].
/// No dither (recorded in the coding history). Samples that needed clipping are counted.
public enum SampleEncoder {
    public static let scale: Float = 8_388_607

    /// Encodes `count` samples into `destination`, which must hold `count * 3` bytes.
    /// Returns the number of samples that were clipped.
    @discardableResult
    public static func encodeS24(_ source: UnsafePointer<Float>, count: Int, into destination: UnsafeMutablePointer<UInt8>) -> Int {
        var clipped = 0
        var d = destination
        for i in 0..<count {
            let x = source[i]
            var v: Int32
            if x.isNaN {
                v = 0
                clipped += 1
            } else {
                // Double, so the product itself adds no rounding error before the final rounding.
                let scaled = (Double(x) * 8_388_607).rounded(.toNearestOrEven)
                if scaled > 8_388_607 {
                    v = 8_388_607
                    clipped += 1
                } else if scaled < -8_388_608 {
                    v = -8_388_608
                    clipped += 1
                } else {
                    v = Int32(scaled)
                }
            }
            let u = UInt32(bitPattern: v)
            d[0] = UInt8(u & 0xFF)
            d[1] = UInt8((u >> 8) & 0xFF)
            d[2] = UInt8((u >> 16) & 0xFF)
            d += 3
        }
        return clipped
    }

    /// Decodes 24-bit little-endian PCM to Int32 values (used by tests and verification).
    public static func decodeS24(_ bytes: UnsafeRawBufferPointer) -> [Int32] {
        let n = bytes.count / 3
        var out = [Int32](repeating: 0, count: n)
        for i in 0..<n {
            let b0 = UInt32(bytes[3 * i]), b1 = UInt32(bytes[3 * i + 1]), b2 = UInt32(bytes[3 * i + 2])
            var u = b0 | b1 << 8 | b2 << 16
            if u & 0x80_0000 != 0 { u |= 0xFF00_0000 }
            out[i] = Int32(bitPattern: u)
        }
        return out
    }
}
