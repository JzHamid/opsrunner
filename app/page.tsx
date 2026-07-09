"use client";

import { FormEvent, useState } from "react";
import {
  approvedTasks,
  getApprovedTask,
  type ApprovedTaskId,
} from "@/lib/workflows";

type TaskSuccessResult = {
  ok: true;
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
  code?: "not_configured" | "request_failed" | "invalid_request";
  error: string;
};

type TaskResult = TaskSuccessResult | TaskErrorResult;

const trustPoints = [
  "Server-side n8n execution",
  "Approved task routing",
  "Safe fallback handling",
];

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
      className: "border-accent/20 bg-accent/5 text-foreground",
    };
  }

  if (!result) {
    return {
      eyebrow: "Result",
      title: "Ready for the first run",
      body: "Choose a task type, add the working context, and run it when the request is clear.",
      className: "border-line bg-[#fbfcfb] text-foreground",
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
    className: "border-[#d8c89a] bg-[#fff9ea] text-foreground",
    };
  }

  return {
    eyebrow: "Done",
    title: result.title,
    body: result.body,
    className: "border-accent/25 bg-accent/5 text-foreground",
  };
}

export default function Home() {
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
          taskId: selectedTask.id,
          payload: {
            input,
            reference,
          },
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
    <main className="min-h-screen overflow-x-hidden bg-background px-5 py-5 text-foreground sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[12px] bg-foreground text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
              OR
            </div>
            <div>
              <p className="text-sm font-medium text-muted">OpsRunner</p>
              <p className="text-xs text-muted/80">Internal workflow console</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-line/80 bg-surface/80 px-3 py-2 text-sm text-muted shadow-sm backdrop-blur sm:flex">
            <span className="size-2 rounded-full bg-accent" />
            Ready for approved tasks
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12 lg:py-12">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Internal workflow console
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.04] text-foreground sm:text-5xl lg:text-6xl">
              Run approved operations from one focused workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted sm:text-lg">
              Trigger repeatable business workflows with clear inputs, safe
              routing, and calm result handling.
            </p>

            <div className="mt-8 space-y-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-3 text-sm text-muted"
                >
                  <span className="flex size-5 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                    <span className="size-1.5 rounded-full bg-accent" />
                  </span>
                  {point}
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-[28px] border border-white/70 bg-surface/95 p-3 shadow-[0_28px_90px_rgba(21,31,28,0.16)] backdrop-blur">
            <div className="rounded-[22px] border border-line/70 bg-[#fdfefd]">
              <div className="flex flex-col gap-3 border-b border-line/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="text-sm font-medium text-muted">Run task</p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    Task runner
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <span className="size-2.5 rounded-full bg-accent shadow-[0_0_0_5px_rgba(27,117,83,0.12)]" />
                  Server-side execution
                </div>
              </div>

              <form onSubmit={runTask} className="space-y-6 p-5 sm:p-6">
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
                          className={`group min-h-24 rounded-[16px] border p-4 text-left transition ${
                            isSelected
                              ? "border-accent bg-accent text-white shadow-[0_14px_34px_rgba(27,117,83,0.22)]"
                              : "border-line bg-white text-foreground hover:border-accent/40 hover:bg-[#f7fbf8]"
                          }`}
                        >
                          <span className="block text-sm font-semibold">
                            {task.name}
                          </span>
                          <span
                            className={`mt-2 block text-sm leading-5 ${
                              isSelected ? "text-white/80" : "text-muted"
                            }`}
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
                    rows={7}
                    className="mt-2 w-full resize-none rounded-[18px] border border-line bg-white px-4 py-4 text-base leading-7 text-foreground shadow-inner outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
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
                      className="mt-2 h-12 w-full rounded-[16px] border border-line bg-white px-4 text-base text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={!canRun}
                    className="inline-flex h-12 items-center justify-center rounded-[16px] bg-foreground px-7 text-base font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:bg-[#1c2622] focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#9da9a4] disabled:shadow-none"
                  >
                    {isRunning ? "Running" : "Run task"}
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-[#f8faf8] px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>{selectedTask.statusHint}</span>
                  <span className="font-medium text-foreground">
                    {input.trim() ? "Input ready" : "Waiting for input"}
                  </span>
                </div>
              </form>
            </div>

            <section className={`mt-3 rounded-[22px] border p-5 ${resultShell.className}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] opacity-70">
                    {resultShell.eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {resultShell.title}
                  </h3>
                </div>
                {result?.ok ? (
                  <p className="rounded-full border border-current/20 px-3 py-1 text-xs font-medium opacity-80">
                    {result.status}
                  </p>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-line text-sm leading-6 opacity-80">
                {resultShell.body}
              </p>

              {result?.ok ? (
                <div className="mt-5 space-y-5 border-t border-current/10 pt-5">
                  {result.resultItems?.length ? (
                    <ol className="space-y-3">
                      {result.resultItems.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 opacity-85">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-semibold opacity-75">
                            {index + 1}
                          </span>
                          <span className="pt-px">{item}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div>
                    <p className="text-sm font-semibold">Next steps</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 opacity-80">
                        {result.nextSteps.map((step, index) => (
                          <li key={`${step}-${index}`} className="flex gap-2">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-50" />
                          <span>{step}</span>
                        </li>
                        ))}
                    </ul>
                    </div>
                    <div className="text-sm opacity-80 sm:text-right">
                      <p className="font-semibold">Processed</p>
                      <p className="mt-1 font-mono text-xs">{result.processedAt}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {result ? (
                <details className="mt-5 border-t border-current/10 pt-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Details
                  </summary>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-[16px] bg-white/70 p-4 font-mono text-xs leading-5 text-foreground">
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
