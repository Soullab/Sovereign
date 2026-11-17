import Foundation

/// An independent RIFF/WAVE reader for tests. Written separately from `WAVLayout` so a
/// layout bug cannot hide itself: it walks every chunk to the end of the file and checks
/// that the declared RIFF size matches the file length.
public struct TestWAVReader {
    public struct Chunk {
        public let id: String
        public let offset: Int
        public let size: Int
    }

    public let bytes: [UInt8]
    public let chunks: [Chunk]
    public let riffSizeMatchesFile: Bool

    public init(url: URL) throws {
        bytes = [UInt8](try Data(contentsOf: url))
        guard bytes.count >= 12, Self.ascii(bytes, 0, 4) == "RIFF", Self.ascii(bytes, 8, 4) == "WAVE" else {
            throw NSError(domain: "TestWAVReader", code: 1)
        }
        riffSizeMatchesFile = Int(Self.u32(bytes, 4)) + 8 == bytes.count
        var list: [Chunk] = []
        var o = 12
        while o + 8 <= bytes.count {
            let size = Int(Self.u32(bytes, o + 4))
            list.append(Chunk(id: Self.ascii(bytes, o, 4), offset: o + 8, size: size))
            o += 8 + size + (size & 1)
        }
        chunks = list
    }

    public func chunk(_ id: String) -> Chunk? { chunks.first { $0.id == id } }

    public var formatTag: Int { Int(Self.u16(bytes, chunk("fmt ")!.offset)) }
    public var channels: Int { Int(Self.u16(bytes, chunk("fmt ")!.offset + 2)) }
    public var sampleRate: Int { Int(Self.u32(bytes, chunk("fmt ")!.offset + 4)) }
    public var bitsPerSample: Int { Int(Self.u16(bytes, chunk("fmt ")!.offset + 14)) }
    public var frames: Int { chunk("data")!.size / (channels * 3) }

    /// All samples, as signed 24-bit integers, interleaved.
    public var samples: [Int32] {
        let d = chunk("data")!
        var out: [Int32] = []
        out.reserveCapacity(d.size / 3)
        var i = d.offset
        while i + 2 < d.offset + d.size {
            var u = UInt32(bytes[i]) | UInt32(bytes[i + 1]) << 8 | UInt32(bytes[i + 2]) << 16
            if u & 0x800000 != 0 { u |= 0xFF000000 }
            out.append(Int32(bitPattern: u))
            i += 3
        }
        return out
    }

    public var bextDescription: String {
        let b = chunk("bext")!
        let raw = bytes[b.offset..<b.offset + 256].prefix { $0 != 0 }
        return String(decoding: raw, as: UTF8.self)
    }

    /// Cue point frame positions, in order.
    public var cuePositions: [Int] {
        guard let c = chunk("cue ") else { return [] }
        let n = Int(Self.u32(bytes, c.offset))
        return (0..<n).map { Int(Self.u32(bytes, c.offset + 4 + $0 * 24 + 20)) }
    }

    /// Text of every `labl` sub-chunk.
    public var labels: [String] {
        guard let list = chunks.first(where: { $0.id == "LIST" && Self.ascii(bytes, $0.offset, 4) == "adtl" }) else { return [] }
        var out: [String] = []
        var o = list.offset + 4
        while o + 8 <= list.offset + list.size {
            let size = Int(Self.u32(bytes, o + 4))
            if Self.ascii(bytes, o, 4) == "labl" {
                let text = bytes[(o + 12)..<(o + 8 + size)].prefix { $0 != 0 }
                out.append(String(decoding: text, as: UTF8.self))
            }
            o += 8 + size + (size & 1)
        }
        return out
    }

    static func ascii(_ b: [UInt8], _ o: Int, _ n: Int) -> String { String(decoding: b[o..<o + n], as: UTF8.self) }
    static func u16(_ b: [UInt8], _ o: Int) -> UInt16 { UInt16(b[o]) | UInt16(b[o + 1]) << 8 }
    static func u32(_ b: [UInt8], _ o: Int) -> UInt32 {
        UInt32(b[o]) | UInt32(b[o + 1]) << 8 | UInt32(b[o + 2]) << 16 | UInt32(b[o + 3]) << 24
    }
}
