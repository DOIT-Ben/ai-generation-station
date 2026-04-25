const assert = require('assert');
const { chromium } = require('playwright');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:18791';
const MODEL_CACHE_KEY = 'aigs.chat.model-options';
const LOGIN_USERNAME = process.env.AIGS_TEST_USERNAME || 'studio';
const LOGIN_PASSWORD = process.env.AIGS_TEST_PASSWORD || 'AIGS2026!';
const MODEL_DELAY_MS = Number(process.env.MODEL_DELAY_MS || 1200);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginIfNeeded(page) {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    document.querySelector('#login-form') ||
    document.querySelector('#sidebar') ||
    document.querySelector('#chat-model-dropdown')
  ));

  if (await page.locator('#login-form').count()) {
    await page.fill('#login-username', LOGIN_USERNAME);
    await page.fill('#login-password', LOGIN_PASSWORD);
    await Promise.all([
      page.waitForResponse(item => item.url().includes('/api/auth/login') && item.request().method() === 'POST'),
      page.locator('#login-form button[type="submit"]').click()
    ]);
  }

  if (new URL(page.url()).pathname !== '/') {
    await page.waitForURL(url => new URL(String(url)).pathname === '/');
  }
  await page.locator('#sidebar').waitFor({ state: 'visible' });
  await page.locator('#chat-model-dropdown').waitFor({ state: 'visible' });
}

async function openDropdownAndCollect(page) {
  const dropdown = page.locator('#chat-model-dropdown');
  const isHidden = await dropdown.locator('.dropdown-menu').evaluate(menu => menu.hidden);
  if (isHidden) {
    await dropdown.locator('.dropdown-trigger').click();
  }
  await page.waitForFunction(() => {
    const menu = document.querySelector('#chat-model-dropdown .dropdown-menu');
    return Boolean(menu && !menu.hidden && menu.textContent.trim());
  });

  return page.evaluate(() => {
    const dropdownEl = document.querySelector('#chat-model-dropdown');
    const menu = dropdownEl?.querySelector('.dropdown-menu');
    const options = Array.from(menu?.querySelectorAll('.dropdown-option') || []);
    return {
      source: dropdownEl?.getAttribute('data-model-source') || '',
      triggerText: dropdownEl?.querySelector('.dropdown-value')?.textContent?.trim() || '',
      menuText: menu?.textContent?.replace(/\s+/g, ' ').trim() || '',
      optionCount: options.length,
      activeLabel: menu?.querySelector('.dropdown-option.active .dropdown-option-label, .dropdown-option.active')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    };
  });
}

async function waitForLive(page) {
  await page.waitForFunction(() => document.querySelector('#chat-model-dropdown')?.getAttribute('data-model-source') === 'live');
  return openDropdownAndCollect(page);
}

async function runScenario({ name, seedCache }) {
  console.log(`[${name}] start`);
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });

  await context.addInitScript(({ cacheKey, cacheModels }) => {
    window.localStorage.removeItem(cacheKey);
    if (cacheModels?.length) {
      window.localStorage.setItem(cacheKey, JSON.stringify({
        models: cacheModels,
        savedAt: Date.now()
      }));
    }
  }, {
    cacheKey: MODEL_CACHE_KEY,
    cacheModels: seedCache ? [
      { id: 'cached-fast-model', label: 'Cached Fast Model', tags: ['缓存'] },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', tags: ['默认'] }
    ] : []
  });

  try {
    const page = await context.newPage();
    await page.route('**/api/chat/models', async route => {
      await delay(MODEL_DELAY_MS);
      await route.continue();
    });

    const startedAt = Date.now();
    await loginIfNeeded(page);
    const workspaceReadyAt = Date.now();
    console.log(`[${name}] workspace ready`);
    const firstOpen = await openDropdownAndCollect(page);
    const firstOpenAt = Date.now();
    console.log(`[${name}] first open source=${firstOpen.source}`);
    const live = await waitForLive(page);
    const liveAt = Date.now();
    console.log(`[${name}] live source=${live.source}`);

    await page.screenshot({
      path: `docs\\dev-records\\2026-04-25-chat-dropdown-${name}.png`,
      fullPage: false
    });

    return {
      name,
      timings: {
        workspaceReadyMs: workspaceReadyAt - startedAt,
        firstOpenAfterWorkspaceMs: firstOpenAt - workspaceReadyAt,
        liveAfterWorkspaceMs: liveAt - workspaceReadyAt
      },
      firstOpen,
      live
    };
  } finally {
    await browser.close();
  }
}

(async () => {
  const noCache = await runScenario({ name: 'no-cache-slow', seedCache: false });
  assert.equal(noCache.firstOpen.source, 'loading', 'no-cache first open should use loading source');
  assert.ok(noCache.firstOpen.menuText.includes('正在加载模型列表'), 'no-cache first open should show loading text');
  assert.equal(noCache.live.source, 'live', 'no-cache should become live after delayed request');
  assert.ok(noCache.live.optionCount > 1, 'no-cache live menu should contain real options');

  const cached = await runScenario({ name: 'cache-slow', seedCache: true });
  assert.equal(cached.firstOpen.source, 'cache', 'cached first open should use cache source');
  assert.ok(cached.firstOpen.menuText.includes('Cached Fast Model'), 'cached first open should show cached model');
  assert.equal(cached.live.source, 'live', 'cached scenario should become live after delayed request');
  assert.ok(cached.live.optionCount > 1, 'cached live menu should contain real options');

  console.log(JSON.stringify({ noCache, cached }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
