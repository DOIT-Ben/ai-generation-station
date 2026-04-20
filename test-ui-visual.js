const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const { chromium } = require('playwright');
const { createServer } = require('./server/index');
const { createConfig } = require('./server/config');

const VIEWPORT = { width: 1440, height: 1280 };
const VISUAL_ROOT = path.join(__dirname, 'test-artifacts');
const BASELINE_DIR = path.join(VISUAL_ROOT, 'visual-baseline');
const CURRENT_DIR = path.join(VISUAL_ROOT, 'visual-current');
const DIFF_DIR = path.join(VISUAL_ROOT, 'visual-diff');
const MAX_DIFF_PIXELS = 40;
const MAX_DIFF_RATIO = 0.0002;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.UI_VISUAL_BASE_URL || 'http://127.0.0.1:18791',
    port: Number(process.env.UI_VISUAL_PORT || 18791),
    launchServer: process.env.UI_VISUAL_LAUNCH_SERVER === '1',
    updateBaseline: process.env.UI_VISUAL_UPDATE_BASELINE === '1'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1];
      i += 1;
    } else if (arg === '--port' && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--launch-server') {
      args.launchServer = true;
    } else if (arg === '--update-baseline') {
      args.updateBaseline = true;
    }
  }

  return args;
}

function requestUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await requestUrl(url);
      if (response.status === 200) {
        return response;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`UI visual target not ready: ${lastError ? lastError.message : url}`);
}

async function withListeningServer({ port }, fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aigs-ui-visual-'));
  const tempDbPath = path.join(tempRoot, 'app-state.sqlite');
  const tempLegacyPath = path.join(tempRoot, 'app-state.json');
  fs.writeFileSync(tempLegacyPath, JSON.stringify({ sessions: {}, history: {} }, null, 2));

  const server = createServer({
    config: createConfig({
      env: {
        ...process.env,
        PORT: String(port),
        APP_STATE_DB: tempDbPath,
        APP_STATE_FILE: tempLegacyPath
      }
    })
  });

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(() => resolve()));
    server.appStateStore?.close?.();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetArtifactDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

async function waitForAuthGate(page) {
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator('#auth-gate').waitFor({ state: 'visible' });
  await page.locator('#auth-gate .auth-card').waitFor({ state: 'visible' });
}

async function loginAsBootstrapAdmin(page) {
  await waitForAuthGate(page);
  await page.fill('#auth-username', 'studio');
  await page.fill('#auth-password', 'AIGS2026!');
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/auth/login') && response.request().method() === 'POST'),
    page.locator('#auth-form button[type="submit"]').click()
  ]);
  await page.locator('#btn-logout').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const gate = document.getElementById('auth-gate');
    return Boolean(gate) && gate.hasAttribute('hidden');
  });
  await page.waitForFunction(() => {
    const panel = document.getElementById('admin-panel');
    return Boolean(panel) && !panel.hasAttribute('hidden');
  });
}

