import { filterConversations, type Conversation, type ConversationSide } from '../domain/conversation';

export type MessageService = {
  list(side: ConversationSide, query: string): Conversation[];
  badgeCount(side: ConversationSide): number;
};

export function createMessageService(
  conversations: readonly Conversation[],
  badges: Readonly<Record<ConversationSide, number>>,
): MessageService {
  return {
    list: (side, query) => filterConversations(conversations, side, query),
    badgeCount: (side) => badges[side],
  };
}
