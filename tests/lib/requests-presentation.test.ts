import { describe, expect, it } from "vitest";
import {
  createMemberLabelMap,
  formatDateOnly,
  memberDisplayName,
  requestActivityMessage,
  requestLabel,
  sortRequests,
} from "@/lib/requests/presentation";

const labels = createMemberLabelMap([
  { user_id: "alex", display_name: "Alex", role: "operator" },
  { user_id: "sam", display_name: "Sam", role: "admin" },
]);

describe("request presentation", () => {
  it("uses readable labels and UTC date formatting", () => {
    expect(requestLabel("in_progress")).toBe("In progress");
    expect(requestLabel("client_update")).toBe("Client update");
    expect(formatDateOnly("2026-07-20T00:00:00.000Z")).toBe("Jul 20, 2026");
  });

  it("never falls back to displaying a raw member identifier", () => {
    expect(memberDisplayName("alex", labels)).toBe("Alex");
    expect(memberDisplayName("unmapped-uuid", labels)).toBe("Former member");
  });

  it("orders urgent and high incomplete work before other and terminal work", () => {
    const sorted = sortRequests([
      { id: "complete", status: "completed", priority: "urgent", created_at: "2026-07-14T10:00:00Z" },
      { id: "normal", status: "open", priority: "normal", created_at: "2026-07-14T11:00:00Z" },
      { id: "high-old", status: "blocked", priority: "high", created_at: "2026-07-13T10:00:00Z" },
      { id: "urgent-new", status: "open", priority: "urgent", created_at: "2026-07-14T12:00:00Z" },
    ]);
    expect(sorted.map((request) => request.id)).toEqual([
      "urgent-new",
      "high-old",
      "normal",
      "complete",
    ]);
  });
});

describe("request activity presentation", () => {
  it.each([
    ["request_created", {}, "Request created"],
    ["request_status_changed", { from: "open", to: "in_progress" }, "Status changed from Open to In progress"],
    ["request_priority_changed", { from: "normal", to: "high" }, "Priority changed from Normal to High"],
    ["request_assignee_changed", { from: null, to: "alex" }, "Assigned to Alex"],
    ["request_assignee_changed", { from: "alex", to: "sam" }, "Assignment changed from Alex to Sam"],
    ["request_assignee_changed", { from: "alex", to: null }, "Assignment removed"],
  ])("renders %s safely", (eventType, metadata, expected) => {
    expect(
      requestActivityMessage(
        { event_type: eventType, metadata },
        labels,
      ),
    ).toBe(expected);
  });

  it("uses a neutral message for unfamiliar metadata without exposing JSON", () => {
    const message = requestActivityMessage(
      { event_type: "future_event", metadata: { secret: "raw-value" } },
      labels,
    );
    expect(message).toBe("Request updated");
    expect(message).not.toContain("raw-value");
  });
});
