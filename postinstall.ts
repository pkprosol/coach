import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const skillDir = join(homedir(), ".claude", "skills", "coach");
const skillFile = join(skillDir, "SKILL.md");

const SKILL_CONTENT = `---
name: coach
description: Daily AI work coach — analyzes your Claude sessions to deliver insights, handoff notes, focus analysis, and more
disable-model-invocation: true
user-invocable: true
---

Run the Coach CLI tool and display the output exactly as-is to the user (it contains formatted terminal UI).

If the user passes an argument, route it as a subcommand:
- \`/coach\` → \`coach\` (today's lesson + tip)
- \`/coach handoff\` → \`coach handoff\` (generate handoff note)
- \`/coach focus\` → \`coach focus\` (focus analysis)
- \`/coach recap\` → \`coach recap\` (quick stats)
- \`/coach goals\` → \`coach goals\` (show goals)
- \`/coach goals set "text"\` → \`coach goals set "text"\`
- \`/coach goals done 1\` → \`coach goals done 1\`
- \`/coach compare\` → \`coach compare\` (today vs averages)
- \`/coach streak\` → \`coach streak\`
- \`/coach history\` → \`coach history\`

\`\`\`bash
coach
\`\`\`

After showing the output of the default command, ask the user: "Was this helpful? (y/n)" and based on their answer, run:

- If yes: \`coach rate y\`
- If no: \`coach rate n\`
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
