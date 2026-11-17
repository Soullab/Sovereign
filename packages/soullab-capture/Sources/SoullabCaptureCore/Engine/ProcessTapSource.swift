import CoreAudio
import Foundation

/// C1 source: one application's audio output, captured with a Core Audio process tap.
///
/// Start (on `controlQueue`): translate PID → create a private, unmuted tap of that one
/// process → read the tap's format → build the sink → create a private aggregate device
/// holding only the tap → create the IO proc → listen for source exit, output-device
/// change and format change → start IO.
///
/// Stop (also on `controlQueue`, so it can never interleave with a start): remove the
/// listener → stop IO → destroy IO proc → destroy aggregate → destroy tap. Every stop path
/// runs the same cleanup, including a failed or cancelled start.
public final class ProcessTapSource: AudioSource, @unchecked Sendable {
    public let descriptor: SourceDescriptor
    private let provider: TapProvider
    private let pid: pid_t
    private let channels: Int
    private let controlQueue: DispatchQueue

    // Owned by controlQueue.
    private var tap: AudioObjectID?
    private var aggregate: AudioObjectID?
    private var ioProc: TapIOProc?
    private var listener: TapListenerToken?
    private var ioRunning = false

    // Strong owner (controlQueue) and an unretained alias read on the realtime thread, so
    // the callback does no reference counting. IO always stops before either is cleared.
    private var sink: RealtimeSink?
    private unowned(unsafe) var realtimeSink: RealtimeSink?
    private var scratch: UnsafeMutablePointer<Float>?
    private static let scratchFrames = 16_384

    public init(provider: TapProvider, descriptor: SourceDescriptor, pid: pid_t, channels: Int,
                controlQueue: DispatchQueue = DispatchQueue(label: "life.soullab.capture.tap-control")) {
        self.provider = provider
        self.descriptor = descriptor
        self.pid = pid
        self.channels = channels
        self.controlQueue = controlQueue
    }

    deinit {
        cleanup()
        scratch?.deallocate()
    }

    public func start(makeSink: @escaping @Sendable (SourceFormat) throws -> RealtimeSink,
                      onEnded: @escaping @Sendable (StopReason) -> Void,
                      completion: @escaping @Sendable (Result<SourceFormat, CaptureError>) -> Void) {
        controlQueue.async { [self] in
            do {
                let processObject = try provider.translatePID(pid)
                let uuid = UUID()
                let tapID = try provider.createProcessTap(processObject: processObject, mono: channels == 1, uuid: uuid,
                                                          name: CapturePolicy.objectPrefix + "tap." + uuid.uuidString)
                tap = tapID
                let format = try provider.tapFormat(tapID)
                let madeSink = try makeSink(format)
                if !format.interleaved || format.channels != madeSink.format.channels {
                    scratch = .allocate(capacity: Self.scratchFrames * max(1, madeSink.format.channels))
                }
                sink = madeSink
                realtimeSink = madeSink
                let device = try provider.createAggregate(uid: CapturePolicy.objectPrefix + "aggregate." + uuid.uuidString,
                                                          name: "Soullab Capture", tapUUID: uuid)
                aggregate = device
                ioProc = try provider.createIOProc(device: device) { [unowned(unsafe) self] buffers, time in
                    self.render(buffers, time)
                }
                listener = try provider.addLifecycleListener(
                    processObject: processObject, device: device, tap: tapID,
                    onOverload: { [weak self] in self?.sink?.noteProcessorOverload() },
                    onEnded: onEnded)
                try provider.startIO(device: device, proc: ioProc!)
                ioRunning = true
                completion(.success(format))
            } catch let error as CaptureError {
                cleanup()
                completion(.failure(error))
            } catch {
                cleanup()
                completion(.failure(CaptureError(.tapFailed, "\(error)")))
            }
        }
    }

    public func stop() {
        controlQueue.sync { cleanup() }
    }

    private func cleanup() {
        if let listener {
            provider.removeLifecycleListener(listener)
            self.listener = nil
        }
        if let aggregate, let ioProc {
            if ioRunning {
                provider.stopIO(device: aggregate, proc: ioProc)
                ioRunning = false
            }
            provider.destroyIOProc(device: aggregate, proc: ioProc)
        }
        ioProc = nil
        if let aggregate {
            provider.destroyAggregate(aggregate)
            self.aggregate = nil
        }
        if let tap {
            provider.destroyTap(tap)
            self.tap = nil
        }
        realtimeSink = nil
        sink = nil
    }

    /// Realtime IO thread. No allocation, locks or I/O.
    private func render(_ list: UnsafePointer<AudioBufferList>, _ time: UnsafePointer<AudioTimeStamp>) {
        guard let sink = realtimeSink else { return }
        let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: list))
        let sampleTime = time.pointee.mFlags.contains(.sampleTimeValid) ? time.pointee.mSampleTime : .nan
        let outChannels = sink.format.channels

        if buffers.count == 1, Int(buffers[0].mNumberChannels) == outChannels, let data = buffers[0].mData {
            let frames = Int(buffers[0].mDataByteSize) / (MemoryLayout<Float>.size * outChannels)
            sink.push(data.assumingMemoryBound(to: Float.self), frames: frames, sampleTime: sampleTime)
            return
        }

        // Non-interleaved (one buffer per channel) or channel mismatch: interleave into scratch.
        guard let scratch, buffers.count > 0, let first = buffers[0].mData else { return }
        let firstChannels = max(1, Int(buffers[0].mNumberChannels))
        let totalFrames = Int(buffers[0].mDataByteSize) / (MemoryLayout<Float>.size * firstChannels)
        var done = 0
        while done < totalFrames {
            let n = min(Self.scratchFrames, totalFrames - done)
            for c in 0..<outChannels {
                let (buffer, stride, offset): (UnsafeMutableRawPointer, Int, Int) = {
                    if buffers.count >= outChannels, let d = buffers[c].mData {
                        return (d, max(1, Int(buffers[c].mNumberChannels)), 0)
                    }
                    return (first, firstChannels, min(c, firstChannels - 1))
                }()
                let src = buffer.assumingMemoryBound(to: Float.self)
                for f in 0..<n {
                    scratch[f * outChannels + c] = src[(done + f) * stride + offset]
                }
            }
            let t = sampleTime.isFinite ? sampleTime + Double(done) : sampleTime
            sink.push(scratch, frames: n, sampleTime: t)
            done += n
        }
    }
}
