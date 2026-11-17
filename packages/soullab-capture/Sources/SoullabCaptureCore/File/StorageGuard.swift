import Foundation

/// Reports free bytes on the volume holding a path. Injectable for tests.
public protocol FreeSpaceProbe: Sendable {
    func availableBytes(at url: URL) -> Int64?
}

public struct StatfsFreeSpaceProbe: FreeSpaceProbe {
    public init() {}

    public func availableBytes(at url: URL) -> Int64? {
        var s = statfs()
        guard statfs(url.path, &s) == 0 else { return nil }
        return Int64(s.f_bavail) * Int64(s.f_bsize)
    }
}

/// Storage root, take names and free space.
public enum StorageGuard {
    /// Resolves the storage root chosen by the host (through a native folder dialog).
    /// Symlinks are resolved once here; every take lives directly inside this directory.
    public static func resolveRoot(_ url: URL) throws -> URL {
        guard let real = realpath(url.path, nil) else {
            throw CaptureError(.rootInvalid, "root does not exist")
        }
        defer { free(real) }
        let resolved = URL(fileURLWithPath: String(cString: real), isDirectory: true)
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: resolved.path, isDirectory: &isDir), isDir.boolValue else {
            throw CaptureError(.rootInvalid, "root is not a directory")
        }
        guard access(resolved.path, W_OK) == 0 else {
            throw CaptureError(.rootInvalid, "root is not writable")
        }
        return resolved
    }

    /// Take names are rejected, never rewritten. A valid name contains no path separator,
    /// no control characters, does not start with ".", and is at most 128 bytes of UTF-8.
    public static func validateTakeName(_ name: String) throws {
        let bytes = name.utf8.count
        guard bytes > 0, bytes <= CapturePolicy.maxTakeNameBytes else {
            throw CaptureError(.invalidName, "length")
        }
        guard !name.hasPrefix("."), name != "..", name.trimmingCharacters(in: .whitespaces) == name else {
            throw CaptureError(.invalidName, "leading dot or surrounding spaces")
        }
        for scalar in name.unicodeScalars {
            if scalar == "/" || scalar == ":" || scalar == "\\" || scalar.value < 0x20 || scalar.value == 0x7F {
                throw CaptureError(.invalidName, "forbidden character")
            }
        }
    }

    public struct TakePaths: Sendable {
        public let partial: URL
        public let final: URL
        public let journal: URL
        public let provenance: URL
    }

    public static func paths(root: URL, name: String) throws -> TakePaths {
        try validateTakeName(name)
        let paths = TakePaths(
            partial: root.appendingPathComponent(name + ".partial.wav"),
            final: root.appendingPathComponent(name + ".wav"),
            journal: root.appendingPathComponent(name + ".journal.json"),
            provenance: root.appendingPathComponent(name + ".provenance.json")
        )
        for url in [paths.partial, paths.final, paths.journal, paths.provenance] {
            guard url.deletingLastPathComponent().standardizedFileURL.path == root.standardizedFileURL.path else {
                throw CaptureError(.outsideRoot)
            }
        }
        return paths
    }

    /// True when none of the take's files exist (symlinks included).
    public static func isAvailable(_ paths: TakePaths) -> Bool {
        for url in [paths.partial, paths.final, paths.journal, paths.provenance] {
            var st = stat()
            if lstat(url.path, &st) == 0 { return false }
        }
        return true
    }
}
