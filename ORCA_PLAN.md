# Orca — Iron Man's JARVIS, Built on OpenClaw + Samskara

> **Zero config. Self-aware. Cloud-native.**
> A personal AI that actually thinks before it acts.

---

## Vision

OpenClaw gives us the **body** — 33 channels, multi-LLM, tool execution, memory.
Samskara gives us the **brain** — reasoning, reflexes, safety, karma, identity.
Orca is the **integration** — hardened, stripped, deployed as a turnkey JARVIS.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Fly.io Cloud                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  ORCA (Agent Body)                   │  │
│  │                                                      │  │
│  │  Channels: Telegram · Discord · Slack ·              │  │
│  │            WhatsApp · Signal · iMessage              │  │
│  │                      ↓                               │  │
│  │  Gateway (WebSocket JSON-RPC, port 18789)            │  │
│  │                      ↓                               │  │
│  │  Agent Loop (pi-embedded-runner)                     │  │
│  │    1. check_reflex  ──────────────────────────────┐  │  │
│  │    2. get_context   ──────────────────────────┐   │  │  │
│  │    3. memory_search ──────────────────────┐   │   │  │  │
│  │    4. safety_check  ──────────────────┐   │   │   │  │  │
│  │    5. consult       ──────────────┐   │   │   │   │  │  │
│  │    6. [execute tools]             │   │   │   │   │  │  │
│  │    7. report_outcome ─────────────┘   │   │   │   │  │  │
│  │    8. ingest        ──────────────────┘   │   │   │  │  │
│  │                      ↑MCP calls           │   │   │  │  │
│  └──────────────────────┼────────────────────┘   │   │  │  │
│                         │ HTTP (fly.internal)     │   │  │  │
│  ┌──────────────────────▼────────────────────────▼───▼─┐  │
│  │               SAMSKARA (Brain - MCP Server)          │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │ consult  │  │  reflex  │  │  safety  │           │  │
│  │  │ (Buddhi) │  │  (Manas) │  │ (Viveka) │           │  │
│  │  └──────────┘  └──────────┘  └──────────┘           │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │  memory  │  │ outcome  │  │  ingest  │           │  │
│  │  │ (Chitta) │  │ (Karma)  │  │ (Learn)  │           │  │
│  │  └──────────┘  └──────────┘  └──────────┘           │  │
│  │                                                      │  │
│  │  SQLite: karma_ledger · reflex_cache · memory        │  │
│  │  Port: 3333 (internal only)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Repo Structure

```
Orca_1/
├── orca/                    ← Hardened OpenClaw fork
│   ├── src/
│   │   ├── gateway/         ← WebSocket control plane (kept)
│   │   ├── agents/          ← Agent loop (modified to call Samskara)
│   │   ├── memory/          ← Chitta (SQLite + vector, kept + fixed)
│   │   ├── channels/        ← Only 6 core channels (stripped)
│   │   ├── security/        ← Hardened audit (W1-W18 fixed)
│   │   └── config/          ← Zero-config startup logic
│   ├── extensions/
│   │   ├── acpx/            ← MCP bridge (modified for Samskara)
│   │   ├── telegram/        ← Kept
│   │   ├── discord/         ← Kept
│   │   ├── slack/           ← Kept
│   │   ├── whatsapp/        ← Kept
│   │   ├── signal/          ← Kept
│   │   └── imessage/        ← Kept (macOS only)
│   ├── Dockerfile
│   ├── fly.toml             ← Fly.io config
│   └── package.json
│
├── samskara/                ← NEW: Brain MCP Server
│   ├── src/
│   │   ├── server.ts        ← MCP server entry point
│   │   ├── tools/
│   │   │   ├── consult.ts       ← Buddhi: LLM reasoning
│   │   │   ├── check-reflex.ts  ← Manas: fast-path patterns
│   │   │   ├── memory-search.ts ← Chitta: retrieval
│   │   │   ├── safety-check.ts  ← Viveka: pre-action gate
│   │   │   ├── report-outcome.ts← Karma: feedback loop
│   │   │   ├── ingest.ts        ← Samskara: learning
│   │   │   ├── get-identity.ts  ← Ahamkara: who am I
│   │   │   └── get-context.ts   ← Manas: situational context
│   │   ├── karma-ledger.ts      ← SQLite decision trace
│   │   ├── reflex-cache.ts      ← Fast-path pattern store
│   │   └── embeddings.ts        ← Vector embedding helper
│   ├── Dockerfile
│   ├── fly.toml
│   └── package.json
│
├── docker-compose.yml       ← Local dev: both services
├── .env.example             ← Single file: just set API keys
└── deploy.sh                ← One-command Fly.io deploy
```

---

## What Gets Removed from OpenClaw

### Apps (dead weight for cloud deployment)
- `apps/android/` — remove
- `apps/ios/` — remove
- `apps/macos/` — remove
- `ui/` — keep only gateway admin panel

### Channels (keep 6 core, remove 17)
**Kept:** Telegram, Discord, Slack, WhatsApp, Signal, iMessage
**Removed:** Twitch, IRC, Matrix, Zalo, Feishu, LINE, Teams, Mattermost, Tlon,
  Nextcloud Talk, Synology Chat, GoogleChat, BlueBubbles, Zalo, Nextcloud

