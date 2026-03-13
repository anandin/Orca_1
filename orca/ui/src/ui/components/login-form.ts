/**
 * <login-form> — Email + password login screen.
 *
 * Calls POST /auth/login with { email, password }.
 * On success fires a "login-success" CustomEvent with detail { token: string }.
 * On failure renders an inline error (no page navigation).
 *
 * Designed mobile-first: 48px min-height inputs, autocomplete attributes,
 * 16px font-size (prevents iOS auto-zoom), centered max-width card.
 */

import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { loadOrCreateDeviceIdentity } from "../device-identity.js";

@customElement("login-form")
export class LoginForm extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
      background: var(--bg, #0d0f14);
      box-sizing: border-box;
    }

    .card {
      width: 100%;
      max-width: 400px;
      background: var(--card, #13161e);
      border: 1px solid var(--border, #1e2230);
      border-radius: 12px;
      padding: 40px 32px 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .brand-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-strong, #f2f0e8);
      letter-spacing: -0.02em;
    }

    .brand-sub {
      font-size: 13px;
      color: var(--muted, #6b6862);
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    label {
      font-size: 13px;
      font-weight: 500;
      color: var(--muted, #6b6862);
      letter-spacing: 0.01em;
    }

    input {
      /* 16px minimum prevents iOS auto-zoom on focus */
      font-size: 16px;
      min-height: 48px;
      padding: 12px 14px;
      background: var(--input, #1e2230);
      border: 1px solid var(--border, #1e2230);
      border-radius: 8px;
      color: var(--text, #e8e6df);
      outline: none;
      transition: border-color 0.15s ease;
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
    }

    input:focus {
      border-color: var(--accent, #8b5cf6);
    }

    input::placeholder {
      color: var(--muted-strong, #524f4c);
    }

    button[type="submit"] {
      min-height: 48px;
      padding: 12px 20px;
      background: var(--accent, #8b5cf6);
      color: var(--accent-foreground, #ffffff);
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, opacity 0.15s ease;
      font-family: inherit;
      width: 100%;
    }

    button[type="submit"]:hover:not(:disabled) {
      background: var(--accent-hover, #9d70f7);
    }

    button[type="submit"]:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error {
      font-size: 13px;
      color: var(--svadhisthana, #e8620a);
      background: var(--svadhisthana-subtle, rgba(232, 98, 10, 0.15));
      border: 1px solid rgba(232, 98, 10, 0.3);
      border-radius: 6px;
      padding: 10px 12px;
      line-height: 1.45;
    }
  `;

  @state() private _email = "";
  @state() private _password = "";
  @state() private _loading = false;
  @state() private _error: string | null = null;

  private async _handleSubmit(e: Event) {
    e.preventDefault();
    if (this._loading) return;

    const email = this._email.trim();
    const password = this._password;

    if (!email || !password) {
      this._error = "Please enter your email and password.";
      return;
    }

    this._loading = true;
    this._error = null;

    try {
      // Include device identity so the server can auto-approve pairing on success.
      let deviceId: string | undefined;
      let publicKey: string | undefined;
      if (isSecureContext) {
        try {
          const identity = await loadOrCreateDeviceIdentity();
          deviceId = identity.deviceId;
          publicKey = identity.publicKey;
        } catch {
          // Non-fatal: proceed without device identity; user will see pairing prompt after login.
        }
      }

      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceId, publicKey }),
      });

      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        if (typeof data.token === "string" && data.token) {
          this.dispatchEvent(
            new CustomEvent("login-success", {
              detail: { token: data.token },
              bubbles: true,
              composed: true,
            }),
          );
          return;
        }
        this._error = "Login succeeded but no token was returned. Check server configuration.";
      } else if (res.status === 429) {
        this._error = "Too many attempts. Please wait a few minutes and try again.";
      } else if (res.status === 401) {
        this._error = "Wrong email or password.";
      } else if (res.status === 404) {
        this._error =
          "Login endpoint not configured. Set OPENCLAW_ADMIN_EMAIL and OPENCLAW_ADMIN_PASSWORD on the server.";
      } else {
        this._error = `Login failed (${res.status}). Please try again.`;
      }
    } catch {
      this._error = "Could not reach the server. Check your connection and try again.";
    } finally {
      this._loading = false;
    }
  }

  render() {
    return html`
      <div class="card">
        <div class="brand">
          <div class="brand-title">Orca</div>
          <div class="brand-sub">Sign in to continue</div>
        </div>

        <form class="fields" @submit=${this._handleSubmit}>
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="you@example.com"
              .value=${this._email}
              @input=${(e: InputEvent) => {
                this._email = (e.target as HTMLInputElement).value;
              }}
              ?disabled=${this._loading}
              required
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              .value=${this._password}
              @input=${(e: InputEvent) => {
                this._password = (e.target as HTMLInputElement).value;
              }}
              ?disabled=${this._loading}
              required
            />
          </div>

          ${this._error ? html`<div class="error">${this._error}</div>` : ""}

          <button type="submit" ?disabled=${this._loading}>
            ${this._loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "login-form": LoginForm;
  }
}
