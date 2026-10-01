import { apiRequest } from '@/services/api';
import type { Conversation } from '../domain/conversation';
import type { ChatMessage, ChatUser, MessagePage, MessageRepository } from '../domain/message_repository';

export const apiMessageRepository: MessageRepository = {
  sync: (cursor, signal) => apiRequest(`/sync${cursor === null ? '' : `?cursor=${cursor}`}`, { signal, timeout: 32000 }),
  messages: (id, page) => apiRequest<MessagePage>(`/conversations/${encodeURIComponent(id)}/messages?${page.before ? `before=${page.before}` : page.after !== undefined ? `after=${page.after}` : ''}`),
  open: async (recipientId) => (await apiRequest<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { recipientId } })).conversation,
  search: async (query, signal) => (await apiRequest<{ users: ChatUser[] }>(`/users?q=${encodeURIComponent(query)}`, { signal })).users,
  send: async (id, text, clientId) => (await apiRequest<{ message: ChatMessage }>(`/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { text, clientId } })).message,
  read: async (id, throughSeq) => { await apiRequest(`/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: { throughSeq } }); },
};
