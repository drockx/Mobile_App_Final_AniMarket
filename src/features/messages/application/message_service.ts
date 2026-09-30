import { filterConversations, type Conversation, type ConversationSide } from '../domain/conversation';

export type MessageService = {
  list(side: ConversationSide, query: string): Conversation[];
  badgeCount(side: ConversationSide): number;
  get(id: string): Conversation | undefined;
  getSnapshot(): readonly Conversation[];
  subscribe(listener: () => void): () => void;
  openBuyerConversation(item: { id: string; title: string; seller: string; verified?: boolean }): Conversation;
};

export function createMessageService(
  conversations: readonly Conversation[],
  badges: Readonly<Record<ConversationSide, number>>,
): MessageService {
  let snapshot = [...conversations];
  const listeners = new Set<() => void>();
  return {
    list: (side, query) => filterConversations(snapshot, side, query),
    badgeCount: (side) => badges[side],
    get: (id) => snapshot.find((conversation) => conversation.id === id),
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    openBuyerConversation(item) {
      const existing = snapshot.find((entry) => entry.side === 'buying' && (entry.listingId === item.id || (!entry.listingId && entry.participant === item.seller && entry.listing === item.title)));
      if (existing) return existing;
      const conversation: Conversation = {
        id: `buyer-${item.id}`, side: 'buying', participant: item.seller,
        initials: item.seller.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
        listing: item.title, listingId: item.id, verifiedSeller: !!item.verified,
        preview: 'Start a conversation', time: 'Now', unreadCount: 0, empty: true,
      };
      snapshot = [conversation, ...snapshot];
      listeners.forEach((listener) => listener());
      return conversation;
    },
  };
}
