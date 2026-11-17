// soullab-capture-helper
//
// Records one selected application's audio output to a local 24-bit WAV, for Soullab
// Sound Studio (owner: SoullabTech/Sovereign#1979). Launched by MAIA Desktop's main process
// (integration is a later, separately authorized stage). Serves one local Unix socket; never
// connects to a network; never starts capturing without an explicit `start` request.
//
// Usage:
//   soullab-capture-helper --root <dir> --socket <path> --token-file <path> [--synthetic]
//
// --synthetic exists only in DEBUG builds. Exit codes: 0 normal, 2 authentication failed,
// 64 usage, 65 protocol violation, 69 platform unsupported.

import AppKit
import Foundation
import SoullabCaptureCore

let helperVersion = "0.1.0"
#if DEBUG
let buildKind = "debug"
#else
let buildKind = "release"
#endif

func fail(_ code: Int32, _ message: String) -> Never {
    FileHandle.standardError.write(Data("soullab-capture-helper: \(message)\n".utf8))
    exit(code)
}

struct Arguments {
    var root: String?
    var socket: String?
    var tokenFile: String?
    var synthetic = false
}

func parseArguments() -> Arguments {
    var args = Arguments()
    var it = CommandLine.arguments.dropFirst().makeIterator()
    while let arg = it.next() {
        switch arg {
        case "--root": args.root = it.next()
        case "--socket": args.socket = it.next()
        case "--token-file": args.tokenFile = it.next()
        case "--synthetic": args.synthetic = true
        default: fail(64, "unknown argument")
        }
    }
    return args
}

/// The token file must be a regular file owned by this user with no group/other access.
func readToken(_ path: String) -> String {
    var st = stat()
    guard lstat(path, &st) == 0, (st.st_mode & S_IFMT) == S_IFREG, st.st_uid == getuid(), st.st_mode & 0o077 == 0 else {
        fail(64, "token file must be a 0600 regular file owned by this user")
    }
    guard let raw = try? String(contentsOfFile: path, encoding: .utf8) else { fail(64, "token file unreadable") }
    let token = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard (32...512).contains(token.utf8.count) else { fail(64, "token length") }
    return token
}

signal(SIGPIPE, SIG_IGN)
let arguments = parseArguments()
guard let rootPath = arguments.root, let socketPath = arguments.socket, let tokenPath = arguments.tokenFile else {
    fail(64, "--root, --socket and --token-file are required")
}

let root: URL
do {
    root = try StorageGuard.resolveRoot(URL(fileURLWithPath: rootPath, isDirectory: true))
} catch {
    fail(64, "storage root is not a writable directory")
}
let token = readToken(tokenPath)

let catalog: SourceCatalog
let mode: String
var orphansRemoved = 0
if arguments.synthetic {
    #if DEBUG
    catalog = SyntheticCatalog()
    mode = "synthetic"
    #else
    fail(64, "--synthetic is not available in release builds")
    #endif
} else if #available(macOS 14.2, *) {
    let provider = CoreAudioTapProvider()
    orphansRemoved = TapCleanup.sweep(provider).count
    catalog = CoreAudioSourceCatalog(provider: provider)
    mode = "processTap"
} else {
    fail(69, "process taps need macOS 14.2 or later")
}

let recovery = TakeRecovery.recover(root: root, helperVersion: helperVersion)

let listener: Int32
do {
    listener = try SocketServer.listen(path: socketPath)
} catch {
    fail(64, "cannot serve the control socket: \(error)")
}

final class ServerSlot: @unchecked Sendable {
    private let lock = NSLock()
    private var value: HelperServer?
    func set(_ s: HelperServer) { lock.lock(); value = s; lock.unlock() }
    func get() -> HelperServer? { lock.lock(); defer { lock.unlock() }; return value }
}
let slot = ServerSlot()
let serveCatalog = catalog, serveMode = mode, serveOrphans = orphansRemoved

Thread.detachNewThread {
    let client: Int32
    do {
        client = try SocketServer.acceptOne(listener: listener, path: socketPath)
    } catch {
        fail(2, "client rejected")
    }
    let s = HelperServer(version: helperVersion, build: buildKind, mode: serveMode, token: token, root: root,
                         catalog: serveCatalog, recovery: recovery, orphansRemoved: serveOrphans,
                         connection: Connection(fd: client))
    slot.set(s)
    s.run()
}

// SIGTERM: finalize any take, then exit. Handlers run on the main queue: top-level code is
// main-actor isolated in Swift 6, and running them elsewhere traps at runtime.
signal(SIGTERM, SIG_IGN)
let termSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
termSource.setEventHandler {
    if let s = slot.get() {
        s.finish(code: 0, reason: .terminated)
    }
    exit(0)
}
termSource.resume()

// System sleep: finalize. Wake does nothing.
let sleepObserver = NSWorkspace.shared.notificationCenter.addObserver(
    forName: NSWorkspace.willSleepNotification, object: nil, queue: .main
) { _ in
    DispatchQueue.global().async { slot.get()?.stopForSleep() }
}

withExtendedLifetime(sleepObserver) {
    RunLoop.main.run()
}
