// swift-tools-version:6.0
//
// Soullab Capture — local-first capture core for Sound Studio (owner: SoullabTech/Sovereign#1979).
// C1 source: one selected application's output via Core Audio process taps (macOS 14.2+).
// Apple system frameworks only. No third-party dependencies.

import PackageDescription

let package = Package(
    name: "SoullabCapture",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "SoullabCaptureCore", targets: ["SoullabCaptureCore"]),
        .executable(name: "soullab-capture-helper", targets: ["soullab-capture-helper"]),
    ],
    targets: [
        // Minimal C11 atomics for the realtime single-producer/single-consumer paths.
        .target(name: "CSoullabAtomics"),
        .target(
            name: "SoullabCaptureCore",
            dependencies: ["CSoullabAtomics"]
        ),
        .executableTarget(
            name: "soullab-capture-helper",
            dependencies: ["SoullabCaptureCore"]
        ),
        // Test-only support. Never a dependency of the helper.
        .target(
            name: "SoullabCaptureTestSupport",
            dependencies: ["SoullabCaptureCore"]
        ),
        .testTarget(
            name: "SoullabCaptureCoreTests",
            dependencies: ["SoullabCaptureCore", "SoullabCaptureTestSupport", "CSoullabAtomics"],
            exclude: ["Fixtures"]
        ),
        .testTarget(
            name: "SoullabCaptureHelperTests",
            dependencies: ["SoullabCaptureCore", "SoullabCaptureTestSupport"]
        ),
    ]
)
