import { describe, expect, it, vi } from "vitest";

import { coalescedRunner } from "@/lib/coalescedRunner";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe("coalescedRunner", () => {
  it("runs the task once when nothing is in flight", async () => {
    const task = vi.fn(() => Promise.resolve());
    await coalescedRunner(task)();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("collapses every call made during a run into a single extra run", async () => {
    const gates = [deferred(), deferred()];
    const task = vi.fn(() => gates[task.mock.calls.length - 1]?.promise ?? Promise.resolve());
    const run = coalescedRunner(task);

    const first = run();
    void run();
    void run();
    void run();
    expect(task).toHaveBeenCalledTimes(1);

    gates[0]?.resolve();
    await first;
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(2));

    gates[1]?.resolve();
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(2));
  });

  it("reports busy once for the whole burst, not between the coalesced runs", async () => {
    const gate = deferred();
    const busy = vi.fn();
    const run = coalescedRunner(() => gate.promise, busy);

    const first = run();
    void run();
    expect(busy).toHaveBeenCalledTimes(1);
    expect(busy).toHaveBeenLastCalledWith(true);

    gate.resolve();
    await first;
    await vi.waitFor(() => expect(busy).toHaveBeenLastCalledWith(false));
    expect(busy.mock.calls.filter(([value]) => value === false)).toHaveLength(1);
  });

  it("stays usable after a task fails", async () => {
    let attempt = 0;
    const run = coalescedRunner(() => {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error("boom")) : Promise.resolve();
    });

    await expect(run()).rejects.toThrow("boom");
    await expect(run()).resolves.toBeUndefined();
    expect(attempt).toBe(2);
  });
});
