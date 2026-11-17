// SOULLAB-CAPTURE J4a-1 — build and sign the nested Soullab Capture helper.
//
// The helper is the existing package `packages/soullab-capture` (owner #1979).
// This script only assembles its release build into `Soullab Capture.app` and
// signs it ON ITS OWN, with the package's deliberately EMPTY entitlements.
//
// ⛔ Why it is signed here and not by electron-builder: electron-builder signs
// every nested binary with `mac.entitlementsInherit`, which for MAIA Desktop
// carries network.client, allow-jit, allow-unsigned-executable-memory,
// disable-library-validation and audio-input. The helper must have none of
// them. build.mjs therefore excludes it from electron-builder's signing
// (`mac.signIgnore`) and verify-package.mjs re-checks the finished app.
//
// usage: node scripts/build-capture-helper.mjs [outDir]
//   default outDir: maia-desktop/.capture-helper (used by a development launch)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(here, '..');
export const CAPTURE_PACKAGE = path.join(desktopRoot, '..', 'packages', 'soullab-capture');
export const CAPTURE_APP_NAME = 'Soullab Capture.app';
export const CAPTURE_BUNDLE_ID = 'life.soullab.maia.desktop.capture';
export const CAPTURE_EXECUTABLE = 'soullab-capture-helper';

function developerIdIdentity() {
  try {
    const out = execFileSync('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
    const lines = out.split('\n').filter((line) => line.includes('Developer ID Application:'));
    const requested = String(process.env.CSC_NAME || '').trim();
    const line = requested ? lines.find((candidate) => candidate.includes(requested)) : lines[0];
    const match = line && line.match(/"(Developer ID Application:[^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Entitlements actually embedded in a signed bundle, as raw XML text ('' when none). */
export function embeddedEntitlements(appPath) {
  const out = execFileSync('/usr/bin/codesign', ['-d', '--entitlements', '-', '--xml', appPath], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.trim();
}

/** Throws unless the bundle carries no entitlement at all. */
export function assertNoEntitlements(appPath) {
  const xml = embeddedEntitlements(appPath);
  const keys = [...xml.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
  if (keys.length > 0) {
    throw new Error(`Soullab Capture helper carries entitlements (${keys.join(', ')}); refusing to package`);
  }
  return { keys, xml };
}

/** Throws unless the bundle is the helper we built: identifier, executable, signature. */
export function assertCaptureHelper(appPath) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  const read = (key) => execFileSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim();
  if (read('CFBundleIdentifier') !== CAPTURE_BUNDLE_ID) throw new Error('helper bundle identifier is wrong');
  if (read('CFBundleExecutable') !== CAPTURE_EXECUTABLE) throw new Error('helper executable name is wrong');
  if (read('LSUIElement') !== 'true') throw new Error('helper must not appear in the Dock');
  execFileSync('/usr/bin/codesign', ['--verify', '--strict', appPath], { stdio: 'inherit' });
  const detail = execFileSync('/usr/bin/codesign', ['-dv', '--verbose=4', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ...assertNoEntitlements(appPath), signature: String(detail) };
}

export function buildCaptureHelper({ outDir, identity = developerIdIdentity() } = {}) {
  execFileSync('swift', ['build', '-c', 'release', '--product', CAPTURE_EXECUTABLE, '-Xswiftc', '-warnings-as-errors'], {
    cwd: CAPTURE_PACKAGE, stdio: 'inherit',
  });
  const binDir = execFileSync('swift', ['build', '-c', 'release', '--show-bin-path'], { cwd: CAPTURE_PACKAGE, encoding: 'utf8' }).trim();
  const appPath = path.join(outDir, CAPTURE_APP_NAME);
  fs.rmSync(appPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(appPath, 'Contents', 'MacOS'), { recursive: true });
  fs.copyFileSync(path.join(binDir, CAPTURE_EXECUTABLE), path.join(appPath, 'Contents', 'MacOS', CAPTURE_EXECUTABLE));
  fs.copyFileSync(path.join(CAPTURE_PACKAGE, 'HelperBundle', 'Info.plist'), path.join(appPath, 'Contents', 'Info.plist'));

  const sign = identity || '-';
  execFileSync('/usr/bin/codesign', [
    '--force', ...(identity ? ['--timestamp'] : []), '--options', 'runtime',
    '--entitlements', path.join(CAPTURE_PACKAGE, 'HelperBundle', 'Helper.entitlements'),
    '--identifier', CAPTURE_BUNDLE_ID,
    '--sign', sign, appPath,
  ], { stdio: 'inherit' });
  assertCaptureHelper(appPath);
  console.log(`[Soullab Capture] helper built and signed (${identity ? identity : 'ad-hoc, local only'}), no entitlements: ${appPath}`);
  return { appPath, identity };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(desktopRoot, '.capture-helper');
  fs.mkdirSync(outDir, { recursive: true });
  buildCaptureHelper({ outDir });
}
