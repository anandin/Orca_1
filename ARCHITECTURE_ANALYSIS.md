# OpenClaw Architecture Analysis: Mapping to Samskara Vision

> **Purpose:** This document analyses the existing OpenClaw codebase
> (`/home/user/openclaw-repo`) and maps each component to the Samskara
> (Vedic Digital Body) product vision. For every concept in the vision,
> we identify what already exists, how closely it maps, what the key
> gaps are, and which files are the entry points for any future work.

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Antahkarana — The Brain](#2-antahkarana--the-brain)
3. [Nadi — The Nervous System](#3-nadi--the-nervous-system)
4. [Jnanendriyas — Knowledge Senses](#4-jnanendriyas--knowledge-senses)
5. [Karmendriyas — Action Organs](#5-karmendriyas--action-organs)
6. [Antarchakshu — The Inner Eye](#6-antarchakshu--the-inner-eye)
7. [Viveka — Discrimination Override](#7-viveka--discrimination-override)
8. [Tanmatra — Signal Format](#8-tanmatra--signal-format)
9. [Signal Modes](#9-signal-modes)
10. [Coverage Summary Table](#10-coverage-summary-table)
11. [Key Implementation Gaps](#11-key-implementation-gaps)
12. [Recommended Adoption Path](#12-recommended-adoption-path)

---

## 1. Repository Overview

| Property | Value |
|---|---|
| **Location** | `/home/user/openclaw-repo` |
| **Language** | TypeScript (strict) |
| **Backend** | Express.js + WebSocket (JSON-RPC 2.0) |
| **Frontend** | Lit web components + Signals |
| **Memory** | SQLite + sqlite-vec (vector), optional LanceDB |
| **Protocol** | ACP (Agent Client Protocol) + MCP bridge via `mcporter` |
| **Source files** | ~5,914 TypeScript/JavaScript files |
| **Core modules** | 54 (`src/`) |
| **Extensions** | 43+ (`extensions/`) |
| **Skills** | 50+ (`skills/`) |
| **Test framework** | Vitest 4.0 |

OpenClaw is a mature, production-ready, multi-platform AI assistant
platform. Its architecture is modular, pluggable, and already contains
clear analogues for most Samskara concepts — but they are expressed in
engineering terms rather than Vedic philosophy terms.

---

## 2. Antahkarana — The Brain

The Antahkarana comprises six subsystems: Chitta, Manas, Buddhi,
Ahamkara, Dharma, and Sanskara.

---

### 2.1 Chitta — Memory Field

**Samskara definition:** Living memory store. Seeds with 9-dimension
contextual fingerprints. pgvector similarity search + Neo4j graph
traversal. Exponential decay (lambda-based). Hebbian activation on
retrieval. Karma feedback evolution.

**OpenClaw mapping: ✅ Exact Match**

OpenClaw has a full memory subsystem with exponential temporal decay,
vector embeddings, hybrid BM25+vector search, and score-based
retrieval. The implementation closely mirrors the Chitta specification.

**Key files:**

| File | Role |
|---|---|
| `src/memory/manager.ts` | `MemoryIndexManager` — core storage abstraction, manages vector embeddings + FTS index + embedding cache |
| `src/memory/temporal-decay.ts` | Exponential decay implementation |
| `src/memory/hybrid.ts` | BM25 + vector hybrid search, MMR diversity re-ranking |
| `src/memory/types.ts` | `MemorySearchResult`, `MemoryProviderStatus` types |
| `extensions/memory-core/` | SQLite + sqlite-vec implementation |
| `extensions/memory-lancedb/` | LanceDB alternative backend |

**Decay implementation** (`src/memory/temporal-decay.ts`):

```ts
export function calculateTemporalDecayMultiplier(params: {
  ageInDays: number;
  halfLifeDays: number;   // default 30 days
}): number {
  const lambda = toDecayLambda(params.halfLifeDays);  // ln(2) / half_life
  const clampedAge = Math.max(0, params.ageInDays);
  if (lambda <= 0 || !Number.isFinite(clampedAge)) return 1;
  return Math.exp(-lambda * clampedAge);
}
```

**Gaps vs Samskara vision:**
- Uses SQLite (not PostgreSQL + pgvector) and has no Neo4j graph layer
- No explicit 9-dimension contextual fingerprint — uses standard
  embedding vectors
- No Hebbian activation (retrieval does not boost seed strength)
- No karma feedback loop from outcomes back to seed weights
- Memory segmented as dated files (`YYYY-MM-DD.md`) + evergreen
  `MEMORY.md`; no explicit "seed" abstraction

**Adoption path:** The decay and vector infrastructure is ready.
To reach full Chitta spec: add a karma score column to the seed table,
implement Hebbian retrieval boost, and add Neo4j for graph traversal.

---

### 2.2 Manas — Reactive Mind

**Samskara definition:** Fast, associative, emotionally honest. Triggers
first on every input. Surfaces fears, desires, patterns, risks. Does
not filter. Tags output as `[FEAR]`, `[DESIRE]`, `[PATTERN]`, `[RISK]`,
`[NOISE]`.

**OpenClaw mapping: ⚠️ Partial Match**

OpenClaw has a reactive auto-reply system and DM classification engine
that handles reflexive decisions — conceptually Manas-like — but
there is no LLM layer that produces emotionally-tagged associative
output before a deliberate reasoning step.

**Key files:**

| File | Role |
|---|---|
| `src/auto-reply/` | Reactive policy-driven message handling |
| `src/discord/monitor/dm-command-decision.ts` | Real-time DM classification: pairing mode vs open mode |
| `src/agents/pi-embedded-helpers.ts` | Fast error pattern classification |

**Gaps:** No explicit "fast LLM pass" that surfaces raw associations
with emotional tags. Manas as a distinct pipeline stage does not exist;
the system goes directly from input to full agent reasoning.

---

### 2.3 Buddhi — Discriminating Intellect

**Samskara definition:** Activates after Manas. Separates signal from
noise. Filters through organisational values/identity. Presents 2-3
options with consequence mapping. Produces single dharmic recommendation.

**OpenClaw mapping: ⚠️ Partial Match**

The tool policy pipeline is a multi-stage discriminating layer that
filters decisions through cascading policy contexts, which is
structurally Buddhi-like. However, it operates on tool selection, not
on reasoning quality or value alignment.

**Key files:**

| File | Role |
|---|---|
| `src/agents/tool-policy-pipeline.ts` | Multi-stage policy pipeline: profile → provider → global → agent |
| `src/agents/tool-policy.ts` | Owner-only restrictions, group membership, plugin allowlists |
| `src/agents/tool-policy-shared.ts` | Tool group definitions: core, plugins, safe, dangerous |

**Tool policy pipeline** (`src/agents/tool-policy-pipeline.ts`):

```ts
export function applyToolPolicyPipeline(params: {
  tools: AnyAgentTool[];
  toolMeta: (tool: AnyAgentTool) => { pluginId: string } | undefined;
  warn: (message: string) => void;
  steps: ToolPolicyPipelineStep[];
}): AnyAgentTool[] {
  let filtered = params.tools;
  for (const step of params.steps) {
    if (!step.policy) continue;
    // Apply discriminating logic at each layer
    filtered = applyToolPolicy({ tools: filtered, policy: step.policy, ... });
  }
  return filtered;
}
```

**Gaps:** Buddhi as specified requires value-aware reasoning (not just
tool filtering), contra-indicator identification, and explicit
consequence mapping. The current pipeline is mechanical, not
philosophical.

---

### 2.4 Ahamkara — Identity

**Samskara definition:** Sense of self. Prior that shapes perception
from the first moment. Colours framing and reasoning. Supports
enterprise and personal brain types.

**OpenClaw mapping: ✅ Exact Match**

OpenClaw has a clean, first-class identity configuration system.
Agent identity is resolved before any processing and injected as a
prior into the agent's context.

**Key files:**

| File | Role |
|---|---|
| `src/agents/identity.ts` | `resolveAgentIdentity()` — per-agent identity resolution |
| `src/signal/identity.ts` | Signal-specific identity: phone/UUID sender, display formatting |

**Identity resolution** (`src/agents/identity.ts`):

```ts
export function resolveAgentIdentity(
  cfg: OpenClawConfig,
  agentId: string,
): IdentityConfig | undefined {
  return resolveAgentConfig(cfg, agentId)?.identity;
}

export function resolveIdentityName(
  cfg: OpenClawConfig,
  agentId: string,
): string | undefined {
  return resolveAgentIdentity(cfg, agentId)?.name?.trim() || undefined;
}
```

Identity fields available: `name`, `emoji`, persona context, channel
prefixes.

**Gaps:** No explicit "company DNA" fields (mission, values, voice,
forbidden phrases). Identity configuration is functional but not
philosophical.

---

### 2.5 Dharma — Constitutional Layer

**Samskara definition:** Hard-stop rules, soft guidance, compliance
constraints. Three action types: block, flag, reshape. Validates every
output before it leaves the brain.

**OpenClaw mapping: ⚠️ Partial Match**

Security policies and ACP dispatch policies form an implicit Dharma
layer. The security audit system produces severity-categorised findings
(critical/warn/info) with remediation suggestions.

**Key files:**

| File | Role |
|---|---|
| `src/acp/policy.ts` | ACP dispatch policy: enabled/disabled state, dispatch guards |
| `src/security/audit.ts` | Security audit: gateway auth posture, sandbox config, dangerous tools |
| `src/agents/sandbox/tool-policy.ts` | Sandbox restrictions: pty guard, root prevention, path guards |

**Security audit type** (`src/security/audit.ts`):

```ts
export type SecurityAuditFinding = {
  checkId: string;
  severity: SecurityAuditSeverity;  // "critical" | "warn" | "info"
  title: string;
  detail: string;
  remediation?: string;
};
```

**Gaps:** No explicit block/flag/reshape output filter. Dharma as
specified intercepts every *output* from the brain and classifies it;
OpenClaw's security layer intercepts *configuration* and *tool
invocations*, not generated text. No "constitutional layer" that
shapes LLM output content.

---

### 2.6 Sanskara — Decision Memory

**Samskara definition:** Every decision logged with full context:
trigger, Manas output, Buddhi output, synthesis, final decision,
eventual outcome. Becomes basis for Pratyaksha reflexes.

**OpenClaw mapping: ⚠️ Partial Match**

Auth profile usage tracking and exec approval management provide
structural analogues, but these are domain-specific (auth decisions,
tool approvals), not general decision-outcome traces.

**Key files:**

| File | Role |
|---|---|
| `src/agents/auth-profiles/usage.ts` | Auth profile decision history: last success, failure counts, cooldown |
| `src/gateway/exec-approval-manager.ts` | Exec approval request logging + decision persistence |
| `src/context-engine/types.ts` | `ingestBatch()`, `compact()` for turn history management |

**Gaps:** No general decision ledger. No outcome tracking (did the
decision produce a good result?). No karma score per decision trace.
No pathway to Pratyaksha (reflex) mode from high-karma Sanskaras.

---

## 3. Nadi — The Nervous System

**Samskara definition:** MCP protocol layer. Routes perception signals
from Jnanendriyas to brain; action intents from brain to Karmendriyas;
outcome reports back for karma. Logs every signal to `nadi_signal_log`.
Detects signal mode. Checks Viveka before learning updates.

**OpenClaw mapping: ⚠️ Partial Match**

The Gateway WebSocket server is the closest analogue — it routes all
signals through a central dispatcher. However, it is not framed as a
Nadi layer, does not log signals with Nadi semantics, and does not
detect or enforce signal modes.

**Key files:**

| File | Role |
|---|---|
| `src/gateway/server.impl.ts` | Core gateway (1,065 lines): WebSocket server, method dispatch, broadcast |
| `src/plugins/types.ts` | Plugin hook system: `gateway_start`, `gateway_stop`, message handlers |
| `extensions/acpx/index.ts` | ACPX Runtime: ACP execution backend, relay parent↔child sessions |
| `extensions/acpx/runtime-internals/mcp-proxy.mjs` | MCP proxy: bridges ACP sessions with MCP servers |
| `src/channels/` | Channel adapters (33 platform integrations) |

**Protocol:** JSON-RPC 2.0 over WebSocket. All method calls follow the
pattern `{domain}.{action}` (e.g. `chat.send`, `agent.start`).

**Gateway request context** (`src/gateway/server.impl.ts`):

```ts
const gatewayRequestContext = {
  deps,
  cron,
  execApprovalManager,
  broadcast,
  broadcastToConnIds,
  nodeSendToSession,
  nodeSendToAllSubscribed,
  nodeSubscribe,
  nodeUnsubscribe,
  ...
};
```

**MCP integration:** Not first-class. MCP servers connect via the
`mcporter` bridge in the `acpx` extension. This is a decoupled proxy
pattern — MCP tools are injected into ACP session bootstraps without
modifying the core runtime.

**Gaps:**
- No `nadi_signal_log` table or equivalent structured signal log
- No signal mode detection before routing
- No Viveka check integrated into the routing layer
- MCP is a bridge, not the primary protocol
- No `consult` / `ingest` / `report_outcome` channel semantics

---

## 4. Jnanendriyas — Knowledge Senses

### 4.1 Shrotra — Ear (Audio/Voice)

**OpenClaw mapping: ✅ Implemented**

Voice transcription, TTS synthesis, voice wake, and voice call
channels all exist.

**Key files:** `src/media-understanding/`, `src/nodes/voice/`,
`extensions/voice-talk/`, `extensions/voice-call/`

---

### 4.2 Chakshu — Eye (Visual)

**OpenClaw mapping: ✅ Implemented**

Image understanding, browser screenshots, Canvas A2UI host, and
document rendering are all present.

**Key files:** `src/browser/`, `src/canvas-host/`, `src/media-understanding/`

---

### 4.3 Sparsha — Touch (Direct Interaction)

**OpenClaw mapping: ✅ Implemented**

Direct state queries (health, presence, approval queue), structured
API calls, and the control UI all form the Sparsha layer.

**Key files:** `src/gateway/server/health-state.ts`,
`src/gateway/server-methods/health.ts`

---

### 4.4 Rasana — Taste (Evaluation/Quality Scoring)

**OpenClaw mapping: ✅ Implemented**

Memory scoring uses a hybrid BM25 + vector similarity pipeline with
MMR diversity re-ranking. This is a functional quality/relevance
evaluation layer.

**Key files:** `src/memory/hybrid.ts`

**BM25 scoring** (`src/memory/hybrid.ts`):

```ts
export function bm25RankToScore(rank: number): number {
  if (!Number.isFinite(rank)) return 1 / (1 + 999);
  if (rank < 0) {
    const relevance = -rank;
    return relevance / (1 + relevance);
  }
  return 1 / (1 + rank);
}
```

---

### 4.5 Ghrana — Smell (Anomaly/Pattern Detection)

**OpenClaw mapping: ⚠️ Partial Match**

Error classification and failover detection exist, but these are
reactive (triggered by failures), not proactive pattern monitoring.

**Key files:** `src/agents/pi-embedded-helpers.ts`,
`src/agents/failover-error.ts`

**Error classification:**

```ts
export function isAuthAssistantError(error: unknown): boolean { ... }
export function isBillingAssistantError(error: unknown): boolean { ... }
export function isRateLimitAssistantError(error: unknown): boolean { ... }
```

**Gaps:** No proactive anomaly detection (trend alerts, karma drift
detection, ossification monitoring). Ghrana needs to watch for
patterns that haven't yet caused failures.

---

## 5. Karmendriyas — Action Organs

All Karmendriyas follow the enforced pipeline:
**Intent → Plan → Execute → Verify → Report**

### 5.1 Vak — Speech (Communication)

**OpenClaw mapping: ✅ Implemented**

Message sending with identity prefixes, markdown rendering, and
channel-specific encoding.

**Key files:** `src/signal/send.ts`, `src/infra/outbound/deliver.ts`

**Gaps:** No explicit Tanmatra → human-readable translation step.

---

### 5.2 Pani — Hands (Manipulation)

**OpenClaw mapping: ✅ Implemented**

Exec tools, file manipulation, cron creation, state mutations.

**Key files:** `src/agents/bash-tools.exec.ts`,
`src/agents/tools/cron-tool.ts`

---

### 5.3 Pada — Feet (Navigation)

**OpenClaw mapping: ✅ Implemented**

Browser navigation, DOM traversal, context switching between domains.

**Key files:** `src/agents/tools/browser-tool.ts`

---

### 5.4 Payu — Elimination (Cleanup)

**OpenClaw mapping: ⚠️ Partial Match**

Media TTL cleanup, session garbage collection, and dedup cleanup exist.

**Key files:** `src/gateway/server.impl.ts` (lines 705-724)

```ts
const mediaCleanupTimer = setInterval(() => {
  cleanupExpiredMedia(deps.mediaDir, resolveMediaCleanupTtlMs(cfg));
}, MEDIA_CLEANUP_INTERVAL_MS);
```

**Gaps:** No knowledge/seed cleanup (removing stale or quarantined
seeds). No karma-driven archival logic.

---

### 5.5 Upastha — Creation (Generation)

**OpenClaw mapping: ✅ Implemented**

Sub-agent spawning, session creation, cron job creation, Canvas A2UI
generation.

**Key files:** `src/agents/acp-spawn.ts`

**ACP spawn** (`src/agents/acp-spawn.ts`):

```ts
export type SpawnAcpParams = {
  task: string;
  label?: string;
  agentId?: string;
  cwd?: string;
  mode?: SpawnAcpMode;
  thread?: boolean;
  sandbox?: SpawnAcpSandboxMode;
  streamTo?: SpawnAcpStreamTarget;
};
```

---

### 5.6 Enforced Pipeline Verification

**OpenClaw mapping: ⚠️ Partial Match**

The ACP spawn system has rollback on failure (`cleanupFailedAcpSpawn`),
and exec approval requires human confirmation before execution. This
covers Intent → Plan → Execute partially.

**Gaps:** No formal Verify → Report pipeline. Outcome reports do not
feed back into a karma system. The five-stage pipeline is not enforced
as a pattern across all action organs.

---

## 6. Antarchakshu — The Inner Eye

**Samskara definition:** Observes all Nadi traffic. Translates compact
Tanmatra signals to human-readable narratives. Monitors learning health:
karma drift, ossification detection, contradiction identification.
Produces health score (0-100).

**OpenClaw mapping: ⚠️ Partial Match**

The gateway health state system provides real-time operational health
(channel status, approval queues, node presence). The context engine
provides signal translation (message compaction/assembly). Neither
monitors *learning health*.

**Key files:**

| File | Role |
|---|---|
| `src/gateway/server/health-state.ts` | Real-time health aggregation: channels, nodes, approval queues |
| `src/context-engine/types.ts` | Context assembly, compaction, message translation |
| `src/security/audit.ts` | Security posture audit (closest to self-reflection) |

**Health state** (`src/gateway/server/health-state.ts`):
Tracks `channelStatus`, `approvalQueueSize`, `nodePresence`, and
cache versioning for efficient broadcast.

**Context engine interface** (`src/context-engine/types.ts`):

```ts
interface ContextEngine {
  ingest(params: { sessionId: string; message: AgentMessage }): Promise<IngestResult>;
  assemble(params: {
    sessionId: string;
    messages: AgentMessage[];
    tokenBudget?: number;
  }): Promise<AssembleResult>;
  compact(params: { sessionId: string; tokenBudget?: number; force?: boolean }): Promise<CompactResult>;
}
```

**Gaps:**
- No karma trend monitoring per domain
- No Pratyaksha-to-Savikalpa ratio tracking
- No contradiction detection across outcomes
- No overall learning health score
- No self-reflection report generation

---

## 7. Viveka — Discrimination Override

**Samskara definition:** Master safety kill switch. Global learning
toggle, karma-only toggle, reflex formation toggle, seed ingestion
toggle, per-domain freeze, seed quarantine, karma snapshot, karma
rollback.

**OpenClaw mapping: ⚠️ Partial Match**

Security audit, DM pairing policies, and sandbox restrictions form a
partial Viveka. The pairing system provides implicit quarantine of
unknown senders.

**Key files:**

| File | Role |
|---|---|
| `src/security/audit.ts` | Security posture analysis with severity-graded findings |
| `src/discord/monitor/dm-command-decision.ts` | DM pairing: implicit sender quarantine |
| `src/agents/sandbox/tool-policy.ts` | Sandbox restrictions |
| `src/config/config.ts` | Feature flags (implicit learning toggles) |

**Coverage by Viveka control:**

| Viveka Control | OpenClaw Status | Notes |
|---|---|---|
| Global learning toggle | ❌ Missing | No explicit on/off for learning |
| Karma updates toggle | ❌ Missing | No karma system yet |
| Reflex formation toggle | ❌ Missing | No reflex system yet |
| Seed ingestion toggle | ❌ Missing | Memory ingestion always on |
| Domain freeze | ❌ Missing | No domain-level learning freeze |
| Seed quarantine | ⚠️ Partial | Pairing system quarantines *senders*, not seeds |
| Karma snapshot | ❌ Missing | No karma snapshots |
| Karma rollback | ⚠️ Partial | Spawn-level rollback only (`cleanupFailedAcpSpawn`) |

**Viveka + Feedback Interaction** (deferred feedback when blocked):
Not implemented. Feedback is not stored with `karmaApplied = false`;
there is no deferred application mechanism.

---

## 8. Tanmatra — Signal Format

**Samskara definition:** Compact, machine-optimised internal signal
format. Not human-readable. Translated by Antarchakshu on demand.

**OpenClaw mapping: ❌ Missing**

OpenClaw uses standard JSON throughout. All internal and external
signals are verbose JSON objects over WebSocket. There is no compact
internal signal format.

**Nearest analogue:** The gateway JSON-RPC message envelope is
structured but not compact.

**Implementation note:** For the Samskara vision, Tanmatra would need
to be defined as a typed schema (potentially using msgpack or a compact
JSON subset) and all Nadi routing would use it. Antarchakshu would
hold the translation layer. This is a new component with no current
analogue.

---

## 9. Signal Modes

**Samskara definition:**
- **Pratyaksha** — Reflex: known pattern, direct seed match, no LLM
- **Avyakta** — Subconscious: routine, minimal LLM, Manas only
- **Savikalpa** — Conscious: novel/complex, full ATMAN pipeline

**OpenClaw mapping: ❌ Missing (implicit analogues only)**

Signal mode classification does not exist as a formal system. However,
functional equivalents exist implicitly:

| Signal Mode | Implicit OpenClaw Equivalent | Status |
|---|---|---|
| Pratyaksha (Reflex) | Auto-reply system, DM decision logic | Implicit only |
| Avyakta (Subconscious) | Cron jobs, background heartbeat, scheduled tasks | Implicit only |
| Savikalpa (Conscious) | Full agent tool execution with LLM reasoning | Implicit only |

**Gap:** No signal mode tag is attached to any request. No routing
decision is made based on the estimated cognitive load of a request.
No Pratyaksha-to-Savikalpa ratio is tracked.

---

## 10. Coverage Summary Table

| Samskara Component | OpenClaw Mapping | Coverage | Key File(s) |
|---|---|---|---|
| **Chitta** (Memory) | Memory manager + temporal decay | ✅ Exact | `src/memory/manager.ts`, `src/memory/temporal-decay.ts` |
| **Manas** (Reactive Mind) | Auto-reply system | ⚠️ Partial | `src/auto-reply/` |
| **Buddhi** (Intellect) | Tool policy pipeline | ⚠️ Partial | `src/agents/tool-policy-pipeline.ts` |
| **Ahamkara** (Identity) | Agent identity config | ✅ Exact | `src/agents/identity.ts` |
| **Dharma** (Rules) | Security policies, ACP policy | ⚠️ Partial | `src/acp/policy.ts`, `src/security/audit.ts` |
| **Sanskara** (Decisions) | Auth usage + approval records | ⚠️ Partial | `src/agents/auth-profiles/usage.ts` |
| **Nadi** (Nervous System) | Gateway WebSocket dispatcher | ⚠️ Partial | `src/gateway/server.impl.ts` |
| **MCP Protocol** | `mcporter` bridge via ACPX | ⚠️ Partial | `extensions/acpx/runtime-internals/mcp-proxy.mjs` |
| **Signal modes** | Implicit (no classification) | ❌ Missing | — |
| **Shrotra** (Audio) | Voice transcription + TTS | ✅ Implemented | `src/media-understanding/` |
| **Chakshu** (Visual) | Image + Canvas + browser | ✅ Implemented | `src/browser/`, `src/canvas-host/` |
| **Sparsha** (Direct) | Health queries + control API | ✅ Implemented | `src/gateway/server/health-state.ts` |
| **Rasana** (Evaluation) | BM25 + vector memory scoring | ✅ Implemented | `src/memory/hybrid.ts` |
| **Ghrana** (Anomaly) | Error classification (reactive) | ⚠️ Partial | `src/agents/pi-embedded-helpers.ts` |
| **Vak** (Speech/Output) | Message sending + formatting | ✅ Implemented | `src/signal/send.ts` |
| **Pani** (Manipulation) | Exec tools, file ops | ✅ Implemented | `src/agents/bash-tools.exec.ts` |
| **Pada** (Navigation) | Browser tool | ✅ Implemented | `src/agents/tools/browser-tool.ts` |
| **Payu** (Cleanup) | Media/session TTL cleanup | ⚠️ Partial | `src/gateway/server.impl.ts` |
| **Upastha** (Creation) | ACP spawn, session creation | ✅ Implemented | `src/agents/acp-spawn.ts` |
| **Antarchakshu** (Inner Eye) | Health monitoring + context engine | ⚠️ Partial | `src/gateway/server/health-state.ts` |
| **Viveka** (Safety) | Security audit + sandbox | ⚠️ Partial | `src/security/audit.ts` |
| **Tanmatra** (Format) | Standard JSON (no compact format) | ❌ Missing | — |

**Overall alignment: ~70%**
- ✅ Exact/Implemented: 9 components
- ⚠️ Partial: 11 components
- ❌ Missing: 3 components (signal modes, Tanmatra, full Viveka controls)

---

## 11. Key Implementation Gaps

Listed in priority order (highest value / lowest risk first):

### Gap 1: Sanskara — Decision Ledger with Karma

**What's missing:** A general decision-outcome trace log. Currently
only auth decisions and tool approvals are logged; there is no record
of what the agent decided, what action it took, and whether that action
produced a good outcome.

**Impact:** Without this, Pratyaksha (reflex) mode, karma feedback,
and Viveka rollback are all impossible.

**Implementation approach:**
1. Add a `decision_log` table: `{id, session_id, trigger_hash, manas_output, buddhi_output, final_decision, timestamp}`
2. Add an `outcome_log` table: `{decision_id, outcome_type (positive/negative/neutral), karma_delta, timestamp}`
3. Connect `report_outcome` channel in Nadi to update this table
4. Add EMA-based karma score per seed/decision type

**Entry point:** `src/agents/auth-profiles/usage.ts` (extend this
pattern to general decisions), `src/context-engine/types.ts`
(add outcome reporting hook)

---

### Gap 2: Signal Mode Classification (Pratyaksha/Avyakta/Savikalpa)

**What's missing:** Before routing any signal through the gateway,
classify it as reflex / subconscious / conscious based on karma
scores and pattern familiarity.

**Impact:** Without this, every request pays full LLM cost even when
a high-confidence cached answer exists. Also blocks Antarchakshu from
monitoring the reflex-to-conscious ratio.

**Implementation approach:**
1. Add signal mode detection step in the gateway dispatcher (before
   method handlers run)
2. Check Sanskara for matching high-karma decision traces
3. Tag each request with `{ mode: "pratyaksha" | "avyakta" | "savikalpa" }`
4. Log mode tag to signal log
5. Route Pratyaksha requests directly to seed retrieval, bypass LLM

**Entry point:** `src/gateway/server.impl.ts` (main dispatch function)

---

### Gap 3: Viveka — Learning Toggles and Domain Freeze

**What's missing:** Explicit controls to freeze learning at global,
domain, or seed level. Currently there is no way to stop the system
from ingesting new memories or applying karma updates.

**Impact:** Safety guarantees are impossible without these controls.
Antarchakshu can detect karma drift, but there is nothing to act on
that detection.

**Implementation approach:**
1. Add `viveka_config` table: `{scope (global/domain/seed), freeze_type (all/karma/seeds/reflexes), active, reason, created_at}`
2. Add Viveka check to the Nadi routing layer (before `ingest` and
   `report_outcome` channels)
3. Implement seed quarantine: `quarantined` flag on seeds, excluded
   from retrieval but visible in admin
4. Implement karma snapshot: point-in-time copy of all karma scores
5. Implement karma rollback: restore from snapshot

**Entry point:** New module `src/viveka/` — integrate into
`src/gateway/server.impl.ts` dispatch layer

---

### Gap 4: Antarchakshu — Learning Health Monitoring

**What's missing:** Self-reflection on the learning system. Karma
drift detection, ossification monitoring, contradiction identification,
and a health score.

**Impact:** Without Antarchakshu, operators have no visibility into
*how* the brain is learning — only *whether* it is running. Karma
drift and Sanskara ossification go undetected.

**Implementation approach:**
1. Add a background cron job (`node-cron`) that runs learning health
   assessments periodically
2. Query karma score distributions per domain — detect uniform drift
3. Query Pratyaksha-to-Savikalpa ratio from signal log — detect
   autopilot mode
4. Query decisions with similar triggers but opposite outcomes —
   detect contradictions
5. Produce a health report: overall score (0-100), domain breakdown,
   specific warnings, suggested Viveka actions

**Entry point:** `src/cron/` (add new cron job), query
`decision_log` + `outcome_log` tables

---

### Gap 5: Dharma — Output Filter

**What's missing:** A constitutional layer that intercepts LLM output
*before* it is sent to the action organ. Currently, security policies
filter tool invocations but not generated text.

**Impact:** Brand/compliance violations, sensitive disclosures, and
tone failures are undetectable at the brain layer.

**Implementation approach:**
1. Add a Dharma validation step in the agent response pipeline
2. Support three action types: `block` (suppress output), `flag`
   (log + alert, allow), `reshape` (LLM rewrite through a constraint
   prompt)
3. Load Dharma rules from agent identity config (same layer as Ahamkara)

**Entry point:** Agent response pipeline, after LLM completion and
before delivery to `src/infra/outbound/deliver.ts`

---

### Gap 6: Manas — Fast Associative Layer

**What's missing:** A dedicated fast LLM pass that produces raw
associative output (fears, desires, patterns, risks) before Buddhi's
deliberate analysis.

**Impact:** Buddhi currently operates without Manas input. This means
the system skips the "emotionally honest" phase and goes directly to
filtered analysis, potentially missing signals that only surface with
unfiltered association.

**Implementation approach:**
1. Add a Manas prompt template: "Given this input, surface ALL
   associations — fears, desires, patterns, risks, noise — without
   filtering. Tag each with [FEAR], [DESIRE], [PATTERN], [RISK],
   [NOISE]."
2. Run Manas as a fast, cheap LLM call (small model, minimal context)
3. Pass Manas output as additional context to Buddhi
4. Store both in the decision log

**Entry point:** Agent execution pipeline (between input receipt and
full reasoning), `src/agents/`

---

### Gap 7: Tanmatra — Compact Signal Format

**What's missing:** A typed, compact internal signal representation
that replaces ad-hoc JSON in Nadi routing.

**Impact:** Medium-term efficiency concern. Low priority for initial
Samskara implementation.

**Implementation approach:**
1. Define a `Tanmatra` TypeScript interface with `modality`, `raw`,
   `processed` fields
2. Wrap all Nadi-routed signals in this format
3. Antarchakshu holds the translation function to human-readable
   narratives
4. Consider msgpack serialisation for high-frequency signal paths

**Entry point:** New type in `src/types/tanmatra.ts`, adopt in
`src/gateway/server.impl.ts`

---

## 12. Recommended Adoption Path

The following phased plan maps OpenClaw to the full Samskara vision
with minimal disruption to the existing codebase.

### Phase 1 — Foundational Learning Layer (prerequisite for everything else)

1. Define `Tanmatra` signal type
2. Add `decision_log` and `outcome_log` tables (Sanskara)
3. Implement `report_outcome` channel in the gateway (Nadi)
4. Connect outcome reports to seed karma updates (Chitta karma feedback)
5. Add karma score column to memory seeds

**Unlocks:** Karma system, Viveka controls, Antarchakshu monitoring

---

### Phase 2 — Signal Intelligence

1. Implement signal mode detection (Pratyaksha/Avyakta/Savikalpa) in
   the gateway dispatcher
2. Add Pratyaksha routing: high-karma Sanskara match → bypass LLM
3. Log signal mode with every request
4. Add Manas fast-pass LLM step before full reasoning

**Unlocks:** LLM cost reduction, reflex mode, Antarchakshu ratio
monitoring

---

### Phase 3 — Safety Layer (Viveka + Dharma)

1. Implement Viveka config table and check in Nadi routing
2. Implement seed quarantine
3. Implement karma snapshot and rollback
4. Implement Dharma output filter (block/flag/reshape)
5. Extend Ahamkara identity config with company DNA fields

**Unlocks:** Full operator control over learning, compliance
guarantees, safety lockdown

---

### Phase 4 — Self-Reflection (Antarchakshu)

1. Add background learning health cron job
2. Implement karma drift detection per domain
3. Implement Pratyaksha ossification detection
4. Implement contradiction identification across outcomes
5. Add learning health score API endpoint and admin UI panel

**Unlocks:** Full observability, proactive safety warnings, health
reporting

---

### Phase 5 — Full Jnanendriya Pipeline

1. Formalise Shrotra, Chakshu, Sparsha, Rasana, Ghrana as typed Nadi
   channels with standard lifecycle (Perceive → Consult → Feed → Report)
2. Upgrade Ghrana from reactive error detection to proactive anomaly
   monitoring
3. Enforce Karmendriya pipeline: Intent → Plan → Execute → Verify →
   Report for all action organs

**Unlocks:** Full Vedic Digital Body architecture

---

*Analysis generated: 2026-03-10*
*Source codebase: `/home/user/openclaw-repo`*
*Target vision: Samskara — Brain-as-a-Service for the Enterprise*
