import CoreAudio
import Foundation

/// Real Core Audio implementation of `TapProvider` (macOS 14.2+).
///
/// J2 compiles this file but never executes it: tests use a fake provider, and creating a
/// tap is what triggers macOS's system-audio permission prompt. First execution is J3,
/// on the founder's Mac, under a separate grant.
@available(macOS 14.2, *)
public final class CoreAudioTapProvider: TapProvider, @unchecked Sendable {
    private let listenerQueue = DispatchQueue(label: "life.soullab.capture.tap-listeners")

    public init() {}

    // MARK: Tap, aggregate, IO

    public func translatePID(_ pid: pid_t) throws -> AudioObjectID {
        var addr = Self.address(kAudioHardwarePropertyTranslatePIDToProcessObject)
        var qualifier = pid
        var object = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr,
                                                UInt32(MemoryLayout<pid_t>.size), &qualifier, &size, &object)
        guard status == noErr, object != AudioObjectID(kAudioObjectUnknown) else {
            throw CaptureError(.sourceNotFound, "translate pid OSStatus \(status)")
        }
        return object
    }

    public func createProcessTap(processObject: AudioObjectID, mono: Bool, uuid: UUID, name: String) throws -> AudioObjectID {
        let description = mono
            ? CATapDescription(monoMixdownOfProcesses: [processObject])
            : CATapDescription(stereoMixdownOfProcesses: [processObject])
        description.uuid = uuid
        description.name = name
        description.isPrivate = true
        description.muteBehavior = .unmuted
        var tapID = AudioObjectID(kAudioObjectUnknown)
        let status = AudioHardwareCreateProcessTap(description, &tapID)
        guard status == noErr, tapID != AudioObjectID(kAudioObjectUnknown) else {
            throw CaptureError(.tapFailed, "create tap OSStatus \(status)")
        }
        return tapID
    }

    public func tapFormat(_ tap: AudioObjectID) throws -> SourceFormat {
        var addr = Self.address(kAudioTapPropertyFormat)
        var asbd = AudioStreamBasicDescription()
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        let status = AudioObjectGetPropertyData(tap, &addr, 0, nil, &size, &asbd)
        guard status == noErr else { throw CaptureError(.tapFailed, "tap format OSStatus \(status)") }
        let isFloat = asbd.mFormatFlags & kAudioFormatFlagIsFloat != 0
        guard asbd.mFormatID == kAudioFormatLinearPCM, isFloat, asbd.mBitsPerChannel == 32 else {
            throw CaptureError(.formatUnsupported, "tap delivers a non-Float32 format")
        }
        let interleaved = asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved == 0
        return SourceFormat(sampleRate: asbd.mSampleRate, channels: Int(asbd.mChannelsPerFrame), interleaved: interleaved)
    }

    public func createAggregate(uid: String, name: String, tapUUID: UUID) throws -> AudioObjectID {
        let outputUID = try defaultOutputDeviceUID()
        let description: [String: Any] = [
            kAudioAggregateDeviceNameKey: name,
            kAudioAggregateDeviceUIDKey: uid,
            kAudioAggregateDeviceMainSubDeviceKey: outputUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID]],
            kAudioAggregateDeviceTapListKey: [[
                kAudioSubTapDriftCompensationKey: true,
                kAudioSubTapUIDKey: tapUUID.uuidString,
            ]],
        ]
        var device = AudioObjectID(kAudioObjectUnknown)
        let status = AudioHardwareCreateAggregateDevice(description as CFDictionary, &device)
        guard status == noErr, device != AudioObjectID(kAudioObjectUnknown) else {
            throw CaptureError(.tapFailed, "create aggregate OSStatus \(status)")
        }
        return device
    }

    public func createIOProc(device: AudioObjectID, handler: @escaping TapIOHandler) throws -> TapIOProc {
        var procID: AudioDeviceIOProcID?
        let status = AudioDeviceCreateIOProcIDWithBlock(&procID, device, nil) { _, inputData, inputTime, _, _ in
            handler(inputData, inputTime)
        }
        guard status == noErr, procID != nil else {
            throw CaptureError(.ioFailed, "create IO proc OSStatus \(status)")
        }
        return TapIOProc(raw: procID)
    }

    public func startIO(device: AudioObjectID, proc: TapIOProc) throws {
        let status = AudioDeviceStart(device, proc.raw)
        guard status == noErr else { throw CaptureError(.ioFailed, "start IO OSStatus \(status)") }
    }

    public func stopIO(device: AudioObjectID, proc: TapIOProc) {
        _ = AudioDeviceStop(device, proc.raw)
    }

    public func destroyIOProc(device: AudioObjectID, proc: TapIOProc) {
        if let raw = proc.raw { _ = AudioDeviceDestroyIOProcID(device, raw) }
    }

    public func destroyAggregate(_ device: AudioObjectID) {
        _ = AudioHardwareDestroyAggregateDevice(device)
    }

    public func destroyTap(_ tap: AudioObjectID) {
        _ = AudioHardwareDestroyProcessTap(tap)
    }

    // MARK: Lifecycle listeners

    final class ListenerToken: TapListenerToken, @unchecked Sendable {
        var registrations: [(AudioObjectID, AudioObjectPropertyAddress, AudioObjectPropertyListenerBlock)] = []
    }

    public func addLifecycleListener(processObject: AudioObjectID, device: AudioObjectID, tap: AudioObjectID,
                                     onOverload: @escaping @Sendable () -> Void,
                                     onEnded: @escaping @Sendable (StopReason) -> Void) throws -> TapListenerToken {
        let token = ListenerToken()
        let system = AudioObjectID(kAudioObjectSystemObject)
        do {
            try register(token, system, kAudioHardwarePropertyProcessObjectList) { [weak self] _, _ in
                guard let self else { return }
                if !self.processObjects().contains(processObject) { onEnded(.sourceExited) }
            }
            try register(token, system, kAudioHardwarePropertyDefaultOutputDevice) { _, _ in onEnded(.deviceChanged) }
            try register(token, tap, kAudioTapPropertyFormat) { _, _ in onEnded(.formatChanged) }
            try register(token, device, kAudioDevicePropertyDeviceIsAlive) { _, _ in onEnded(.deviceChanged) }
            try register(token, device, kAudioDeviceProcessorOverload) { _, _ in onOverload() }
        } catch {
            removeLifecycleListener(token)
            throw error
        }
        return token
    }

    public func removeLifecycleListener(_ token: TapListenerToken) {
        guard let token = token as? ListenerToken else { return }
        for (object, address, block) in token.registrations {
            var addr = address
            _ = AudioObjectRemovePropertyListenerBlock(object, &addr, listenerQueue, block)
        }
        token.registrations.removeAll()
    }

    private func register(_ token: ListenerToken, _ object: AudioObjectID, _ selector: AudioObjectPropertySelector,
                          _ block: @escaping AudioObjectPropertyListenerBlock) throws {
        var addr = Self.address(selector)
        let status = AudioObjectAddPropertyListenerBlock(object, &addr, listenerQueue, block)
        guard status == noErr else { throw CaptureError(.tapFailed, "listener OSStatus \(status)") }
        token.registrations.append((object, addr, block))
    }

    // MARK: Orphans

    public func listOrphans() -> [OrphanObject] {
        var found: [OrphanObject] = []
        for device in Self.objectArray(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDevices) {
            if let uid = Self.stringProperty(device, kAudioDevicePropertyDeviceUID), uid.hasPrefix(CapturePolicy.objectPrefix) {
                found.append(OrphanObject(kind: .aggregate, objectID: device, identifier: uid))
            }
        }
        for tap in Self.objectArray(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyTapList) {
            var addr = Self.address(kAudioTapPropertyDescription)
            var description: Unmanaged<CATapDescription>?
            var size = UInt32(MemoryLayout<Unmanaged<CATapDescription>?>.size)
            if AudioObjectGetPropertyData(tap, &addr, 0, nil, &size, &description) == noErr,
               let name = description?.takeRetainedValue().name, name.hasPrefix(CapturePolicy.objectPrefix) {
                found.append(OrphanObject(kind: .tap, objectID: tap, identifier: name))
            }
        }
        return found
    }

    // MARK: Property helpers

    func processObjects() -> [AudioObjectID] {
        Self.objectArray(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyProcessObjectList)
    }

    private func defaultOutputDeviceUID() throws -> String {
        var addr = Self.address(kAudioHardwarePropertyDefaultOutputDevice)
        var device = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &device)
        guard status == noErr, let uid = Self.stringProperty(device, kAudioDevicePropertyDeviceUID) else {
            throw CaptureError(.tapFailed, "default output device OSStatus \(status)")
        }
        return uid
    }

    static func address(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
        AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal,
                                   mElement: kAudioObjectPropertyElementMain)
    }

    static func objectArray(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> [AudioObjectID] {
        var addr = address(selector)
        var size: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(object, &addr, 0, nil, &size) == noErr, size > 0 else { return [] }
        var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        guard AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &ids) == noErr else { return [] }
        return Array(ids.prefix(Int(size) / MemoryLayout<AudioObjectID>.size))
    }

    static func stringProperty(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
        var addr = address(selector)
        var value: Unmanaged<CFString>?
        var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        guard AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &value) == noErr else { return nil }
        return value?.takeRetainedValue() as String?
    }

    static func u32Property(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) -> UInt32? {
        var addr = address(selector)
        var value: UInt32 = 0
        var size = UInt32(MemoryLayout<UInt32>.size)
        guard AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &value) == noErr else { return nil }
        return value
    }

    static func pidProperty(_ object: AudioObjectID) -> pid_t? {
        var addr = address(kAudioProcessPropertyPID)
        var value: pid_t = 0
        var size = UInt32(MemoryLayout<pid_t>.size)
        guard AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &value) == noErr else { return nil }
        return value
    }
}

