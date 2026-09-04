/**
 * Unit tests for workforce policy primitives.
 * These test the pure logic of cycle detection, state machine transitions,
 * and validation helpers without needing a live database.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Cycle detection (BFS) — extracted logic mirroring detectDelegationCycle
// ---------------------------------------------------------------------------

function detectCycleBFS(
  edges: Array<[string, string]>,  // [manager, subordinate]
  proposedManager: string,
  proposedSubordinate: string,
): boolean {
  // Build adjacency from subordinate → manager
  const upward = new Map<string, string[]>();
  for (const [mgr, sub] of edges) {
    if (!upward.has(sub)) upward.set(sub, []);
    upward.get(sub)!.push(mgr);
  }

  // BFS: starting from proposedManager, walk upward; if we reach proposedSubordinate, cycle
  const visited = new Set<string>();
  const queue = [proposedManager];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === proposedSubordinate) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const parent of upward.get(current) ?? []) {
      queue.push(parent);
    }
  }
  return false;
}

describe("detectDelegationCycle (BFS)", () => {
  it("returns false for a clean hierarchy with no cycle", () => {
    const edges: Array<[string, string]> = [
      ["chief_orchestrator", "strategy_director"],
      ["strategy_director", "content_director"],
    ];
    expect(detectCycleBFS(edges, "strategy_director", "content_director")).toBe(false);
  });

  it("returns true when proposing a delegation that creates a direct cycle", () => {
    const edges: Array<[string, string]> = [
      ["content_director", "strategy_director"],
    ];
    // proposedManager=strategy_director, proposedSubordinate=content_director
    // Walking upward from strategy_director → content_director ← that IS the proposed sub → cycle
    expect(detectCycleBFS(edges, "strategy_director", "content_director")).toBe(true);
  });

  it("returns true for transitive cycle (A→B→C and proposing C→A)", () => {
    const edges: Array<[string, string]> = [
      ["A", "B"],
      ["B", "C"],
    ];
    // Proposing C as manager of A: walk up from C → B → A → found A (proposedSub) → cycle
    expect(detectCycleBFS(edges, "C", "A")).toBe(true);
  });

  it("returns false for parallel branches with no cycle", () => {
    const edges: Array<[string, string]> = [
      ["root", "branchA"],
      ["root", "branchB"],
      ["branchA", "leafA1"],
    ];
    expect(detectCycleBFS(edges, "branchB", "leafA2")).toBe(false);
  });

  it("self-delegation is a trivial cycle", () => {
    const edges: Array<[string, string]> = [];
    // proposedManager === proposedSubordinate
    expect(detectCycleBFS(edges, "agent_x", "agent_x")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Workflow state machine transitions
// ---------------------------------------------------------------------------

type WorkflowStatus =
  | "draft" | "queued" | "running" | "awaiting_customer_input"
  | "awaiting_approval" | "blocked" | "completed" | "failed" | "cancelled";

const WORKFLOW_TERMINAL: Set<WorkflowStatus> = new Set(["completed", "failed", "cancelled"]);
const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft:                    ["queued", "cancelled"],
  queued:                   ["running", "cancelled"],
  running:                  ["awaiting_customer_input", "awaiting_approval", "blocked", "completed", "failed", "cancelled"],
  awaiting_customer_input:  ["running", "cancelled"],
  awaiting_approval:        ["running", "cancelled"],
  blocked:                  ["running", "failed", "cancelled"],
  completed:                [],
  failed:                   [],
  cancelled:                [],
};

function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (WORKFLOW_TERMINAL.has(from)) return false;
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

describe("Workflow state machine", () => {
  it("allows draft → queued", () => expect(canTransition("draft", "queued")).toBe(true));
  it("allows queued → running", () => expect(canTransition("queued", "running")).toBe(true));
  it("allows running → completed", () => expect(canTransition("running", "completed")).toBe(true));
  it("allows running → awaiting_approval", () => expect(canTransition("running", "awaiting_approval")).toBe(true));
  it("allows awaiting_approval → running", () => expect(canTransition("awaiting_approval", "running")).toBe(true));
  it("disallows completed → running (terminal)", () => expect(canTransition("completed", "running")).toBe(false));
  it("disallows failed → queued (terminal)", () => expect(canTransition("failed", "queued")).toBe(false));
  it("disallows draft → completed (no direct edge)", () => expect(canTransition("draft", "completed")).toBe(false));
  it("disallows queued → awaiting_approval (must go through running)", () =>
    expect(canTransition("queued", "awaiting_approval")).toBe(false));
});

// ---------------------------------------------------------------------------
// Task state machine transitions
// ---------------------------------------------------------------------------

type TaskStatus =
  | "created" | "queued" | "claimed" | "running"
  | "awaiting_handoff_acceptance" | "awaiting_approval"
  | "retry_scheduled" | "blocked" | "completed" | "failed" | "cancelled" | "expired";

const TASK_TERMINAL: Set<TaskStatus> = new Set(["completed", "failed", "cancelled", "expired"]);
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  created:                     ["queued", "cancelled"],
  queued:                      ["claimed", "cancelled"],
  claimed:                     ["running", "cancelled"],
  running:                     ["awaiting_handoff_acceptance", "awaiting_approval", "retry_scheduled", "blocked", "completed", "failed", "cancelled"],
  awaiting_handoff_acceptance: ["running", "cancelled", "failed"],
  awaiting_approval:           ["queued", "cancelled"],
  retry_scheduled:             ["queued", "failed", "cancelled"],
  blocked:                     ["running", "failed", "cancelled"],
  completed:                   [],
  failed:                      [],
  cancelled:                   [],
  expired:                     [],
};

function canTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (TASK_TERMINAL.has(from)) return false;
  return TASK_TRANSITIONS[from].includes(to);
}

describe("Task state machine", () => {
  it("allows created → queued", () => expect(canTaskTransition("created", "queued")).toBe(true));
  it("allows queued → claimed", () => expect(canTaskTransition("queued", "claimed")).toBe(true));
  it("allows running → awaiting_handoff_acceptance", () => expect(canTaskTransition("running", "awaiting_handoff_acceptance")).toBe(true));
  it("allows awaiting_approval → queued (approval granted)", () => expect(canTaskTransition("awaiting_approval", "queued")).toBe(true));
  it("allows retry_scheduled → queued", () => expect(canTaskTransition("retry_scheduled", "queued")).toBe(true));
  it("disallows completed → running", () => expect(canTaskTransition("completed", "running")).toBe(false));
  it("disallows expired → queued", () => expect(canTaskTransition("expired", "queued")).toBe(false));
  it("disallows created → completed (must progress through states)", () => expect(canTaskTransition("created", "completed")).toBe(false));
});

// ---------------------------------------------------------------------------
// Approval expiry logic
// ---------------------------------------------------------------------------

function isApprovalExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < now.getTime();
}

describe("Approval expiry", () => {
  it("returns false when expiresAt is null (no expiry)", () => {
    expect(isApprovalExpired(null)).toBe(false);
  });

  it("returns false when expiry is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isApprovalExpired(future)).toBe(false);
  });

  it("returns true when expiry is in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isApprovalExpired(past)).toBe(true);
  });

  it("returns true at exact expiry boundary (millisecond past)", () => {
    const now = new Date(1_700_000_000_000);
    const atExpiry = new Date(now.getTime() - 1).toISOString();
    expect(isApprovalExpired(atExpiry, now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Delegation depth enforcement
// ---------------------------------------------------------------------------

function exceedsDelegationDepth(currentDepth: number, maxDepth: number): boolean {
  return currentDepth >= maxDepth;
}

describe("Delegation depth enforcement", () => {
  it("allows delegation at depth 0 with max_depth 3", () => {
    expect(exceedsDelegationDepth(0, 3)).toBe(false);
  });

  it("allows delegation at depth 2 with max_depth 3", () => {
    expect(exceedsDelegationDepth(2, 3)).toBe(false);
  });

  it("blocks delegation at depth 3 with max_depth 3", () => {
    expect(exceedsDelegationDepth(3, 3)).toBe(true);
  });

  it("blocks delegation at depth 5 with max_depth 3", () => {
    expect(exceedsDelegationDepth(5, 3)).toBe(true);
  });

  it("with max_depth 1 only allows immediate delegation", () => {
    expect(exceedsDelegationDepth(0, 1)).toBe(false);
    expect(exceedsDelegationDepth(1, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotency key deduplication guard
// ---------------------------------------------------------------------------

function wouldConflict(
  existingKeys: Set<string | null>,
  proposed: string | null,
): boolean {
  if (proposed === null) return false; // nulls are not distinct per DB constraint
  return existingKeys.has(proposed);
}

describe("Idempotency key conflict detection", () => {
  it("returns false for null key (nulls are not distinct in DB, always allowed)", () => {
    expect(wouldConflict(new Set([null]), null)).toBe(false);
  });

  it("returns false for a new unique key", () => {
    expect(wouldConflict(new Set(["key-A"]), "key-B")).toBe(false);
  });

  it("returns true when the same key already exists", () => {
    expect(wouldConflict(new Set(["key-A", "key-B"]), "key-A")).toBe(true);
  });
});
