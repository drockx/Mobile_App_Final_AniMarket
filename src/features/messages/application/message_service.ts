import { filterConversations, type Conversation, type ConversationSide } from '../domain/conversation';
import type { ChatMessage, ChatUser, MessageRepository } from '../domain/message_repository';

export type PendingMessage = ChatMessage & { delivery: 'sending' | 'failed'; error: string };
export type ChatThread = { messages: readonly ChatMessage[]; pending: readonly PendingMessage[]; loading: boolean; hasMore: boolean; syncedThrough: number; error: string };
export type MessageSnapshot = { conversations: readonly Conversation[]; threads: Readonly<Record<string, ChatThread>>; status: 'signed-out' | 'connecting' | 'live' | 'offline'; error: string };
export const emptyThread: ChatThread = { messages: [], pending: [], loading: false, hasMore: false, syncedThrough: 0, error: '' };
type SellerContact = { id: string; title: string; seller: string; sellerId?: string; verified?: boolean };
export type MessageService = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): MessageSnapshot;
  getUserId(): string;
  list(side: ConversationSide, query: string): Conversation[];
  get(id: string): Conversation | undefined;
  badgeCount(side: ConversationSide): number;
  connect(userId: string, accountKey: string): void;
  setActive(active: boolean): void;
  reconnect(): void;
  watch(id: string): () => void;
  loadOlder(id: string): Promise<void>;
  reload(id: string): Promise<void>;
  openConversation(recipientId: string): Promise<Conversation>;
  searchUsers(query: string, signal?: AbortSignal): Promise<ChatUser[]>;
  send(id: string, text: string, clientId: string): Promise<ChatMessage>;
  markRead(id: string, throughSeq: number): Promise<void>;
  openBuyerConversation(item: SellerContact): Promise<Conversation>;
};

