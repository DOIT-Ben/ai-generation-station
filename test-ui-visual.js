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
const MAX_DIFF_PIXELS = 50;
const MAX_DIFF_RATIO = 0.0002;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.UI_VISUAL_BASE_URL || 'http://127.0.0.1:18791',
    port: Number(process.env.UI_VISUAL_PORT || 18791),
    launchServer: process.env.UI_VISUAL_LAUNCH_SERVER === '1',
    updateBaseline: process.env.UI_VISUAL_UPDATE_BASELINE === '1',
    cdpUrl: process.env.UI_VISUAL_CDP_URL || ''
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
    } else if (arg === '--cdp-url' && argv[i + 1]) {
      args.cdpUrl = argv[i + 1];
      i += 1;
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

async function waitForAuthPage(page) {
  await page.locator('#portal-user-nav').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator('#login-form').waitFor({ state: 'visible' });
  await page.locator('#login-username').waitFor({ state: 'visible' });
  await page.locator('#login-password').waitFor({ state: 'visible' });
}

async function waitForWorkspace(page) {
  await page.waitForURL(url => new URL(String(url)).pathname === '/');
  await page.locator('#sidebar').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle-fixed').waitFor({ state: 'visible' });
  await page.locator('#btn-logout').waitFor({ state: 'visible' });
}

async function gotoAuthPage(page, baseUrl) {
  await page.goto(`${baseUrl}/auth/`, { waitUntil: 'domcontentloaded' });
  await waitForAuthPage(page);
  await stabilizePage(page);
}

async function gotoPortalPage(page, baseUrl, pathname, selector) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(url => new URL(String(url)).pathname === pathname);
  await page.locator('#portal-user-nav').waitFor({ state: 'visible' });
  await page.locator('#theme-toggle').waitFor({ state: 'visible' });
  await page.locator(selector).waitFor({ state: 'visible' });
  await stabilizePage(page);
}

async function loginAsBootstrapAdmin(page, baseUrl) {
  await page.goto(`${baseUrl}/auth/`, { waitUntil: 'domcontentloaded' });
  const currentPath = await page.evaluate(() => window.location.pathname);
  if (currentPath !== '/auth/') {
    await waitForWorkspace(page);
    await stabilizePage(page);
    return;
  }

  await waitForAuthPage(page);
  await stabilizePage(page);
  await page.fill('#login-username', 'studio');
  await page.fill('#login-password', 'AIGS2026!');
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/auth/login') && response.request().method() === 'POST'),
    page.locator('#login-form button[type="submit"]').click()
  ]);
  await waitForWorkspace(page);
  await stabilizePage(page);
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
  await waitForWorkspace(page);
  await stabilizePage(page);
}

async function ensureTheme(page, theme) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
    if (currentTheme === theme) {
      await stabilizePage(page);
      return;
    }
    await page.click('#theme-toggle');
    await page.waitForTimeout(120);
  }
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
    const maskStableTextNode = (node, width = '72px') => {
      if (!node) return;
      node.textContent = '';
      node.style.display = 'inline-block';
      node.style.width = width;
      node.style.height = '12px';
      node.style.borderRadius = '999px';
      node.style.background = 'rgba(160, 160, 192, 0.28)';
    };

    document.querySelectorAll('#admin-user-list time').forEach(node => {
      maskStableTextNode(node, '72px');
    });
    document.querySelectorAll('#admin-audit-table-body tr td:first-child .audit-log-copy strong').forEach(node => {
      maskStableTextNode(node, '76px');
    });
    document.querySelectorAll('#admin-user-list .admin-user-detail:nth-child(2) strong').forEach(node => {
      maskStableTextNode(node, '88px');
    });
  });
  await stabilizePage(page);
}

