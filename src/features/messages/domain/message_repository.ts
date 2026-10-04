import type { Conversation } from './conversation';

export type ChatMessage = { id: string; seq: number; conversationId: string; senderId: string; clientId: string; text: string; createdAt: string };
export type ChatUser = { id: string; fullName: string; city: string };
export type MessagePage = { messages: ChatMessage[]; hasMore: boolean };
export type MessageRepository = {
  sync(cursor: number | null, signal: AbortSignal): Promise<{ cursor: number; conversations: Conversation[] }>;
  messages(id: string, page: { before?: number; after?: number }): Promise<MessagePage>;
  watchMessages?(id: string, receive: (page: MessagePage) => void, fail: (error: Error) => void): () => void;
  open(recipientId: string): Promise<Conversation>;
  search(query: string, signal?: AbortSignal): Promise<ChatUser[]>;
  send(id: string, text: string, clientId: string): Promise<ChatMessage>;
  read(id: string, throughSeq: number): Promise<void>;
};
