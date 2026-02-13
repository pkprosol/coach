import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CoachState, StoredInsight } from "./types.js";

const COACH_DIR = join(homedir(), ".coach");
const STATE_FILE = join(COACH_DIR, "state.json");
const INSIGHTS_FILE = join(COACH_DIR, "insights.jsonl");

function ensureDir(): void {
  if (!existsSync(COACH_DIR)) {
    mkdirSync(COACH_DIR, { recursive: true });
  }
}

const DEFAULT_STATE: CoachState = {
  streak: 0,
  lastRunDate: null,
  recentDimensions: [],
  totalInsights: 0,
  helpfulCount: 0,
  notHelpfulCount: 0,
};

export function loadState(): CoachState {
  ensureDir();
  if (!existsSync(STATE_FILE)) {
    return { ...DEFAULT_STATE };
  }
  const raw = readFileSync(STATE_FILE, "utf-8");
  return JSON.parse(raw) as CoachState;
}

export function saveState(state: CoachState): void {
  ensureDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getApiKey(): string | undefined {
  const state = loadState();
  return state.apiKey ?? process.env.ANTHROPIC_API_KEY;
}

export function setApiKey(key: string): void {
  const state = loadState();
  state.apiKey = key;
  saveState(state);
}

export function updateStreak(state: CoachState, today: string): CoachState {
  if (state.lastRunDate === today) {
    return state; // Already ran today
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (state.lastRunDate === yesterdayStr) {
    state.streak += 1;
  } else if (state.lastRunDate === null) {
    state.streak = 1;
  } else {
    state.streak = 1; // Streak broken, restart
  }

  state.lastRunDate = today;
  return state;
}

export function recordDimension(state: CoachState, dimension: string): CoachState {
  state.recentDimensions.push(dimension as any);
  // Keep only last 4 to ensure rotation
  if (state.recentDimensions.length > 4) {
    state.recentDimensions = state.recentDimensions.slice(-4);
  }
  state.totalInsights += 1;
  return state;
}

export function appendInsight(insight: StoredInsight): void {
  ensureDir();
  appendFileSync(INSIGHTS_FILE, JSON.stringify(insight) + "\n");
}

export function loadInsights(): StoredInsight[] {
  ensureDir();
  if (!existsSync(INSIGHTS_FILE)) {
    return [];
  }
  const raw = readFileSync(INSIGHTS_FILE, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").map((line) => JSON.parse(line) as StoredInsight);
}

export function updateLastInsightRating(rating: "helpful" | "not_helpful"): void {
  const insights = loadInsights();
  if (insights.length === 0) return;
  insights[insights.length - 1].rating = rating;
  // Rewrite entire file
  ensureDir();
  writeFileSync(
    INSIGHTS_FILE,
    insights.map((i) => JSON.stringify(i)).join("\n") + "\n"
  );
}
