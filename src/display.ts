import chalk from "chalk";
import type { Insight, CoachState, StoredInsight, Goal, CollectedData, DailyStat } from "./types.js";

const WIDTH = 50;

function hr(): string {
  return chalk.dim("─".repeat(WIDTH));
}

function boxTop(): string {
  return chalk.dim("┌" + "─".repeat(WIDTH) + "┐");
}

function boxBot(): string {
  return chalk.dim("└" + "─".repeat(WIDTH) + "┘");
}

function boxMid(): string {
  return chalk.dim("├" + "─".repeat(WIDTH) + "┤");
}

function padLine(text: string): string {
  return chalk.dim("│") + " " + text;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderSection(label: string, body: string): string[] {
  const lines: string[] = [];
  lines.push(padLine(""));
  lines.push(padLine(chalk.bold(label)));
  for (const line of wrapText(body, WIDTH - 4)) {
    lines.push(padLine("  " + line));
  }
  return lines;
}

export function renderInsight(insight: Insight, state: CoachState): string {
  const out: string[] = [];

  // Header
  out.push(boxTop());
  const streakStr = state.streak > 0 ? `Day ${state.streak} ${state.streak >= 3 ? "🔥" : ""}` : "Day 1";
  const header = `  COACH`;
  const headerRight = streakStr;
  const padding = WIDTH - header.length - headerRight.length - 1;
  out.push(
    padLine(chalk.bold.white(header) + " ".repeat(Math.max(1, padding)) + chalk.yellow(headerRight))
  );
  out.push(boxMid());

  // Dimension
  out.push(padLine(""));
  out.push(padLine(chalk.cyan.bold(`  TODAY'S LENS: ${insight.dimension}`)));

  // Lesson
  out.push(...renderSection("  📖 LESSON", insight.lesson));

  // Tip
  out.push(...renderSection("  💡 TIP", insight.tip));

  // Specific example
  if (insight.specificExample) {
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  ✦ BEFORE (your prompt):")));
    for (const line of wrapText(insight.specificExample.before, WIDTH - 6)) {
      out.push(padLine(chalk.dim("    " + line)));
    }
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  ✦ AFTER (try this):")));
    for (const line of wrapText(insight.specificExample.after, WIDTH - 6)) {
      out.push(padLine(chalk.green("    " + line)));
    }
  }

  // Encouragement
  out.push(padLine(""));
  out.push(padLine("  🌱 " + chalk.italic(insight.encouragement)));

  // Footer
  out.push(padLine(""));
  out.push(boxMid());
  out.push(padLine(chalk.dim("  Was this helpful?  ") + chalk.bold("[y]") + " Yes  " + chalk.bold("[n]") + " No"));
  out.push(boxBot());

  return out.join("\n");
}

export function renderStreak(state: CoachState): string {
  const out: string[] = [];

  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  COACH STATS")));
  out.push(boxMid());
  out.push(padLine(""));
  out.push(padLine(`  🔥 Current streak: ${chalk.bold.yellow(String(state.streak))} days`));
  out.push(padLine(`  📊 Total insights: ${chalk.bold(String(state.totalInsights))}`));
  if (state.totalInsights > 0) {
    const helpfulPct = Math.round((state.helpfulCount / state.totalInsights) * 100);
    out.push(padLine(`  👍 Helpful rate: ${chalk.bold.green(helpfulPct + "%")} (${state.helpfulCount}/${state.totalInsights})`));
  }
  out.push(padLine(`  📅 Last run: ${state.lastRunDate ?? "never"}`));
  out.push(padLine(""));
  out.push(boxBot());

  return out.join("\n");
}

export function renderHistory(insights: StoredInsight[]): string {
  if (insights.length === 0) {
    return chalk.dim("No insights yet. Run `coach` to get your first one!");
  }

  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  PAST INSIGHTS")));
  out.push(boxMid());

  // Show last 10
  const recent = insights.slice(-10).reverse();
  for (const insight of recent) {
    const ratingIcon =
      insight.rating === "helpful"
        ? chalk.green("👍")
        : insight.rating === "not_helpful"
          ? chalk.red("👎")
          : chalk.dim("--");

    out.push(padLine(""));
    out.push(
      padLine(
        `  ${chalk.dim(insight.date)}  ${chalk.cyan(insight.dimension)}  ${ratingIcon}`
      )
    );
    const preview = insight.lesson.slice(0, WIDTH - 8);
    out.push(padLine(chalk.dim(`    ${preview}...`)));
  }

  out.push(padLine(""));
  out.push(boxBot());

  if (insights.length > 10) {
    out.push(chalk.dim(`  Showing last 10 of ${insights.length} insights`));
  }

  return out.join("\n");
}

export function renderWelcome(): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  WELCOME TO COACH")));
  out.push(boxMid());
  out.push(padLine(""));
  out.push(padLine("  Coach analyzes your Claude Code and Claude"));
  out.push(padLine("  App sessions to give you a daily lesson and"));
  out.push(padLine("  actionable tip — like a personal AI work coach."));
  out.push(padLine(""));
  out.push(padLine(chalk.bold("  How it works:")));
  out.push(padLine("  1. Use Claude Code / Claude App as usual"));
  out.push(padLine("  2. Run " + chalk.cyan("coach") + " at the end of your day"));
  out.push(padLine("  3. Get a personalized insight + tip"));
  out.push(padLine(""));
  out.push(padLine(chalk.bold("  Commands:")));
  out.push(padLine("  " + chalk.cyan("coach") + "           Today's lesson + tip"));
  out.push(padLine("  " + chalk.cyan("coach handoff") + "   Handoff note for your work"));
  out.push(padLine("  " + chalk.cyan("coach focus") + "     Focus & context-switching"));
  out.push(padLine("  " + chalk.cyan("coach recap") + "     Quick stats (no AI)"));
  out.push(padLine("  " + chalk.cyan("coach goals") + "     Track your goals"));
  out.push(padLine("  " + chalk.cyan("coach compare") + "   Today vs recent averages"));
  out.push(padLine("  " + chalk.cyan("coach help") + "      All commands"));
  out.push(padLine(""));
  out.push(padLine(chalk.bold("  Requirements:")));
  out.push(padLine("  " + chalk.dim("Claude Code CLI must be installed and")));
  out.push(padLine("  " + chalk.dim("authenticated. Get it at:")));
  out.push(padLine("  " + chalk.dim("https://docs.anthropic.com/en/docs/claude-code")));
  out.push(padLine(""));
  out.push(boxBot());
  return out.join("\n");
}

