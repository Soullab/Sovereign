import Foundation

/// Byte layout of a Soullab Capture take: a BWF-compatible RIFF/WAVE file.
///
///     RIFF <size> WAVE
///     bext <602 + coding history>      Broadcast Wave extension (EBU Tech 3285, v2)
///     fmt  <40>                        WAVE_FORMAT_EXTENSIBLE, 24-bit PCM
///     data <size> …samples…
///     [pad byte]
///     cue  …                           one cue point per discontinuity (optional)
///     LIST adtl labl …                 a label per cue point (optional)
///
/// RF64 is deferred (handoff C2). Takes stop and finalize before the 4 GiB RIFF limit.
public enum WAVLayout {
    public static let bextFixedSize = 602
    public static let bextDescriptionOffset = 12 + 8   // after "RIFF<size>WAVE" and "bext<size>"
    public static let bextDescriptionLength = 256
    public static let fmtChunkSize = 40
    /// Room reserved for trailing cue/label chunks when computing the size limit.
    public static let trailingReserveBytes: Int64 = 1024 * 1024

    public struct HeaderInfo: Sendable, Equatable {
        public var format: CaptureFormat
        public var description: String
        public var originator: String
        public var originatorReference: String
        public var originationDate: Date
        public var timeZone: TimeZone
        public var codingHistory: String

        public init(format: CaptureFormat, description: String, originator: String = "Soullab Capture",
                    originatorReference: String, originationDate: Date, timeZone: TimeZone = .current,
                    codingHistory: String) {
            self.format = format
            self.description = description
            self.originator = originator
            self.originatorReference = originatorReference
            self.originationDate = originationDate
            self.timeZone = timeZone
            self.codingHistory = codingHistory
        }

        /// Sample count since local midnight at the take's start (BWF TimeReference).
        public var timeReference: UInt64 {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = timeZone
            let midnight = calendar.startOfDay(for: originationDate)
            let seconds = originationDate.timeIntervalSince(midnight)
            return UInt64((seconds * format.sampleRate).rounded(.down))
        }
    }

    public struct Header: Sendable {
        public let bytes: [UInt8]
        /// Offset of the first audio byte.
        public let dataOffset: Int
        /// Offset of the 4-byte data chunk size field.
        public let dataSizeFieldOffset: Int
    }

    /// The largest data payload a C1 take may hold, rounded down to whole frames.
    public static func maxDataBytes(for format: CaptureFormat, headerBytes: Int) -> Int64 {
        let ceiling = Int64(UInt32.max) - 8 - Int64(headerBytes) - 1 - trailingReserveBytes
        return ceiling - (ceiling % Int64(format.blockAlign))
    }

    // MARK: Building

    public static func header(_ info: HeaderInfo) -> Header {
        var out = ByteWriter()
        out.ascii("RIFF")
        out.u32(0) // patched by riffSize
        out.ascii("WAVE")

        // bext
        var history = Array((info.codingHistory).utf8)
        if history.count % 2 == 1 { history.append(0) }
        out.ascii("bext")
        out.u32(UInt32(bextFixedSize + history.count))
        out.fixedASCII(info.description, length: bextDescriptionLength)
        out.fixedASCII(info.originator, length: 32)
        out.fixedASCII(info.originatorReference, length: 32)
        let (date, time) = dateAndTime(info.originationDate, timeZone: info.timeZone)
        out.fixedASCII(date, length: 10)
        out.fixedASCII(time, length: 8)
        let tr = info.timeReference
        out.u32(UInt32(truncatingIfNeeded: tr))
        out.u32(UInt32(truncatingIfNeeded: tr >> 32))
        out.u16(2)                       // BWF version 2
        out.zeros(64)                    // UMID (none)
        out.u16(0x7FFF); out.u16(0x7FFF) // loudness value / range: not measured
        out.u16(0x7FFF); out.u16(0x7FFF) // max true peak / momentary: not measured
        out.u16(0x7FFF)                  // max short-term: not measured
        out.zeros(180)                   // reserved
        out.bytes(history)

        // fmt (WAVE_FORMAT_EXTENSIBLE)
        let f = info.format
        out.ascii("fmt ")
        out.u32(UInt32(fmtChunkSize))
        out.u16(0xFFFE)
        out.u16(UInt16(f.channels))
        out.u32(UInt32(f.sampleRate))
        out.u32(UInt32(f.byteRate))
        out.u16(UInt16(f.blockAlign))
        out.u16(UInt16(CaptureFormat.bitsPerSample))
        out.u16(22)
        out.u16(UInt16(CaptureFormat.bitsPerSample)) // valid bits
        out.u32(f.channelMask)
        out.bytes(pcmSubformatGUID)

        // data
        out.ascii("data")
        let dataSizeFieldOffset = out.count
        out.u32(0)
        return Header(bytes: out.storage, dataOffset: out.count, dataSizeFieldOffset: dataSizeFieldOffset)
    }

    /// KSDATAFORMAT_SUBTYPE_PCM: 00000001-0000-0010-8000-00AA00389B71
    public static let pcmSubformatGUID: [UInt8] = [
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
        0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71,
    ]

