import Foundation

/// Events a session reports to its host. Delivered on the session queue.
public enum CaptureEvent: Sendable {
    case state(CaptureState, generation: Int)
    case meter(MeterSnapshot)
    case discontinuity(Discontinuity)
    case storageLow(availableBytes: Int64)
    case finalized(TakeResult)
    case error(CaptureErrorCode)
}

public struct SessionConfig: Sendable {
    public var root: URL
    public var probe: FreeSpaceProbe
    public var helperVersion: String
    /// Test hook: a smaller size limit than the RIFF limit.
    public var maxDataBytes: Int64?
    /// When false, the writer timer is not started; tests call `drainForTesting()`.
    public var automaticDrain: Bool
    public var clock: @Sendable () -> Date

    public init(root: URL, probe: FreeSpaceProbe = StatfsFreeSpaceProbe(), helperVersion: String,
                maxDataBytes: Int64? = nil, automaticDrain: Bool = true,
                clock: @escaping @Sendable () -> Date = { Date() }) {
        self.root = root
        self.probe = probe
        self.helperVersion = helperVersion
        self.maxDataBytes = maxDataBytes
        self.automaticDrain = automaticDrain
        self.clock = clock
    }
}

public struct SessionStatus: Sendable, Codable, Equatable {
    public let state: CaptureState
    public let generation: Int
    public let takeName: String?
    public let source: SourceDescriptor?
    public let framesWritten: Int64
    public let seconds: Double
    public let discontinuities: Int
}

/// One capture session: prepare → start → record → stop → finalize → idle.
///
/// All state lives on one serial queue. Public methods must not be called from that queue
/// (the event handler runs on it). The realtime thread touches only the `RealtimeSink`.
public final class CaptureSession: @unchecked Sendable {
    private let config: SessionConfig
    private let queue = DispatchQueue(label: "life.soullab.capture.session")
    private let queueKey = DispatchSpecificKey<Bool>()
    private let emit: @Sendable (CaptureEvent) -> Void

    private struct Prepared {
        let source: AudioSource
        let name: String
        let paths: StorageGuard.TakePaths
        let member: MemberFields
    }

    private final class Active {
        let prepared: Prepared
        let takeId: String
        let sink: RealtimeSink
        let writer: TakeWriter
        let meter: LevelMeter
        let startedAt: Date
        var markers: [Discontinuity] = []
        var encoderClips: Int64 = 0
        var overloadsSeen: Int64 = 0
        var lastCheckpoint: Date
        var lastMeter: Date
        var lastStorageCheck: Date
        var storageLowSent = false
        let floatScratch: UnsafeMutablePointer<Float>
        let byteScratch: UnsafeMutablePointer<UInt8>
        let scratchSamples: Int

        init(prepared: Prepared, takeId: String, sink: RealtimeSink, writer: TakeWriter, startedAt: Date) {
            self.prepared = prepared
            self.takeId = takeId
            self.sink = sink
            self.writer = writer
            self.startedAt = startedAt
            meter = LevelMeter(channels: sink.format.channels, sampleRate: sink.format.sampleRate)
            lastCheckpoint = startedAt
            lastMeter = startedAt
            lastStorageCheck = startedAt
            let channels = sink.format.channels
            scratchSamples = (65_536 / channels) * channels
            floatScratch = .allocate(capacity: scratchSamples)
            byteScratch = .allocate(capacity: scratchSamples * CaptureFormat.bytesPerSample)
        }

        deinit {
            floatScratch.deallocate()
            byteScratch.deallocate()
        }
    }

    private final class SinkBox: @unchecked Sendable {
        private let lock = NSLock()
        private var value: RealtimeSink?
        func set(_ s: RealtimeSink) { lock.lock(); value = s; lock.unlock() }
        func get() -> RealtimeSink? { lock.lock(); defer { lock.unlock() }; return value }
    }

    private var state: CaptureState = .idle
    private var generation = 0
    private var prepared: Prepared?
    private var active: Active?
    private var timer: DispatchSourceTimer?

    public init(config: SessionConfig, events: @escaping @Sendable (CaptureEvent) -> Void) {
        self.config = config
        self.emit = events
        queue.setSpecific(key: queueKey, value: true)
    }

    private func onQueue<T>(_ body: () throws -> T) rethrows -> T {
        precondition(DispatchQueue.getSpecific(key: queueKey) != true, "CaptureSession API called from its own queue")
        return try queue.sync(execute: body)
    }

    // MARK: Public API

    public func status() -> SessionStatus {
        onQueue {
            SessionStatus(state: state, generation: generation, takeName: prepared?.name,
                          source: prepared?.source.descriptor,
                          framesWritten: active?.writer.framesWritten ?? 0,
                          seconds: active.map { Double($0.writer.framesWritten) / $0.sink.format.sampleRate } ?? 0,
                          discontinuities: active?.markers.count ?? 0)
        }
    }

