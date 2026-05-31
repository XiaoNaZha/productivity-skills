require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  TIMEOUT: parseInt(process.env.TIMEOUT) || 30000,
  MAX_INPUT_SIZE: parseInt(process.env.MAX_INPUT_SIZE) || 10 * 1024 * 1024, // 10MB

  DEFAULT_OPTIONS: {
    preserveImages: true,
    preserveLinks: true,
    headingStyle: 'atx',        // atx | setext
    codeFence: '```',           // ``` | ~~~
    bulletListMarker: '-',      // - | * | +
    emDelimiter: '_',           // _ | *
    strongDelimiter: '**',      // ** | __
    linkStyle: 'inlined',       // inlined | referenced
    linkReferenceStyle: 'full', // full | collapsed | shortcut
  },
};