async function stabilizePage(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .toast-container,
      .loading-overlay {
        opacity: 0 !important;
        visibility: hidden !important;
      }
      html {
        scroll-behavior: auto !important;
      }
    `
  });
  await page.evaluate(async () => {
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    } catch {
      // Ignore font readiness failures and keep going with the current render.
    }
    document.activeElement?.blur?.();
  });
  await page.waitForTimeout(100);
}

async function gotoApp(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#sidebar').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle-fixed').waitFor({ state: 'visible' });
  await stabilizePage(page);
}

async function ensureTheme(page, theme) {
  const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
  if (currentTheme === theme) return;

  await page.click('#theme-toggle');
  await page.waitForFunction(expectedTheme => {
    return (document.documentElement.getAttribute('data-theme') || 'dark') === expectedTheme;
  }, theme);
  await stabilizePage(page);
}

async function switchTab(page, tab) {
  await page.locator(`.nav-item[data-tab="${tab}"]`).click();
  await page.waitForFunction(nextTab => {
    const tabEl = document.getElementById(`tab-${nextTab}`);
    const navEl = document.querySelector(`.nav-item[data-tab="${nextTab}"]`);
    return Boolean(tabEl?.classList.contains('active') && navEl?.classList.contains('active'));
  }, tab);
  await stabilizePage(page);
}

async function normalizeAdminPanel(page) {
  await page.waitForFunction(() => {
    const summary = document.getElementById('admin-audit-summary');
    return Boolean(summary?.textContent) && !summary.textContent.includes('正在');
  });
  await page.evaluate(() => {
    document.querySelectorAll('#admin-panel time').forEach(node => {
      node.textContent = '';
      node.style.display = 'inline-block';
      node.style.width = '72px';
      node.style.height = '12px';
      node.style.borderRadius = '999px';
      node.style.background = 'rgba(160, 160, 192, 0.28)';
    });
  });
  await stabilizePage(page);
}

async function setFixedUtilityVisibility(page, visible) {
  await page.evaluate(isVisible => {
    const utility = document.getElementById('theme-toggle-fixed');
    if (!utility) return;
    utility.style.visibility = isVisible ? 'visible' : 'hidden';
  }, visible);
  await stabilizePage(page);
}

async function setStableBackdrop(page, enabled) {
  await page.evaluate(isEnabled => {
    let style = document.getElementById('visual-backdrop-override');
    if (!style) {
      style = document.createElement('style');
      style.id = 'visual-backdrop-override';
      document.head.appendChild(style);
    }
    style.textContent = isEnabled ? `
      body::before,
      body::after {
        display: none !important;
      }
      body {
        background: var(--bg-deep) !important;
      }
    ` : '';
  }, enabled);
  await stabilizePage(page);
}

function getCapturePlan(baseUrl) {
  return [
    {
      name: 'auth-gate-card',
      selector: '#auth-gate .auth-card',
      showFixedUtility: false,
      stableBackdrop: false,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await waitForAuthGate(page);
      }
    },
    {
      name: 'utility-cluster-authenticated',
      selector: '#theme-toggle-fixed',
      showFixedUtility: true,
      stableBackdrop: false,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await loginAsBootstrapAdmin(page);
        await ensureTheme(page, 'dark');
      }
    },
    {
      name: 'admin-panel',
      selector: '#admin-panel',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await loginAsBootstrapAdmin(page);
        await ensureTheme(page, 'dark');
        await normalizeAdminPanel(page);
      }
    },
    {
      name: 'chat-card-dark',
      selector: '#tab-chat .chat-card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await loginAsBootstrapAdmin(page);
        await switchTab(page, 'chat');
        await ensureTheme(page, 'dark');
      }
    },
    {
      name: 'chat-card-light',
      selector: '#tab-chat .chat-card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await loginAsBootstrapAdmin(page);
        await switchTab(page, 'chat');
        await ensureTheme(page, 'light');
      }
    },
    {
      name: 'lyrics-card-light',
      selector: '#tab-lyrics .card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await gotoApp(page, baseUrl);
        await loginAsBootstrapAdmin(page);
        await switchTab(page, 'lyrics');
        await ensureTheme(page, 'light');
      }
    }
  ];
}

async function captureElement(page, selector) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await stabilizePage(page);
  return locator.screenshot({ animations: 'disabled' });
}

async function compareCapture({ name, buffer, updateBaseline, pixelmatch }) {
  ensureDir(BASELINE_DIR);
  ensureDir(CURRENT_DIR);
  ensureDir(DIFF_DIR);

  const baselinePath = path.join(BASELINE_DIR, `${name}.png`);
  const currentPath = path.join(CURRENT_DIR, `${name}.png`);
  const diffPath = path.join(DIFF_DIR, `${name}.png`);
  fs.writeFileSync(currentPath, buffer);

  if (updateBaseline || !fs.existsSync(baselinePath)) {
    fs.copyFileSync(currentPath, baselinePath);
    fs.rmSync(diffPath, { force: true });
    return {
      name,
      status: updateBaseline ? 'baseline-updated' : 'baseline-created'
    };
  }

  const baselinePng = PNG.sync.read(fs.readFileSync(baselinePath));
  const currentPng = PNG.sync.read(buffer);
  if (baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height) {
    return {
      name,
      status: 'failed',
      message: `size mismatch: baseline ${baselinePng.width}x${baselinePng.height}, current ${currentPng.width}x${currentPng.height}`,
      diffPath: currentPath
    };
  }

  const diffPng = new PNG({ width: baselinePng.width, height: baselinePng.height });
  const diffPixels = pixelmatch(
    baselinePng.data,
    currentPng.data,
    diffPng.data,
    baselinePng.width,
    baselinePng.height,
    { threshold: 0.1 }
  );
  const diffRatio = diffPixels / (baselinePng.width * baselinePng.height);

  if (diffPixels > MAX_DIFF_PIXELS || diffRatio > MAX_DIFF_RATIO) {
    fs.writeFileSync(diffPath, PNG.sync.write(diffPng));
    return {
      name,
      status: 'failed',
      diffPixels,
      diffRatio,
      diffPath
    };
  }

  fs.rmSync(diffPath, { force: true });
  return {
    name,
    status: 'passed',
    diffPixels,
    diffRatio
  };
}

async function runVisualRegression({ baseUrl, updateBaseline, headless = process.env.PLAYWRIGHT_HEADLESS !== '0' }) {
  resetArtifactDir(CURRENT_DIR);
  resetArtifactDir(DIFF_DIR);
  ensureDir(BASELINE_DIR);

  const pixelmatch = (await import('pixelmatch')).default;
  const browser = await chromium.launch({ headless });
  const plan = getCapturePlan(baseUrl);
  const results = [];

  try {
    for (const capture of plan) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const page = await context.newPage();
      try {
        await capture.prepare(page);
        await setFixedUtilityVisibility(page, Boolean(capture.showFixedUtility));
        await setStableBackdrop(page, Boolean(capture.stableBackdrop));
        const buffer = await captureElement(page, capture.selector);
        results.push(await compareCapture({
          name: capture.name,
          buffer,
          updateBaseline,
          pixelmatch
        }));
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter(item => item.status === 'failed');
  if (failures.length > 0) {
    const summary = failures.map(item => {
      if (item.message) {
        return `${item.name}: ${item.message} (${item.diffPath})`;
      }
      return `${item.name}: ${item.diffPixels} px, ${(item.diffRatio * 100).toFixed(4)}% (${item.diffPath})`;
    }).join('\n');
    throw new Error(`Visual regression failed\n${summary}`);
  }

  const summary = results.map(item => {
    if (item.status === 'passed') {
      return `${item.name}: ${item.diffPixels} px`;
    }
    return `${item.name}: ${item.status}`;
  }).join('\n');
  console.log(summary);
  console.log(updateBaseline ? 'UI visual baselines updated' : 'UI visual regression passed');
}

async function main(options = {}) {
  const args = options.argv ? parseArgs(options.argv) : { ...parseArgs([]), ...options };
  const baseUrl = options.baseUrl || args.baseUrl;
  const port = Number(options.port || args.port || 18791);
  const launchServer = options.launchServer != null ? options.launchServer : args.launchServer;
  const updateBaseline = options.updateBaseline != null ? options.updateBaseline : args.updateBaseline;

  if (launchServer) {
    await withListeningServer({ port }, async serverBaseUrl => {
      await waitForServer(serverBaseUrl);
      await runVisualRegression({ baseUrl: serverBaseUrl, updateBaseline });
    });
  } else {
    await waitForServer(baseUrl);
    await runVisualRegression({ baseUrl, updateBaseline });
  }
}

if (require.main === module) {
  main({ argv: process.argv.slice(2) }).catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  main
};
