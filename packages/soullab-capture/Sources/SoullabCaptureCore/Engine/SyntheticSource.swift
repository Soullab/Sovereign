#if DEBUG
import Foundation

/// Debug-only deterministic source, used to exercise the helper end to end without any
/// OS capture. Compiled out of release builds, so a release helper cannot fake input.
public final class SyntheticSource: AudioSource, @unchecked Sendable {
    public enum Signal: String, Sendable, CaseIterable {
        case sine1k
        case ramp
        case silence
    }

    public let descriptor: SourceDescriptor
    public let signal: Signal
    private let format: SourceFormat
    private let blockFrames = 480
    private let lock = NSLock()
    private var running = false
    private var finished: DispatchSemaphore?

    public init(signal: Signal, sampleRate: Double, channels: Int) {
        self.signal = signal
        format = SourceFormat(sampleRate: sampleRate, channels: channels, interleaved: true)
        descriptor = SourceDescriptor(kind: .synthetic, id: "synthetic:\(signal.rawValue)", name: "Synthetic \(signal.rawValue)")
    }

    /// The exact sample the ramp signal produces, as a 24-bit integer.
    public static func rampValue(frame: Int64, channel: Int) -> Int32 {
        let k = (frame &* 7 &+ Int64(channel) &* 3) % 16_777_215
        return Int32(k - 8_388_607)
    }

    public static func sample(_ signal: Signal, frame: Int64, channel: Int, sampleRate: Double) -> Float {
        switch signal {
        case .sine1k:
            return Float(0.5 * sin(2 * Double.pi * 1000 * Double(frame) / sampleRate))
        case .ramp:
            return Float(rampValue(frame: frame, channel: channel)) / SampleEncoder.scale
        case .silence:
            return 0
        }
    }

    public func start(makeSink: @escaping @Sendable (SourceFormat) throws -> RealtimeSink,
                      onEnded: @escaping @Sendable (StopReason) -> Void,
                      completion: @escaping @Sendable (Result<SourceFormat, CaptureError>) -> Void) {
        let sink: RealtimeSink
        do {
            sink = try makeSink(format)
        } catch let error as CaptureError {
            completion(.failure(error)); return
        } catch {
            completion(.failure(CaptureError(.formatUnsupported))); return
        }
        let done = DispatchSemaphore(value: 0)
        lock.lock(); running = true; finished = done; lock.unlock()

        let format = self.format, blockFrames = self.blockFrames, signal = self.signal
        let thread = Thread { [weak self] in
            let channels = format.channels
            let buffer = UnsafeMutablePointer<Float>.allocate(capacity: blockFrames * channels)
            defer { buffer.deallocate(); done.signal() }
            var frame: Int64 = 0
            let begin = Date()
            while self?.isRunning == true {
                for f in 0..<blockFrames {
                    for c in 0..<channels {
                        buffer[f * channels + c] = Self.sample(signal, frame: frame + Int64(f), channel: c, sampleRate: format.sampleRate)
                    }
                }
                sink.push(buffer, frames: blockFrames, sampleTime: Double(frame))
                frame += Int64(blockFrames)
                let due = begin.addingTimeInterval(Double(frame) / format.sampleRate)
                let wait = due.timeIntervalSinceNow
                if wait > 0 { Thread.sleep(forTimeInterval: wait) }
            }
        }
        thread.qualityOfService = .userInteractive
        thread.start()
        completion(.success(format))
    }

    private var isRunning: Bool {
        lock.lock(); defer { lock.unlock() }
        return running
    }

    public func stop() {
        lock.lock()
        let wasRunning = running
        running = false
        let done = finished
        finished = nil
        lock.unlock()
        if wasRunning { done?.wait() }
    }
}

/// Debug-only catalog of synthetic sources.
public final class SyntheticCatalog: SourceCatalog, @unchecked Sendable {
    public init() {}

    public func listSources() throws -> [SourceInfo] {
        SyntheticSource.Signal.allCases.map {
            SourceInfo(id: "synthetic:\($0.rawValue)", name: "Synthetic \($0.rawValue)", bundleID: nil, pid: nil, producingOutput: true)
        }
    }

    public func makeSource(id: String, channels: Int, sampleRate: Double?) throws -> AudioSource {
        guard id.hasPrefix("synthetic:"), let signal = SyntheticSource.Signal(rawValue: String(id.dropFirst("synthetic:".count))) else {
            throw CaptureError(.sourceNotFound)
        }
        return SyntheticSource(signal: signal, sampleRate: sampleRate ?? 48_000, channels: channels)
    }
}
#endif
