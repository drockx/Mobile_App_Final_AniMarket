import { BackendError } from './core.mjs';
import { hash, id, member, text } from './records.mjs';

export function conversationDto(record, uid) {
  member(record, uid); const other = record.participants.find((value) => value !== uid); const peer = record.peers[other];
  return { id: record.id, side: uid === record.initiatorId ? 'buying' : 'selling', participant: peer.name, initials: peer.initials,
    participantId: other, listing: 'Direct conversation', preview: record.preview ?? '', time: '', unreadCount: (record.seq ?? 0) - (record.readBy?.[uid] ?? 0),
    verifiedSeller: peer.verified, updatedAt: record.updatedAt, lastMessageSeq: record.seq ?? 0, readSeq: record.readBy?.[uid] ?? 0,
    otherReadSeq: record.readBy?.[other] ?? 0, empty: !record.seq };
}
export function createChat({ store, accounts, now = Date.now }) {
  async function append(tx, record, uid, message, clientId) {
    member(record, uid); const messageId = `${uid}_${id(clientId)}`;
    const previous = await tx.get(`conversations/${record.id}/messages/${messageId}`);
    if (previous) {
      if (previous.text !== message) throw new BackendError('This message request was already used.', 409); return previous;
    }
    const seq = record.seq + 1; const createdAt = new Date(now()).toISOString();
    const value = { id: messageId, conversationId: record.id, senderId: uid, clientId, text: message, seq, createdAt };
    tx.set(`conversations/${record.id}/messages/${messageId}`, value);
    tx.set(`conversations/${record.id}`, { ...record, seq, preview: message, updatedAt: createdAt, readBy: { ...record.readBy, [uid]: seq } });
    return value;
  }
  return {
    append,
    async handle(uid, path, body, method) {
      if (path === '/conversations' && method === 'POST') {
        const recipientId = id(body.recipientId); if (recipientId === uid) throw new BackendError('Choose another user to message.', 400);
        const conversationId = await hash([uid, recipientId].sort().join('\0'));
        return store.transact(async (tx) => {
          const previous = await tx.get(`conversations/${conversationId}`);
          if (previous) return { conversation: conversationDto(previous, uid) };
          const peers = { [uid]: await accounts.peer(uid, tx), [recipientId]: await accounts.peer(recipientId, tx) };
          const record = { id: conversationId, initiatorId: uid, participants: [uid, recipientId], peers,
            seq: 0, preview: '', readBy: { [uid]: 0, [recipientId]: 0 }, updatedAt: new Date(now()).toISOString() };
          tx.set(`conversations/${conversationId}`, record); return { conversation: conversationDto(record, uid) };
        });
      }
      const match = path.match(/^\/conversations\/([\w-]+)\/(messages|read)$/);
      if (!match || method !== 'POST') return undefined;
      return store.transact(async (tx) => {
        const record = member(await tx.get(`conversations/${id(match[1])}`), uid);
        if (match[2] === 'messages') return { message: await append(tx, record, uid, text(body.text, 'message', 2000), id(body.clientId)) };
        if (!Number.isSafeInteger(body.throughSeq) || body.throughSeq < 0 || body.throughSeq > record.seq) throw new BackendError('Invalid message read position.', 400);
        tx.set(`conversations/${record.id}`, { ...record, readBy: { ...record.readBy, [uid]: Math.max(record.readBy[uid] ?? 0, body.throughSeq) } }); return {};
      });
    },
  };
}
