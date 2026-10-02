/** Reuses a live listener while the existing service waits for the next revision. */
export function createLiveSync<T>(initial: T) {
  let value = initial; let revision = 0; let ready = false; let error: Error | undefined;
  const waiting = new Set<() => void>();
  const publish = () => [...waiting].forEach((resolve) => resolve());
  return {
    update(next: T) { value = next; ready = true; error = undefined; revision++; publish(); },
    fail(next: Error) { error = next; ready = true; revision++; publish(); },
    reset() { value = initial; ready = false; error = undefined; revision++; publish(); },
    current: () => value,
    wait(cursor: number | null, signal: AbortSignal): Promise<{ cursor: number; value: T }> {
      return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const clean = () => { waiting.delete(check); signal.removeEventListener('abort', abort); if (timer) clearTimeout(timer); };
        const abort = () => { clean(); reject(new DOMException('Request cancelled', 'AbortError')); };
        const check = () => { if (!ready) return; if (error) { clean(); reject(error); } else if (cursor !== revision) { clean(); resolve({ cursor: revision, value }); } };
        if (signal.aborted) { abort(); return; }
        waiting.add(check); signal.addEventListener('abort', abort);
        timer = setTimeout(() => { clean(); if (error) reject(error); else if (!ready) reject(new Error('Cloud data is still loading. Check your connection.')); else resolve({ cursor: revision, value }); }, 25000);
        check();
      });
    },
  };
}
