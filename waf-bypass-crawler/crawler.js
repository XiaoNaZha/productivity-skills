const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('./config');
const { CrawlerError, ERROR_CODES } = require('./errorHandler');

puppeteer.use(StealthPlugin());

class Crawler {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    try {
      this.browser = await puppeteer.launch(config.LAUNCH_OPTIONS);
      this.page = await this.browser.newPage();
      
      await this.page.setUserAgent(config.USER_AGENT);
      
      await this.page.setBypassCSP(true);
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      });
      
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        window.chrome = {
          runtime: {},
        };
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });
      
      console.log('[Crawler] Browser initialized successfully');
    } catch (error) {
      throw new CrawlerError(
        `Failed to launch browser: ${error.message}`,
        ERROR_CODES.BROWSER_LAUNCH_FAILED
      );
    }
  }

  async extract({ url, format = 'html', waitFor = 0, selector = null, retries = 0 }) {
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
          await this.page.waitForTimeout(waitFor);
        }
        
        if (await this.isCloudflareChallenge()) {
          console.log('[Crawler] Cloudflare challenge detected, waiting for auto-solve...');
          await this.waitForCloudflareBypass();
        }
        
        let content;
        let title;
        
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
          title = await this.page.title();
        } else if (format === 'text') {
          content = await this.page.evaluate(() => document.body.innerText);
          title = await this.page.title();
        } else {
          content = await this.page.content();
          title = await this.page.title();
        }
        
        console.log(`[Crawler] Successfully extracted content (${content.length} bytes)`);
        
        return {
          url,
          title,
          content,
          extractedAt: new Date().toISOString(),
          format,
        };
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
    const title = await this.page.title();
    const url = this.page.url();
    
    return (
      title.includes('Just a moment') ||
      title.includes('Cloudflare') ||
      url.includes('cdn-cgi/challenge') ||
      (await this.page.$('#challenge-form')) !== null
    );
  }

  async waitForCloudflareBypass() {
    const maxWait = 30000;
    const interval = 1000;
    let waited = 0;
    
    while (waited < maxWait) {
      await this.sleep(interval);
      waited += interval;
      
      const passed = !(await this.isCloudflareChallenge());
      if (passed) {
        console.log('[Crawler] Cloudflare challenge bypassed');
        return true;
      }
    }
    
    throw new CrawlerError(
      'Cloudflare challenge not solved within timeout',
      ERROR_CODES.CLOUDFLARE_BLOCKED
    );
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[Crawler] Browser closed');
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function createCrawler() {
  const crawler = new Crawler();
  await crawler.init();
  return crawler;
}

module.exports = { createCrawler, Crawler };
