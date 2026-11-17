import CoreAudio
import Foundation
import SoullabCaptureCore

/// A thread-safe box for test bookkeeping.
public final class Locked<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: T
    public init(_ value: T) { self.value = value }
    public func get() -> T { lock.lock(); defer { lock.unlock() }; return value }
    public func mutate<R>(_ body: (inout T) -> R) -> R { lock.lock(); defer { lock.unlock() }; return body(&value) }
}

/// Settable free-space probe.
public final class FakeProbe: FreeSpaceProbe, @unchecked Sendable {
    private let bytes: Locked<Int64>
    public init(_ available: Int64 = 500 * 1024 * 1024 * 1024) { bytes = Locked(available) }
    public func set(_ value: Int64) { bytes.mutate { $0 = value } }
    public func availableBytes(at url: URL) -> Int64? { bytes.get() }
}

/// A source the test drives by hand: frames are pushed synchronously into the sink.
public final class FakeSource: AudioSource, @unchecked Sendable {
    public enum StartMode: Sendable {
        case immediate
        case deferred
        case fail(CaptureError)
    }

    public let descriptor: SourceDescriptor
    public let format: SourceFormat
    public var mode: StartMode
    public let startCount = Locked(0)
    public let stopCount = Locked(0)
    private let state = Locked<(sink: RealtimeSink?, onEnded: (@Sendable (StopReason) -> Void)?,
                                completion: (@Sendable (Result<SourceFormat, CaptureError>) -> Void)?)>((nil, nil, nil))
    public private(set) var framesPushed: Int64 = 0

    public init(sampleRate: Double = 48_000, channels: Int = 2, mode: StartMode = .immediate) {
        format = SourceFormat(sampleRate: sampleRate, channels: channels, interleaved: true)
        descriptor = SourceDescriptor(kind: .test, id: "test:fake", name: "Fake source")
        self.mode = mode
    }

    public func start(makeSink: @escaping @Sendable (SourceFormat) throws -> RealtimeSink,
                      onEnded: @escaping @Sendable (StopReason) -> Void,
                      completion: @escaping @Sendable (Result<SourceFormat, CaptureError>) -> Void) {
        startCount.mutate { $0 += 1 }
        if case .fail(let error) = mode {
            completion(.failure(error))
            return
        }
        do {
            let sink = try makeSink(format)
            state.mutate { $0 = (sink, onEnded, completion) }
        } catch let error as CaptureError {
            completion(.failure(error)); return
        } catch {
            completion(.failure(CaptureError(.formatUnsupported))); return
        }
        if case .immediate = mode { completion(.success(format)) }
    }

    /// Completes a deferred start (possibly after the session cancelled it).
    public func completeDeferredStart() {
        let completion = state.get().completion
        completion?(.success(format))
    }

    public func stop() {
        stopCount.mutate { $0 += 1 }
    }

    public var sink: RealtimeSink? { state.get().sink }

    /// Pushes `frames` of the deterministic ramp signal, continuing the sequence.
    public func pushRamp(frames: Int, block: Int = 512, sampleTime: Double? = nil) {
        guard let sink else { return }
        let channels = format.channels
        var remaining = frames
        var time = sampleTime ?? Double(framesPushed)
        let buffer = UnsafeMutablePointer<Float>.allocate(capacity: block * channels)
        defer { buffer.deallocate() }
        while remaining > 0 {
            let n = min(block, remaining)
            for f in 0..<n {
                for c in 0..<channels {
                    buffer[f * channels + c] = Float(TestSignal.ramp(frame: framesPushed + Int64(f), channel: c)) / SampleEncoder.scale
                }
            }
            sink.push(buffer, frames: n, sampleTime: time)
            framesPushed += Int64(n)
            time += Double(n)
            remaining -= n
        }
    }

    public func end(_ reason: StopReason) {
        state.get().onEnded?(reason)
    }
}

public enum TestSignal {
    /// Same pattern as the debug helper's synthetic ramp.
    public static func ramp(frame: Int64, channel: Int) -> Int32 {
        let k = (frame &* 7 &+ Int64(channel) &* 3) % 16_777_215
        return Int32(k - 8_388_607)
    }
}

/// Records every Core Audio call a `ProcessTapSource` makes, without touching Core Audio.
public final class FakeTapProvider: TapProvider, @unchecked Sendable {
    public let log = Locked<[String]>([])
    public var format = SourceFormat(sampleRate: 48_000, channels: 2, interleaved: true)
    public var failAt: String?
    public var failCode: CaptureErrorCode = .tapFailed
    public var orphans: [OrphanObject] = []
    private let handler = Locked<TapIOHandler?>(nil)
    private let ended = Locked<(@Sendable (StopReason) -> Void)?>(nil)
    private let overload = Locked<(@Sendable () -> Void)?>(nil)

