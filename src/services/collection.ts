/** Implement this contract with an authorized backend adapter when one is configured. */
export interface CollectionRepository<T extends { id: string }> {
  watch(scope: string, receive: (items: readonly T[]) => void, fail: (error: Error) => void): () => void;
  save(scope: string, item: T): Promise<T>;
  remove(scope: string, id: string): Promise<void>;
}

export type CollectionState<T> = { items: readonly T[]; loading: boolean; error: string | null };

export function createCollectionStore<T extends { id: string }>(repository: CollectionRepository<T>, validate?: (item: T) => boolean) {
  let state: CollectionState<T> = { items: [], loading: false, error: null };
  let scope: string | null = null;
  let epoch = 0;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  function publish(next: CollectionState<T>) { state = next; listeners.forEach((listener) => listener()); }
  function acceptConfirmed(item: T, before?: T) {
    if (!item?.id || (validate && !validate(item))) throw new Error('The data source returned an invalid saved record.');
    const current = state.items.find((entry) => entry.id === item.id);
    if (!current || JSON.stringify(current) === JSON.stringify(before)) {
      publish({ ...state, error: null, items: [...state.items.filter((entry) => entry.id !== item.id), item] });
    }
  }
  function connect(nextScope: string | null, force = false) {
    if (scope === nextScope && !force) return;
    const current = ++epoch;
    stop?.(); stop = undefined; scope = nextScope;
    publish({ items: [], loading: nextScope !== null, error: null });
    if (nextScope === null) return;
    try {
      stop = repository.watch(nextScope, (items) => {
        if (current !== epoch) return;
        const ids = new Set<string>();
        if (!Array.isArray(items) || items.some((item) => !item || typeof item.id !== 'string' || !item.id.trim()
          || ids.has(item.id) || !ids.add(item.id) || (validate && !validate(item)))) {
          publish({ items: state.items, loading: false, error: 'The data source returned invalid or duplicate records.' }); return;
        }
        publish({ items: [...items], loading: false, error: null });
      }, (error) => {
        if (current === epoch) publish({ ...state, loading: false, error: error.message || 'Unable to load data. Please retry.' });
      });
    } catch (error) {
      publish({ ...state, loading: false, error: error instanceof Error ? error.message : 'Unable to load data.' });
    }
  }
  async function mutate<R>(action: (activeScope: string) => Promise<R>): Promise<R> {
    if (scope === null) throw new Error('Sign in before saving changes.');
    const current = epoch;
    try {
      const result = await action(scope);
      if (current !== epoch) throw new Error('Your account changed. Please try again.');
      return result;
    } catch (error) {
      if (current === epoch) publish({ ...state, error: error instanceof Error ? error.message : 'Unable to save changes.' });
      throw error;
    }
  }
  return {
    connect,
    acceptConfirmed,
    dropConfirmed(id: string, before?: T) {
      const current = state.items.find((entry) => entry.id === id);
      if (current && JSON.stringify(current) === JSON.stringify(before)) publish({ ...state, items: state.items.filter((entry) => entry.id !== id) });
    },
    retry: () => connect(scope, true),
    getSnapshot: () => state.items,
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async save(item: T) {
      const before = state.items.find((entry) => entry.id === item.id);
      const saved = await mutate((activeScope) => repository.save(activeScope, item));
      // A confirmed write can arrive before its subscription. Preserve any newer subscription value.
      acceptConfirmed(saved, before);
      return saved;
    },
    async remove(id: string) {
      const before = state.items.find((entry) => entry.id === id);
      await mutate((activeScope) => repository.remove(activeScope, id));
      const current = state.items.find((entry) => entry.id === id);
      if (!current || JSON.stringify(current) === JSON.stringify(before)) publish({ ...state, error: null, items: state.items.filter((entry) => entry.id !== id) });
    },
  };
}

/** Local development storage. No samples are required, and it makes no network connections. */
export function createMemoryCollection<T extends { id: string }>(initial: readonly T[] = []): CollectionRepository<T> {
  const copy = <V>(value: V): V => JSON.parse(JSON.stringify(value));
  const records = new Map<string, T>(initial.map((item) => [item.id, copy(item)]));
  const listeners = new Set<(items: readonly T[]) => void>();
  const items = () => copy(Array.from(records.values()));
  function publish() { listeners.forEach((listener) => listener(items())); }
  return {
    watch: (_scope, receive) => { listeners.add(receive); receive(items()); return () => { listeners.delete(receive); }; },
    async save(_scope, item) {
      if (!item.id) throw new Error('A record ID is required.');
      records.set(item.id, copy(item)); publish(); return copy(item);
    },
    async remove(_scope, id) {
      if (!records.delete(id)) throw new Error('This record is no longer available.');
      publish();
    },
  };
}

export function createPrivateMemoryCollection<T extends { id: string; ownerId: string }>(): CollectionRepository<T> {
  const collection = createMemoryCollection<T>();
  const owners = new Map<string, string>();
  function authorize(scope: string, id: string) {
    if (!scope || (owners.has(id) && owners.get(id) !== scope)) throw new Error('This record is unavailable for your account.');
  }
  return {
    watch: (scope, receive, fail) => collection.watch(scope, (items) => receive(items.filter((item) => item.ownerId === scope)), fail),
    async save(scope, item) {
      authorize(scope, item.id);
      if (item.ownerId !== scope) throw new Error('This record belongs to another account.');
      const previous = owners.get(item.id);
      owners.set(item.id, scope);
      try { return await collection.save(scope, item); }
      catch (error) { if (previous) owners.set(item.id, previous); else owners.delete(item.id); throw error; }
    },
    async remove(scope, id) { authorize(scope, id); await collection.remove(scope, id); owners.delete(id); },
  };
}