/// Real source catalog: processes that own Core Audio process objects.
@available(macOS 14.2, *)
public final class CoreAudioSourceCatalog: SourceCatalog, @unchecked Sendable {
    private let provider: CoreAudioTapProvider

    public init(provider: CoreAudioTapProvider) {
        self.provider = provider
    }

    public func listSources() throws -> [SourceInfo] {
        let own = getpid()
        return provider.processObjects().compactMap { object in
            guard let pid = CoreAudioTapProvider.pidProperty(object), pid != own else { return nil }
            let bundleID = CoreAudioTapProvider.stringProperty(object, kAudioProcessPropertyBundleID)
            let running = (CoreAudioTapProvider.u32Property(object, kAudioProcessPropertyIsRunningOutput) ?? 0) != 0
            return SourceInfo(id: "pid:\(pid)", name: Self.processName(pid) ?? bundleID ?? "pid \(pid)",
                              bundleID: bundleID, pid: pid, producingOutput: running)
        }
    }

    public func makeSource(id: String, channels: Int, sampleRate: Double?) throws -> AudioSource {
        guard sampleRate == nil else { throw CaptureError(.invalidRequest, "sample rate comes from the tap") }
        guard let info = try listSources().first(where: { $0.id == id }), let pid = info.pid else {
            throw CaptureError(.sourceNotFound)
        }
        let descriptor = SourceDescriptor(kind: .processTap, id: info.id, name: info.name, bundleID: info.bundleID, pid: pid)
        return ProcessTapSource(provider: provider, descriptor: descriptor, pid: pid, channels: channels)
    }

    static func processName(_ pid: pid_t) -> String? {
        var buffer = [CChar](repeating: 0, count: 256)
        let n = proc_name(pid, &buffer, UInt32(buffer.count))
        guard n > 0 else { return nil }
        return String(decoding: buffer.prefix(Int(n)).map { UInt8(bitPattern: $0) }, as: UTF8.self)
    }
}