    /// Chooses a source and a take name. Opens nothing and captures nothing.
    public func prepare(source: AudioSource, takeName: String, member: MemberFields = MemberFields()) throws {
        try onQueue {
            guard state == .idle || state == .prepared else {
                throw CaptureError(.invalidState, "prepare while \(state.rawValue)")
            }
            try member.validate()
            let paths = try StorageGuard.paths(root: config.root, name: takeName)
            guard StorageGuard.isAvailable(paths) else { throw CaptureError(.nameExists) }
            try checkStorage(for: nil)
            prepared = Prepared(source: source, name: takeName, paths: paths, member: member)
            setState(.prepared)
        }
    }

    /// Explicit start. The only path that asks a source to begin capturing.
    public func start() throws {
        try onQueue {
            switch state {
            case .prepared: break
            case .starting: throw CaptureError(.alreadyStarting)
            default: throw CaptureError(.invalidState, "start while \(state.rawValue)")
            }
            guard let prep = prepared else { throw CaptureError(.invalidState) }
            guard StorageGuard.isAvailable(prep.paths) else { throw CaptureError(.nameExists) }
            try checkStorage(for: nil)

            generation += 1
            let g = generation
            setState(.starting)
            let box = SinkBox()
            prep.source.start(
                makeSink: { format in
                    let captureFormat = try CaptureFormat(sampleRate: format.sampleRate, channels: format.channels)
                    let sink = RealtimeSink(format: captureFormat)
                    box.set(sink)
                    return sink
                },
                onEnded: { [weak self] reason in
                    guard let self else { return }
                    self.queue.async { self.sourceEnded(generation: g, reason: reason) }
                },
                completion: { [weak self] result in
                    guard let self else {
                        prep.source.stop()
                        return
                    }
                    self.queue.async { self.startCompleted(generation: g, source: prep.source, box: box, result: result) }
                }
            )
        }
    }

    /// Explicit stop. Finalizes whatever was captured. Returns the take, if one was recording.
    @discardableResult
    public func stop(reason: StopReason = .memberStop) -> TakeResult? {
        onQueue { stopOnQueue(reason) }
    }

    /// Test hook: one writer cycle (drain, meter, checkpoint, storage check).
    public func drainForTesting(forceCheckpoint: Bool = true) {
        onQueue { tick(forceCheckpoint: forceCheckpoint) }
    }

    // MARK: Start / end handling

    private func startCompleted(generation g: Int, source: AudioSource, box: SinkBox,
                                result: Result<SourceFormat, CaptureError>) {
        guard g == generation, state == .starting, let prep = prepared, prep.source === source else {
            // A late result for a start that was cancelled or superseded: release everything it made.
            source.stop()
            return
        }
        switch result {
        case .failure(let error):
            source.stop()
            emit(.error(error.code))
            setState(.prepared)
        case .success:
            guard let sink = box.get() else {
                source.stop()
                emit(.error(.formatUnsupported))
                setState(.prepared)
                return
            }
            do {
                try checkStorage(for: sink.format)
                let takeId = UUID().uuidString.lowercased()
                let now = config.clock()
                let header = WAVLayout.HeaderInfo(
                    format: sink.format,
                    description: "Soullab Capture take \(takeId)",
                    originatorReference: String(takeId.prefix(32)),
                    originationDate: now,
                    codingHistory: "A=PCM,F=\(Int(sink.format.sampleRate)),W=24,M=\(sink.format.channelLabel),T=Soullab Capture \(config.helperVersion); no dither; source=\(prep.source.descriptor.kind.rawValue)\r\n")
                let journal = TakeJournal(takeId: takeId, name: prep.name, state: .recording,
                                          sampleRate: sink.format.sampleRate, channels: sink.format.channels,
                                          dataOffset: 0, source: prep.source.descriptor, member: prep.member,
                                          startedAt: now, helperVersion: config.helperVersion,
                                          finalDataBytes: nil, markers: [], clipSamples: 0)
                let writer = try TakeWriter(paths: prep.paths, header: header, journal: journal, maxDataBytes: config.maxDataBytes)
                active = Active(prepared: prep, takeId: takeId, sink: sink, writer: writer, startedAt: now)
                setState(.recording)
                startTimer()
            } catch let error as CaptureError {
                source.stop()
                emit(.error(error.code))
                setState(.prepared)
            } catch {
                source.stop()
                emit(.error(.writeFailed))
                setState(.prepared)
            }
        }
    }

    private func sourceEnded(generation g: Int, reason: StopReason) {
        guard g == generation else { return }
        if state == .recording || state == .starting {
            _ = stopOnQueue(reason)
        }
    }

    private func stopOnQueue(_ reason: StopReason) -> TakeResult? {
        switch state {
        case .starting:
            generation += 1 // any late start result is now stale and will be cleaned up
            prepared?.source.stop()
            setState(.prepared)
            return nil
        case .recording:
            guard let take = active else { return nil }
            setState(.finalizing)
            stopTimer()
            take.prepared.source.stop()
            generation += 1
            drain(take, final: true)
            let result = finalize(take, reason: reason)
            active = nil
            prepared = nil
            setState(.idle)
            if let result { emit(.finalized(result)) }
            return result
        default:
            return nil
        }
    }

