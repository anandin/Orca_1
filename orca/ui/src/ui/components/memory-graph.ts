/**
 * memory-graph — Obsidian-style force-directed canvas graph of Samskara memory nodes.
 * Uses Canvas 2D — no external dependencies.
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { SamskaraUIClient, MemoryNode } from "../data/samskara-client.ts";

type GraphNode = MemoryNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

type GraphEdge = {
  source: GraphNode;
  target: GraphNode;
};

const TAG_COLORS = [
  "#8B5CF6",
  "#2A7F8F",
  "#5A8A6B",
  "#D4A017",
  "#E8620A",
  "#5C58CC",
];

@customElement("memory-graph")
export class MemoryGraph extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .graph-header {
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    canvas {
      flex: 1;
      width: 100%;
      cursor: pointer;
      display: block;
    }
    .node-detail {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      line-height: 1.6;
      max-height: 120px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .node-detail__score {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
    }
    .empty-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
      padding: 24px;
    }
    .refresh-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .refresh-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
  `;

  @property({ attribute: false }) samskaraClient?: SamskaraUIClient;

  @state() private nodes: GraphNode[] = [];
  @state() private edges: GraphEdge[] = [];
  @state() private loading = false;
  @state() private selectedNode: GraphNode | null = null;

  private canvas?: HTMLCanvasElement;
  private animFrame?: number;
  private pollTimer?: ReturnType<typeof setInterval>;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.pollTimer = setInterval(() => void this.load(), 60_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private async load() {
    if (!this.samskaraClient || this.loading) return;
    this.loading = true;
    try {
      const result = await this.samskaraClient.memorySearch("", 20);
      const rawNodes = result.results ?? [];
      this.buildGraph(rawNodes);
    } catch {
      // Silently fail
    } finally {
      this.loading = false;
    }
  }

  private buildGraph(rawNodes: MemoryNode[]) {
    const w = this.canvas?.clientWidth ?? 280;
    const h = this.canvas?.clientHeight ?? 200;

    const graphNodes: GraphNode[] = rawNodes.map((n) => ({
      ...n,
      x: w * 0.1 + Math.random() * w * 0.8,
      y: h * 0.1 + Math.random() * h * 0.8,
      vx: 0,
      vy: 0,
      radius: 6 + (n.score ?? 0.5) * 12,
    }));

    // Edges between nodes that share tags
    const edges: GraphEdge[] = [];
    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const tagsA = graphNodes[i].tags ?? [];
        const tagsB = graphNodes[j].tags ?? [];
        const shared = tagsA.some((t) => tagsB.includes(t));
        if (shared) {
          edges.push({ source: graphNodes[i], target: graphNodes[j] });
        }
      }
    }

    this.nodes = graphNodes;
    this.edges = edges;
    this.startSimulation();
  }

  private startSimulation() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    let ticks = 0;

    const tick = () => {
      this.simulate();
      this.draw();
      ticks++;
      if (ticks < 200) {
        this.animFrame = requestAnimationFrame(tick);
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  private simulate() {
    const nodes = this.nodes;
    const alpha = 0.05;
    const w = this.canvas?.clientWidth ?? 280;
    const h = this.canvas?.clientHeight ?? 200;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (60 * 60) / (dist * dist);
        const fx = (dx / dist) * force * alpha;
        const fy = (dy / dist) * force * alpha;
        nodes[i].vx += fx;
        nodes[i].vy += fy;
        nodes[j].vx -= fx;
        nodes[j].vy -= fy;
      }
    }

    // Attraction along edges
    for (const edge of this.edges) {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 80) * 0.01 * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      edge.source.vx += fx;
      edge.source.vy += fy;
      edge.target.vx -= fx;
      edge.target.vy -= fy;
    }

    // Apply velocities + dampen + bounds
    for (const n of nodes) {
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x = Math.max(n.radius, Math.min(w - n.radius, n.x + n.vx));
      n.y = Math.max(n.radius, Math.min(h - n.radius, n.y + n.vy));
    }
  }

  private draw() {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Resize canvas for pixel density
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    // Draw edges
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (const edge of this.edges) {
      ctx.beginPath();
      ctx.moveTo(edge.source.x, edge.source.y);
      ctx.lineTo(edge.target.x, edge.target.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const [i, node] of this.nodes.entries()) {
      const color = TAG_COLORS[i % TAG_COLORS.length];
      const isSelected = this.selectedNode?.id === node.id;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      if (isSelected) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = color + (isSelected ? "ff" : "cc");
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.strokeStyle = "#ffffff44";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private handleCanvasClick(event: MouseEvent) {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hit = this.nodes.find((n) => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });

    this.selectedNode = hit ?? null;
    this.draw();
    this.requestUpdate();
  }

  protected firstUpdated() {
    this.canvas = this.renderRoot.querySelector("canvas") ?? undefined;
    if (this.nodes.length > 0) {
      this.draw();
    }
  }

  render() {
    return html`
      <div class="graph-header">
        <span>Memory map</span>
        <button
          class="refresh-btn"
          @click=${() => this.load()}
          ?disabled=${this.loading}
          title="Refresh memories"
        >
          ${this.loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      ${
        this.nodes.length === 0 && !this.loading
          ? html`<div class="empty-state">
              No memories yet.<br />
              <small>Your assistant's memory will appear here.</small>
            </div>`
          : html`<canvas @click=${(e: MouseEvent) => this.handleCanvasClick(e)}></canvas>`
      }
      ${
        this.selectedNode
          ? html`
              <div class="node-detail">
                <div>${this.selectedNode.content}</div>
                <div class="node-detail__score">
                  Score: ${(this.selectedNode.score * 100).toFixed(0)}%
                  ${this.selectedNode.tags?.length ? ` · ${this.selectedNode.tags.join(", ")}` : ""}
                </div>
              </div>
            `
          : nothing
      }
    `;
  }
}

// needed for the template
import { nothing } from "lit";

declare global {
  interface HTMLElementTagNameMap {
    "memory-graph": MemoryGraph;
  }
}
