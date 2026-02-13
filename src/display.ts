import chalk from "chalk";
import type { Insight, CoachState, StoredInsight } from "./types.js";

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

export function renderSetupSuccess(): string {
  return chalk.green("✓") + " API key saved. Run " + chalk.bold("coach") + " to get your first insight!";
}

export function renderNoData(): string {
  return chalk.yellow("No Claude Code sessions found for today.") +
    "\n" +
    chalk.dim("Use Claude Code throughout the day, then run `coach` in the evening for your daily insight.");
}

export function renderError(msg: string): string {
  return chalk.red("Error: ") + msg;
}