### External Dependencies (security/reliability risk)
- ClawHub skill registry — remove (community registry is an attack surface)
- W7 multi-user gateway — add hard `throw` guard in `server.impl.ts`

### Test Infrastructure
- W20 live test flakiness — replace all live API calls with recorded mocks

---

## What Gets Fixed (W1-W18)

| ID | Fix | File Target |
|----|-----|-------------|
| W1 | `sandbox.mode` default → `"container"` | `src/config/defaults.ts` |
| W2 | Plugin sandbox via `isolated-vm` | `src/plugins/loader.ts` |
| W3 | Prompt injection regex + classifier before tool dispatch | `src/agents/prompt-guard.ts` (new) |
| W4 | Symlink validation in skill loading | `src/skills/loader.ts` |
| W5 | 128-bit entropy pairing codes | `extensions/device-pair/src/pairing.ts` |
| W6 | Startup permission check on config file | `src/config/loader.ts` |
| W8 | SQLite WAL for all file state (replace sessions.json) | `src/config/session-store.ts` |
| W9 | Incremental memory index (not full re-index) | `src/memory/manager.ts` |
| W10 | LanceDB streaming search (not all-in-RAM) | `extensions/memory-lancedb/src/index.ts` |
| W11 | Parallel tool execution in agent loop | `src/agents/pi-embedded-runner/run.ts` |
| W12 | Docker sandbox container cleanup on exit | `src/agents/sandbox/docker.ts` |
| W14 | Plugin dependency declaration in manifests | `src/plugins/manifest.ts` |
| W15 | Centralized `ToolPolicyEngine` class | `src/agents/tool-policy-engine.ts` (new) |
| W17 | WAL-based transcript (replace heuristic repair) | `src/agents/transcript-store.ts` |
| W18 | Surface credential failures in agent reply stream | `src/agents/auth-profile-resolver.ts` |

---

## Samskara MCP Server — 8 Tools

### Tool Definitions

```typescript
// 1. consult — Buddhi (Intellect)
// The primary reasoning tool. Called before every non-trivial response.
{
  name: "consult",
  description: "Query Samskara for structured reasoning on a task",
  inputSchema: {
    question: string,        // The user's intent distilled
    context: string,         // Recent conversation
    memory_hits: string[],   // Retrieved memories
    proposed_action?: string // What the agent is considering
  },
  returns: {
    decision: string,        // What to do
    reasoning: string,       // Why
    confidence: number,      // 0-1
    decision_id: string      // For karma tracking
  }
}

// 2. check_reflex — Manas (Reactive Mind)
// Fast-path check. If a pattern matches, respond without LLM inference.
{
  name: "check_reflex",
  description: "Check if this message matches a known reflex pattern",
  inputSchema: {
    message: string,
    channel_id: string
  },
  returns: {
    reflex: boolean,
    cached_response?: string,
    pattern_id?: string
  }
}

// 3. memory_search — Chitta (Memory)
// Retrieves relevant episodic and semantic memories.
{
  name: "memory_search",
  description: "Search long-term memory with temporal decay weighting",
  inputSchema: {
    query: string,
    limit?: number,        // default: 10
    temporal_weight?: number // 0-1, default: 0.3
  },
  returns: {
    memories: Array<{ content, score, age_days, tags }>
  }
}

// 4. safety_check — Viveka (Discrimination/Safety)
// Pre-action gate. Must clear before executing any tool.
{
  name: "safety_check",
  description: "Verify an action is safe before execution",
  inputSchema: {
    action: string,        // Human-readable action description
    action_type: string,  // "shell" | "file_write" | "network" | "memory"
    target?: string,       // File path, URL, etc.
    context: string
  },
  returns: {
    safe: boolean,
    risk_level: "none" | "low" | "medium" | "high" | "critical",
    reason: string,
    alternatives?: string[]
  }
}

// 5. report_outcome — Karma Feedback
// Called after every action. Honest accounting of what happened.
{
  name: "report_outcome",
  description: "Report the outcome of a decision for karma tracking",
  inputSchema: {
    decision_id: string,
    outcome: "success" | "failure" | "partial" | "refused",
    was_helpful: boolean,
    user_satisfaction?: number, // 1-5 if available
    notes?: string
  },
  returns: { karma_score: number }
}

// 6. ingest — Samskara Formation (Learning)
// Feed new knowledge into long-term memory.
{
  name: "ingest",
  description: "Store new knowledge in Chitta memory",
  inputSchema: {
    content: string,
    source: string,     // "user" | "observation" | "inference"
    tags: string[],
    importance: number  // 0-1
  },
  returns: { memory_id: string }
}

// 7. get_identity — Ahamkara (Self)
{
  name: "get_identity",
  description: "Get the agent's current identity and persona configuration",
  inputSchema: {},
  returns: {
    name: string,       // "Orca"
    persona: string,
    capabilities: string[],
    karma_score: number,
    created_at: string
  }
}

// 8. get_context — Manas Context
{
  name: "get_context",
  description: "Retrieve recent conversation context for a channel",
  inputSchema: {
    channel_id: string,
    depth?: number  // messages back, default: 10
  },
  returns: {
    messages: Array<{ role, content, timestamp }>,
    summary?: string
  }
}
```

