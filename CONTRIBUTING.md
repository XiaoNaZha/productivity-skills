# Contributing to Productivity Skills

Thanks for contributing! 🚀

## How to Add a New Skill

1. **Copy the template:** `cp -r _template/ your-skill-name/`
2. **Implement your skill** following the template structure
3. **Write tests** — every skill should have `npm test` working
4. **Add a CLAUDE.md** — so Claude Code knows how to invoke it
5. **Update the catalog** — add your skill to the table in the root `README.md`
6. **Open a PR** with a clear description

## Skill Guidelines

- **Self-contained:** Each skill installs and runs independently
- **Documented:** Clear README with API reference, examples, and quick start
- **Tested:** Include a test suite that verifies core functionality
- **Configurable:** Use environment variables for sensitive values, provide sensible defaults
- **Error handling:** All skills should handle errors gracefully and return meaningful messages

## Project Conventions

- **Language:** Node.js (JavaScript) for consistency
- **Formatting:** 2-space indentation, single quotes preferred
- **Dependencies:** Keep them minimal — prefer built-in modules where possible
- **Server skills:** Express-based, port configurable via `PORT` env var, health check at `/health`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
