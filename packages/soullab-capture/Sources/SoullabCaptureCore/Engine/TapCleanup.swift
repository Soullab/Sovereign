import Foundation

/// Removes Core Audio objects a previous helper run may have left behind ("ghost" taps or
/// aggregate devices). Only objects whose identifier starts with
/// `CapturePolicy.objectPrefix` are touched. Aggregates are destroyed before taps.
public enum TapCleanup {
    @discardableResult
    public static func sweep(_ provider: TapProvider) -> [OrphanObject] {
        guard CapturePolicy.orphanSweepEnabled else { return [] }
        let orphans = provider.listOrphans().filter { $0.identifier.hasPrefix(CapturePolicy.objectPrefix) }
        for orphan in orphans where orphan.kind == .aggregate {
            provider.destroyAggregate(orphan.objectID)
        }
        for orphan in orphans where orphan.kind == .tap {
            provider.destroyTap(orphan.objectID)
        }
        return orphans
    }
}
