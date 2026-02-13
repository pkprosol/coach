// === Analysis Dimensions ===

export const DIMENSIONS = [
  "Prompting Craft",
  "Workflow Efficiency",
  "Architecture Thinking",
  "Learning Patterns",
  "Focus & Deep Work",
  "Communication Style",
  "Tool Leverage",
  "Problem Decomposition",
  "Cost Awareness",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

// === Collected Session Data ===

export interface UserPrompt {
  text: string;
  timestamp: string;
  sessionId: string;
  project: string;
}

export type SessionSource = "claude-code" | "claude-app";

export interface SessionSummary {
  sessionId: string;
  project: string;
  source: SessionSource;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  toolNames: string[];
  inputTokens: number;
  outputTokens: number;
  startTime: string;
  endTime: string;
  gitBranch?: string;
}

export interface CollectedData {
  date: string;
  prompts: UserPrompt[];
  sessions: SessionSummary[];
  totalTokens: number;
  totalMessages: number;
  totalToolCalls: number;
  projectsWorkedOn: string[];
}

// === Analysis Result ===

export interface SpecificExample {
  before: string;
  after: string;
}

export interface Insight {
  dimension: Dimension;
  lesson: string;
  tip: string;
  specificExample: SpecificExample | null;
  encouragement: string;
}

export interface StoredInsight extends Insight {
  date: string;
  rating: "helpful" | "not_helpful" | null;
}

// === Goals ===

export interface Goal {
  id: number;
  text: string;
  createdDate: string;
  completedDate: string | null;
}

// === Daily Stats ===

export interface DailyStat {
  date: string;
  sessions: number;
  prompts: number;
  tokens: number;
  projects: string[];
  toolCalls: number;
}

// === Coach State ===

export interface CoachState {
  streak: number;
  lastRunDate: string | null;
  recentDimensions: Dimension[];
  totalInsights: number;
  helpfulCount: number;
  notHelpfulCount: number;
  goals: Goal[];
  dailyStats: DailyStat[];
}

// === Cost Analysis ===

export interface CostEstimate {
  sessionId: string;
  project: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostAnalysis {
  estimatedCost: string;
  mostExpensiveSession: string;
  costBreakdown: string;
  surprisingFact: string;
  efficiencyTips: string[];
  promptEngineeringInsight: string;
}

// === Strategize Analysis ===

export interface StrategizeArea {
  area: string;
  why: string;
  suggestedAction: string;
}

export interface StrategizeAnalysis {
  recentPatterns: string;
  highImpactAreas: StrategizeArea[];
  tomorrowPlan: string[];
  avoidTomorrow: string;
  motivationalNote: string;
}

// === Raw Claude Code Data Types ===

export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface ConversationMessage {
  type: "user" | "assistant" | "file-history-snapshot";
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    usage?: TokenUsage;
  };
}

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// === Raw Claude Desktop App Data Types ===

export interface DesktopSessionMeta {
  sessionId: string;
  title: string;
  model: string;
  initialMessage: string;
  createdAt: number;
  lastActivityAt: number;
  cwd?: string;
}

export interface AuditEntry {
  type: "user" | "assistant" | "tool" | "tool_result";
  uuid: string;
  session_id: string;
  parent_tool_use_id: string | null;
  message: {
    role: string;
    content: string | ContentBlock[];
  };
  _audit_timestamp: string;
}