export function createMessageService(repository: MessageRepository): MessageService {
  let snapshot: MessageSnapshot = { conversations: [], threads: {}, status: 'signed-out', error: '' };
  const listeners = new Set<() => void>();
  let accountKey = '';
  let userId = '';
  let epoch = 0;
  let accountVersion = 0;
  let foreground = true;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let cursor: number | null = null;
  let watchedId: string | null = null;
  let watchOwner = 0;
  let threadWatchVersion = 0;
  let stopThreadWatch: (() => void) | undefined;
  let threadRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let threadFailures = 0;
  const threadRequests = new Map<string, Promise<void>>();
  const readRequests = new Map<string, number>();
  const sendRequests = new Map<string, Promise<ChatMessage>>();
  const sendTails = new Map<string, Promise<ChatMessage>>();
  const sendConfirmations = new Map<string, (message: ChatMessage) => void>();
  const sendKey = (id: string, clientId: string) => JSON.stringify([id, clientId]);
  function publish(next: MessageSnapshot) { snapshot = next; listeners.forEach((listener) => listener()); }
  function updateThread(id: string, next: ChatThread) { publish({ ...snapshot, threads: { ...snapshot.threads, [id]: next } }); }
  function merge(id: string, incoming: readonly ChatMessage[], extra: Partial<ChatThread> = {}) {
    const current = snapshot.threads[id] ?? emptyThread;
    const unique = new Map(current.messages.map((message) => [message.id, message]));
    for (const message of incoming) {
      const previous = unique.get(message.id);
      if (!previous || previous.seq !== message.seq || previous.text !== message.text || previous.senderId !== message.senderId
        || previous.createdAt !== message.createdAt || previous.clientId !== message.clientId || previous.conversationId !== message.conversationId) unique.set(message.id, message);
    }
    const messages = [...unique.values()].sort((a, b) => a.seq - b.seq);
    const confirmed = new Set(incoming.filter((message) => message.senderId === userId).map((message) => message.clientId));
    const pending = current.pending.some((message) => confirmed.has(message.clientId))
      ? current.pending.filter((message) => !confirmed.has(message.clientId)) : current.pending;
    const next = { ...current, ...extra, messages, pending };
    if (messages.length === current.messages.length && messages.every((message, index) => message === current.messages[index])
      && pending === current.pending && next.loading === current.loading && next.hasMore === current.hasMore && next.syncedThrough === current.syncedThrough && next.error === current.error) return;
    updateThread(id, next);
    for (const message of incoming) if (message.senderId === userId) sendConfirmations.get(sendKey(id, message.clientId))?.(message);
  }
  function stopThreadListener() { threadWatchVersion++; clearTimeout(threadRetryTimer); threadRetryTimer = undefined; stopThreadWatch?.(); stopThreadWatch = undefined; }
  function stop() { epoch++; controller?.abort(); controller = null; clearTimeout(retryTimer); retryTimer = undefined; stopThreadListener(); }
  function latestSeq(id: string) {
    const messages = snapshot.threads[id]?.messages;
    return Math.max(snapshot.conversations.find((conversation) => conversation.id === id)?.lastMessageSeq ?? 0, messages?.[messages.length - 1]?.seq ?? 0);
  }
  async function loadThread(id: string, older = false): Promise<void> {
    if (threadRequests.has(id)) return threadRequests.get(id);
    const requestEpoch = epoch;
    const current = snapshot.threads[id] ?? emptyThread;
    const requestedThrough = latestSeq(id);
    updateThread(id, { ...current, loading: true, error: '' });
    const task = (async () => {
      try {
        if (older || current.syncedThrough === 0) {
          const page = await repository.messages(id, older ? { before: current.messages[0]?.seq } : {});
          if (requestEpoch === epoch) merge(id, page.messages, { hasMore: page.hasMore, loading: false, syncedThrough: Math.max(snapshot.threads[id]?.syncedThrough ?? 0, older ? current.syncedThrough : page.messages[page.messages.length - 1]?.seq ?? 0) });
        } else {
          // A sent-message acknowledgement can arrive ahead of unseen incoming messages.
          // Advance this cursor only from fetched history, never from a send response.
          let after = current.syncedThrough;
          let more = true;
          while (more && requestEpoch === epoch) {
            const page = await repository.messages(id, { after });
            if (requestEpoch !== epoch) return;
            merge(id, page.messages, { loading: false, syncedThrough: Math.max(snapshot.threads[id]?.syncedThrough ?? 0, page.messages[page.messages.length - 1]?.seq ?? after) });
            more = page.hasMore;
            if (!page.messages.length) break;
            after = page.messages[page.messages.length - 1].seq;
          }
        }
      } catch (error) {
        if (requestEpoch === epoch) updateThread(id, { ...(snapshot.threads[id] ?? emptyThread), loading: false, error: error instanceof Error ? error.message : 'Unable to load messages.' });
      } finally {
        if (requestEpoch === epoch) {
          threadRequests.delete(id);
          // An update can arrive while this page is in flight. Catch it without waiting for another event.
          const thread = snapshot.threads[id];
          if (foreground && watchedId === id && thread && !thread.error && thread.syncedThrough < latestSeq(id)
            && (thread.syncedThrough > current.syncedThrough || latestSeq(id) > requestedThrough)) void loadThread(id);
        }
      }
    })();
    threadRequests.set(id, task);
    return task;
  }
  function startThreadListener(id: string, retry = false) {
    stopThreadListener();
    if (!retry) threadFailures = 0;
    if (!userId || !foreground) return;
    if (!repository.watchMessages) {
      if (!snapshot.threads[id] || snapshot.threads[id].syncedThrough < latestSeq(id)) void loadThread(id);
      return;
    }
    const requestEpoch = epoch;
    const version = threadWatchVersion;
    const isCurrent = () => requestEpoch === epoch && version === threadWatchVersion && watchedId === id;
    updateThread(id, { ...(snapshot.threads[id] ?? emptyThread), loading: true, error: '' });
    let failed = false;
    const fail = (error: Error) => {
      if (!isCurrent() || failed) return;
      failed = true;
      updateThread(id, { ...(snapshot.threads[id] ?? emptyThread), loading: false, error: error.message || 'Unable to load messages.' });
      threadRetryTimer = setTimeout(() => { if (isCurrent()) startThreadListener(id, true); }, Math.min(15000, 1000 * 2 ** threadFailures++));
    };
    try {
      const unsubscribe = repository.watchMessages(id, (page) => {
        if (!isCurrent() || failed) return;
        threadFailures = 0;
        const current = snapshot.threads[id] ?? emptyThread;
        const first = page.messages[0]?.seq ?? 0;
        const last = page.messages[page.messages.length - 1]?.seq ?? 0;
        const contiguous = current.syncedThrough === 0 || first <= current.syncedThrough + 1;
        merge(id, page.messages, { loading: false, error: '', hasMore: current.syncedThrough === 0 ? page.hasMore : current.hasMore,
          syncedThrough: contiguous ? Math.max(current.syncedThrough, last) : current.syncedThrough });
        // Recover any gap after a long disconnect before advancing the history cursor.
        if (!contiguous) void loadThread(id);
      }, fail);
      if (isCurrent()) stopThreadWatch = unsubscribe; else unsubscribe();
    } catch (error) { fail(error instanceof Error ? error : new Error('Unable to load messages.')); }
  }
  function start() {
    if (!userId || !foreground) return;
    const loopEpoch = epoch;
    controller = new AbortController();
    const signal = controller.signal;
    publish({ ...snapshot, status: 'connecting', error: '' });
    if (watchedId) startThreadListener(watchedId);
    void (async () => {
      let failures = 0;
      while (!signal.aborted && loopEpoch === epoch) {
        try {
          const result = await repository.sync(cursor, signal);
          if (signal.aborted || loopEpoch !== epoch) return;
          cursor = result.cursor; failures = 0;
          const previous = new Map(snapshot.conversations.map((conversation) => [conversation.id, conversation]));
          const conversations = result.conversations.map((conversation) => {
            const cached = previous.get(conversation.id);
            const next = { ...conversation, time: cached?.updatedAt === conversation.updatedAt ? cached?.time ?? ''
              : conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '' };
            return cached && Object.keys(cached).length === Object.keys(next).length
              && Object.keys(next).every((key) => cached[key as keyof Conversation] === next[key as keyof Conversation]) ? cached : next;
          });
          if (snapshot.status !== 'live' || snapshot.error || conversations.length !== snapshot.conversations.length
            || conversations.some((conversation, index) => conversation !== snapshot.conversations[index])) publish({ ...snapshot, conversations, status: 'live', error: '' });
          if (watchedId && !repository.watchMessages && conversations.some((conversation) => conversation.id === watchedId)
            && (!snapshot.threads[watchedId] || snapshot.threads[watchedId].syncedThrough < latestSeq(watchedId))) void loadThread(watchedId);
        } catch (error) {
          if (signal.aborted || loopEpoch !== epoch) return;
          publish({ ...snapshot, status: 'offline', error: error instanceof Error ? error.message : 'Unable to connect.' });
          const delay = Math.min(15000, 1000 * 2 ** failures++);
          await new Promise<void>((resolve) => {
            const abort = () => { clearTimeout(retryTimer); resolve(); };
            signal.addEventListener('abort', abort, { once: true });
            retryTimer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
          });
          cursor = null;
        }
      }
    })();
  }
  function ensureSignedIn() { if (!userId) throw new Error('Please sign in to message another user.'); }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    getUserId: () => userId,
    list: (side: ConversationSide, query: string) => filterConversations(snapshot.conversations, side, query),
    get: (id: string) => snapshot.conversations.find((conversation) => conversation.id === id),
    badgeCount: (side: ConversationSide) => snapshot.conversations.filter((conversation) => conversation.side === side).reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    connect(nextUserId: string, nextAccountKey: string) {
      if (accountKey === nextAccountKey) return;
      stop(); accountVersion++; accountKey = nextAccountKey; userId = nextUserId; cursor = null; watchedId = null; watchOwner++;
      threadRequests.clear(); readRequests.clear(); sendRequests.clear(); sendTails.clear(); sendConfirmations.clear();
      publish({ conversations: [], threads: {}, status: userId ? 'connecting' : 'signed-out', error: '' }); start();
    },
    setActive(active: boolean) {
      if (foreground === active) return;
      foreground = active; stop(); threadRequests.clear(); readRequests.clear();
      // Finish interrupted loading states so a retry can run on foreground.
      publish({ ...snapshot, threads: Object.fromEntries(Object.entries(snapshot.threads).map(([id, thread]) => [id, { ...thread, loading: false }])), status: userId ? active ? 'connecting' : 'offline' : 'signed-out' });
      if (active) { cursor = null; start(); }
    },
    reconnect() { stop(); threadRequests.clear(); readRequests.clear(); cursor = null; start(); },
    watch(id: string) {
      watchedId = id;
      const owner = ++watchOwner;
      startThreadListener(id);
      return () => { if (owner === watchOwner) { watchedId = null; stopThreadListener(); } };
    },
    loadOlder: (id: string) => loadThread(id, true),
    reload: (id: string) => {
      if (repository.watchMessages && watchedId === id) { startThreadListener(id); return Promise.resolve(); }
      return loadThread(id);
    },
    async openConversation(recipientId: string) {
      ensureSignedIn(); const requestEpoch = epoch;
      const conversation = await repository.open(recipientId);
      if (requestEpoch !== epoch) throw new Error('Please try opening the conversation again.');
      publish({ ...snapshot, conversations: [conversation, ...snapshot.conversations.filter((entry) => entry.id !== conversation.id)] });
      return conversation;
    },
    searchUsers(query: string, signal?: AbortSignal): Promise<ChatUser[]> { ensureSignedIn(); return repository.search(query, signal); },
    async send(id: string, text: string, clientId: string) {
      ensureSignedIn();
      const trimmed = text.trim(); if (!trimmed || trimmed.length > 2000) throw new Error('Enter a message with up to 2,000 characters.');
      const key = sendKey(id, clientId);
      const confirmed = () => snapshot.threads[id]?.messages.find((message) => message.senderId === userId && message.clientId === clientId);
      const current = snapshot.threads[id] ?? emptyThread;
      const existing = confirmed() ?? current.pending.find((message) => message.clientId === clientId);
      if (existing && existing.text !== trimmed) throw new Error('This message request was already used.');
      if (sendRequests.has(key)) return sendRequests.get(key)!;
      if (existing && !('delivery' in existing)) return existing;
      const pending: PendingMessage = { id: clientId, seq: 0, conversationId: id, senderId: userId, clientId, text: trimmed,
        createdAt: existing?.createdAt ?? new Date().toISOString(), delivery: 'sending', error: '' };
      updateThread(id, { ...current, pending: existing ? current.pending.map((message) => message.clientId === clientId ? pending : message) : [...current.pending, pending] });
      const requestAccount = accountVersion;
      const isCurrent = () => requestAccount === accountVersion;
      // Preserve typing order without making the composer wait for a network round trip.
      const previous = sendTails.get(id) ?? Promise.resolve();
      const task = previous.catch(() => {}).then(async () => {
        if (!isCurrent()) throw new Error('Your account changed. Please check the conversation.');
        const saved = confirmed(); if (saved) return saved;
        const liveConfirmation = new Promise<ChatMessage>((resolve) => { sendConfirmations.set(key, resolve); });
        try {
          // A live server confirmation can arrive before the HTTP response.
          const message = await Promise.race([repository.send(id, trimmed, clientId), liveConfirmation]);
          if (!isCurrent()) throw new Error('Your account changed. Please check the conversation.');
          merge(id, [message]); return message;
        } catch (error) {
          if (isCurrent()) {
            const saved = confirmed(); if (saved) return saved;
            const thread = snapshot.threads[id] ?? emptyThread;
            updateThread(id, { ...thread, pending: thread.pending.map((message) => message.clientId === clientId
              ? { ...message, delivery: 'failed', error: error instanceof Error ? error.message : 'Message was not sent.' } : message) });
          }
          throw error;
        } finally { if (isCurrent()) sendConfirmations.delete(key); }
      }).finally(() => {
        if (sendRequests.get(key) === task) sendRequests.delete(key);
        if (sendTails.get(id) === task) sendTails.delete(id);
      });
      sendRequests.set(key, task); sendTails.set(id, task);
      return task;
    },
    async markRead(id: string, throughSeq: number) {
      const conversation = snapshot.conversations.find((item) => item.id === id);
      if (!userId || !foreground || !throughSeq || throughSeq <= (conversation?.readSeq ?? 0) || throughSeq <= (readRequests.get(id) ?? 0)) return;
      const requestEpoch = epoch; readRequests.set(id, throughSeq);
      try { await repository.read(id, throughSeq); }
      catch { /* Retry when the next sync or foreground refresh confirms the thread. */ }
      finally { if (requestEpoch === epoch && readRequests.get(id) === throughSeq) readRequests.delete(id); }
    },
    async openBuyerConversation(item: { id: string; title: string; seller: string; sellerId?: string; verified?: boolean }) {
      if (!item.sellerId) throw new Error('The seller account is unavailable. Choose New message to contact a registered user.');
      ensureSignedIn(); return this.openConversation(item.sellerId);
    },
  };
}
