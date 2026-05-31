/**
 * filters.js — Noise Detection & DOM Filtering Engine
 *
 * 3-tier stripping strategy:
 *   Tier 1: Hard strip — always remove these selectors
 *   Tier 2: Heuristic strip — remove if class/id matches noise patterns
 *   Tier 3: Empty element cleanup — remove elements with no visible text
 */

// Tier 1: Elements that are NEVER content — always strip
const HARD_STRIP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'nav',
  'footer',
  'figure',
  'figcaption',
  'svg',
  'canvas',
  'input',
  'button',
  'select',
  'textarea',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="search"]',
  '[aria-hidden="true"]',
];

// Tier 2: Class/ID patterns that indicate non-content elements
const HEURISTIC_PATTERNS = [
  // Ads & sponsors
  'ad', 'ads', 'advertisement', 'advert', 'sponsor', 'banner-ad',
  'google-ad', 'dfp-ad', 'promoted', 'paid-content',

  // Sidebars & asides
  'sidebar', 'aside', 'side-panel',

  // Social & sharing
  'social', 'share', 'sharing', 'social-media', 'social-links',
  'facebook', 'twitter', 'linkedin', 'reddit',

  // Comments
  'comment', 'comments', 'discussion', 'disqus',

  // Popups & modals
  'cookie', 'popup', 'modal', 'overlay', 'lightbox',
  'newsletter', 'subscribe', 'subscription', 'signup-form',
  'gdpr', 'consent', 'toast', 'notification',

  // Related / recommended (often noise)
  'related-posts', 'related-articles', 'recommended', 'trending',
  'popular-posts', 'you-may-also-like', 'more-stories',

  // Widgets & embeds
  'widget', 'embed', 'tweet', 'instagram', 'tiktok',

  // Navigation extras
  'breadcrumb', 'pagination', 'pager', 'page-nav',
  'menu', 'submenu', 'dropdown',

  // Misc noise
  'copyright', 'legal', 'disclaimer', 'print', 'hidden',
  'screen-reader', 'sr-only', 'visually-hidden',
  'skip-link', 'skip-to-content', 'back-to-top',
];

// Content-indicating selectors — we prefer these for the main body
const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.content-body',
  '.page-content',
  '#content',
  '#main-content',
  '#article-body',
  '.markdown-body',
  '.prose',
];

// Elements to preserve even if empty (they carry semantic meaning)
const PRESERVE_EMPTY = ['br', 'hr', 'img', 'input'];

/**
 * Check if an element is likely noise based on its class/id attributes.
 * @param {Cheerio} $el — cheerio element
 * @returns {boolean}
 */
function isNoiseByHeuristic($el) {
  const classAttr = ($el.attr('class') || '').toLowerCase();
  const idAttr = ($el.attr('id') || '').toLowerCase();
  const combined = `${classAttr} ${idAttr}`;

  if (!combined.trim()) return false;

  return HEURISTIC_PATTERNS.some((pattern) => combined.includes(pattern));
}

/**
 * Strip noise from a cheerio-loaded document. Mutates the DOM.
 * @param {CheerioStatic} $ — cheerio instance
 * @returns {{ hardStripped: number, heuristicStripped: number }} stats
 */
function stripNoise($) {
  let hardStripped = 0;
  let heuristicStripped = 0;

  // Tier 1: Hard strip
  HARD_STRIP_SELECTORS.forEach((selector) => {
    $(selector).each((i, el) => {
      const $el = $(el);
      // Don't count already-removed children
      if ($el.closest('html').length === 0) return;
      hardStripped++;
      $el.remove();
    });
  });

  // Tier 2: Heuristic strip — scan all divs, sections, asides, headers, ul/ol
  $('div, section, aside, header, ul, ol, form').each((i, el) => {
    const $el = $(el);
    if ($el.closest('html').length === 0) return;

    // Never strip elements inside main content area
    const insideContent = CONTENT_SELECTORS.some((sel) => $el.closest(sel).length > 0);
    if (insideContent) return;

    if (isNoiseByHeuristic($el)) {
      heuristicStripped++;
      $el.remove();
    }
  });

  return { hardStripped, heuristicStripped };
}

/**
 * Remove empty elements that have no visible text after stripping.
 * @param {CheerioStatic} $ — cheerio instance
 * @returns {number} removed count
 */
function removeEmptyElements($) {
  let removed = 0;

  // Run multiple passes — emptying one element can make its parent empty
  for (let pass = 0; pass < 3; pass++) {
    let passRemoved = 0;

    $('p, div, section, span, li, ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6').each((i, el) => {
      const $el = $(el);
      if ($el.closest('html').length === 0) return;

      // Preserve semantic void elements
      if (PRESERVE_EMPTY.includes(el.tagName?.toLowerCase())) return;

      // Check if element has any visible text (after stripping scripts/styles)
      const text = $el.text().trim();
      // Check if it has meaningful children (images, links, etc.)
      const hasMeaningfulChildren = $el.find('img, a, table, pre, code, blockquote, video, audio, picture').length > 0;

      if (!text && !hasMeaningfulChildren) {
        $el.remove();
        passRemoved++;
        removed++;
      }
    });

    if (passRemoved === 0) break; // Converged
  }

  return removed;
}

/**
 * Extract the best content container from the page.
 * @param {CheerioStatic} $ — cheerio instance
 * @returns {Cheerio} the content element
 */
function extractContentRoot($) {
  // Try to find a semantic content container
  for (const selector of CONTENT_SELECTORS) {
    const $el = $(selector);
    if ($el.length > 0) {
      // Pick the largest one if multiple
      if ($el.length === 1) return $el.first();
      let best = $el.first();
      $el.each((i, el) => {
        if ($(el).text().length > best.text().length) {
          best = $(el);
        }
      });
      return best;
    }
  }

  // Fallback: use body and hope for the best
  return $('body');
}

module.exports = {
  HARD_STRIP_SELECTORS,
  HEURISTIC_PATTERNS,
  CONTENT_SELECTORS,
  PRESERVE_EMPTY,
  isNoiseByHeuristic,
  stripNoise,
  removeEmptyElements,
  extractContentRoot,
};
