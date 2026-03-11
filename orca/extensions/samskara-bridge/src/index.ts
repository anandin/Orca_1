/**
 * Samskara Bridge — OpenClaw Extension
 *
 * Wires the Samskara brain (https://samskara-mind.replit.app) into every
 * stage of the Orca agent loop:
 *
 *   1. checkReflex   — fast-path before LLM (Manas)
 *   2. memorySearch  — load relevant memories (Chitta)
 *   3. safetyCheck   — gate before tool execution (Viveka)
 *   4. consult       — structured reasoning (Buddhi)
 *   5. reportOutcome — karma feedback after response
 *   6. ingest        — store new knowledge
 */

import { SamskaraClient, INDRIYA, INDRIYA_TYPE } from "./client.js";

export type SamskaraBridgeConfig = {
  apiKey: string;
  agentId?: string;
  baseUrl?: string;
  /** Minimum confidence below which consult result is treated as advisory only */
  confidenceThreshold?: number;
  /** If true, block tool execution when safety check returns allowed:false */
  enforceSafety?: boolean;
  /** If true, prepend Buddhi analysis to every LLM system prompt */
  injectConsultContext?: boolean;
};

const DEFAULT_AGENT_ID = "orca-v1";
const DEFAULT_CONFIDENCE_THRESHOLD = 0.3;

let client: SamskaraClient | null = null;
let config: SamskaraBridgeConfig | null = null;

function getClient(): SamskaraClient {
  if (!client || !config) {
    throw new Error("Samskara bridge not initialized");
  }
  return client;
}

/**
 * Map a channel message type to the appropriate Indriya (sense organ).
 */
function channelToIndriya(channelId: string): string {
  if (channelId.includes("voice") || channelId.includes("audio")) return INDRIYA.AUDIO;
  if (channelId.includes("image") || channelId.includes("vision")) return INDRIYA.VISUAL;
  return INDRIYA.TEXT;
}

/**
 * Run the full Samskara pre-processing pipeline before the agent responds.
 * Returns enriched context to inject into the agent's system prompt.
 */
export async function preProcess(opts: {
  message: string;
  channelId: string;
  sessionId: string;
}): Promise<{
  reflexHit: boolean;
  reflexResponse?: string;
  memories: string[];
  consultId?: string;
  buddhi?: string;
  confidence?: number;
  signalMode?: string;
}> {
  const samskara = getClient();
  const indriyaId = channelToIndriya(opts.channelId);

  // 1. Reflex check — fast-path (Manas)
  try {
    const reflex = await samskara.checkReflex(opts.message, `channel:${opts.channelId}`);
    if (reflex.matched && reflex.reflex) {
      return { reflexHit: true, reflexResponse: reflex.reflex, memories: [] };
    }
  } catch {
    // Non-fatal — proceed without reflex
  }

  // 2. Memory search — load relevant context (Chitta)
  let memories: string[] = [];
  try {
    const mem = await samskara.memorySearch(opts.message, 8);
    memories = mem.results.map((r) => r.content);
  } catch {
    // Non-fatal
  }

  // 3. Consult — Buddhi reasoning
  let consultId: string | undefined;
  let buddhi: string | undefined;
  let confidence: number | undefined;
  let signalMode: string | undefined;

  if (config?.injectConsultContext !== false) {
    try {
      const result = await samskara.consult(opts.message, indriyaId, INDRIYA_TYPE.INPUT);
      consultId = result.consultId;
      buddhi = result.answer;
      confidence = result.confidence;
      signalMode = result.signalMode;
    } catch {
      // Non-fatal — agent proceeds without Buddhi context
    }
  }

  return { reflexHit: false, memories, consultId, buddhi, confidence, signalMode };
}

/**
 * Safety gate — call before every tool execution.
 * Returns true if the action is permitted.
 */
export async function checkToolSafety(
  toolName: string,
  toolArgs: Record<string, unknown>,
  context: string,
): Promise<{ allowed: boolean; reason: string }> {
  if (!config?.enforceSafety) return { allowed: true, reason: "safety enforcement disabled" };

  const samskara = getClient();
  try {
    const result = await samskara.safetyCheck(
      toolName,
      JSON.stringify(toolArgs),
      context,
    );
    return { allowed: result.allowed, reason: result.reason };
  } catch {
    // Fail open — if Samskara is unreachable, don't block the agent
    return { allowed: true, reason: "samskara unreachable, failing open" };
  }
}

/**
 * Post-processing — report outcome and optionally ingest new knowledge.
 */
export async function postProcess(opts: {
  consultId?: string;
  responseText: string;
  wasHelpful: boolean;
  channelId: string;
  newKnowledge?: string;
}): Promise<void> {
  const samskara = getClient();

  // Report outcome (karma feedback)
  if (opts.consultId) {
    try {
      await samskara.reportOutcome(
        opts.consultId,
        opts.wasHelpful ? "positive" : "neutral",
        opts.wasHelpful,
        `Channel: ${opts.channelId}`,
      );
    } catch {
      // Non-fatal
    }
  }

  // Ingest new knowledge if provided
  if (opts.newKnowledge) {
    try {
      await samskara.ingest(
        opts.newKnowledge,
        "observation",
        ["agent-response", opts.channelId],
        0.5,
        channelToIndriya(opts.channelId),
      );
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Build the Samskara context string to inject into the LLM system prompt.
 * This is what makes Orca smarter than vanilla OpenClaw.
 */
export function buildSamskaraSystemContext(opts: {
  buddhi?: string;
  memories?: string[];
  confidence?: number;
  signalMode?: string;
}): string {
  const parts: string[] = ["## Samskara Brain Context\n"];

  if (opts.signalMode) {
    parts.push(`Signal Mode: ${opts.signalMode} (confidence: ${((opts.confidence ?? 0) * 100).toFixed(0)}%)\n`);
  }

  if (opts.memories && opts.memories.length > 0) {
    parts.push("### Relevant Memories (Chitta)");
    opts.memories.forEach((m, i) => parts.push(`${i + 1}. ${m}`));
    parts.push("");
  }

  if (opts.buddhi) {
    parts.push("### Buddhi Analysis (Samskara Brain)");
    parts.push(opts.buddhi);
    parts.push("");
  }

  parts.push("Use the above context to inform your response. The Buddhi analysis is advisory — apply your own judgment.");

  return parts.join("\n");
}

// ─── Plugin Lifecycle ──────────────────────────────────────────────────────

/**
 * Called by OpenClaw plugin loader at gateway startup.
 */
export function onLoad(pluginConfig: SamskaraBridgeConfig): void {
  config = {
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    enforceSafety: true,
    injectConsultContext: true,
    agentId: DEFAULT_AGENT_ID,
    ...pluginConfig,
  };

  client = new SamskaraClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    agentId: config.agentId ?? DEFAULT_AGENT_ID,
  });

  // Ingest startup event
  client
    .ingest(
      `Orca agent started. Agent ID: ${config.agentId}. Safety enforcement: ${config.enforceSafety}`,
      "system",
      ["startup", "orca"],
      0.7,
      INDRIYA.SYSTEM,
    )
    .catch(() => {});

  console.log("[samskara-bridge] Connected to Samskara brain at", config.baseUrl ?? "https://samskara-mind.replit.app");
}

export { SamskaraClient, INDRIYA, INDRIYA_TYPE };
