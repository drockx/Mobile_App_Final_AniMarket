import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirebaseServices } from '@/services/firebase';
import { requireFirebaseUser } from '@/services/firebase_identity';
import { cloudBackendRequest } from '@/services/supabase';
import { createLiveSync } from '@/services/live_sync';
import type { Conversation } from '../domain/conversation';
import type { ChatMessage, ChatUser, MessageRepository } from '../domain/message_repository';

const state = createLiveSync<Conversation[]>([]);
let uid = ''; let stop: (() => void) | undefined; let initialized = false;
function ensure() {
  const services = getFirebaseServices();
  if (!initialized) { initialized = true; onAuthStateChanged(services.auth, (user) => { if (user?.uid !== uid) { stop?.(); stop = undefined; uid = ''; state.reset(); } }); }
  const current = requireFirebaseUser().uid; if (current === uid && stop) return;
  stop?.(); uid = current; state.reset();
  stop = onSnapshot(query(collection(services.firestore, 'conversations'), where('participants', 'array-contains', uid)), (snapshot) => {
    const rows = snapshot.docs.map((document) => {
      const data = document.data(); const other = data.participants.find((participant: string) => participant !== current); const peer = data.peers[other];
      return { id: document.id, side: current === data.initiatorId ? 'buying' : 'selling', participant: peer.name, initials: peer.initials, participantId: other, listing: 'Direct conversation', preview: data.preview, time: '', unreadCount: data.seq - (data.readBy[current] ?? 0), verifiedSeller: peer.verified, updatedAt: data.updatedAt, lastMessageSeq: data.seq, readSeq: data.readBy[current] ?? 0, otherReadSeq: data.readBy[other] ?? 0, empty: !data.seq } as Conversation;
    }); state.update(rows.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')));
  }, (error) => state.fail(error));
}
export const firebaseMessageRepository: MessageRepository = {
  async sync(cursor, signal) { ensure(); const result = await state.wait(cursor, signal); return { cursor: result.cursor, conversations: result.value }; },
  async messages(id, page) {
    const current = requireFirebaseUser().uid; const ref = collection(getFirebaseServices().firestore, 'conversations', id, 'messages');
    const before = page.before !== undefined; const after = page.after !== undefined;
    const constraints = [...(before ? [where('seq', '<', page.before)] : after ? [where('seq', '>', page.after)] : []), orderBy('seq', after ? 'asc' : 'desc'), limit(51)];
    const result = await getDocs(query(ref, ...constraints)); if (requireFirebaseUser().uid !== current) throw new Error('Your account changed.');
    return { messages: result.docs.slice(0, 50).map((item) => item.data() as ChatMessage).sort((a, b) => a.seq - b.seq), hasMore: result.docs.length > 50 };
  },
  async search(value, signal) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const current = requireFirebaseUser().uid; const prefix = value.trim().toLowerCase(); if (!prefix) return [];
    const result = await getDocs(query(collection(getFirebaseServices().firestore, 'directory'), where('nameLower', '>=', prefix), where('nameLower', '<=', `${prefix}\uf8ff`), limit(20)));
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError'); if (requireFirebaseUser().uid !== current) throw new Error('Your account changed.');
    return result.docs.map((item) => item.data() as ChatUser).filter((item) => item.id !== current);
  },
  open: async (recipientId) => (await cloudBackendRequest<{ conversation: Conversation }>('/conversations', { recipientId })).conversation,
  send: async (id, text, clientId) => (await cloudBackendRequest<{ message: ChatMessage }>(`/conversations/${id}/messages`, { text, clientId })).message,
  read: async (id, throughSeq) => { await cloudBackendRequest(`/conversations/${id}/read`, { throughSeq }); },
};
