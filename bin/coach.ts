#!/usr/bin/env node
import { createInterface } from "node:readline";
import ora from "ora";
import chalk from "chalk";
import { collectToday } from "../src/collector.js";
import { analyze } from "../src/analyzer.js";
import {
  renderInsight,
  renderStreak,
  renderHistory,
  renderSetupSuccess,
  renderNoData,
  renderError,
} from "../src/display.js";
import {
  loadState,
  saveState,
  getApiKey,
  setApiKey,
  loadInsights,
  appendInsight,
  updateLastInsightRating,
  updateStreak,
  recordDimension,
} from "../src/storage.js";
import type { StoredInsight } from "../src/types.js";

function askQuestion(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function handleSetup(): Promise<void> {
  const existing = getApiKey();
  if (existing) {
    console.log(chalk.dim("API key already configured."));
    const answer = await askQuestion("Replace it? [y/N] ");
    if (answer !== "y") return;
  }
  const key = await askQuestion("Enter your Anthropic API key: ");
  if (!key) {
    console.log(renderError("No key provided."));
    return;
  }
  setApiKey(key);
  console.log(renderSetupSuccess());
}

async function handleDefault(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(renderError("No API key found. Run `coach setup` first, or set ANTHROPIC_API_KEY."));
    return;
  }

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

  // Analyze
  let insight;
  try {
    insight = await analyze(data, state.recentDimensions, pastInsights, apiKey);
  } catch (err: any) {
    spinner.stop();
    if (err.status === 401) {
      console.log(renderError("Invalid API key. Run `coach setup` to update it."));
    } else {
      console.log(renderError(err.message ?? "Analysis failed."));
    }
    return;
  }

  spinner.stop();

  // Update state
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

function handleHelp(): void {
  console.log(`
${chalk.bold("coach")} — Daily AI Work Coach

${chalk.bold("Usage:")}
  coach            Today's lesson + tip (default)
  coach setup      Set your Anthropic API key
  coach history    Browse past insights
  coach streak     Show current streak + stats
  coach help       Show this help message
`);
}

// --- Main ---
const command = process.argv[2];

switch (command) {
  case "setup":
    handleSetup();
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
    handleDefault();
    break;
}