    private func finalize(_ take: Active, reason: StopReason) -> TakeResult? {
        do {
            let clips = take.encoderClips
            let finalURL = try take.writer.finalize(markers: take.markers, clipSamples: clips)
            let sha = try StreamingHash.sha256(of: finalURL)
            let size = (try FileManager.default.attributesOfItem(atPath: finalURL.path)[.size] as? NSNumber)?.int64Value ?? 0
            let record = ProvenanceRecord(
                takeId: take.takeId, file: finalURL.lastPathComponent, sha256: sha, bytes: size,
                format: take.sink.format, frames: take.writer.framesWritten, source: take.prepared.source.descriptor,
                startedAt: take.startedAt, endedAt: config.clock(), stopReason: reason, recovered: false,
                discontinuities: take.markers, clipSamples: clips, member: take.prepared.member,
                helperVersion: config.helperVersion)
            try record.write(to: take.prepared.paths.provenance)
            try? FileManager.default.removeItem(at: take.prepared.paths.journal)
            return TakeResult(record: record, path: finalURL, provenancePath: take.prepared.paths.provenance)
        } catch {
            take.writer.abandon()
            emit(.error(.writeFailed))
            return nil
        }
    }

    // MARK: Writer cycle

    private func startTimer() {
        guard config.automaticDrain else { return }
        let t = DispatchSource.makeTimerSource(queue: queue)
        t.schedule(deadline: .now() + CapturePolicy.drainInterval, repeating: CapturePolicy.drainInterval)
        t.setEventHandler { [weak self] in self?.tick(forceCheckpoint: false) }
        timer = t
        t.resume()
    }

    private func stopTimer() {
        timer?.cancel()
        timer = nil
    }

    private func tick(forceCheckpoint: Bool) {
        guard state == .recording, let take = active else { return }
        let hitLimit = drain(take, final: false)
        if hitLimit {
            _ = stopOnQueue(.sizeLimit)
            return
        }
        let now = config.clock()
        if forceCheckpoint || now.timeIntervalSince(take.lastCheckpoint) >= CapturePolicy.checkpointInterval {
            do {
                try take.writer.checkpoint(markers: take.markers, clipSamples: take.encoderClips)
            } catch {
                emit(.error(.writeFailed))
                _ = stopOnQueue(.sourceFailed)
                return
            }
            take.lastCheckpoint = now
        }
        if forceCheckpoint || now.timeIntervalSince(take.lastMeter) >= CapturePolicy.meterEventInterval {
            emit(.meter(take.meter.snapshot()))
            take.lastMeter = now
        }
        if forceCheckpoint || now.timeIntervalSince(take.lastStorageCheck) >= CapturePolicy.storageCheckInterval {
            take.lastStorageCheck = now
            if let available = config.probe.availableBytes(at: config.root) {
                if available < CapturePolicy.criticalStorageBytes {
                    _ = stopOnQueue(.storageCritical)
                    return
                }
                if available < CapturePolicy.lowStorageBytes, !take.storageLowSent {
                    take.storageLowSent = true
                    emit(.storageLow(availableBytes: available))
                }
            }
        }
    }

    /// Moves audio from the ring to disk. Returns true when the size limit was reached.
    @discardableResult
    private func drain(_ take: Active, final: Bool) -> Bool {
        let channels = take.sink.format.channels
        var hitLimit = false
        while true {
            let n = take.sink.ring.read(into: take.floatScratch, maxCount: take.scratchSamples)
            if n == 0 { break }
            let frames = n / channels
            take.meter.process(take.floatScratch, frames: frames)
            take.encoderClips += Int64(SampleEncoder.encodeS24(take.floatScratch, count: n, into: take.byteScratch))
            let bytes = UnsafeRawBufferPointer(start: take.byteScratch, count: n * CaptureFormat.bytesPerSample)
            do {
                let written = try take.writer.append(bytes)
                if written < bytes.count {
                    hitLimit = true
                    if final { continue } // keep emptying the ring; the rest cannot be stored
                    break
                }
            } catch {
                emit(.error(.writeFailed))
                hitLimit = true
                break
            }
        }

        var incoming = take.sink.markers.drain()
        let overloads = take.sink.overloadEvents.value
        if overloads > take.overloadsSeen {
            incoming.append(Discontinuity(kind: .processorOverload, framePosition: take.writer.framesWritten,
                                          lostFrames: 0))
            take.overloadsSeen = overloads
        }
        for marker in DiscontinuityMerger.merge(&take.markers, incoming) {
            emit(.discontinuity(marker))
        }
        return hitLimit
    }

    // MARK: Helpers

    private func checkStorage(for format: CaptureFormat?) throws {
        guard let available = config.probe.availableBytes(at: config.root) else { return }
        if available < CapturePolicy.startRequirement(for: format) {
            throw CaptureError(.insufficientStorage, "\(available) bytes available")
        }
    }

    private func setState(_ new: CaptureState) {
        state = new
        emit(.state(new, generation: generation))
    }
}