    /// Bytes that follow the data chunk: an optional pad byte, then cue + LIST/adtl chunks.
    public static func trailingChunks(markers: [Discontinuity], dataBytes: Int64) -> [UInt8] {
        var out = ByteWriter()
        if dataBytes % 2 == 1 { out.u8(0) }
        let points = Array(markers.prefix(CapturePolicy.maxFileCuePoints))
        guard !points.isEmpty else { return out.storage }

        out.ascii("cue ")
        out.u32(UInt32(4 + 24 * points.count))
        out.u32(UInt32(points.count))
        for (index, marker) in points.enumerated() {
            let position = UInt32(clamping: marker.framePosition)
            out.u32(UInt32(index + 1))
            out.u32(position)
            out.ascii("data")
            out.u32(0)
            out.u32(0)
            out.u32(position)
        }

        var adtl = ByteWriter()
        adtl.ascii("adtl")
        for (index, marker) in points.enumerated() {
            var text = Array(label(for: marker).utf8)
            text.append(0)
            adtl.ascii("labl")
            adtl.u32(UInt32(4 + text.count))
            adtl.u32(UInt32(index + 1))
            adtl.bytes(text)
            if text.count % 2 == 1 { adtl.u8(0) }
        }
        out.ascii("LIST")
        out.u32(UInt32(adtl.count))
        out.bytes(adtl.storage)
        return out.storage
    }

    public static func label(for marker: Discontinuity) -> String {
        switch marker.kind {
        case .overrun: return "discontinuity: overrun, \(marker.lostFrames) frames dropped"
        case .timestampGap: return "discontinuity: source clock gap, \(marker.lostFrames) frames"
        case .processorOverload: return "discontinuity: processor overload"
        case .recovered: return "recovered after interruption"
        }
    }

    /// RIFF size field for a file of `fileLength` bytes.
    public static func riffSize(fileLength: Int64) -> UInt32 {
        UInt32(clamping: fileLength - 8)
    }

    static func dateAndTime(_ date: Date, timeZone: TimeZone) -> (String, String) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let d = String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
        let t = String(format: "%02d:%02d:%02d", c.hour ?? 0, c.minute ?? 0, c.second ?? 0)
        return (d, t)
    }

    // MARK: Parsing (used by recovery)

    public struct Parsed: Sendable, Equatable {
        public let channels: Int
        public let sampleRate: Double
        public let bitsPerSample: Int
        public let dataOffset: Int
        public let declaredDataBytes: Int64
        public let hasBext: Bool
    }

    /// Parses the chunks up to and including the `data` chunk header.
    public static func parse(_ bytes: [UInt8]) -> Parsed? {
        guard bytes.count >= 12,
              String(decoding: bytes[0..<4], as: UTF8.self) == "RIFF",
              String(decoding: bytes[8..<12], as: UTF8.self) == "WAVE" else { return nil }
        var offset = 12
        var channels = 0, rate = 0.0, bits = 0, hasBext = false
        while offset + 8 <= bytes.count {
            let id = String(decoding: bytes[offset..<offset + 4], as: UTF8.self)
            let size = Int(readU32(bytes, offset + 4))
            let body = offset + 8
            switch id {
            case "bext":
                hasBext = true
            case "fmt ":
                guard body + 16 <= bytes.count else { return nil }
                let tag = readU16(bytes, body)
                guard tag == 1 || tag == 0xFFFE else { return nil }
                channels = Int(readU16(bytes, body + 2))
                rate = Double(readU32(bytes, body + 4))
                bits = Int(readU16(bytes, body + 14))
            case "data":
                guard channels > 0, rate > 0, bits > 0 else { return nil }
                return Parsed(channels: channels, sampleRate: rate, bitsPerSample: bits,
                              dataOffset: body, declaredDataBytes: Int64(size), hasBext: hasBext)
            default:
                break
            }
            offset = body + size + (size % 2)
        }
        return nil
    }

    static func readU16(_ b: [UInt8], _ o: Int) -> UInt16 { UInt16(b[o]) | UInt16(b[o + 1]) << 8 }
    static func readU32(_ b: [UInt8], _ o: Int) -> UInt32 {
        UInt32(b[o]) | UInt32(b[o + 1]) << 8 | UInt32(b[o + 2]) << 16 | UInt32(b[o + 3]) << 24
    }
}

/// Little-endian byte builder.
struct ByteWriter {
    var storage: [UInt8] = []
    var count: Int { storage.count }

    mutating func u8(_ v: UInt8) { storage.append(v) }
    mutating func u16(_ v: UInt16) { storage.append(UInt8(v & 0xFF)); storage.append(UInt8(v >> 8)) }
    mutating func u32(_ v: UInt32) {
        storage.append(UInt8(v & 0xFF)); storage.append(UInt8((v >> 8) & 0xFF))
        storage.append(UInt8((v >> 16) & 0xFF)); storage.append(UInt8(v >> 24))
    }
    mutating func ascii(_ s: String) { storage.append(contentsOf: Array(s.utf8)) }
    mutating func bytes(_ b: [UInt8]) { storage.append(contentsOf: b) }
    mutating func zeros(_ n: Int) { storage.append(contentsOf: [UInt8](repeating: 0, count: n)) }
    /// ASCII text, truncated or NUL-padded to exactly `length` bytes. Non-ASCII becomes "?".
    mutating func fixedASCII(_ s: String, length: Int) {
        var b = s.unicodeScalars.map { $0.isASCII && $0.value >= 0x20 ? UInt8($0.value) : UInt8(ascii: "?") }
        if b.count > length { b = Array(b.prefix(length)) }
        storage.append(contentsOf: b)
        storage.append(contentsOf: [UInt8](repeating: 0, count: length - b.count))
    }
}
