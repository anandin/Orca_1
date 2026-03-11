/**
 * Samskara Brain panel — 3-column layout:
 *   Left (240px)   — Assistant status + connections + memory stats
 *   Center (flex)  — Signal stream (Datadog APM waterfall)
 *   Right (300px)  — Health score + memory graph
 */
import { html } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import { SamskaraUIClient } from "../data/samskara-client.ts";
import "../components/health-score.ts";
import "../components/signal-stream.ts";
import "../components/memory-graph.ts";

// Lazy-init client per-render, caching on the state object
const CLIENT_CACHE = new WeakMap<object, SamskaraUIClient>();

function getSamskaraClient(state: AppViewState): SamskaraUIClient | undefined {
  if (!state.client) return undefined;
  if (CLIENT_CACHE.has(state.client)) {
    return CLIENT_CACHE.get(state.client);
  }
  const client = new SamskaraUIClient(state.client);
  CLIENT_CACHE.set(state.client, client);
  return client;
}

export function renderSamskara(state: AppViewState) {
  const samskaraClient = getSamskaraClient(state);
  const connected = state.connected;

  const channelCount = Object.keys(state.channelsSnapshot?.channelAccounts ?? {}).length;
  const memoryCount =
    typeof state.samskaraMemoryNodes.length === "number" ? state.samskaraMemoryNodes.length : 0;

  return html`
    <div class="samskara-shell">
      <!-- Left panel: status sidebar -->
      <aside class="samskara-left">
        <div class="samskara-section">
          <div class="samskara-section-title">My Assistant</div>
          <div class="samskara-status-row">
            <span
              class="samskara-dot ${connected ? "samskara-dot--ok" : "samskara-dot--offline"}"
            ></span>
            <span>${state.assistantName || "Orca"}</span>
          </div>
          ${
            state.samskaraConfigured
              ? html`<div class="samskara-badge samskara-badge--brain">● Brain connected</div>`
              : html`<div class="samskara-badge">○ Brain not connected</div>`
          }
        </div>

        <div class="samskara-section">
          <div class="samskara-section-title">Connections</div>
          ${
            channelCount === 0
              ? html`<div class="samskara-empty">No connections active.</div>`
              : html`
                  ${Object.entries(state.channelsSnapshot?.channelAccounts ?? {}).map(
                    ([channel, accounts]) => html`
                      <div class="samskara-status-row">
                        <span class="samskara-dot samskara-dot--ok"></span>
                        <span>${channel} (${(accounts as unknown[]).length})</span>
                      </div>
                    `,
                  )}
                `
          }
        </div>

        <div class="samskara-section">
          <div class="samskara-section-title">Memory</div>
          <div class="samskara-big-number">${memoryCount || "–"}</div>
          <div class="samskara-section-sub">seeds stored</div>
        </div>
      </aside>

      <!-- Center panel: signal stream -->
      <main class="samskara-center">
        <signal-stream .gatewayClient=${state.client}></signal-stream>
      </main>

      <!-- Right panel: brain health + memory graph -->
      <aside class="samskara-right">
        <health-score .samskaraClient=${samskaraClient}></health-score>
        <div class="samskara-divider"></div>
        <memory-graph
          .samskaraClient=${samskaraClient}
          style="flex: 1;"
        ></memory-graph>
      </aside>
    </div>
  `;
}