export function renderNoData(): string {
  return chalk.yellow("No Claude Code sessions found for today.") +
    "\n" +
    chalk.dim("Use Claude Code throughout the day, then run `coach` in the evening for your daily insight.");
}

export function renderError(msg: string): string {
  return chalk.red("Error: ") + msg;
}

// === Handoff ===

export function renderHandoff(handoff: {
  workingOn: string;
  currentState: string;
  keyDecisions: string[];
  nextSteps: string[];
  openQuestions: string[];
}): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  HANDOFF NOTE")));
  out.push(boxMid());

  out.push(...renderSection("  Working On", handoff.workingOn));
  out.push(...renderSection("  Current State", handoff.currentState));

  if (handoff.keyDecisions.length > 0) {
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  Key Decisions")));
    for (const d of handoff.keyDecisions) {
      for (const line of wrapText(`- ${d}`, WIDTH - 6)) {
        out.push(padLine("    " + line));
      }
    }
  }

  if (handoff.nextSteps.length > 0) {
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  Next Steps")));
    for (const s of handoff.nextSteps) {
      for (const line of wrapText(`- ${s}`, WIDTH - 6)) {
        out.push(padLine("    " + line));
      }
    }
  }

  if (handoff.openQuestions.length > 0) {
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  Open Questions")));
    for (const q of handoff.openQuestions) {
      for (const line of wrapText(`? ${q}`, WIDTH - 6)) {
        out.push(padLine("    " + line));
      }
    }
  }

  out.push(padLine(""));
  out.push(boxBot());
  return out.join("\n");
}

// === Focus ===

