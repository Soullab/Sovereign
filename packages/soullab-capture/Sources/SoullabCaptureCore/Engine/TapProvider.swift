import CoreAudio
import Foundation

/// Handler invoked on the realtime IO thread with the tap's buffers.
public typealias TapIOHandler = @Sendable (UnsafePointer<AudioBufferList>, UnsafePointer<AudioTimeStamp>) -> Void

/// Opaque IO proc identity.
public struct TapIOProc: @unchecked Sendable {
    public let raw: AudioDeviceIOProcID?
    public let testID: Int

    public init(raw: AudioDeviceIOProcID?, testID: Int = 0) {
        self.raw = raw
        self.testID = testID
    }
}

/// Removes a lifecycle listener when released through the provider.
public protocol TapListenerToken: AnyObject, Sendable {}

/// A Core Audio object left behind by an earlier helper run.
public struct OrphanObject: Sendable, Equatable {
    public enum Kind: String, Sendable { case aggregate, tap }
    public let kind: Kind
    public let objectID: AudioObjectID
    public let identifier: String

    public init(kind: Kind, objectID: AudioObjectID, identifier: String) {
        self.kind = kind
        self.objectID = objectID
        self.identifier = identifier
    }
}

/// The Core Audio operations a process-tap capture needs. Real implementation:
/// `CoreAudioTapProvider`. Tests use a fake, so J2 never creates a real tap and never
/// triggers the system-audio permission prompt.
public protocol TapProvider: AnyObject, Sendable {
    func translatePID(_ pid: pid_t) throws -> AudioObjectID
    /// Creating the tap is the step that can trigger macOS's system-audio permission prompt.
    func createProcessTap(processObject: AudioObjectID, mono: Bool, uuid: UUID, name: String) throws -> AudioObjectID
    func tapFormat(_ tap: AudioObjectID) throws -> SourceFormat
    func createAggregate(uid: String, name: String, tapUUID: UUID) throws -> AudioObjectID
    func createIOProc(device: AudioObjectID, handler: @escaping TapIOHandler) throws -> TapIOProc
    func addLifecycleListener(processObject: AudioObjectID, device: AudioObjectID, tap: AudioObjectID,
                              onOverload: @escaping @Sendable () -> Void,
                              onEnded: @escaping @Sendable (StopReason) -> Void) throws -> TapListenerToken
    func startIO(device: AudioObjectID, proc: TapIOProc) throws
    func stopIO(device: AudioObjectID, proc: TapIOProc)
    func destroyIOProc(device: AudioObjectID, proc: TapIOProc)
    func removeLifecycleListener(_ token: TapListenerToken)
    func destroyAggregate(_ device: AudioObjectID)
    func destroyTap(_ tap: AudioObjectID)
    /// Taps and aggregates whose identifier starts with `CapturePolicy.objectPrefix`.
    func listOrphans() -> [OrphanObject]
}
