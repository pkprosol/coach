import { spawn } from "node:child_process";
import type { CollectedData, CostEstimate, Dimension, Insight, StoredInsight } from "./types.js";
import { DIMENSIONS } from "./types.js";

// Claude Sonnet pricing (most common for Claude Code)
const INPUT_COST_PER_MTOK = 3;   // $3 per million input tokens
const OUTPUT_COST_PER_MTOK = 15;  // $15 per million output tokens

export function estimateCosts(data: CollectedData): CostEstimate[] {
  return data.sessions.map((s) => {
    const inputCost = (s.inputTokens / 1_000_000) * INPUT_COST_PER_MTOK;
    const outputCost = (s.outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;
    return {
      sessionId: s.sessionId.slice(0, 8),
      project: s.project,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
    };
  });
}

export function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let rejected = false;

    function fail(err: Error) {
      if (!rejected) {
        rejected = true;
        reject(err);
      }
    }

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
      // EPIPE means claude exited before we finished writing — handled in 'close'
      if (err.code !== "EPIPE") {
        fail(err);
      }
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        fail(new Error("claude CLI not found. Install Claude Code first: https://docs.anthropic.com/en/docs/claude-code"));
      } else {
        fail(err);
      }
    });

    proc.on("close", (code) => {
      if (rejected) return;
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        fail(new Error(stderr.trim() || `claude exited with code ${code}`));
      }
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function pickDimension(recentDimensions: Dimension[], data: CollectedData): Dimension {
  // Filter out recently used dimensions
  const available = DIMENSIONS.filter((d) => !recentDimensions.includes(d));
  const pool = available.length > 0 ? available : [...DIMENSIONS];

  // Heuristic: pick the most relevant dimension for today's data
  // Weight based on data signals
  const scores = new Map<Dimension, number>();
  for (const d of pool) {
    scores.set(d, Math.random()); // Base randomness
  }

  const avgPromptsPerSession =
    data.sessions.length > 0
      ? data.prompts.length / data.sessions.length
      : data.prompts.length;

  // Boost relevant dimensions based on data patterns
  if (avgPromptsPerSession > 8) {
    scores.set("Prompting Craft", (scores.get("Prompting Craft") ?? 0) + 2);
    scores.set("Workflow Efficiency", (scores.get("Workflow Efficiency") ?? 0) + 1);
  }
  if (data.projectsWorkedOn.length > 2) {
    scores.set("Focus & Deep Work", (scores.get("Focus & Deep Work") ?? 0) + 2);
  }
  if (data.totalToolCalls > 20) {
    scores.set("Tool Leverage", (scores.get("Tool Leverage") ?? 0) + 1.5);
  }
  if (data.sessions.length === 1 && data.prompts.length > 5) {
    scores.set("Problem Decomposition", (scores.get("Problem Decomposition") ?? 0) + 1.5);
  }
  if (data.totalTokens > 100000) {
    scores.set("Cost Awareness", (scores.get("Cost Awareness") ?? 0) + 1.5);
  }

  // Pick highest scoring available dimension
  let best: Dimension = pool[0];
  let bestScore = -1;
  for (const [dim, score] of scores) {
    if (pool.includes(dim) && score > bestScore) {
      best = dim;
      bestScore = score;
    }
  }

  return best;
}

function buildPrompt(
  data: CollectedData,
  dimension: Dimension,
  pastInsights: StoredInsight[]
): string {
  // Truncate prompts to avoid overwhelming context
  const samplePrompts = data.prompts.slice(0, 40).map((p) => ({
    text: p.text.slice(0, 500),
    project: p.project,
    sessionId: p.sessionId.slice(0, 8),
  }));

  const costs = estimateCosts(data);
  const sessionSummaries = data.sessions.map((s, i) => ({
    project: s.project,
    messages: s.messageCount,
    userMessages: s.userMessageCount,
    toolCalls: s.toolCallCount,
    tools: s.toolNames,
    tokens: s.inputTokens + s.outputTokens,
    estimatedCost: `$${costs[i]?.totalCost.toFixed(4) ?? "0.0000"}`,
    duration:
      s.startTime && s.endTime
        ? `${Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)}min`
        : "unknown",
    branch: s.gitBranch,
  }));

  // Include recent past insights for context
  const recentRated = pastInsights
    .filter((i) => i.rating !== null)
    .slice(-5)
    .map((i) => ({
      dimension: i.dimension,
      rating: i.rating,
      date: i.date,
    }));

  return `You are Coach, a personal AI work coach that analyzes a developer's Claude Code usage patterns to deliver one actionable lesson and one practical tip.

## Today's Analysis Dimension: ${dimension}

Dimension descriptions:
- Prompting Craft: clarity, specificity, effectiveness of the user's prompts
- Workflow Efficiency: circular patterns, redundant requests, wasted effort
- Architecture Thinking: over/under-engineering signals in what the user asks for
- Learning Patterns: building knowledge vs re-learning the same things
- Focus & Deep Work: context switching vs sustained depth
- Communication Style: how problems are described to Claude
- Tool Leverage: effective use of Claude's capabilities (tools, features)
- Problem Decomposition: breaking down vs monolithic asks
- Cost Awareness: token efficiency, cost-effective prompting, understanding what makes prompts expensive or cheap

## Today's Session Data

Date: ${data.date}
Projects worked on: ${data.projectsWorkedOn.join(", ")}
Total sessions: ${data.sessions.length}
Total messages: ${data.totalMessages}
Total tool calls: ${data.totalToolCalls}
Total tokens: ${data.totalTokens.toLocaleString()}
Estimated total cost: $${costs.reduce((s, c) => s + c.totalCost, 0).toFixed(4)} (Sonnet pricing)

### User Prompts (chronological)
${JSON.stringify(samplePrompts, null, 2)}

### Session Summaries
${JSON.stringify(sessionSummaries, null, 2)}

${recentRated.length > 0 ? `### Past Insight Ratings (for context on what the user finds helpful)
${JSON.stringify(recentRated, null, 2)}` : ""}

## Your Task

Analyze the data through the lens of "${dimension}" and return a JSON object with exactly these fields:

{
  "dimension": "${dimension}",
  "lesson": "A specific, data-backed observation about today's work (2-3 sentences). Reference actual prompts or patterns you see.",
  "tip": "One concrete, actionable technique they can try tomorrow (2-3 sentences). Be specific with a method or framework.",
  "specificExample": { "before": "An actual prompt from today (or close paraphrase)", "after": "A rewritten version applying your tip" } or null if not applicable,
  "encouragement": "One sentence noting something they did well today. Be genuine — find something real."
}

Guidelines:
- Be specific. Reference actual data from the session — prompt text, project names, patterns.
- The lesson should feel like a personal discovery, not generic advice.
- The tip should be immediately actionable tomorrow.
- If the specificExample doesn't make sense for this dimension, set it to null.
- Keep the encouragement genuine and grounded in their actual work.
- Total response should feel insightful but concise.

Respond with ONLY the JSON object, no markdown fences or other text.`;
}

export function buildHandoffPrompt(data: CollectedData): string {
  const sessionSummaries = data.sessions.map((s) => ({
    project: s.project,
    branch: s.gitBranch,
    messages: s.messageCount,
    toolCalls: s.toolCallCount,
    tools: s.toolNames,
    duration:
      s.startTime && s.endTime
        ? `${Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000)}min`
        : "unknown",
  }));

  const samplePrompts = data.prompts.slice(0, 30).map((p) => ({
    text: p.text.slice(0, 400),
    project: p.project,
  }));

  return `You are a work session analyzer. Given the developer's Claude Code sessions from today, produce a structured handoff note for when they pause or stop working.

## Today's Session Data

Date: ${data.date}
Projects: ${data.projectsWorkedOn.join(", ")}

### Sessions
${JSON.stringify(sessionSummaries, null, 2)}

### User Prompts
${JSON.stringify(samplePrompts, null, 2)}

## Your Task

Produce a handoff note as a JSON object with these fields:

{
  "workingOn": "Brief description of what was being worked on (projects, branches, features)",
  "currentState": "What's done, what's in progress",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "nextSteps": ["Next step 1", "Next step 2"],
  "openQuestions": ["Question 1"] or []
}

Be specific — reference actual projects, branches, and prompt content.
Respond with ONLY the JSON object, no markdown fences or other text.`;
}

export function buildFocusPrompt(data: CollectedData): string {
  const sessionTimeline = data.sessions.map((s) => ({
    project: s.project,
    start: s.startTime,
    end: s.endTime,
    prompts: s.userMessageCount,
  }));

  const projectSwitches: string[] = [];
  for (let i = 1; i < data.prompts.length; i++) {
    if (data.prompts[i].project !== data.prompts[i - 1].project) {
      projectSwitches.push(
        `${data.prompts[i - 1].project} → ${data.prompts[i].project} at ${data.prompts[i].timestamp}`
      );
    }
  }

  return `You are a focus and productivity analyst. Analyze this developer's context-switching patterns and suggest optimal focus blocks.

## Today's Data

Date: ${data.date}
Total sessions: ${data.sessions.length}
Projects: ${data.projectsWorkedOn.join(", ")}

### Session Timeline
${JSON.stringify(sessionTimeline, null, 2)}

### Context Switches
${projectSwitches.length > 0 ? projectSwitches.join("\n") : "No context switches detected"}

## Your Task

Analyze the patterns and return a JSON object:

{
  "contextSwitches": ${projectSwitches.length},
  "longestFocusPeriod": "Description of longest uninterrupted focus period",
  "shortestFocusPeriod": "Description of shortest period before switching",
  "pattern": "Overall observation about their focus pattern today (2-3 sentences)",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}

Be specific and reference actual project names and times.
Respond with ONLY the JSON object, no markdown fences or other text.`;
}

export function buildCostsPrompt(data: CollectedData, costs: CostEstimate[]): string {
  const totalCost = costs.reduce((s, c) => s + c.totalCost, 0);
  const totalInput = costs.reduce((s, c) => s + c.inputTokens, 0);
  const totalOutput = costs.reduce((s, c) => s + c.outputTokens, 0);
  const totalInputCost = costs.reduce((s, c) => s + c.inputCost, 0);
  const totalOutputCost = costs.reduce((s, c) => s + c.outputCost, 0);

  const samplePrompts = data.prompts.slice(0, 30).map((p) => ({
    text: p.text.slice(0, 400),
    project: p.project,
    charLength: p.text.length,
  }));

  const sessionCosts = costs.map((c) => ({
    project: c.project,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    estimatedCost: `$${c.totalCost.toFixed(4)}`,
  }));

  return `You are a cost and prompt engineering analyst for Claude Code usage. Analyze this developer's token usage and costs to provide actionable insights about efficiency, prompt engineering, and how LLMs process their requests.

## Today's Cost Data

Date: ${data.date}
Total estimated cost: $${totalCost.toFixed(4)} (using Sonnet pricing: $${INPUT_COST_PER_MTOK}/MTok input, $${OUTPUT_COST_PER_MTOK}/MTok output)
Total input tokens: ${totalInput.toLocaleString()} ($${totalInputCost.toFixed(4)})
Total output tokens: ${totalOutput.toLocaleString()} ($${totalOutputCost.toFixed(4)})
Total sessions: ${data.sessions.length}
Total prompts: ${data.prompts.length}
Total tool calls: ${data.totalToolCalls}

### Per-Session Costs
${JSON.stringify(sessionCosts, null, 2)}

### User Prompts (with character lengths)
${JSON.stringify(samplePrompts, null, 2)}

## Your Task

Analyze the cost patterns and return a JSON object with exactly these fields:

{
  "estimatedCost": "Total estimated cost as a readable string (e.g. '$0.42')",
  "mostExpensiveSession": "Describe which session cost the most and why (project name, what drove the cost — long prompts, many tool calls, etc). 2-3 sentences.",
  "costBreakdown": "Explain the input vs output token split and what it means. Are they paying more for long prompts (input) or for Claude's responses (output)? What does the ratio tell us? 2-3 sentences.",
  "surprisingFact": "One interesting or surprising observation about their usage — could be about token economics, how LLMs tokenize text, why certain prompts cost more, context window mechanics, or prompt caching. Make it genuinely educational. 2-3 sentences.",
  "efficiencyTips": ["Tip 1", "Tip 2", "Tip 3"],
  "promptEngineeringInsight": "A genuinely interesting insight about prompt engineering, how LLMs work, or token economics that relates to their specific usage patterns. Teach them something they probably don't know. 2-3 sentences."
}

Guidelines:
- Be specific — reference actual projects, prompt lengths, and cost numbers from the data.
- For efficiencyTips, give concrete, actionable advice (not generic "write shorter prompts").
- For surprisingFact and promptEngineeringInsight, teach something genuinely interesting about LLMs, tokenization, attention mechanisms, or prompt engineering that connects to their data.
- Keep costs in perspective — compare to a cup of coffee, a SaaS subscription, etc.
- If tool calls are a significant portion of the work, explain how tool use affects costs (each tool result is input tokens on the next turn).

Respond with ONLY the JSON object, no markdown fences or other text.`;
}

export async function analyze(
  data: CollectedData,
  recentDimensions: Dimension[],
  pastInsights: StoredInsight[]
): Promise<Insight> {
  const dimension = pickDimension(recentDimensions, data);
  const prompt = buildPrompt(data, dimension, pastInsights);

  const text = await runClaude(prompt);

  // Parse JSON from response — handle possible markdown fences
  const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
  const result = JSON.parse(cleaned) as Insight;

  return result;
}
