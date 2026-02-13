# Coach — Daily AI Work Coach

Analyzes your **Claude Code** and **Claude App** sessions to deliver insights, handoff notes, focus analysis, and more. A swiss army knife for developer productivity.

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

## Requirements

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Claude Code and/or Claude Desktop App (for session data)

## Usage

### Core

```bash
coach              # Today's lesson + tip (AI-powered)
coach handoff      # Generate a handoff note for your current work
coach focus        # Analyze context-switching and focus patterns
```

### Quick Stats (no AI)

```bash
coach recap        # Summary of today's sessions, prompts, tokens, tools
coach compare      # Compare today vs your 7-day averages
```

### Goals

```bash
coach goals              # Show current goals
coach goals set "text"   # Add a new goal
coach goals done 1       # Mark goal #1 complete
coach goals clear        # Clear completed goals
```

### Meta

```bash
coach history      # Browse past insights
coach streak       # Current streak + stats
coach help         # Show all commands
```

### Claude Code

```
/coach             # Same thing, right inside Claude
/coach handoff
/coach recap
```

## How it works

1. **Collects** today's session data from `~/.claude/` (Claude Code) and `~/Library/Application Support/Claude/` (Claude App)
2. **Analyzes** your prompts, workflow patterns, and tool usage through a rotating lens (8 dimensions: prompting craft, workflow efficiency, architecture thinking, etc.)
3. **Delivers** one specific lesson + one actionable tip, with examples from your actual sessions
4. **Learns** from your ratings to improve future insights

AI-powered commands (`coach`, `handoff`, `focus`) use the Claude CLI under the hood — no separate API key needed.

## Data sources

| Source | Location | What's collected |
|--------|----------|-----------------|
| Claude Code | `~/.claude/` | Prompts, session transcripts, tool usage, tokens |
| Claude App | `~/Library/Application Support/Claude/` | Cowork/agent mode audit logs |

All data stays local. Only a summary is sent to Claude for analysis.