---

## Modified Agent Loop (orca/src/agents/pi-embedded-runner/run.ts)

```
BEFORE (OpenClaw):
  message → [context assembly] → LLM → tool calls → response

AFTER (Orca + Samskara):
  message
    ↓
  check_reflex()     ← if match: respond immediately, skip LLM (cost zero)
    ↓ (no reflex)
  get_context()      ← load recent channel history
  memory_search()    ← load relevant long-term memories
    ↓
  safety_check()     ← verify action is safe BEFORE passing to LLM
    ↓ (safe)
  consult()          ← Buddhi: structured reasoning, returns decision_id
    ↓
  [LLM with Samskara's decision as system context]
    ↓
  [tool execution with safety_check per tool]
    ↓
  report_outcome()   ← honest result tracking
  ingest()           ← if new knowledge gained
    ↓
  response → channel
```

---

## Zero Config Bootstrap

Just set your LLM API key. Everything else auto-configures:

```bash
# Option 1: One-liner deploy to Fly.io
OPENAI_API_KEY=sk-... ./deploy.sh

# Option 2: Local Docker
OPENAI_API_KEY=sk-... docker compose up

# Option 3: Manual
fly secrets set OPENAI_API_KEY=sk-...
fly deploy
```

**What auto-configures:**
- Gateway token → auto-generated UUID
- TLS cert → auto-generated self-signed (OpenClaw native feature)
- SQLite databases → auto-initialized on first start
- Samskara brain → auto-connected via fly.internal network
- Sandbox mode → defaults to `container` (safe)
- Memory → SQLite + vector embeddings initialized empty

---

## Fly.io Deployment

Two Fly apps communicating via private network:

```
orca-gateway.internal:18789   ← Public-facing agent
orca-samskara.internal:3333   ← Brain (private only)
```

### orca/fly.toml
```toml
app = "orca-gateway"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"
  [build.args]
    OPENCLAW_INSTALL_BROWSER = "0"

[[services]]
  internal_port = 18789
  protocol = "tcp"
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[env]
  SAMSKARA_URL = "http://orca-samskara.internal:3333"

[mounts]
  source = "orca_data"
  destination = "/home/node/.openclaw"
```

### samskara/fly.toml
```toml
app = "orca-samskara"
primary_region = "sjc"

[[services]]
  internal_port = 3333
  # No public ports — brain is internal only

[mounts]
  source = "samskara_data"
  destination = "/data"
```

---

## Implementation Phases

### Phase 1: Fork + Strip (this session)
1. Copy openclaw-repo → orca/ in Orca_1
2. Remove: apps/, 17 channels, ClawHub, live tests
3. Add W7 hard guard (multi-user rejection)
4. Fix W1 (sandbox default), W6 (file permissions), W8 (SQLite WAL)

### Phase 2: Security Hardening
1. W2: Plugin isolation via isolated-vm
2. W3: Prompt injection guard
3. W4: Symlink validation
4. W5: Strong pairing codes
5. W17: WAL transcript
6. W18: Credential failure surfacing

### Phase 3: Samskara Integration ✅ (Samskara already live at samskara-mind.replit.app)
1. Orca registered as agent → ID: `orca-v1`
2. All 8 API endpoints mapped and tested
3. `extensions/samskara-bridge/` extension built
4. REST SDK client with full type safety
5. MCP URL configured in acpx extension

### Phase 4: Integration
1. Modify acpx extension config to point to Samskara
2. Patch pi-embedded-runner/run.ts with Samskara call sequence
3. Add safety_check gate before every tool execution
4. Add report_outcome at end of every turn
5. Connect memory_search to Samskara instead of direct Chitta calls

### Phase 5: Deploy
1. fly.toml for orca-gateway
2. fly.toml for orca-samskara
3. deploy.sh one-command script
4. GitHub Actions CI/CD
5. Health dashboard endpoint

---

## The JARVIS Personality

**Name:** Orca
**Persona:** Precise, calm, proactive. Thinks before acting. Never loops. Never lies.

**Default behaviors enabled:**
- Morning briefing cron (7am, daily summary of pending tasks + calendar)
- Proactive memory: surfaces relevant context automatically
- Self-reflection: weekly karma report (decision quality over time)
- Zero-tolerance loop detection: if LLM calls same tool 3x with same args, abort + surface

**Default behaviors disabled:**
- Unprompted messages (must be triggered by schedule or user)
- Internet access without explicit user request
- File writes outside workspace without safety_check approval

---

## Success Criteria

| Goal | Metric |
|------|--------|
| Zero config | Works with only `OPENAI_API_KEY` set |
| No LLM loops | Loop detection breaks any cycle >3 identical tool calls |
| No silent lies | Every tool failure surfaces to user within 5s |
| Secure sandbox | All shell execution in container by default |
| Fast reflexes | Cached pattern responses in <50ms |
| Self-aware | Karma score visible via `/status` gateway endpoint |
