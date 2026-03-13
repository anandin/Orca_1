/**
 * cmd-palette — Raycast-style ⌘K / Ctrl+K command palette.
 * Fuzzy search across nav views, sessions, schedules, and brain queries.
 */
import { html, LitElement, css, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import type { AppViewState } from "../app-view-state.ts";
import type { Tab } from "../navigation.ts";
import { tabGroupsForMode, titleForTab } from "../navigation.ts";

type PaletteAction = {
  id: string;
  label: string;
  description?: string;
  group: string;
  tab?: Tab;
  handler: () => void;
};

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: all chars appear in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

@customElement("cmd-palette")
export class CmdPalette extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    :host([hidden]) {
      display: none;
    }
    .palette {
      width: 560px;
      max-width: calc(100vw - 32px);
      background: var(--card);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl), 0 0 40px rgba(139, 92, 246, 0.1);
      overflow: hidden;
      animation: scale-in 0.12s var(--ease-spring) both;
    }
    @keyframes scale-in {
      from { opacity: 0; transform: scale(0.96) translateY(-8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .palette__input-row {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .palette__icon {
      color: var(--muted);
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .palette__input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      font-size: 15px;
      color: var(--text);
      font-family: inherit;
    }
    .palette__input::placeholder {
      color: var(--muted);
    }
    .palette__shortcut {
      font-size: 11px;
      color: var(--muted);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 6px;
      flex-shrink: 0;
    }
    .palette__list {
      max-height: 360px;
      overflow-y: auto;
    }
    .palette__group-label {
      padding: 6px 16px 4px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .palette__item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.08s;
    }
    .palette__item:hover,
    .palette__item--active {
      background: var(--accent-subtle);
    }
    .palette__item-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-elevated);
      border-radius: 6px;
      flex-shrink: 0;
      font-size: 14px;
    }
    .palette__item-text {
      flex: 1;
      min-width: 0;
    }
    .palette__item-label {
      font-size: 13px;
      color: var(--text);
    }
    .palette__item-desc {
      font-size: 11px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .palette__empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
    }
    .palette__hint {
      padding: 8px 16px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--muted);
      display: flex;
      gap: 16px;
    }
    .palette__hint kbd {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0 4px;
      font-family: inherit;
    }
  `;

  @property({ attribute: false }) appState?: AppViewState;

  @state() private query = "";
  @state() private activeIndex = 0;

  @query(".palette__input") private inputEl?: HTMLInputElement;

  private get actions(): PaletteAction[] {
    if (!this.appState) return [];
    const state = this.appState;
    const actions: PaletteAction[] = [];

    // Nav views
    const groups = tabGroupsForMode(state.uiMode ?? "basic");
    for (const group of groups) {
      for (const tab of group.tabs as unknown as Tab[]) {
        actions.push({
          id: `nav:${tab}`,
          label: titleForTab(tab),
          group: "Navigate",
          tab,
          handler: () => state.setTab(tab),
        });
      }
    }

    // Scheduled tasks (cron jobs)
    for (const job of state.cronJobs ?? []) {
      const name = typeof job.name === "string" ? job.name : String(job.id ?? "");
      actions.push({
        id: `cron:${String(job.id ?? name)}`,
        label: name,
        description: "Run scheduled task",
        group: "Schedules",
        handler: () => {
          state.setTab("cron");
        },
      });
    }

    return actions;
  }

  private get filteredActions(): PaletteAction[] {
    const q = this.query.trim();
    if (!q) return this.actions;
    return this.actions.filter((a) => fuzzyMatch(q, a.label) || fuzzyMatch(q, a.description ?? ""));
  }

  protected firstUpdated() {
    this.inputEl?.focus();
  }

  private handleKeyDown(e: KeyboardEvent) {
    const items = this.filteredActions;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[this.activeIndex];
      if (item) {
        item.handler();
        this.close();
      }
    } else if (e.key === "Escape") {
      this.close();
    }
  }

  private handleQueryInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = 0;
  }

  private handleBackdropClick(e: MouseEvent) {
    if (e.target === this.renderRoot.firstElementChild) {
      this.close();
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent("cmd-palette-close", { bubbles: true, composed: true }));
  }

  render() {
    const items = this.filteredActions;
    const grouped = new Map<string, PaletteAction[]>();
    for (const item of items) {
      const list = grouped.get(item.group) ?? [];
      list.push(item);
      grouped.set(item.group, list);
    }

    let globalIndex = 0;

    return html`
      <div @click=${(e: MouseEvent) => this.handleBackdropClick(e)}>
        <div class="palette" @keydown=${(e: KeyboardEvent) => this.handleKeyDown(e)}>
          <div class="palette__input-row">
            <span class="palette__icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </span>
            <input
              class="palette__input"
              placeholder="Search views, schedules, settings…"
              .value=${this.query}
              @input=${this.handleQueryInput}
              autocomplete="off"
              spellcheck="false"
            />
            <span class="palette__shortcut">Esc</span>
          </div>

          <div class="palette__list">
            ${
              items.length === 0
                ? html`<div class="palette__empty">No results for "${this.query}"</div>`
                : [...grouped.entries()].map(([group, groupItems]) => html`
                    <div class="palette__group-label">${group}</div>
                    ${groupItems.map((item) => {
                      const idx = globalIndex++;
                      return html`
                        <div
                          class="palette__item ${idx === this.activeIndex ? "palette__item--active" : ""}"
                          @click=${() => { item.handler(); this.close(); }}
                          @mouseenter=${() => { this.activeIndex = idx; }}
                        >
                          <div class="palette__item-icon">
                            ${item.tab
                              ? html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
                              : html`<span>⊙</span>`}
                          </div>
                          <div class="palette__item-text">
                            <div class="palette__item-label">${item.label}</div>
                            ${item.description
                              ? html`<div class="palette__item-desc">${item.description}</div>`
                              : nothing}
                          </div>
                        </div>
                      `;
                    })}
                  `)
            }
          </div>

          <div class="palette__hint">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cmd-palette": CmdPalette;
  }
}
