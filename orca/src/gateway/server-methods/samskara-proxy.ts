/**
 * samskara-proxy — Server-side gateway proxy for Samskara brain API.
 *
 * All calls are forwarded from the browser via the gateway so that
 * SAMSKARA_API_KEY and SAMSKARA_AGENT_ID never reach the client.
 *
 * Allowed endpoints (read-only):
 *   identity   — GET  /api/sdk/identity
 *   consult    — POST /api/sdk/consult
 *   memory     — POST /api/sdk/memory/search
 *   safety     — POST /api/sdk/safety/check
 */

import type { GatewayRequestHandlers } from "./types.js";

const ALLOWED_ENDPOINTS = new Set(["identity", "consult", "memory", "safety"]);

function resolveSamskaraBaseUrl(): string {
  return (process.env.SAMSKARA_BASE_URL ?? "https://samskara-mind.replit.app").replace(/\/$/, "");
}

function resolveSamskaraApiKey(): string {
  return process.env.SAMSKARA_API_KEY ?? "";
}

function resolveSamskaraAgentId(): string {
  return process.env.SAMSKARA_AGENT_ID ?? "orca-v1";
}

function endpointToPath(endpoint: string): { method: string; path: string } {
  switch (endpoint) {
    case "identity":
      return { method: "GET", path: "/api/sdk/identity" };
    case "consult":
      return { method: "POST", path: "/api/sdk/consult" };
    case "memory":
      return { method: "POST", path: "/api/sdk/memory/search" };
    case "safety":
      return { method: "POST", path: "/api/sdk/safety/check" };
    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

export const samskaraProxyHandlers: GatewayRequestHandlers = {
  "samskara.proxy": async ({ params, respond }) => {
    const endpoint = typeof params?.endpoint === "string" ? params.endpoint : "";
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      respond(false, undefined, {
        code: -32602,
        message: `Unknown Samskara endpoint: ${endpoint}. Allowed: ${[...ALLOWED_ENDPOINTS].join(", ")}`,
      });
      return;
    }

    const apiKey = resolveSamskaraApiKey();
    if (!apiKey) {
      respond(false, undefined, {
        code: -32603,
        message: "Samskara is not configured. Set SAMSKARA_API_KEY to enable brain features.",
      });
      return;
    }

    const baseUrl = resolveSamskaraBaseUrl();
    const agentId = resolveSamskaraAgentId();
    const { method, path } = endpointToPath(endpoint);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-Agent-Id": agentId,
    };

    try {
      const body =
        method === "GET"
          ? undefined
          : JSON.stringify(
              typeof params?.body === "object" && params.body !== null ? params.body : {},
            );

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        respond(false, undefined, {
          code: -32603,
          message: `Samskara ${endpoint} returned HTTP ${res.status}: ${text.slice(0, 200)}`,
        });
        return;
      }

      const data: unknown = await res.json();
      respond(true, data, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, {
        code: -32603,
        message: `Samskara proxy error: ${message}`,
      });
    }
  },
};
