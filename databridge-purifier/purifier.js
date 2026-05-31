/**
 * purifier.js — HTML to Clean Markdown Converter
 *
 * Pipeline: Raw HTML → Cheerio DOM → Noise Filter → Turndown → Clean Markdown
 */

const cheerio = require('cheerio');
const TurndownService = require('turndown');
const config = require('./config');
const { stripNoise, removeEmptyElements, extractContentRoot } = require('./filters');

class Purifier {
  constructor() {
    this.turndown = null;
  }

  /**
   * Purify HTML into clean Markdown.
   * @param {string} html — raw HTML string
   * @param {object} options — turndown + filter options
   * @returns {{ markdown: string, title: string, stats: object }}
   */
  purify(html, options = {}) {
    const opts = { ...config.DEFAULT_OPTIONS, ...options };
    const originalSize = html.length;

    // Step 1: Parse HTML
    const $ = cheerio.load(html);

    // Step 2: Extract title before we strip it
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Step 3: Strip noise (Tier 1 + Tier 2)
    const noiseStats = stripNoise($);

    // Step 4: Find best content root
    const $content = extractContentRoot($);

    // Step 5: Clean up empties inside content (Tier 3)
    const emptyRemoved = removeEmptyElements($);

    // Step 6: Get cleaned HTML from the content root
    const cleanedHtml = $content.html() || '';

    // Step 7: Convert to Markdown with turndown
    const turndownService = new TurndownService({
      headingStyle: opts.headingStyle,
      codeBlockStyle: 'fenced',
      fence: opts.codeFence,
      bulletListMarker: opts.bulletListMarker,
      emDelimiter: opts.emDelimiter,
      strongDelimiter: opts.strongDelimiter,
      linkStyle: opts.linkStyle,
      linkReferenceStyle: opts.linkReferenceStyle,
    });

    // Custom rules for cleaner output
    this.applyTurndownRules(turndownService, opts);

    let markdown = turndownService.turndown(cleanedHtml);

    // Step 8: Ensure page title is preserved in output
    // (content root may have excluded the <header> where <h1> lives)
    if (title && title !== 'Untitled') {
      const titleAsH1 = `# ${title}`;
      if (!markdown.includes(titleAsH1) && !markdown.startsWith(`# ${title.split(' ').slice(0, 3).join(' ')}`)) {
        markdown = `${titleAsH1}\n\n${markdown}`;
      }
    }

    // Step 9: Post-process — compact excessive blank lines
    markdown = this.compactBlankLines(markdown);

    // Step 9: Build stats
    const strippedTypes = {
      hardStripped: noiseStats.hardStripped,
      heuristicStripped: noiseStats.heuristicStripped,
      emptyCleaned: emptyRemoved,
      total: noiseStats.hardStripped + noiseStats.heuristicStripped + emptyRemoved,
    };

    const cleanedSize = markdown.length;
    const reductionPercent = originalSize > 0
      ? Math.round((1 - cleanedSize / originalSize) * 100 * 10) / 10
      : 0;

    return {
      markdown,
      title,
      stats: {
        strippedElements: strippedTypes.total,
        strippedTypes,
        originalSize,
        cleanedSize,
        reductionPercent,
      },
    };
  }

  /**
   * Apply custom turndown rules for cleaner Markdown output.
   */
  applyTurndownRules(td, opts) {
    // Remove empty links (href="#" or empty)
    td.addRule('removeEmptyLinks', {
      filter: (node) => {
        if (node.nodeName !== 'A') return false;
        const href = node.getAttribute('href') || '';
        return !href || href === '#' || href.startsWith('javascript:');
      },
      replacement: (content) => content,
    });

    // Convert strong/b inside headings to plain text (avoids ** inside #)
    td.addRule('headingStrong', {
      filter: (node) => {
        if (node.nodeName !== 'STRONG' && node.nodeName !== 'B') return false;
        // Check if any ancestor is a heading
        let parent = node.parentNode;
        while (parent) {
          if (/^H[1-6]$/.test(parent.nodeName)) return true;
          parent = parent.parentNode;
        }
        return false;
      },
      replacement: (content) => content,
    });

    // Strip image alt text if preserveImages is false
    if (!opts.preserveImages) {
      td.addRule('stripImages', {
        filter: 'img',
        replacement: () => '',
      });
    }

    // Keep code blocks clean
    td.addRule('cleanCodeBlocks', {
      filter: (node) => {
        return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE';
      },
      replacement: (content, node) => {
        const code = node.firstChild;
        const lang = (code.getAttribute('class') || '')
          .replace('language-', '')
          .replace('lang-', '')
          .trim();

        const text = code.textContent || '';
        return `\n\n${opts.codeFence}${lang}\n${text.trim()}\n${opts.codeFence}\n\n`;
      },
    });
  }

  /**
   * Compact excessive blank lines (max 1 consecutive blank line).
   */
  compactBlankLines(md) {
    return md
      .replace(/\n{3,}/g, '\n\n')  // 3+ newlines → 2
      .replace(/^\n+/, '')          // Strip leading newlines
      .replace(/\n+$/, '\n');       // Single trailing newline
  }
}

module.exports = { Purifier };
