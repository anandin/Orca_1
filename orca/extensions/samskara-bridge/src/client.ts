/**
 * Samskara REST SDK Client
 * Wraps all calls to https://samskara-mind.replit.app/api/sdk
 */

export type ConsultResult = {
  consultId: string;
  answer: string;
  confidence: number;
  signalMode: "pratyaksha" | "avyakta" | "savikalpa";
  evidence: unknown[];
};

export type SafetyResult = {
  allowed: boolean;
  reason: string;
  warnings: string[];
  safetyState: {
    globalLearningEnabled: boolean;
    karmaUpdatesEnabled: boolean;
    reflexFormationEnabled: boolean;
    frozenDomains: string[];
    quarantineRulesActive: number;
  };
  dharmaConstraints: string;
};

export type ReflexResult = {
  matched: boolean;
  reflex: string | null;
};

export type MemoryResult = {
  query: string;
  resultsFound: number;
  results: Array<{ content: string; score: number; tags: string[] }>;
};

export type IngestResult = {
  ingested: boolean;
  seedsCreated: number;
  edgesFormed: number;
};

// Indriya (sense organ) IDs — map channel types to the correct Vedic sense
export const INDRIYA = {
  TEXT: "sparsha",     // Touch/direct contact — text messages
  AUDIO: "shrotra",   // Hearing — voice/audio
  VISUAL: "chakshu",  // Sight — images/video
  MEMORY: "rasana",   // Taste/evaluation — memory & search
  SYSTEM: "sparsha",  // System events
} as const;

export const INDRIYA_TYPE = {
  INPUT: "jnanendriya",    // Knowledge organ — user input
  OUTPUT: "karmendriya",   // Action organ — agent actions
} as const;

export class SamskaraClient {
  private baseUrl: string;
  private apiKey: string;
  private agentId: string;

  constructor(config: {
    baseUrl?: string;
    apiKey: string;
    agentId: string;
  }) {
    this.baseUrl = (config.baseUrl ?? "https://samskara-mind.replit.app").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
      "X-Agent-Id": this.agentId,
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const json = await res.json() as T;
    return json;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    });
    return res.json() as Promise<T>;
  }

  /**
   * Consult — Buddhi (Intellect)
   * The primary reasoning call. Use before every non-trivial response.
   */
  async consult(
    query: string,
    indriyaId: string = INDRIYA.TEXT,
    indriyaType: string = INDRIYA_TYPE.INPUT,
  ): Promise<ConsultResult> {
    return this.post<ConsultResult>("/api/sdk/consult", {
      query,
      indriyaId,
      indriyaType,
    });
  }

  /**
   * Safety Check — Viveka (Discrimination)
   * Gate before any tool execution. Returns allowed/blocked.
   */
  async safetyCheck(
    trigger: string,
    action: string,
    context: string,
  ): Promise<SafetyResult> {
    return this.post<SafetyResult>("/api/sdk/safety/check", {
      trigger,
      action,
      context,
    });
  }

  /**
   * Reflex Check — Manas (Reactive Mind)
   * Fast-path: if pattern matches, skip LLM entirely.
   */
  async checkReflex(trigger: string, context: string): Promise<ReflexResult> {
    return this.post<ReflexResult>("/api/sdk/reflex/check", {
      trigger,
      context,
    });
  }

  /**
   * Memory Search — Chitta (Deep Memory)
   * Retrieve relevant long-term memories.
   */
  async memorySearch(query: string, limit = 10): Promise<MemoryResult> {
    return this.post<MemoryResult>("/api/sdk/memory/search", { query, limit });
  }

  /**
   * Report Outcome — Karma Feedback
   * Called after every response. Honest accounting.
   * outcome: "positive" | "negative" | "neutral"
   */
  async reportOutcome(
    consultId: string,
    outcome: "positive" | "negative" | "neutral",
    helpful: boolean,
    notes?: string,
  ): Promise<unknown> {
    return this.post("/api/sdk/outcome", {
      consultId,
      outcome,
      helpful,
      notes,
    });
  }

  /**
   * Ingest — Samskara Formation (Learning)
   * Feed new knowledge into Chitta.
   */
  async ingest(
    content: string,
    source: "user" | "system" | "observation" | "inference",
    tags: string[],
    importance: number,
    indriyaId: string = INDRIYA.TEXT,
  ): Promise<IngestResult> {
    return this.post<IngestResult>("/api/sdk/ingest", {
      content,
      source,
      tags,
      importance,
      indriyaId,
    });
  }

  /**
   * Get Identity — Ahamkara (Self)
   */
  async getIdentity(): Promise<{ configured: boolean; message: string; identity?: unknown }> {
    return this.get("/api/sdk/identity");
  }

  /**
   * Get Context — Manas Context Window
   */
  async getContext(channelId: string, depth = 10): Promise<unknown> {
    return this.post("/api/sdk/context", { channelId, depth });
  }
}
