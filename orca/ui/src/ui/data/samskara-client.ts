/**
 * SamskaraUIClient — browser-side client for the Samskara brain.
 *
 * All requests are forwarded via the gateway RPC "samskara.proxy"
 * so the API key stays server-side.
 */

import type { GatewayBrowserClient } from "../gateway.ts";

export type HealthIdentityResult = {
  configured: boolean;
  agentId?: string;
  karmaScore?: number;
  message?: string;
};

export type ConsultResult = {
  response?: string;
  confidence?: number;
  consultId?: string;
  mode?: "pratyaksha" | "savikalpa" | "avyakta";
  durationMs?: number;
};

export type MemoryNode = {
  id: string;
  content: string;
  score: number;
  tags?: string[];
  createdAt?: string;
};

export type MemoryResult = {
  results?: MemoryNode[];
  total?: number;
};

export type SafetyResult = {
  allowed: boolean;
  reason?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
};

export class SamskaraUIClient {
  constructor(private readonly client: GatewayBrowserClient) {}

  private async proxy<T>(
    endpoint: "identity" | "consult" | "memory" | "safety",
    body?: unknown,
  ): Promise<T> {
    const result = await this.client.request("samskara.proxy", {
      endpoint,
      body: body ?? {},
    });
    return result as T;
  }

  async getIdentity(): Promise<HealthIdentityResult> {
    return this.proxy<HealthIdentityResult>("identity");
  }

  async consult(query: string): Promise<ConsultResult> {
    return this.proxy<ConsultResult>("consult", {
      query,
      indriyaId: "sparsha",
      indriyaType: "input",
    });
  }

  async memorySearch(query = "", limit = 20): Promise<MemoryResult> {
    return this.proxy<MemoryResult>("memory", { query, limit });
  }

  async safetyCheck(trigger: string, action?: string): Promise<SafetyResult> {
    return this.proxy<SafetyResult>("safety", {
      trigger,
      action: action ?? trigger,
      context: {},
    });
  }
}
