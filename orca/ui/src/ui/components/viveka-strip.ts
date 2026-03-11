/**
 * viveka-strip — Always-visible 44px bottom bar.
 * Learning / Memory / Reflexes toggles + kill switch.
 * Named after Viveka (discernment/safety faculty in Samskara).
 */
import { html, LitElement, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("viveka-strip")
export class VivekaStrip extends LitElement {
  static styles = css`
    :host {
      display: block;
      flex-shrink: 0;
      height: 44px;
    }
    .strip {
      height: 44px;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 16px;
      border-top: 1px solid var(--border);
      background: var(--panel);
      font-size: 12px;
      transition: background 0.3s ease, border-color 0.3s ease;
      overflow: hidden;
    }
    .strip--killed {
      background: var(--muladhara-subtle);
      border-top-color: var(--muladhara);
    }
    .strip--degraded {
      background: var(--manipura-subtle);
      border-top-color: var(--manipura);
    }
    .strip__label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 2px 8px;
      border-radius: 20px;
      border: none;
      background: none;
      font-size: 12px;
      color: var(--text);
      transition: background 0.1s;
      flex-shrink: 0;
    }
    .toggle:hover {
      background: var(--bg-hover);
    }
    .toggle:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .toggle__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: background 0.2s;
    }
    .toggle__dot--on {
      background: var(--anahata);
    }
    .toggle__dot--off {
      background: var(--muted);
    }
    .spacer {
      flex: 1;
    }
    .kill-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid var(--muladhara);
      background: var(--muladhara-subtle);
      color: var(--muladhara);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.1s;
      flex-shrink: 0;
    }
    .kill-btn:hover {
      background: var(--muladhara);
      color: #fff;
    }
    .kill-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .kill-btn--killed {
      background: var(--muladhara);
      color: #fff;
    }
    .resume-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid var(--anahata);
      background: var(--anahata-subtle);
      color: var(--anahata);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.1s;
      flex-shrink: 0;
    }
    .resume-btn:hover {
      background: var(--anahata);
      color: #fff;
    }
  `;

  @property({ type: Boolean }) learning = true;
  @property({ type: Boolean }) memory = true;
  @property({ type: Boolean }) reflexes = true;
  @property({ type: Boolean }) killed = false;
  @property({ type: Boolean }) busy = false;

  private dispatch(type: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  render() {
    const anyOff = !this.learning || !this.memory || !this.reflexes;
    const stripClass = this.killed
      ? "strip strip--killed"
      : anyOff
        ? "strip strip--degraded"
        : "strip";

    return html`
      <div class="${stripClass}">
        <span class="strip__label">Viveka</span>

        <button
          class="toggle"
          ?disabled=${this.killed || this.busy}
          @click=${() => this.dispatch("viveka-toggle-learning")}
          title="Toggle learning"
        >
          <span class="toggle__dot ${this.learning && !this.killed ? "toggle__dot--on" : "toggle__dot--off"}"></span>
          Learning
        </button>

        <button
          class="toggle"
          ?disabled=${this.killed || this.busy}
          @click=${() => this.dispatch("viveka-toggle-memory")}
          title="Toggle memory"
        >
          <span class="toggle__dot ${this.memory && !this.killed ? "toggle__dot--on" : "toggle__dot--off"}"></span>
          Memory
        </button>

        <button
          class="toggle"
          ?disabled=${this.killed || this.busy}
          @click=${() => this.dispatch("viveka-toggle-reflexes")}
          title="Toggle reflexes"
        >
          <span class="toggle__dot ${this.reflexes && !this.killed ? "toggle__dot--on" : "toggle__dot--off"}"></span>
          Reflexes
        </button>

        <div class="spacer"></div>

        ${
          this.killed
            ? html`
                <button
                  class="resume-btn"
                  ?disabled=${this.busy}
                  @click=${() => this.dispatch("viveka-resume")}
                  title="Resume all functions"
                >
                  ↺ Resume
                </button>
              `
            : html`
                <button
                  class="kill-btn"
                  ?disabled=${this.busy}
                  @click=${() => this.dispatch("viveka-kill")}
                  title="Stop all assistant functions immediately"
                >
                  ✕ Stop all
                </button>
              `
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "viveka-strip": VivekaStrip;
  }
}
