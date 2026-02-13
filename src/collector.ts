import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type {
  CollectedData,
  HistoryEntry,
  UserPrompt,
  SessionSummary,
  ConversationMessage,
  ContentBlock,
  AuditEntry,
  DesktopSessionMeta,
} from "./types.js";

const CLAUDE_DIR = join(homedir(), ".claude");
const HISTORY_FILE = join(CLAUDE_DIR, "history.jsonl");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const DESKTOP_SESSIONS_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "Claude",
  "local-agent-mode-sessions"
);

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8").trim();
  if (!raw) return [];
  const items: T[] = [];
  for (const line of raw.split("\n")) {
    try {
      items.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed lines
    }
  }
  return items;
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localToday(): string {
  return toLocalDateStr(new Date());
}

function isSameDay(timestamp: string | number, targetDate: string): boolean {
  const date = new Date(timestamp);
  return toLocalDateStr(date) === targetDate;
}

function extractProjectName(projectPath: string): string {
  return basename(projectPath);
}

// =============================================
// Claude Code collection
// =============================================

function collectCodePrompts(today: string): UserPrompt[] {
  const entries = readJsonl<HistoryEntry>(HISTORY_FILE);
  const prompts: UserPrompt[] = [];

  for (const entry of entries) {
    if (isSameDay(entry.timestamp, today)) {
      prompts.push({
        text: entry.display,
        timestamp: new Date(entry.timestamp).toISOString(),
        sessionId: entry.sessionId,
        project: extractProjectName(entry.project),
      });
    }
  }

  return prompts;
}

function findCodeSessionFiles(_today: string, sessionIds: Set<string>): string[] {
  const files: string[] = [];
  if (!existsSync(PROJECTS_DIR)) return files;

  for (const projectDir of readdirSync(PROJECTS_DIR)) {
    const projectPath = join(PROJECTS_DIR, projectDir);
    let entries: string[];
    try {
      entries = readdirSync(projectPath);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      const sessionId = entry.replace(".jsonl", "");
      if (sessionIds.has(sessionId)) {
        files.push(join(projectPath, entry));
      }
    }
  }

  return files;
}

function parseCodeSessionFile(filePath: string, today: string): SessionSummary | null {
  const messages = readJsonl<ConversationMessage>(filePath);
  if (messages.length === 0) return null;

  let userCount = 0;
  let assistantCount = 0;
  let toolCallCount = 0;
  const toolNames: Set<string> = new Set();
  let inputTokens = 0;
  let outputTokens = 0;
  let startTime = "";
  let endTime = "";
  let sessionId = "";
  let project = "";
  let gitBranch: string | undefined;

  for (const msg of messages) {
    if (msg.type === "file-history-snapshot") continue;
    if (!msg.timestamp || !isSameDay(msg.timestamp, today)) continue;

    if (!startTime || msg.timestamp < startTime) startTime = msg.timestamp;
    if (!endTime || msg.timestamp > endTime) endTime = msg.timestamp;

    if (msg.sessionId) sessionId = msg.sessionId;
    if (msg.gitBranch) gitBranch = msg.gitBranch;
    if (msg.cwd) project = extractProjectName(msg.cwd);

    if (msg.type === "user") {
      userCount++;
    } else if (msg.type === "assistant") {
      assistantCount++;
      if (msg.message?.usage) {
        inputTokens += msg.message.usage.input_tokens || 0;
        outputTokens += msg.message.usage.output_tokens || 0;
      }
      if (Array.isArray(msg.message?.content)) {
        for (const block of msg.message!.content as ContentBlock[]) {
          if (block.type === "tool_use" && block.name) {
            toolCallCount++;
            toolNames.add(block.name);
          }
        }
      }
    }
  }

  if (userCount === 0 && assistantCount === 0) return null;

  return {
    sessionId,
    project,
    source: "claude-code",
    messageCount: userCount + assistantCount,
    userMessageCount: userCount,
    assistantMessageCount: assistantCount,
    toolCallCount,
    toolNames: [...toolNames],
    inputTokens,
    outputTokens,
    startTime,
    endTime,
    gitBranch,
  };
}

function collectCodeSessions(today: string): { prompts: UserPrompt[]; sessions: SessionSummary[] } {
  const prompts = collectCodePrompts(today);
  const sessionIds = new Set(prompts.map((p) => p.sessionId));
  const sessionFiles = findCodeSessionFiles(today, sessionIds);
  const sessions: SessionSummary[] = [];

  for (const file of sessionFiles) {
    const summary = parseCodeSessionFile(file, today);
    if (summary) sessions.push(summary);
  }

  return { prompts, sessions };
}

// =============================================
// Claude Desktop App collection
// =============================================

