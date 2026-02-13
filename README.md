# Coach — Daily AI Work Coach

Analyzes your **Claude Code** and **Claude App** sessions to deliver one lesson + one tip daily. Built around the [Hooked model](https://www.nirandfar.com/hooked/) to make self-improvement habitual.

```
┌──────────────────────────────────────────────────┐
│  COACH                               Day 12 🔥   │
├──────────────────────────────────────────────────┤
│                                                  │
│  TODAY'S LENS: Prompting Craft                   │
│                                                  │
│  📖 LESSON                                       │
│  Your prompts today started broad and required   │
│  3-4 clarification rounds...                     │
│                                                  │
│  💡 TIP                                          │
│  Try the 'Context-Task-Format' frame...          │
│                                                  │
│  🌱 Your afternoon sessions showed much tighter  │
│  prompting — you're already improving.           │
│                                                  │
├──────────────────────────────────────────────────┤
│  Was this helpful?  [y] Yes  [n] No              │
└──────────────────────────────────────────────────┘
```

## Install

```bash
npm install -g @pkprosol/coach
```

This installs the `coach` CLI and auto-registers `/coach` as a slash command in Claude Code.

## Setup

```bash
coach setup   # paste your Anthropic API key
```

Or set `ANTHROPIC_API_KEY` in your environment.

## Usage

### Terminal
```bash
coach            # today's lesson + tip
coach streak     # current streak + stats
coach history    # browse past insights
```

### Claude Code
```
/coach           # same thing, right inside Claude
/coach streak
/coach history
```

## How it works

1. **Collects** today's session data from `~/.claude/` (Claude Code) and `~/Library/Application Support/Claude/` (Claude App)
2. **Analyzes** your prompts, workflow patterns, and tool usage through a rotating lens (8 dimensions: prompting craft, workflow efficiency, architecture thinking, etc.)
3. **Delivers** one specific lesson + one actionable tip, with examples from your actual sessions
4. **Learns** from your ratings to improve future insights

## Data sources

| Source | Location | What's collected |
|--------|----------|-----------------|
| Claude Code | `~/.claude/` | Prompts, session transcripts, tool usage, tokens |
| Claude App | `~/Library/Application Support/Claude/` | Cowork/agent mode audit logs |

All data stays local. Only a summary is sent to the Claude API for analysis.

## Requirements

- Node.js 18+
- An Anthropic API key
- Claude Code and/or Claude Desktop App
