import type { ApprovedTask } from "@/lib/workflows";

export type TaskOutput = {
  title: string;
  body: string;
  nextSteps: string[];
  resultItems?: string[];
};

const MAX_SUMMARY_CLAUSE_LENGTH = 150;
const MAX_CHECKLIST_ITEMS = 6;

function cleanText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeListPrefix(value: string) {
  return value.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim();
}

function removeTaskLabel(value: string) {
  return value
    .replace(
      /^(?:checklist|steps?|tasks?|to do|client update|follow-?up(?: draft)?)\s*(?:for|on|about|with)?\s*:\s*/i,
      "",
    )
    .trim();
}

function stripTerminalPunctuation(value: string) {
  return value.replace(/[.!?]+$/, "").trim();
}

function capitalizeFirst(value: string) {
  if (!value) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function lowercaseFirst(value: string) {
  if (!value || /^I(?:\s|')/.test(value)) {
    return value;
  }

  return `${value[0].toLowerCase()}${value.slice(1)}`;
}

function normalizeCalendarTerms(value: string) {
  return value
    .replace(/\bi\b/g, "I")
    .replace(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
      (term) => capitalizeFirst(term.toLowerCase()),
    );
}

function summarizeStatement(value: string) {
  const clientApproval = value.match(/^(?:the )?client approved (.+)$/i);

  if (clientApproval?.[1]) {
    return `Approval was received for ${lowercaseFirst(clientApproval[1])}.`;
  }

  if (/^we\b/i.test(value)) {
    return asSentence(`The team${value.slice(2)}`);
  }

  if (/^i\b/i.test(value)) {
    return asSentence(`The owner${value.slice(1)}`);
  }

  const teamDecision = value.match(/^the team needs (.+)$/i);

  if (teamDecision?.[1]) {
    return `A decision is needed on ${lowercaseFirst(teamDecision[1])}.`;
  }

  return asSentence(value);
}

function asSentence(value: string) {
  const cleaned = removeTaskLabel(removeListPrefix(cleanText(value)));

  if (!cleaned) {
    return "";
  }

  const punctuated = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  return normalizeCalendarTerms(capitalizeFirst(punctuated));
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return truncated || value.slice(0, maxLength).trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toStatements(input: string, max = 3) {
  return unique(
    cleanText(input)
      .split(/\n+|;+|(?<=[.!?])\s+/)
      .map((statement) => asSentence(statement))
      .filter(Boolean),
  ).slice(0, max);
}

function formatSummary(input: string): TaskOutput {
  const statements = toStatements(input, 2);
  const clauses = statements
    .map((statement) =>
      truncateAtWord(
        stripTerminalPunctuation(statement),
        MAX_SUMMARY_CLAUSE_LENGTH,
      ),
    )
    .filter(Boolean);

  const summary = clauses.length
    ? [
        summarizeStatement(clauses[0]),
        ...(clauses[1]
          ? [summarizeStatement(clauses[1])]
          : ["The next action is to confirm ownership and timing."]),
      ].join(" ")
    : "The notes were received and are ready for a focused follow-up.";

  return {
    title: "Notes Summary",
    body: summary,
    nextSteps: ["Confirm the owner and due date.", "Share the agreed actions."],
  };
}

function formatChecklist(input: string): TaskOutput {
  const candidates = unique(
    cleanText(input)
      .split(/\n+|;+|,\s*/)
      .map((item) => asSentence(item))
      .filter(Boolean),
  ).slice(0, MAX_CHECKLIST_ITEMS);

  const defaults = [
    "Confirm the expected outcome.",
    "Complete the required work.",
    "Confirm completion with the responsible owner.",
  ];

  const resultItems = unique([...candidates, ...defaults]).slice(
    0,
    Math.max(3, candidates.length),
  );

  return {
    title: "Checklist",
    body: "Work through these steps in order.",
    resultItems,
    nextSteps: ["Start with the first open step.", "Confirm the final outcome."],
  };
}

function formatClientUpdate(input: string): TaskOutput {
  const statements = toStatements(input, 3);
  const update = statements.length
    ? statements.join(" ")
    : "The latest update has been prepared for review.";

  return {
    title: "Client Update",
    body: [
      "Hello,",
      "",
      update,
      "",
      "Please let me know if you have any questions.",
    ].join("\n"),
    nextSteps: [
      "Review names and dates before sending.",
      "Send when the update is approved.",
    ],
  };
}

function formatFollowUpDraft(input: string): TaskOutput {
  const statements = toStatements(input, 2);
  const firstStatement = statements[0]
    ? stripTerminalPunctuation(statements[0])
    : "the item we discussed";
  const context = /^I(?:\s|')/.test(firstStatement)
    ? `I wanted to follow up. ${asSentence(firstStatement)}`
    : `I wanted to follow up on ${lowercaseFirst(firstStatement)}.`;

  return {
    title: "Follow-up Draft",
    body: [
      "Hello,",
      "",
      context,
      "Could you share an update when you have a moment?",
      "",
      "Thank you,",
    ].join("\n"),
    nextSteps: ["Personalize the recipient and sign-off.", "Send when ready."],
  };
}

export function formatTaskOutput(task: ApprovedTask, input: string): TaskOutput {
  switch (task.taskType) {
    case "summarize_notes":
      return formatSummary(input);
    case "generate_checklist":
      return formatChecklist(input);
    case "format_client_update":
      return formatClientUpdate(input);
    case "create_followup_draft":
      return formatFollowUpDraft(input);
  }
}