    final class Token: TapListenerToken, @unchecked Sendable {}

    public init() {}

    private func record(_ call: String) throws {
        log.mutate { $0.append(call) }
        if failAt == call { throw CaptureError(failCode, "fake failure at \(call)") }
    }

    public func translatePID(_ pid: pid_t) throws -> AudioObjectID { try record("translatePID"); return 10 }
    public func createProcessTap(processObject: AudioObjectID, mono: Bool, uuid: UUID, name: String) throws -> AudioObjectID {
        try record("createTap"); return 20
    }
    public func tapFormat(_ tap: AudioObjectID) throws -> SourceFormat { try record("tapFormat"); return format }
    public func createAggregate(uid: String, name: String, tapUUID: UUID) throws -> AudioObjectID {
        try record("createAggregate"); return 30
    }
    public func createIOProc(device: AudioObjectID, handler: @escaping TapIOHandler) throws -> TapIOProc {
        try record("createIOProc")
        self.handler.mutate { $0 = handler }
        return TapIOProc(raw: nil, testID: 40)
    }
    public func addLifecycleListener(processObject: AudioObjectID, device: AudioObjectID, tap: AudioObjectID,
                                     onOverload: @escaping @Sendable () -> Void,
                                     onEnded: @escaping @Sendable (StopReason) -> Void) throws -> TapListenerToken {
        try record("addListener")
        ended.mutate { $0 = onEnded }
        overload.mutate { $0 = onOverload }
        return Token()
    }
    public func startIO(device: AudioObjectID, proc: TapIOProc) throws { try record("startIO") }
    public func stopIO(device: AudioObjectID, proc: TapIOProc) {
        log.mutate { $0.append("stopIO") }
        handler.mutate { $0 = nil }
    }
    public func destroyIOProc(device: AudioObjectID, proc: TapIOProc) { log.mutate { $0.append("destroyIOProc") } }
    public func removeLifecycleListener(_ token: TapListenerToken) { log.mutate { $0.append("removeListener") } }
    public func destroyAggregate(_ device: AudioObjectID) { log.mutate { $0.append("destroyAggregate:\(device)") } }
    public func destroyTap(_ tap: AudioObjectID) { log.mutate { $0.append("destroyTap:\(tap)") } }
    public func listOrphans() -> [OrphanObject] { orphans }

    public func fireEnded(_ reason: StopReason) { ended.get()?(reason) }
    public func fireOverload() { overload.get()?() }

    /// Delivers non-interleaved Float32 buffers (one per channel), as a tap may.
    public func deliverNonInterleaved(_ channels: [[Float]], sampleTime: Double) {
        guard let handler = handler.get() else { return }
        let list = AudioBufferList.allocate(maximumBuffers: channels.count)
        defer { free(list.unsafeMutablePointer) }
        var storage: [UnsafeMutablePointer<Float>] = []
        for (i, samples) in channels.enumerated() {
            let p = UnsafeMutablePointer<Float>.allocate(capacity: samples.count)
            p.initialize(from: samples, count: samples.count)
            storage.append(p)
            list[i] = AudioBuffer(mNumberChannels: 1, mDataByteSize: UInt32(samples.count * 4), mData: p)
        }
        defer { storage.forEach { $0.deallocate() } }
        var time = AudioTimeStamp()
        time.mSampleTime = sampleTime
        time.mFlags = .sampleTimeValid
        handler(list.unsafePointer, &time)
    }
}

/// Collects session events for assertions.
public final class EventLog: @unchecked Sendable {
    private let events = Locked<[CaptureEvent]>([])
    public init() {}
    public var handler: @Sendable (CaptureEvent) -> Void { { [self] e in events.mutate { $0.append(e) } } }
    public var all: [CaptureEvent] { events.get() }

    public var errors: [CaptureErrorCode] {
        all.compactMap { if case .error(let c) = $0 { return c } else { return nil } }
    }
    public var states: [CaptureState] {
        all.compactMap { if case .state(let s, _) = $0 { return s } else { return nil } }
    }
    public var finalized: [TakeResult] {
        all.compactMap { if case .finalized(let t) = $0 { return t } else { return nil } }
    }
    public var storageLow: [Int64] {
        all.compactMap { if case .storageLow(let b) = $0 { return b } else { return nil } }
    }
}

public func makeTempDirectory(_ label: String = "slc") -> URL {
    let base = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
    let url = base.appendingPathComponent("\(label)-\(UUID().uuidString.prefix(8))", isDirectory: true)
    try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    chmod(url.path, 0o700)
    return try! StorageGuard.resolveRoot(url)
}

/// Waits (polling) for a condition, up to `timeout` seconds.
@discardableResult
public func eventually(_ timeout: TimeInterval = 3, _ condition: () -> Bool) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
        if condition() { return true }
        Thread.sleep(forTimeInterval: 0.01)
    }
    return condition()
}
