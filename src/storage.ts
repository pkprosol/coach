import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CoachState, StoredInsight, Goal, DailyStat } from "./types.js";

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
  goals: [],
  dailyStats: [],
};

export function loadState(): CoachState {
  ensureDir();
  if (!existsSync(STATE_FILE)) {
    return { ...DEFAULT_STATE };
  }
  const raw = readFileSync(STATE_FILE, "utf-8");
  return { ...DEFAULT_STATE, ...JSON.parse(raw) } as CoachState;
}

export function saveState(state: CoachState): void {
  ensureDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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

// === Goal management ===

export function addGoal(text: string): Goal {
  const state = loadState();
  const id = (state.goals.length > 0 ? Math.max(...state.goals.map((g) => g.id)) : 0) + 1;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const goal: Goal = { id, text, createdDate: today, completedDate: null };
  state.goals.push(goal);
  saveState(state);
  return goal;
}

export function completeGoal(id: number): boolean {
  const state = loadState();
  const goal = state.goals.find((g) => g.id === id);
  if (!goal || goal.completedDate) return false;
  const now = new Date();
  goal.completedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  saveState(state);
  return true;
}

export function clearCompletedGoals(): number {
  const state = loadState();
  const before = state.goals.length;
  state.goals = state.goals.filter((g) => !g.completedDate);
  saveState(state);
  return before - state.goals.length;
}

// === Daily stat recording ===

export function recordDailyStat(stat: DailyStat): void {
  const state = loadState();
  // Replace if same date exists, otherwise append
  const idx = state.dailyStats.findIndex((s) => s.date === stat.date);
  if (idx >= 0) {
    state.dailyStats[idx] = stat;
  } else {
    state.dailyStats.push(stat);
  }
  // Keep last 30 days
  if (state.dailyStats.length > 30) {
    state.dailyStats = state.dailyStats.slice(-30);
  }
  saveState(state);
}
