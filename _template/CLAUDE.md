# DataBridge Skill — Claude Code Integration

## What this skill does
Briefly describe what problem this skill solves and when to use it. Reference how it fits into the DataBridge pipeline (crawler → purifier → [this] → ...).

## Pipeline Position
```
databridge-crawler (3000) → databridge-purifier (3001) → databridge-{this} (3002)
```
Explain which stage this is and what flows in/out.

## How to invoke
```
/databridge-skill-name <args>
```

## Examples
```
/databridge-skill-name "example input"
```

## Prerequisites
- Node.js 18+
- `npm install` in the skill directory
- Any API keys needed (set in `.env`)

## Implementation notes
- This skill is a standalone Express server
- It starts on `http://localhost:<PORT>` (default 3002+)
- Use `curl` or the Claude Code skill invocation to interact with it
