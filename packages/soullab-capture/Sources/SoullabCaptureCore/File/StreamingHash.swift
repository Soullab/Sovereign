import CryptoKit
import Foundation

public enum StreamingHash {
    /// SHA-256 of a file, read back from disk in 1 MiB chunks. Lower-case hex.
    public static func sha256(of url: URL) throws -> String {
        guard let handle = FileHandle(forReadingAtPath: url.path) else {
            throw CaptureError(.ioFailed, "cannot open for hashing")
        }
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let chunk = try handle.read(upToCount: 1 << 20) ?? Data()
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
