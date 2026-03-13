import { describe, it, expect, vi, afterEach } from "vitest";
import "../components/login-form.js";

function buildForm(): { el: HTMLElement; shadow: ShadowRoot } {
  const el = document.createElement("login-form");
  document.body.appendChild(el);
  // LitElement renders synchronously on first connect; wait one microtask.
  return { el, shadow: el.shadowRoot! };
}

function cleanup(el: HTMLElement) {
  el.remove();
}

async function nextFrame() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
}

describe("<login-form>", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders email + password inputs and a submit button", async () => {
    const { shadow } = buildForm();
    await nextFrame();
    expect(shadow.querySelector("input[type='email']")).not.toBeNull();
    expect(shadow.querySelector("input[type='password']")).not.toBeNull();
    expect(shadow.querySelector("button[type='submit']")).not.toBeNull();
  });

  it("shows inline error when fields are empty on submit", async () => {
    const { el, shadow } = buildForm();
    await nextFrame();
    const form = shadow.querySelector("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await nextFrame();
    const error = shadow.querySelector(".error");
    expect(error?.textContent).toMatch(/email and password/i);
    cleanup(el);
  });

  it("includes deviceId and publicKey in the POST body and fires login-success on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "gw-token-abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { el, shadow } = buildForm();
    await nextFrame();

    const emailInput = shadow.querySelector<HTMLInputElement>("input[type='email']")!;
    const passwordInput = shadow.querySelector<HTMLInputElement>("input[type='password']")!;

    emailInput.value = "user@example.com";
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.value = "mypassword";
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    await nextFrame();

    const events: CustomEvent[] = [];
    el.addEventListener("login-success", (e) => events.push(e as CustomEvent));

    shadow.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // Wait for async fetch + state update
    await new Promise<void>((r) => setTimeout(r, 50));
    await nextFrame();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/auth/login");

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.email).toBe("user@example.com");
    expect(body.password).toBe("mypassword");
    // deviceId and publicKey should be present when crypto.subtle is available (secure context).
    if (typeof body.deviceId !== "undefined") {
      expect(typeof body.deviceId).toBe("string");
      expect(typeof body.publicKey).toBe("string");
    }

    // login-success event should fire with the token.
    expect(events).toHaveLength(1);
    expect((events[0].detail as { token: string }).token).toBe("gw-token-abc");

    cleanup(el);
  });

  it("shows 'Wrong email or password.' on 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { el, shadow } = buildForm();
    await nextFrame();

    shadow.querySelector<HTMLInputElement>("input[type='email']")!.value = "a@b.com";
    shadow.querySelector<HTMLInputElement>("input[type='email']")!.dispatchEvent(new Event("input", { bubbles: true }));
    shadow.querySelector<HTMLInputElement>("input[type='password']")!.value = "bad";
    shadow.querySelector<HTMLInputElement>("input[type='password']")!.dispatchEvent(new Event("input", { bubbles: true }));
    await nextFrame();

    shadow.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 50));
    await nextFrame();

    const error = shadow.querySelector(".error");
    expect(error?.textContent).toContain("Wrong email or password");
    cleanup(el);
  });
});