export function renderFocus(focus: {
  contextSwitches: number;
  longestFocusPeriod: string;
  shortestFocusPeriod: string;
  pattern: string;
  suggestions: string[];
}): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  FOCUS ANALYSIS")));
  out.push(boxMid());

  out.push(padLine(""));
  out.push(padLine(`  Context switches: ${chalk.bold.yellow(String(focus.contextSwitches))}`));
  out.push(...renderSection("  Longest Focus", focus.longestFocusPeriod));
  out.push(...renderSection("  Shortest Focus", focus.shortestFocusPeriod));
  out.push(...renderSection("  Pattern", focus.pattern));

  if (focus.suggestions.length > 0) {
    out.push(padLine(""));
    out.push(padLine(chalk.bold("  Suggestions")));
    for (const s of focus.suggestions) {
      for (const line of wrapText(`- ${s}`, WIDTH - 6)) {
        out.push(padLine("    " + line));
      }
    }
  }

  out.push(padLine(""));
  out.push(boxBot());
  return out.join("\n");
}

// === Recap ===

export function renderRecap(data: CollectedData): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  TODAY'S RECAP")));
  out.push(boxMid());

  out.push(padLine(""));
  out.push(padLine(`  Date: ${chalk.bold(data.date)}`));
  out.push(padLine(`  Projects: ${chalk.cyan(data.projectsWorkedOn.join(", ") || "none")}`));
  out.push(padLine(`  Sessions: ${chalk.bold(String(data.sessions.length))}`));
  out.push(padLine(`  Prompts: ${chalk.bold(String(data.prompts.length))}`));
  out.push(padLine(`  Tokens: ${chalk.bold(data.totalTokens.toLocaleString())}`));
  out.push(padLine(`  Tool calls: ${chalk.bold(String(data.totalToolCalls))}`));

  // Time spent
  let totalMinutes = 0;
  for (const s of data.sessions) {
    if (s.startTime && s.endTime) {
      totalMinutes += Math.round(
        (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000
      );
    }
  }
  if (totalMinutes > 0) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    out.push(padLine(`  Time: ${chalk.bold(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)}`));
  }

  // Unique tools
  const allTools = new Set<string>();
  for (const s of data.sessions) {
    for (const t of s.toolNames) allTools.add(t);
  }
  if (allTools.size > 0) {
    out.push(padLine(`  Tools used: ${chalk.dim([...allTools].join(", "))}`));
  }

  out.push(padLine(""));
  out.push(boxBot());
  return out.join("\n");
}

// === Goals ===

export function renderGoals(goals: Goal[]): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  GOALS")));
  out.push(boxMid());

  if (goals.length === 0) {
    out.push(padLine(""));
    out.push(padLine(chalk.dim("  No goals set. Use `coach goals set \"your goal\"` to add one.")));
    out.push(padLine(""));
  } else {
    out.push(padLine(""));
    for (const g of goals) {
      const status = g.completedDate
        ? chalk.green("[done]")
        : chalk.yellow("[    ]");
      const text = g.completedDate ? chalk.strikethrough.dim(g.text) : g.text;
      out.push(padLine(`  ${status} ${chalk.dim(`#${g.id}`)} ${text}`));
    }
    out.push(padLine(""));
  }

  out.push(boxBot());
  return out.join("\n");
}

// === Compare ===

export function renderCompare(today: DailyStat, avg: DailyStat): string {
  const out: string[] = [];
  out.push(boxTop());
  out.push(padLine(chalk.bold.white("  TODAY vs 7-DAY AVERAGE")));
  out.push(boxMid());

  function compareVal(label: string, todayVal: number, avgVal: number): string {
    const diff = todayVal - avgVal;
    const arrow = diff > 0 ? chalk.green("^") : diff < 0 ? chalk.red("v") : chalk.dim("=");
    const diffStr = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${Math.round(diff)})` : "";
    return `  ${label.padEnd(14)} ${chalk.bold(String(todayVal).padStart(6))}  ${chalk.dim("avg")} ${String(Math.round(avgVal)).padStart(6)}  ${arrow}${diffStr}`;
  }

  out.push(padLine(""));
  out.push(padLine(compareVal("Sessions", today.sessions, avg.sessions)));
  out.push(padLine(compareVal("Prompts", today.prompts, avg.prompts)));
  out.push(padLine(compareVal("Tokens", today.tokens, avg.tokens)));
  out.push(padLine(compareVal("Tool calls", today.toolCalls, avg.toolCalls)));
  out.push(padLine(`  ${"Projects".padEnd(14)} ${chalk.bold(String(today.projects.length).padStart(6))}  ${chalk.dim("avg")} ${String(Math.round(avg.projects.length)).padStart(6)}`));
  out.push(padLine(""));
  out.push(boxBot());
  return out.join("\n");
}