async function normalizeChatPanel(page) {
  await page.evaluate(() => {
    const maskTimeNode = node => {
      if (!node) return;
      node.textContent = '';
      node.style.display = 'inline-block';
      node.style.width = '54px';
      node.style.height = '12px';
      node.style.borderRadius = '999px';
      node.style.background = 'rgba(160, 160, 192, 0.28)';
    };

    document.querySelectorAll('.chat-conversation-item time, .chat-archived-copy time').forEach(maskTimeNode);
    document.querySelectorAll('.message-meta-time').forEach(maskTimeNode);
    document.querySelectorAll('.chat-conversation-item strong, .chat-conversation-preview, .chat-conversation-meta span, .chat-conversation-group-label, .chat-conversation-mini-action, .chat-sidebar-summary strong, .chat-sidebar-summary span, .chat-sidebar-tool').forEach(node => {
      node.textContent = '';
      node.style.display = 'inline-block';
      node.style.width = node.tagName === 'STRONG' ? '88px' : '120px';
      node.style.height = '12px';
      node.style.borderRadius = '999px';
      node.style.background = 'rgba(160, 160, 192, 0.28)';
    });
    const title = document.getElementById('chat-conversation-title');
    if (title) {
      title.textContent = '稳定视觉基线对话';
    }
    const subtitle = document.getElementById('chat-conversation-subtitle');
    if (subtitle) {
      subtitle.textContent = '稳定视觉基线 · 会话工作流已就绪';
    }
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
      name: 'auth-portal-card',
      selector: '.portal-layout > .portal-surface-card',
      showFixedUtility: false,
      stableBackdrop: false,
      prepare: async page => {
        await gotoAuthPage(page, baseUrl);
      }
    },
    {
      name: 'utility-cluster-authenticated',
      selector: '#theme-toggle-fixed',
      showFixedUtility: true,
      stableBackdrop: false,
      prepare: async page => {
        await loginAsBootstrapAdmin(page, baseUrl);
        await ensureTheme(page, 'dark');
      }
    },
    {
      name: 'account-center-security',
      selector: '.account-security-card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await loginAsBootstrapAdmin(page, baseUrl);
        await gotoPortalPage(page, baseUrl, '/account/', '.account-security-card');
        await ensureTheme(page, 'light');
      }
    },
    {
      name: 'admin-console',
      selector: '.portal-layout',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await loginAsBootstrapAdmin(page, baseUrl);
        await gotoPortalPage(page, baseUrl, '/admin/', '#admin-audit-form');
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
        await loginAsBootstrapAdmin(page, baseUrl);
        await switchTab(page, 'chat');
        await ensureTheme(page, 'dark');
        await normalizeChatPanel(page);
      }
    },
    {
      name: 'chat-card-light',
      selector: '#tab-chat .chat-card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await loginAsBootstrapAdmin(page, baseUrl);
        await switchTab(page, 'chat');
        await ensureTheme(page, 'light');
        await normalizeChatPanel(page);
      }
    },
    {
      name: 'lyrics-card-light',
      selector: '#tab-lyrics .card',
      showFixedUtility: false,
      stableBackdrop: true,
      prepare: async page => {
        await loginAsBootstrapAdmin(page, baseUrl);
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
  const widthDiff = Math.abs(baselinePng.width - currentPng.width);
  const heightDiff = Math.abs(baselinePng.height - currentPng.height);
  if (widthDiff > 1 || heightDiff > 1) {
    return {
      name,
      status: 'failed',
      message: `size mismatch: baseline ${baselinePng.width}x${baselinePng.height}, current ${currentPng.width}x${currentPng.height}`,
      diffPath: currentPath
    };
  }

  let baselineImage = baselinePng;
  let currentImage = currentPng;
  if (widthDiff > 0 || heightDiff > 0) {
    const width = Math.min(baselinePng.width, currentPng.width);
    const height = Math.min(baselinePng.height, currentPng.height);
    const cropPng = (source, nextWidth, nextHeight) => {
      const cropped = new PNG({ width: nextWidth, height: nextHeight });
      PNG.bitblt(source, cropped, 0, 0, nextWidth, nextHeight, 0, 0);
      return cropped;
    };
    baselineImage = cropPng(baselinePng, width, height);
    currentImage = cropPng(currentPng, width, height);
  }

  const diffPng = new PNG({ width: baselineImage.width, height: baselineImage.height });
  const diffPixels = pixelmatch(
    baselineImage.data,
    currentImage.data,
    diffPng.data,
    baselineImage.width,
    baselineImage.height,
    { threshold: 0.1 }
  );
  const diffRatio = diffPixels / (baselineImage.width * baselineImage.height);

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

async function openBrowser({ headless = process.env.PLAYWRIGHT_HEADLESS !== '0', cdpUrl = '' } = {}) {
  if (cdpUrl) {
    return chromium.connectOverCDP(cdpUrl, { timeout: 120000 });
  }
  return chromium.launch({ headless });
}

async function runVisualRegression({ baseUrl, updateBaseline, headless = process.env.PLAYWRIGHT_HEADLESS !== '0', cdpUrl = '' }) {
  resetArtifactDir(CURRENT_DIR);
  resetArtifactDir(DIFF_DIR);
  ensureDir(BASELINE_DIR);

  const pixelmatch = (await import('pixelmatch')).default;
  const browser = await openBrowser({ headless, cdpUrl });
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
  const cdpUrl = options.cdpUrl != null ? options.cdpUrl : args.cdpUrl;

  if (launchServer) {
    await withListeningServer({ port }, async serverBaseUrl => {
      await waitForServer(serverBaseUrl);
      await runVisualRegression({ baseUrl: serverBaseUrl, updateBaseline, cdpUrl });
    });
  } else {
    await waitForServer(baseUrl);
    await runVisualRegression({ baseUrl, updateBaseline, cdpUrl });
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
