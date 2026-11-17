// SOULLAB-CAPTURE J4a-2 — render the real src/capture.html in fixed states and
// save Experience Contract screenshots. A fixture witness: the real page,
// stylesheet and renderer, with the bridge replaced by
// scripts/capture-window-fixture-preload.cjs. No helper, no audio, no network.
//
// usage: electron scripts/capture-window-screens.cjs <outDir>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.resolve(process.argv[process.argv.length - 1]);
const SHOTS = [
  ['first-run', 420, 640], ['choose', 420, 640], ['recording', 420, 640],
  ['waiting', 420, 640], ['ended-device', 420, 640], ['permission', 420, 640],
  ['recording', 360, 480, 'narrow'],
];

// Each shot destroys its window; the app must outlive that.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const [state, width, height, suffix] of SHOTS) {
    const win = new BrowserWindow({
      width, height, show: false, useContentSize: true, backgroundColor: '#0A1628',
      webPreferences: {
        contextIsolation: true, nodeIntegration: false, sandbox: false,
        preload: path.join(__dirname, 'capture-window-fixture-preload.cjs'),
        additionalArguments: [`--capture-fixture=${state}`],
      },
    });
    const errors = [];
    win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });
    const page = path.join(__dirname, '..', 'src', 'capture.html');
    // A just-destroyed window can abort the next load (ERR_FAILED); retry once.
    await win.loadFile(page).catch(() => new Promise((r) => setTimeout(r, 300)).then(() => win.loadFile(page)));
    await new Promise((r) => setTimeout(r, state === 'waiting' ? 2600 : 600));
    const overflow = await win.webContents.executeJavaScript('document.documentElement.scrollWidth > window.innerWidth');
    const headline = await win.webContents.executeJavaScript("document.getElementById('headline').textContent");
    const image = await win.webContents.capturePage();
    const file = path.join(outDir, `soullab-capture-window-${state}${suffix ? `-${suffix}` : ''}.png`);
    fs.writeFileSync(file, image.toPNG());
    results.push({ state, width, height, headline, horizontalOverflow: overflow, pageErrors: errors, file: path.basename(file) });
    win.destroy();
  }
  console.log(JSON.stringify(results, null, 2));
  app.quit();
});
