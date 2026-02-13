import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const skillDir = join(homedir(), ".claude", "skills", "coach");
const skillFile = join(skillDir, "SKILL.md");

const SKILL_CONTENT = `---
name: coach
description: Daily AI work coach - analyzes your Claude Code and Claude App sessions to deliver one lesson and one tip
disable-model-invocation: true
user-invocable: true
---

Run the Coach CLI tool to analyze today's Claude usage and deliver a personalized insight.

Execute this command and display the output exactly as-is to the user (it contains formatted terminal UI):

\`\`\`bash
coach
\`\`\`

After showing the output, ask the user: "Was this helpful? (y/n)" and based on their answer, run:

- If yes: \`coach rate y\`
- If no: \`coach rate n\`

If the user passes an argument, route it as a subcommand:
- \`/coach streak\` → \`coach streak\`
- \`/coach history\` → \`coach history\`
- \`/coach setup\` → \`coach setup\`
`;

try {
  if (!existsSync(join(homedir(), ".claude"))) {
    // Claude Code not installed — skip skill setup silently
    process.exit(0);
  }

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillFile, SKILL_CONTENT);
  console.log("✓ Installed /coach command for Claude Code");
} catch {
  // Non-fatal — coach CLI still works without the skill
  console.log("Note: Could not install /coach skill (coach CLI still works via `coach` command)");
}
