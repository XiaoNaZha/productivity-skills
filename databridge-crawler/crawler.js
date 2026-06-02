const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('./config');
const { CrawlerError, ERROR_CODES } = require('./errorHandler');

puppeteer.use(StealthPlugin());

/**
 * Singleton browser — shared across all requests.
 * Each request gets its own page (tab) for isolation.
 */
let browserInstance = null;
let browserRefCount = 0;

class Crawler {
  constructor() {
    this.browser = null;
    this.page = null;
    this._ownsBrowser = false; // true if this instance launched the shared browser
  }

  /**
   * Initialize: reuse shared browser or create one.
   * @param {object} opts — { proxy?, cookies? }
   */
  async init(opts = {}) {
    const { proxy, cookies } = opts;

    try {
      // If a browser already exists, reuse it
      if (browserInstance && browserInstance.isConnected()) {
        this.browser = browserInstance;
        browserRefCount++;
      } else {
        // Launch new browser
        const launchOpts = { ...config.LAUNCH_OPTIONS };

        // Inject proxy into browser launch args
        if (proxy) {
          console.log(`[Crawler] Using proxy: ${proxy.replace(/\/\/(.+?):(.+?)@/, '//$1:****@')}`);
          launchOpts.args = [...launchOpts.args, `--proxy-server=${this.extractProxyHost(proxy)}`];
        }

        this.browser = await puppeteer.launch(launchOpts);
        browserInstance = this.browser;
        browserRefCount = 1;
        this._ownsBrowser = true;
      }

      // Create a fresh page (tab) for this request
      this.page = await this.browser.newPage();

      // Configure page
      await this.page.setUserAgent(config.USER_AGENT);
      await this.page.setBypassCSP(true);

      const extraHeaders = {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      };

      // Inject cookies if provided
      if (cookies) {
        console.log(`[Crawler] Using session cookies (${cookies.length} chars)`);
        extraHeaders['Cookie'] = cookies;
      }

      await this.page.setExtraHTTPHeaders(extraHeaders);

      // If proxy requires auth, set it up
      if (proxy && this.proxyHasAuth(proxy)) {
        await this.page.authenticate(this.parseProxyAuth(proxy));
      }

      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      console.log('[Crawler] Page ready');
    } catch (error) {
      throw new CrawlerError(
        `Failed to launch browser: ${error.message}`,
        ERROR_CODES.BROWSER_LAUNCH_FAILED
      );
    }
  }

  async extract({ url, format = 'html', waitFor = 0, selector = null }) {
    const maxRetries = config.MAX_RETRIES;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Crawler] Attempt ${attempt}/${maxRetries} for URL: ${url}`);

        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: config.TIMEOUT,
        });

        if (waitFor > 0) {
          console.log(`[Crawler] Waiting extra ${waitFor}ms for dynamic content...`);
          await this.sleep(waitFor);
        }

        if (await this.isCloudflareChallenge()) {
          console.log('[Crawler] Cloudflare challenge detected, waiting for auto-solve...');
          await this.waitForCloudflareBypass();
        }

        let content;
        const title = await this.page.title();

        if (selector) {
          console.log(`[Crawler] Extracting content with selector: ${selector}`);
          const element = await this.page.$(selector);
          if (!element) {
            throw new CrawlerError(
              `Selector "${selector}" not found on page`,
              ERROR_CODES.EXTRACTION_FAILED
            );
          }
          content = await this.page.evaluate((el) => el.innerHTML, element);
        } else if (format === 'text') {
          content = await this.page.evaluate(() => document.body.innerText);
        } else {
          content = await this.page.content();
        }

        console.log(`[Crawler] Successfully extracted content (${content.length} bytes)`);

        return { url, title, content, extractedAt: new Date().toISOString(), format };
      } catch (error) {
        lastError = error;
        console.error(`[Crawler] Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[Crawler] Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new CrawlerError(
      `Failed after ${maxRetries} attempts: ${lastError.message}`,
      ERROR_CODES.MAX_RETRIES_EXCEEDED
    );
  }

  async isCloudflareChallenge() {
    try {
      const title = await this.page.title();
      const url = this.page.url();
      return (
        title.includes('Just a moment') ||
        title.includes('Cloudflare') ||
        url.includes('cdn-cgi/challenge') ||
        (await this.page.$('#challenge-form')) !== null
      );
    } catch {
      return false;
    }
  }

  async waitForCloudflareBypass() {
    const maxWait = 30000;
    const interval = 1000;
    let waited = 0;

    while (waited < maxWait) {
      await this.sleep(interval);
      waited += interval;
      if (!(await this.isCloudflareChallenge())) {
        console.log('[Crawler] Cloudflare challenge bypassed');
        return true;
      }
    }

    throw new CrawlerError(
      'Cloudflare challenge not solved within timeout',
      ERROR_CODES.CLOUDFLARE_BLOCKED
    );
  }

  /**
   * Close this crawler instance's page. Only closes browser if this
   * instance owns it and it's the last reference.
   */
  async close() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      console.log('[Crawler] Page closed');
    }

    if (this._ownsBrowser && this.browser) {
      browserRefCount--;
      if (browserRefCount <= 0) {
        await this.browser.close();
        browserInstance = null;
        browserRefCount = 0;
        console.log('[Crawler] Browser closed (last reference)');
      }
    }
  }

  /** Extract host:port from proxy URL for --proxy-server flag */
  extractProxyHost(proxy) {
    try {
      const u = new URL(proxy);
      return `${u.hostname}:${u.port}`;
    } catch {
      return proxy;
    }
  }

  /** Check if proxy has embedded credentials */
  proxyHasAuth(proxy) {
    try {
      const u = new URL(proxy);
      return !!(u.username && u.password);
    } catch {
      return false;
    }
  }

  /** Parse proxy auth for page.authenticate() */
  parseProxyAuth(proxy) {
    try {
      const u = new URL(proxy);
      return { username: u.username, password: u.password };
    } catch {
      return { username: '', password: '' };
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a crawler instance. Each call gets its own page on a shared browser.
 * @param {object} opts — { proxy?, cookies? }
 */
async function createCrawler(opts = {}) {
  const crawler = new Crawler();
  await crawler.init(opts);
  return crawler;
}

/**
 * Gracefully shut down the shared browser. Call on process exit.
 */
async function shutdownBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    browserRefCount = 0;
    console.log('[Crawler] Browser shut down');
  }
}

module.exports = { createCrawler, Crawler, shutdownBrowser };
