import CSoullabAtomics

/// Single-producer / single-consumer lock-free ring of Float32 samples.
///
/// The producer is the realtime audio callback; the consumer is the writer queue.
/// Storage is allocated once, at construction, off the realtime thread. `write` never
/// blocks, allocates or locks: if a whole block does not fit, it is rejected and the
/// caller counts it as an overrun.
public final class RingBuffer: @unchecked Sendable {
    public let capacity: Int
    private let mask: Int
    private let storage: UnsafeMutablePointer<Float>
    private let writeIndex: OpaquePointer // sl_atomic_i64*
    private let readIndex: OpaquePointer

    /// - Parameter minimumCapacity: samples (not frames). Rounded up to a power of two.
    public init(minimumCapacity: Int) {
        precondition(minimumCapacity > 0)
        var cap = 1
        while cap < minimumCapacity { cap <<= 1 }
        capacity = cap
        mask = cap - 1
        storage = UnsafeMutablePointer<Float>.allocate(capacity: cap)
        storage.initialize(repeating: 0, count: cap)
        writeIndex = sl_atomic_i64_create(0)
        readIndex = sl_atomic_i64_create(0)
    }

    deinit {
        storage.deallocate()
        sl_atomic_i64_destroy(writeIndex)
        sl_atomic_i64_destroy(readIndex)
    }

    /// Ring sized for at least `seconds` of audio.
    public convenience init(seconds: Double, sampleRate: Double, channels: Int) {
        self.init(minimumCapacity: Int((seconds * sampleRate).rounded(.up)) * channels)
    }

    public var availableToRead: Int {
        Int(sl_atomic_i64_load_acquire(writeIndex) - sl_atomic_i64_load_acquire(readIndex))
    }

    /// Producer side. Realtime safe. Returns false (and writes nothing) when `count`
    /// samples do not fit.
    @inline(__always)
    public func write(_ source: UnsafePointer<Float>, count: Int) -> Bool {
        let w = sl_atomic_i64_load_relaxed(writeIndex)
        let r = sl_atomic_i64_load_acquire(readIndex)
        let free = capacity - Int(w - r)
        if count > free { return false }
        let start = Int(w) & mask
        let first = min(count, capacity - start)
        (storage + start).update(from: source, count: first)
        if first < count {
            storage.update(from: source + first, count: count - first)
        }
        sl_atomic_i64_store_release(writeIndex, w + Int64(count))
        return true
    }

    /// Consumer side. Copies up to `maxCount` samples into `destination`.
    public func read(into destination: UnsafeMutablePointer<Float>, maxCount: Int) -> Int {
        let r = sl_atomic_i64_load_relaxed(readIndex)
        let w = sl_atomic_i64_load_acquire(writeIndex)
        let count = min(maxCount, Int(w - r))
        if count <= 0 { return 0 }
        let start = Int(r) & mask
        let first = min(count, capacity - start)
        destination.update(from: storage + start, count: first)
        if first < count {
            (destination + first).update(from: storage, count: count - first)
        }
        sl_atomic_i64_store_release(readIndex, r + Int64(count))
        return count
    }
}

/// A shared counter that the realtime thread may increment without locks.
public final class AtomicCounter: @unchecked Sendable {
    private let pointer: OpaquePointer

    public init(_ initial: Int64 = 0) {
        pointer = sl_atomic_i64_create(initial)
    }

    deinit { sl_atomic_i64_destroy(pointer) }

    @inline(__always) public func add(_ delta: Int64) {
        _ = sl_atomic_i64_fetch_add(pointer, delta)
    }

    @inline(__always) public var value: Int64 { sl_atomic_i64_load_acquire(pointer) }

    @inline(__always) public func store(_ value: Int64) {
        sl_atomic_i64_store_release(pointer, value)
    }

    public static var isLockFree: Bool { sl_atomic_i64_is_lock_free() == 1 }
}
