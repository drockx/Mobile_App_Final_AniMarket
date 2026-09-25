export type ConversationSide = 'buying' | 'selling';

export type Conversation = {
  id: string;
  side: ConversationSide;
  participant: string;
  initials: string;
  listing: string;
  preview: string;
  time: string;
  unreadCount: number;
  verifiedSeller: boolean;
};

export function filterConversations(
  conversations: readonly Conversation[],
  side: ConversationSide,
  query: string,
): Conversation[] {
  const search = query.trim().toLowerCase();
  return conversations.filter((conversation) =>
    conversation.side === side
    && (!search || `${conversation.participant} ${conversation.listing} ${conversation.preview}`.toLowerCase().includes(search)),
  );
}
