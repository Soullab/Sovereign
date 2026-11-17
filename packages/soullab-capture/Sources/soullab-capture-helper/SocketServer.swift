import Darwin
import Foundation
import SoullabCaptureCore

/// Local control channel: one Unix-domain stream socket, one client, newline-delimited JSON.
///
/// The helper only *serves* this socket inside a directory its host created with mode 0700.
/// It never connects anywhere. The socket file is removed as soon as the one client is
/// accepted, so no second client can reach it.
enum SocketServer {
    static let maxPathBytes = 103

    /// Checks that `dir` is a real directory owned by this user with no group/other access.
    static func checkPrivateDirectory(_ dir: String) throws {
        var st = stat()
        guard lstat(dir, &st) == 0 else { throw CaptureError(.invalidRequest, "socket directory missing") }
        guard (st.st_mode & S_IFMT) == S_IFDIR else { throw CaptureError(.invalidRequest, "socket directory is not a directory") }
        guard st.st_uid == getuid() else { throw CaptureError(.invalidRequest, "socket directory owner") }
        guard st.st_mode & 0o077 == 0 else { throw CaptureError(.invalidRequest, "socket directory must be 0700") }
    }

    /// Binds and listens under a temporary name, then renames the socket into place, so the
    /// moment `path` appears the helper is already accepting. (Binding at `path` directly would
    /// let a host connect between bind and listen and be refused.)
    static func listen(path: String) throws -> Int32 {
        let staging = path + ".t"
        guard staging.utf8.count <= maxPathBytes else { throw CaptureError(.invalidRequest, "socket path too long") }
        try checkPrivateDirectory((path as NSString).deletingLastPathComponent)
        var st = stat()
        guard lstat(path, &st) != 0, lstat(staging, &st) != 0 else {
            throw CaptureError(.invalidRequest, "socket path already exists")
        }

        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { throw CaptureError(.ioFailed, "socket errno \(errno)") }
        var on: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let bytes = Array(staging.utf8)
        withUnsafeMutableBytes(of: &addr.sun_path) { raw in
            raw.copyBytes(from: bytes)
            raw[bytes.count] = 0
        }
        addr.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        let bound = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bound == 0 else {
            close(fd)
            throw CaptureError(.ioFailed, "bind errno \(errno)")
        }
        guard chmod(staging, 0o600) == 0, Darwin.listen(fd, 1) == 0 else {
            close(fd)
            unlink(staging)
            throw CaptureError(.ioFailed, "listen errno \(errno)")
        }
        guard renamex_np(staging, path, UInt32(RENAME_EXCL)) == 0 else {
            close(fd)
            unlink(staging)
            throw CaptureError(.ioFailed, "publish socket errno \(errno)")
        }
        return fd
    }

    /// Accepts exactly one client from the same user, then closes and removes the socket.
    static func acceptOne(listener: Int32, path: String) throws -> Int32 {
        defer {
            close(listener)
            unlink(path)
        }
        while true {
            let client = accept(listener, nil, nil)
            if client < 0 {
                if errno == EINTR { continue }
                throw CaptureError(.ioFailed, "accept errno \(errno)")
            }
            var uid: uid_t = 0, gid: gid_t = 0
            guard getpeereid(client, &uid, &gid) == 0, uid == getuid() else {
                close(client)
                throw CaptureError(.authFailed, "peer is a different user")
            }
            var on: Int32 = 1
            setsockopt(client, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
            return client
        }
    }
}

/// A connected client. Writes are serialized; reads happen on one thread.
final class Connection: @unchecked Sendable {
    private let fd: Int32
    private let writeLock = NSLock()
    private var buffer = Data()
    private var closed = false

    init(fd: Int32) {
        self.fd = fd
    }

    func send(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return }
        var line = data
        line.append(0x0A)
        writeLock.lock()
        defer { writeLock.unlock() }
        guard !closed else { return }
        line.withUnsafeBytes { raw in
            var done = 0
            while done < raw.count {
                let n = write(fd, raw.baseAddress! + done, raw.count - done)
                if n < 0 {
                    if errno == EINTR { continue }
                    closed = true
                    return
                }
                done += n
            }
        }
    }

    enum ReadResult {
        case line(Data)
        case closed
        case oversize
    }

    /// Blocks until a full line, EOF, or a line longer than the protocol limit.
    func readLine() -> ReadResult {
        while true {
            if let newline = buffer.firstIndex(of: 0x0A) {
                let line = buffer[buffer.startIndex..<newline]
                buffer.removeSubrange(buffer.startIndex...newline)
                if line.count > CapturePolicy.maxMessageBytes { return .oversize }
                return .line(Data(line))
            }
            if buffer.count > CapturePolicy.maxMessageBytes { return .oversize }
            var chunk = [UInt8](repeating: 0, count: 16_384)
            let n = read(fd, &chunk, chunk.count)
            if n < 0 && errno == EINTR { continue }
            if n <= 0 { return .closed }
            buffer.append(contentsOf: chunk[0..<n])
        }
    }

    func setReadTimeout(seconds: Int) {
        var tv = timeval(tv_sec: seconds, tv_usec: 0)
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, socklen_t(MemoryLayout<timeval>.size))
    }

    func close() {
        writeLock.lock()
        closed = true
        writeLock.unlock()
        Darwin.close(fd)
    }
}