function findDesktopAuditFiles(): { auditPath: string; metaPath: string }[] {
  const results: { auditPath: string; metaPath: string }[] = [];
  if (!existsSync(DESKTOP_SESSIONS_DIR)) return results;

  try {
    // Traverse: workspace-id / user-id / local_session-id/audit.jsonl
    for (const workspace of readdirSync(DESKTOP_SESSIONS_DIR)) {
      const wsPath = join(DESKTOP_SESSIONS_DIR, workspace);
      if (!statSync(wsPath).isDirectory()) continue;

      for (const userId of readdirSync(wsPath)) {
        const userPath = join(wsPath, userId);
        if (!statSync(userPath).isDirectory()) continue;

        for (const entry of readdirSync(userPath)) {
          // Session directories are named like local_<uuid>
          const sessionDir = join(userPath, entry);
          if (!entry.startsWith("local_") || !statSync(sessionDir).isDirectory()) continue;

          const auditPath = join(sessionDir, "audit.jsonl");
          const metaPath = join(userPath, entry + ".json");
          if (existsSync(auditPath)) {
            results.push({ auditPath, metaPath });
          }
        }
      }
    }
  } catch {
    // Gracefully handle permission errors etc.
  }

  return results;
}

function parseDesktopSession(
  auditPath: string,
  metaPath: string,
  today: string
): { prompts: UserPrompt[]; session: SessionSummary | null } {
  const entries = readJsonl<AuditEntry>(auditPath);
  const prompts: UserPrompt[] = [];

  // Read session metadata for title
  let title = "Claude App";
  let sessionId = "";
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as DesktopSessionMeta;
      title = meta.title || "Claude App";
      sessionId = meta.sessionId || "";
    } catch {
      // Ignore parse errors
    }
  }

  let userCount = 0;
  let assistantCount = 0;
  let toolCallCount = 0;
  const toolNames: Set<string> = new Set();
  let startTime = "";
  let endTime = "";
  let hasTodayMessages = false;

  for (const entry of entries) {
    if (!entry._audit_timestamp || !isSameDay(entry._audit_timestamp, today)) continue;
    hasTodayMessages = true;

    if (!startTime || entry._audit_timestamp < startTime) startTime = entry._audit_timestamp;
    if (!endTime || entry._audit_timestamp > endTime) endTime = entry._audit_timestamp;

    if (!sessionId && entry.session_id) sessionId = entry.session_id;

    if (entry.type === "user") {
      userCount++;
      const text =
        typeof entry.message?.content === "string"
          ? entry.message.content
          : Array.isArray(entry.message?.content)
            ? entry.message.content
                .filter((b: ContentBlock) => b.type === "text" && b.text)
                .map((b: ContentBlock) => b.text!)
                .join(" ")
            : "";

      if (text) {
        prompts.push({
          text,
          timestamp: entry._audit_timestamp,
          sessionId: sessionId || entry.session_id,
          project: `[App] ${title}`,
        });
      }
    } else if (entry.type === "assistant") {
      assistantCount++;
      // Count tool_use blocks in assistant messages
      if (Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content as ContentBlock[]) {
          if (block.type === "tool_use" && block.name) {
            toolCallCount++;
            toolNames.add(block.name);
          }
        }
      }
    }
  }

  if (!hasTodayMessages) {
    return { prompts: [], session: null };
  }

  const session: SessionSummary = {
    sessionId,
    project: `[App] ${title}`,
    source: "claude-app",
    messageCount: userCount + assistantCount,
    userMessageCount: userCount,
    assistantMessageCount: assistantCount,
    toolCallCount,
    toolNames: [...toolNames],
    inputTokens: 0, // Not available in audit logs
    outputTokens: 0,
    startTime,
    endTime,
  };

  return { prompts, session };
}

function collectDesktopSessions(today: string): { prompts: UserPrompt[]; sessions: SessionSummary[] } {
  const auditFiles = findDesktopAuditFiles();
  const prompts: UserPrompt[] = [];
  const sessions: SessionSummary[] = [];

  for (const { auditPath, metaPath } of auditFiles) {
    const result = parseDesktopSession(auditPath, metaPath, today);
    prompts.push(...result.prompts);
    if (result.session && result.session.messageCount > 0) {
      sessions.push(result.session);
    }
  }

  return { prompts, sessions };
}

// =============================================
// Combined collector
// =============================================

export function collectToday(dateOverride?: string): CollectedData {
  const today = dateOverride ?? localToday();

  // Collect from both sources
  const code = collectCodeSessions(today);
  const desktop = collectDesktopSessions(today);

  const prompts = [...code.prompts, ...desktop.prompts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const sessions = [...code.sessions, ...desktop.sessions];

  const totalTokens = sessions.reduce((s, sess) => s + sess.inputTokens + sess.outputTokens, 0);
  const totalMessages = sessions.reduce((s, sess) => s + sess.messageCount, 0);
  const totalToolCalls = sessions.reduce((s, sess) => s + sess.toolCallCount, 0);
  const projectsWorkedOn = [...new Set(prompts.map((p) => p.project))];

  return {
    date: today,
    prompts,
    sessions,
    totalTokens,
    totalMessages,
    totalToolCalls,
    projectsWorkedOn,
  };
}
