"use client";

import { FormEvent, useState } from "react";
import {
  approvedTasks,
  getApprovedTask,
  type ApprovedTaskId,
} from "@/lib/workflows";

type TaskSuccessResult = {
  ok: true;
  taskType: string;
  title: string;
  body: string;
  nextSteps: string[];
  status: string;
  processedAt: string;
  runId?: string;
  source?: string;
  workflowStatus?: string;
  resultItems?: string[];
  data?: unknown;
};

type TaskErrorResult = {
  ok: false;
  code?:
    | "not_configured"
    | "request_failed"
    | "invalid_request"
    | "unauthorized"
    | "forbidden";
  error: string;
};

type TaskResult = TaskSuccessResult | TaskErrorResult;

const trustPoints = [
  "Server-side n8n execution",
  "Approved task routing",
  "Safe fallback handling",
];

const processedAtFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatProcessedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${processedAtFormatter.format(date)} UTC`;
}

function parseNumberedChecklist(value: string) {
  const lines = value.split(/\r?\n/);
  const numberedLines = lines
    .map((line, index) => {
      const match = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/);
      return match?.[1] ? { index, item: match[1] } : null;
    })
    .filter((entry): entry is { index: number; item: string } => entry !== null);

  if (numberedLines.length >= 2) {
    return {
      body: lines.slice(0, numberedLines[0].index).join("\n").trim(),
      items: numberedLines.map(({ item }) => item),
    };
  }

  const inlineItems = Array.from(
    value.matchAll(/(?:^|\s)\d+[.)]\s+(.+?)(?=\s+\d+[.)]\s+|$)/g),
    (match) => match[1]?.trim(),
  ).filter((item): item is string => Boolean(item));

  if (inlineItems.length >= 2) {
    const firstItemIndex = value.search(/(?:^|\s)\d+[.)]\s+/);

    return {
      body: firstItemIndex > 0 ? value.slice(0, firstItemIndex).trim() : "",
      items: inlineItems,
    };
  }

  return null;
}

function isFallbackResult(result: TaskResult | null) {
  if (!result?.ok) {
    return false;
  }

  return (
    result.source === "n8n-fallback" ||
    result.workflowStatus === "fallback" ||
    result.status.toLowerCase().includes("fallback")
  );
}

function getResultShell(result: TaskResult | null, isRunning: boolean) {
  if (isRunning) {
    return {
      eyebrow: "Running",
      title: "Task in progress",
      body: "OpsRunner is sending this through the approved workflow path.",
      className: "border-accent/20 bg-[#f7fbf8] text-foreground",
    };
  }

  if (!result) {
    return {
      eyebrow: "Result",
      title: "Ready for the first run",
      body: "Choose a task type, add the working context, and run it when the request is clear.",
      className: "border-line/80 bg-[#fbfcfb] text-foreground",
    };
  }

  if (!result.ok && result.code === "not_configured") {
    return {
      eyebrow: "Setup",
      title: "Connection needed",
      body: result.error,
      className: "border-[#d8c89a] bg-[#fff9ea] text-[#654d13]",
    };
  }

  if (!result.ok) {
    return {
      eyebrow: "Could not run",
      title: "Request failed",
      body: result.error,
      className: "border-danger/25 bg-danger/5 text-danger",
    };
  }

  if (isFallbackResult(result)) {
    return {
      eyebrow: "Safe fallback",
      title: result.title,
      body: result.body,
      className: "border-line/80 bg-[#fafbf9] text-foreground",
    };
  }

  return {
    eyebrow: "Done",
    title: result.title,
    body: result.body,
    className: "border-line/80 bg-white/80 text-foreground",
  };
}

type TaskRunnerProps = {
  organizationSlug: string;
};

export function TaskRunner({ organizationSlug }: TaskRunnerProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<ApprovedTaskId>(
    approvedTasks[0].id,
  );
  const [input, setInput] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const selectedTask = getApprovedTask(selectedTaskId) ?? approvedTasks[0];
  const canRun = input.trim().length > 0 && !isRunning;
  const resultShell = getResultShell(result, isRunning);
  const isFallback = isFallbackResult(result);
  const parsedChecklist =
    result?.ok && !result.resultItems?.length
      ? parseNumberedChecklist(result.body)
      : null;
  const checklistItems = result?.ok
    ? result.resultItems?.length
      ? result.resultItems
      : (parsedChecklist?.items ?? [])
    : [];
  const displayBody = parsedChecklist?.body ?? resultShell.body;

  async function runTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRun) {
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/run-task", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          task_type: selectedTask.taskType,
          input,
          reference,
          organization_slug: organizationSlug,
        }),
      });

      const data = (await response.json()) as TaskResult;
      setResult(data);
    } catch {
      setResult({
        ok: false,
        code: "request_failed",
        error: "OpsRunner could not reach the workflow service.",
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="overflow-x-hidden bg-background px-4 py-5 text-foreground sm:px-8 sm:py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <section className="grid items-start gap-7 sm:gap-9 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-12 lg:py-5">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent sm:text-sm">
              Internal workflow console
            </p>
            <h1 className="mt-4 text-[2.25rem] font-semibold leading-[1.08] text-foreground sm:mt-5 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04]">
              Run approved operations from one focused workspace.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-7 text-muted sm:mt-5 sm:text-lg">
              Trigger repeatable business workflows with clear inputs, safe
              routing, and calm result handling.
            </p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5 sm:mt-7 sm:gap-x-6">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-2.5 text-xs text-muted sm:text-sm"
                >
                  <span className="size-1.5 rounded-full bg-accent/70" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-[20px] bg-surface/95 p-2 shadow-[0_24px_70px_rgba(21,31,28,0.12),0_1px_2px_rgba(21,31,28,0.06)] ring-1 ring-black/[0.04] sm:p-2.5">
            <div className="rounded-[14px] bg-[#fcfdfc]">
              <div className="flex flex-col gap-2.5 border-b border-line/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div>
                  <p className="text-xs font-medium text-muted sm:text-sm">Run task</p>
                  <h2 className="mt-1 text-[1.35rem] font-semibold leading-7 text-foreground sm:text-2xl">
                    Task runner
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted sm:text-sm">
                  <span className="size-2 rounded-full bg-accent/80 shadow-[0_0_0_4px_rgba(27,117,83,0.1)]" />
                  Server-side execution
                </div>
              </div>

              <form onSubmit={runTask} className="space-y-5 p-4 sm:space-y-6 sm:p-6">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-foreground">
                      Task type
                    </label>
                    <span className="text-xs text-muted">Approved options</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {approvedTasks.map((task) => {
                      const isSelected = selectedTask.id === task.id;

                      return (
                        <button
                          key={task.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`group min-h-[84px] rounded-lg border px-4 py-3.5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/25 ${
                            isSelected
                              ? "border-accent/60 bg-[#eef7f2] text-foreground shadow-[0_6px_18px_rgba(27,117,83,0.09)] ring-1 ring-accent/10"
                              : "border-line/80 bg-white text-foreground hover:-translate-y-px hover:border-accent/35 hover:bg-[#fbfdfb] hover:shadow-[0_6px_18px_rgba(21,31,28,0.06)]"
                          }`}
                        >
                          <span className="block text-sm font-semibold">
                            {task.name}
                          </span>
                          <span
                            className="mt-1.5 block text-[13px] leading-5 text-muted"
                          >
                            {task.summary}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-foreground">
                    Input
                  </span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={selectedTask.inputPlaceholder}
                    maxLength={2000}
                    rows={6}
                    className="mt-2 w-full resize-none rounded-xl border border-line/90 bg-white px-4 py-3.5 text-[15px] leading-7 text-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition duration-200 placeholder:text-muted/55 focus:border-accent/70 focus:ring-2 focus:ring-accent/10 sm:py-4 sm:text-base"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="text-sm font-semibold text-foreground">
                      Reference
                    </span>
                    <input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Optional client, ticket, or record ID"
                      maxLength={160}
                      className="mt-2 h-12 w-full rounded-xl border border-line/90 bg-white px-4 text-[15px] text-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition duration-200 placeholder:text-muted/55 focus:border-accent/70 focus:ring-2 focus:ring-accent/10 sm:text-base"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={!canRun}
                    aria-busy={isRunning}
                    className="inline-flex h-12 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-accent px-7 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(27,117,83,0.22)] outline-none transition-all duration-200 hover:-translate-y-px hover:bg-[#156344] hover:shadow-[0_12px_28px_rgba(27,117,83,0.28)] focus-visible:ring-4 focus-visible:ring-accent/20 active:translate-y-0 active:shadow-[0_6px_16px_rgba(27,117,83,0.2)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-accent/35 disabled:text-white/85 disabled:shadow-none"
                  >
                    {isRunning ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                        />
                        Running
                      </>
                    ) : (
                      "Run task"
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-line/60 pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-sm">
                  <span>{selectedTask.statusHint}</span>
                  <span className="font-medium text-foreground/80">
                    {input.trim() ? "Input ready" : "Waiting for input"}
                  </span>
                </div>
              </form>
            </div>

            <section
              aria-live="polite"
              className={`mt-2 rounded-[14px] border px-4 py-5 shadow-[0_8px_24px_rgba(21,31,28,0.05)] sm:px-6 sm:py-6 ${resultShell.className}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    {resultShell.eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold leading-7">
                    {resultShell.title}
                  </h3>
                </div>
                {result?.ok ? (
                  <p className="flex items-center gap-2 pt-0.5 text-xs font-medium text-muted">
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${isFallback ? "bg-[#9a8552]" : "bg-accent/70"}`}
                    />
                    {isFallback ? "Safe fallback" : "Complete"}
                  </p>
                ) : null}
              </div>

              {displayBody ? (
                <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-foreground/80">
                  {displayBody}
                </p>
              ) : null}

              {result?.ok ? (
                <div className="mt-6 space-y-6 border-t border-line/70 pt-6">
                  {checklistItems.length ? (
                    <ol className="space-y-3.5">
                      {checklistItems.map((item, index) => (
                        <li
                          key={`${item}-${index}`}
                          className="flex gap-3 text-sm leading-6 text-foreground/80"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-muted">
                            {index + 1}
                          </span>
                          <span className="pt-px">{item}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:gap-8">
                    <div>
                      <p className="text-sm font-semibold">Next steps</p>
                      <ul className="mt-2.5 space-y-2 text-sm leading-6 text-foreground/75">
                        {result.nextSteps.map((step, index) => (
                          <li key={`${step}-${index}`} className="flex gap-2">
                            <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted/70" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-sm text-muted sm:text-right">
                      <p className="font-semibold text-foreground">Processed</p>
                      <time
                        dateTime={result.processedAt}
                        title={result.processedAt}
                        className="mt-1.5 block text-xs"
                      >
                        {formatProcessedAt(result.processedAt)}
                      </time>
                    </div>
                  </div>
                </div>
              ) : null}

              {result ? (
                <details className="mt-6 border-t border-line/70 pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted transition hover:text-foreground">
                    Details
                  </summary>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-[12px] bg-surface-muted/70 p-4 font-mono text-xs leading-5 text-foreground">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              ) : null}
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}
