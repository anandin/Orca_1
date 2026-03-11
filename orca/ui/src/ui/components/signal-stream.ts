/**
 * signal-stream — Datadog APM-style waterfall of agent processing signals.
 * Subscribes to gateway WebSocket events: agent, health, cron.
 */
import { html, LitElement, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayBrowserClient } from "../gateway.ts";

type SignalMode = "instant" | "thinking" | "background";
type StageStatus = "pass" | "slow" | "blocked" | "pending";

type Stage = {
  name: string;
  status: StageStatus;
  durationMs?: number;
};

export type SignalEntry = {
  id: string;
  ts: number;
  mode: SignalMode;
  stages: Stage[];
  summary?: string;
  expanded: boolean;
};

const MAX_SIGNALS = 50;

function stageColor(status: StageStatus): string {
  switch (status) {
    case "pass":
      return "var(--anahata)";
    case "slow":
      return "var(--manipura)";
    case "blocked":
      return "var(--muladhara)";
    default:
      return "var(--muted)";
  }
}

function modeLabel(mode: SignalMode): { text: string; color: string } {
  switch (mode) {
    case "instant":
      return { text: "⚡ instant", color: "var(--vishuddha)" };
    case "thinking":
      return { text: "● thinking", color: "var(--ajna)" };
    case "background":
      return { text: "◌ background", color: "var(--muted)" };
  }
}

function timestampLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function inferMode(event: Record<string, unknown>): SignalMode {
  const thinking = (event as { thinking?: unknown }).thinking;
  if (thinking) return "thinking";
  const durationMs = Number((event as { durationMs?: unknown }).durationMs ?? 0);
  if (durationMs < 50) return "instant";
  return "thinking";
}

function eventToSignal(event: Record<string, unknown>, eventType: string): SignalEntry {
  const mode = inferMode(event);
  const stages: Stage[] = [
    { name: "Message", status: "pass" },
    { name: "Memory", status: "pass" },
    { name: "Reason", status: mode === "thinking" ? "pass" : "pending" },
    { name: "Act", status: "pass" },
  ];

  if (eventType === "cron") {
    stages[0] = { name: "Schedule", status: "pass" };
  }

  return {
    id: String(Date.now()) + Math.random(),
    ts: Date.now(),
    mode,
    stages,
    summary: typeof event.summary === "string" ? event.summary : undefined,
    expanded: false,
  };
}

@customElement("signal-stream")
export class SignalStream extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .stream-header {
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .stream-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }
    .signal-row {
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.1s;
    }
    .signal-row:hover {
      background: var(--bg-hover);
    }
    .signal-top {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
    }
    .signal-time {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      font-size: 11px;
    }
    .signal-mode {
      flex-shrink: 0;
      font-size: 11px;
    }
    .signal-stages {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .stage-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .stage-name {
      font-size: 11px;
      color: var(--muted);
    }
    .stage-sep {
      color: var(--border-strong);
      font-size: 10px;
    }
    .signal-expanded {
      margin-top: 8px;
      padding: 8px;
      background: var(--bg-elevated);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text);
      line-height: 1.5;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
      padding: 24px;
    }
  `;

  @property({ attribute: false }) gatewayClient?: GatewayBrowserClient;

  @state() private signals: SignalEntry[] = [];

  private unsubscribeFns: Array<() => void> = [];

  connectedCallback() {
    super.connectedCallback();
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const fn of this.unsubscribeFns) fn();
    this.unsubscribeFns = [];
  }

  private subscribeToEvents() {
    if (!this.gatewayClient) return;

    const handleEvent = (eventType: string) => (event: unknown) => {
      const entry = eventToSignal(event as Record<string, unknown>, eventType);
      this.signals = [entry, ...this.signals].slice(0, MAX_SIGNALS);
    };

    const agentUnsub = this.gatewayClient.subscribe("agent", handleEvent("agent"));
    const cronUnsub = this.gatewayClient.subscribe("cron", handleEvent("cron"));

    if (typeof agentUnsub === "function") this.unsubscribeFns.push(agentUnsub);
    if (typeof cronUnsub === "function") this.unsubscribeFns.push(cronUnsub);
  }

  private toggleExpanded(id: string) {
    this.signals = this.signals.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s));
  }

  render() {
    return html`
      <div class="stream-header">Signal Stream</div>
      <div class="stream-body">
        ${
          this.signals.length === 0
            ? html`<div class="empty-state">
                Waiting for signals…<br />
                <small>Events will appear here when your assistant runs.</small>
              </div>`
            : this.signals.map((s) => this.renderSignal(s))
        }
      </div>
    `;
  }

  private renderSignal(s: SignalEntry) {
    const { text: modeText, color: modeColor } = modeLabel(s.mode);
    return html`
      <div class="signal-row" @click=${() => this.toggleExpanded(s.id)}>
        <div class="signal-top">
          <span class="signal-time">${timestampLabel(s.ts)}</span>
          <span class="signal-mode" style="color: ${modeColor}">${modeText}</span>
          <div class="signal-stages">
            ${s.stages.map(
              (stage, i) => html`
                ${i > 0 ? html`<span class="stage-sep">→</span>` : nothing}
                <span class="stage-dot" style="background: ${stageColor(stage.status)}"></span>
                <span class="stage-name">${stage.name}</span>
              `,
            )}
          </div>
        </div>
        ${
          s.expanded && s.summary
            ? html`<div class="signal-expanded">${s.summary}</div>`
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "signal-stream": SignalStream;
  }
}
