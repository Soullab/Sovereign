import Foundation

/// Fixed-capacity SPSC queue of discontinuity markers, written by the realtime thread.
/// Preallocated; never allocates or locks on push. A full queue counts the loss instead.
public final class MarkerQueue: @unchecked Sendable {
    public static let defaultCapacity = 1024

    private let capacity: Int
    private let kinds: UnsafeMutablePointer<Int64>
    private let positions: UnsafeMutablePointer<Int64>
    private let lost: UnsafeMutablePointer<Int64>
    private let writeIndex = AtomicCounter()
    private let readIndex = AtomicCounter()
    public let droppedMarkers = AtomicCounter()

    public init(capacity: Int = MarkerQueue.defaultCapacity) {
        self.capacity = capacity
        kinds = .allocate(capacity: capacity)
        positions = .allocate(capacity: capacity)
        lost = .allocate(capacity: capacity)
        kinds.initialize(repeating: 0, count: capacity)
        positions.initialize(repeating: 0, count: capacity)
        lost.initialize(repeating: 0, count: capacity)
    }

    deinit {
        kinds.deallocate()
        positions.deallocate()
        lost.deallocate()
    }

    /// Realtime safe.
    @inline(__always)
    public func push(kind: Discontinuity.Kind, framePosition: Int64, lostFrames: Int64) {
        let w = writeIndex.value
        let r = readIndex.value
        if Int(w - r) >= capacity {
            droppedMarkers.add(1)
            return
        }
        let slot = Int(w) % capacity
        kinds[slot] = Self.code(kind)
        positions[slot] = framePosition
        lost[slot] = lostFrames
        writeIndex.store(w + 1)
    }

    /// Consumer side.
    public func drain() -> [Discontinuity] {
        var out: [Discontinuity] = []
        var r = readIndex.value
        let w = writeIndex.value
        while r < w {
            let slot = Int(r) % capacity
            out.append(Discontinuity(kind: Self.kind(kinds[slot]), framePosition: positions[slot], lostFrames: lost[slot]))
            r += 1
        }
        readIndex.store(r)
        return out
    }

    @inline(__always) private static func code(_ kind: Discontinuity.Kind) -> Int64 {
        switch kind {
        case .overrun: return 0
        case .timestampGap: return 1
        case .processorOverload: return 2
        case .recovered: return 3
        }
    }

    private static func kind(_ code: Int64) -> Discontinuity.Kind {
        switch code {
        case 0: return .overrun
        case 1: return .timestampGap
        case 2: return .processorOverload
        default: return .recovered
        }
    }
}

/// The realtime side of a take: ring buffer, markers and counters.
///
/// `push` is called from the source's realtime thread only. It performs no allocation,
/// locking, logging or I/O. Everything it touches is allocated in `init`.
public final class RealtimeSink: @unchecked Sendable {
    public let format: CaptureFormat
    public let ring: RingBuffer
    public let markers: MarkerQueue
    /// Frames accepted into the ring. Equals the file frame position of the next frame.
    public let framesAccepted = AtomicCounter()
    public let overrunFrames = AtomicCounter()
    /// Incremented from any thread by the source's overload listener.
    public let overloadEvents = AtomicCounter()

    // Realtime-thread only.
    private var expectedSampleTime: Double = -1

    public init(format: CaptureFormat, ringSeconds: Double = CapturePolicy.ringSeconds) {
        self.format = format
        ring = RingBuffer(seconds: ringSeconds, sampleRate: format.sampleRate, channels: format.channels)
        markers = MarkerQueue()
    }

    /// Realtime safe. `interleaved` holds `frames * format.channels` samples.
    @inline(__always)
    public func push(_ interleaved: UnsafePointer<Float>, frames: Int, sampleTime: Double) {
        if sampleTime.isFinite {
            if expectedSampleTime >= 0, sampleTime != expectedSampleTime {
                let jump = (sampleTime - expectedSampleTime).rounded()
                markers.push(kind: .timestampGap, framePosition: framesAccepted.value, lostFrames: jump > 0 ? Int64(jump) : 0)
            }
            expectedSampleTime = sampleTime + Double(frames)
        }
        if ring.write(interleaved, count: frames * format.channels) {
            framesAccepted.add(Int64(frames))
        } else {
            overrunFrames.add(Int64(frames))
            markers.push(kind: .overrun, framePosition: framesAccepted.value, lostFrames: Int64(frames))
        }
    }

    /// Any thread.
    public func noteProcessorOverload() {
        overloadEvents.add(1)
    }
}

/// Merges adjacent markers of the same kind at the same file position (for example a run
/// of dropped blocks while the writer was stalled) into one, summing the lost frames.
enum DiscontinuityMerger {
    static func merge(_ existing: inout [Discontinuity], _ incoming: [Discontinuity]) -> [Discontinuity] {
        var added: [Discontinuity] = []
        for marker in incoming {
            if let last = existing.last, last.kind == marker.kind, last.framePosition == marker.framePosition {
                let merged = Discontinuity(kind: last.kind, framePosition: last.framePosition, lostFrames: last.lostFrames + marker.lostFrames)
                existing[existing.count - 1] = merged
                if let addedLast = added.last, addedLast.framePosition == merged.framePosition, addedLast.kind == merged.kind {
                    added[added.count - 1] = merged
                } else {
                    added.append(merged)
                }
            } else {
                existing.append(marker)
                added.append(marker)
            }
        }
        return added
    }
}
