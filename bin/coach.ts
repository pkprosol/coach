#!/usr/bin/env node
import { createInterface } from "node:readline";
import ora from "ora";
import chalk from "chalk";
import { collectToday } from "../src/collector.js";
import { analyze, runClaude, buildHandoffPrompt, buildFocusPrompt, buildCostsPrompt, estimateCosts } from "../src/analyzer.js";
import {
  renderInsight,
  renderStreak,
  renderHistory,
  renderNoData,
  renderError,
  renderHandoff,
  renderFocus,
  renderRecap,
  renderGoals,
  renderCompare,
  renderWelcome,
  renderCosts,
} from "../src/display.js";
import {
  isFirstRun,
  loadState,
  saveState,
  loadInsights,
  appendInsight,
  updateLastInsightRating,
  updateStreak,
  recordDimension,
  addGoal,
  completeGoal,
  clearCompletedGoals,
  recordDailyStat,
} from "../src/storage.js";
import type { StoredInsight, DailyStat } from "../src/types.js";

function askQuestion(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function handleDefault(): Promise<void> {
  const spinner = ora({ text: "Collecting today's sessions...", color: "cyan" }).start();

  // Collect data
  const data = collectToday();

  if (data.prompts.length === 0) {
    spinner.stop();
    console.log(renderNoData());
    return;
  }

  spinner.text = `Found ${data.prompts.length} prompts across ${data.sessions.length} sessions. Analyzing...`;

  // Load state and past insights
  let state = loadState();
  const pastInsights = loadInsights();

  // Record daily stat
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  recordDailyStat({
    date: today,
    sessions: data.sessions.length,
    prompts: data.prompts.length,
    tokens: data.totalTokens,
    projects: data.projectsWorkedOn,
    toolCalls: data.totalToolCalls,
  });

  // Analyze
  let insight;
  try {
    insight = await analyze(data, state.recentDimensions, pastInsights);
  } catch (err: any) {
    spinner.stop();
    if (err.message?.includes("claude CLI not found")) {
      console.log(renderError("claude CLI not found. Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"));
    } else {
      console.log(renderError(err.message ?? "Analysis failed."));
    }
    return;
  }

  spinner.stop();

  // Update state
  state = updateStreak(state, today);
  state = recordDimension(state, insight.dimension);

  // Display
  console.log("");
  console.log(renderInsight(insight, state));
  console.log("");

  // Save insight (without rating yet)
  const storedInsight: StoredInsight = {
    ...insight,
    date: today,
    rating: null,
  };
  appendInsight(storedInsight);

  // Ask for rating (only in interactive terminal)
  if (process.stdin.isTTY) {
    const answer = await askQuestion("  ");
    if (answer === "y" || answer === "yes") {
      state.helpfulCount++;
      updateLastInsightRating("helpful");
      console.log(chalk.green("\n  Thanks! Noted for tomorrow. 🙌\n"));
    } else if (answer === "n" || answer === "no") {
      state.notHelpfulCount++;
      updateLastInsightRating("not_helpful");
      console.log(chalk.dim("\n  Got it — will adjust. Thanks for the feedback.\n"));
    } else {
      console.log(chalk.dim("\n  Skipped. See you tomorrow!\n"));
    }
  }

  saveState(state);
}

function handleStreakCmd(): void {
  const state = loadState();
  console.log("");
  console.log(renderStreak(state));
  console.log("");
}

function handleHistoryCmd(): void {
  const insights = loadInsights();
  console.log("");
  console.log(renderHistory(insights));
  console.log("");
}

function handleRate(value: string): void {
  const state = loadState();
  if (value === "y" || value === "yes") {
    state.helpfulCount++;
    updateLastInsightRating("helpful");
    saveState(state);
    console.log(chalk.green("  Thanks! Noted for tomorrow. 🙌"));
  } else if (value === "n" || value === "no") {
    state.notHelpfulCount++;
    updateLastInsightRating("not_helpful");
    saveState(state);
    console.log(chalk.dim("  Got it — will adjust. Thanks for the feedback."));
  } else {
    console.log(renderError("Usage: coach rate y|n"));
  }
}

async function handleHandoff(): Promise<void> {
  const spinner = ora({ text: "Collecting sessions for handoff...", color: "cyan" }).start();

  const data = collectToday();

  if (data.prompts.length === 0) {
    spinner.stop();
    console.log(renderNoData());
    return;
  }

  spinner.text = "Generating handoff note...";

  try {
    const prompt = buildHandoffPrompt(data);
    const text = await runClaude(prompt);
    spinner.stop();

    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    const handoff = JSON.parse(cleaned);

    console.log("");
    console.log(renderHandoff(handoff));
    console.log("");
  } catch (err: any) {
    spinner.stop();
    if (err.message?.includes("claude CLI not found")) {
      console.log(renderError("claude CLI not found. Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"));
    } else {
      console.log(renderError(err.message ?? "Handoff generation failed."));
    }
  }
}

async function handleFocus(): Promise<void> {
  const spinner = ora({ text: "Analyzing focus patterns...", color: "cyan" }).start();

  const data = collectToday();

  if (data.prompts.length === 0) {
    spinner.stop();
    console.log(renderNoData());
    return;
  }

  spinner.text = "Building focus analysis...";

  try {
    const prompt = buildFocusPrompt(data);
    const text = await runClaude(prompt);
    spinner.stop();

    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    const focus = JSON.parse(cleaned);

    console.log("");
    console.log(renderFocus(focus));
    console.log("");
  } catch (err: any) {
    spinner.stop();
    if (err.message?.includes("claude CLI not found")) {
      console.log(renderError("claude CLI not found. Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"));
    } else {
      console.log(renderError(err.message ?? "Focus analysis failed."));
    }
  }
}

async function handleCosts(): Promise<void> {
  const spinner = ora({ text: "Analyzing costs and token usage...", color: "cyan" }).start();

  const data = collectToday();

  if (data.prompts.length === 0) {
    spinner.stop();
    console.log(renderNoData());
    return;
  }

  spinner.text = "Crunching cost data...";

  try {
    const costs = estimateCosts(data);
    const prompt = buildCostsPrompt(data, costs);
    const text = await runClaude(prompt);
    spinner.stop();

    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    const analysis = JSON.parse(cleaned);

    console.log("");
    console.log(renderCosts(analysis));
    console.log("");
  } catch (err: any) {
    spinner.stop();
    if (err.message?.includes("claude CLI not found")) {
      console.log(renderError("claude CLI not found. Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"));
    } else {
      console.log(renderError(err.message ?? "Cost analysis failed."));
    }
  }
}

function handleRecap(): void {
  const data = collectToday();

  if (data.prompts.length === 0) {
    console.log(renderNoData());
    return;
  }

  console.log("");
  console.log(renderRecap(data));
  console.log("");
}

function handleGoals(args: string[]): void {
  const sub = args[0];

  if (!sub) {
    // Show goals
    const state = loadState();
    console.log("");
    console.log(renderGoals(state.goals));
    console.log("");
    return;
  }

  if (sub === "set") {
    const text = args.slice(1).join(" ").replace(/^["']|["']$/g, "");
    if (!text) {
      console.log(renderError('Usage: coach goals set "your goal"'));
      return;
    }
    const goal = addGoal(text);
    console.log(chalk.green("✓") + ` Goal #${goal.id} added: ${goal.text}`);
    return;
  }

  if (sub === "done") {
    const id = parseInt(args[1], 10);
    if (isNaN(id)) {
      console.log(renderError("Usage: coach goals done <id>"));
      return;
    }
    const ok = completeGoal(id);
    if (ok) {
      console.log(chalk.green("✓") + ` Goal #${id} marked complete.`);
    } else {
      console.log(renderError(`Goal #${id} not found or already completed.`));
    }
    return;
  }

  if (sub === "clear") {
    const count = clearCompletedGoals();
    console.log(chalk.green("✓") + ` Cleared ${count} completed goal${count !== 1 ? "s" : ""}.`);
    return;
  }

  console.log(renderError(`Unknown goals subcommand: ${sub}`));
}

function handleCompare(): void {
  const data = collectToday();

  if (data.prompts.length === 0) {
    console.log(renderNoData());
    return;
  }

  const state = loadState();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const todayStat: DailyStat = {
    date: today,
    sessions: data.sessions.length,
    prompts: data.prompts.length,
    tokens: data.totalTokens,
    projects: data.projectsWorkedOn,
    toolCalls: data.totalToolCalls,
  };

  // Compute 7-day average from stored stats (excluding today)
  const pastStats = state.dailyStats.filter((s) => s.date !== today).slice(-7);

  if (pastStats.length === 0) {
    console.log("");
    console.log(renderRecap(data));
    console.log(chalk.dim("  No historical data yet for comparison. Run `coach` daily to build history."));
    console.log("");
    return;
  }

  const n = pastStats.length;
  const avg: DailyStat = {
    date: `${n}-day avg`,
    sessions: pastStats.reduce((s, d) => s + d.sessions, 0) / n,
    prompts: pastStats.reduce((s, d) => s + d.prompts, 0) / n,
    tokens: pastStats.reduce((s, d) => s + d.tokens, 0) / n,
    projects: Array(Math.round(pastStats.reduce((s, d) => s + d.projects.length, 0) / n)).fill(""),
    toolCalls: pastStats.reduce((s, d) => s + d.toolCalls, 0) / n,
  };

  console.log("");
  console.log(renderCompare(todayStat, avg));
  console.log("");
}

function handleHelp(): void {
  console.log(`
${chalk.bold("coach")} — Daily AI Work Coach

${chalk.bold("Usage:")}
  coach            Today's lesson + tip (default)
  coach handoff    Generate a handoff note for your current work
  coach focus      Analyze context-switching and focus patterns
  coach costs      Token costs, prompt engineering tips & LLM insights
  coach recap      Quick summary of today's stats (no AI)
  coach goals      Show current goals
  coach goals set  Add a goal: coach goals set "finish auth"
  coach goals done Mark complete: coach goals done 1
  coach goals clear Clear completed goals
  coach compare    Compare today vs recent averages
  coach history    Browse past insights
  coach streak     Show current streak + stats
  coach help       Show this help message
`);
}

// --- Main ---
async function main(): Promise<void> {
  const command = process.argv[2];

  // Show welcome on first run (no command or default)
  if (!command && isFirstRun()) {
    console.log("");
    console.log(renderWelcome());
    console.log("");
    return;
  }

  switch (command) {
    case "handoff":
      await handleHandoff();
      break;
    case "focus":
      await handleFocus();
      break;
    case "costs":
      await handleCosts();
      break;
    case "recap":
      handleRecap();
      break;
    case "goals":
      handleGoals(process.argv.slice(3));
      break;
    case "compare":
      handleCompare();
      break;
    case "history":
      handleHistoryCmd();
      break;
    case "streak":
      handleStreakCmd();
      break;
    case "rate":
      handleRate(process.argv[3] ?? "");
      break;
    case "help":
    case "--help":
    case "-h":
      handleHelp();
      break;
    default:
      await handleDefault();
      break;
  }
}

main().catch((err) => {
  console.error(renderError(err.message ?? "Unexpected error"));
  process.exit(1);
});
