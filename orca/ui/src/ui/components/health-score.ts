/**
 * health-score — Mercury-style dominant number showing brain health.
 * Polls Samskara identity endpoint every 30s.
 */
import { html, LitElement, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { SamskaraUIClient } from "../data/samskara-client.ts";

function scoreColor(score: number | null): string {
  if (score === null) return "var(--muted)";
  if (score >= 80) return "var(--sahasrara)";
  if (score >= 60) return "var(--anahata)";
  if (score >= 40) return "var(--manipura)";
  return "var(--svadhisthana)";
}

function scoreLabel(score: number | null): string {
  if (score === null) return "–";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Healthy";
  if (score >= 40) return "Caution";
  return "Degraded";
}

@customElement("health-score")
export class HealthScore extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .score-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
    }
    .score-number {
      font-size: 72px;
      font-weight: 700;
      line-height: 1;
      transition: color 0.4s ease;
      font-variant-numeric: tabular-nums;
    }
    .score-label {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .score-breakdown {
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      line-height: 1.6;
      margin-top: 4px;
    }
    .score-tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--bg-elevated);
      font-size: 10px;
      margin: 2px;
    }
  `;

  @property({ attribute: false }) samskaraClient?: SamskaraUIClient;

  @state() private score: number | null = null;
  @state() private loading = false;
  @state() private configured = false;

  private pollTimer?: ReturnType<typeof setInterval>;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.pollTimer = setInterval(() => void this.load(), 30_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  private async load() {
    if (!this.samskaraClient || this.loading) return;
    this.loading = true;
    try {
      const result = await this.samskaraClient.getIdentity();
      this.configured = result.configured ?? false;
      this.score = typeof result.karmaScore === "number" ? result.karmaScore : null;
    } catch {
      // Silently fail — score stays null
    } finally {
      this.loading = false;
    }
  }

  render() {
    const color = scoreColor(this.score);
    const label = scoreLabel(this.score);
    const displayScore = this.score !== null ? Math.round(this.score) : "–";

    if (!this.configured) {
      return html`
        <div class="score-wrap">
          <div class="score-number" style="color: var(--muted); font-size: 32px;">Not connected</div>
          <div class="score-breakdown">Set SAMSKARA_API_KEY to enable brain features.</div>
        </div>
      `;
    }

    return html`
      <div class="score-wrap">
        <div class="score-number" style="color: ${color}">${displayScore}</div>
        <div class="score-label" style="color: ${color}">${label}</div>
        <div class="score-breakdown">
          Brain health · Memory integrity · Safety record
        </div>
        ${
          this.loading
            ? html`<div class="score-tag">Refreshing…</div>`
            : html`<div class="score-tag">Brain health</div>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "health-score": HealthScore;
  }
}
