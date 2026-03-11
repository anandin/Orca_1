import { t } from "../i18n/index.ts";
import type { IconName } from "./icons.js";

// Basic mode: human-centered groups with friendlier nav structure
export const BASIC_TAB_GROUPS = [
  { label: "chat", tabs: ["chat"] },
  { label: "status", tabs: ["overview", "channels", "instances"] },
  { label: "brain", tabs: ["samskara"] },
  { label: "automation", tabs: ["cron"] },
  { label: "assistant", tabs: ["agents", "skills", "nodes"] },
  // Advanced tabs collapsed under "More" in basic mode
  { label: "more", tabs: ["sessions", "usage", "config", "logs", "debug"] },
] as const;

// Advanced mode: full developer groups (original layout + samskara)
export const ADVANCED_TAB_GROUPS = [
  { label: "chat", tabs: ["chat"] },
  {
    label: "control",
    tabs: ["overview", "channels", "instances", "sessions", "usage", "cron"],
  },
  { label: "brain", tabs: ["samskara"] },
  { label: "agent", tabs: ["agents", "skills", "nodes"] },
  { label: "settings", tabs: ["config", "debug", "logs"] },
] as const;

// Legacy export kept for compatibility — defaults to advanced groups
export const TAB_GROUPS = ADVANCED_TAB_GROUPS;

export type UiMode = "basic" | "advanced";

export type Tab =
  | "agents"
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs"
  | "samskara";

const TAB_PATHS: Record<Tab, string> = {
  agents: "/agents",
  overview: "/overview",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  usage: "/usage",
  cron: "/cron",
  skills: "/skills",
  nodes: "/nodes",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
  samskara: "/samskara",
};

const PATH_TO_TAB = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]));

export function tabGroupsForMode(mode: UiMode) {
  return mode === "basic" ? BASIC_TAB_GROUPS : ADVANCED_TAB_GROUPS;
}

/** Tabs hidden in basic mode (collapsed into "More") */
export const BASIC_MODE_HIDDEN_TABS = new Set<Tab>(["sessions", "usage", "config", "logs", "debug"]);

/** Whether a tab is visible in basic mode (not collapsed) */
export function isTabVisibleInMode(tab: Tab, mode: UiMode): boolean {
  if (mode === "advanced") return true;
  return !BASIC_MODE_HIDDEN_TABS.has(tab);
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath) {
    return "";
  }
  let base = basePath.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (base === "/") {
    return "";
  }
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  return base;
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) {
    normalized = "/";
  }
  if (normalized === "/") {
    return "chat";
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "agents":
      return "sparkles";
    case "chat":
      return "messageSquare";
    case "overview":
      return "home";
    case "channels":
      return "plug";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "usage":
      return "activity";
    case "cron":
      return "clock";
    case "skills":
      return "zap";
    case "nodes":
      return "smartphone";
    case "config":
      return "settings";
    case "debug":
      return "terminal";
    case "logs":
      return "scrollText";
    case "samskara":
      return "brain";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  return t(`tabs.${tab}`);
}

export function subtitleForTab(tab: Tab) {
  return t(`subtitles.${tab}`);
}
