import { BackendError } from './core.mjs';
import { id, text } from './records.mjs';
import { imageBytes } from './media.mjs';

const localities = ['Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'Panabo City', 'Island Garden City of Samal', 'Sawata', 'Santo Tomas', 'Tagum City', 'Talaingod'];
const types = ['National ID', 'Passport', 'Driver’s license', 'UMID', 'Other valid photo ID'];
export function createAccountActions({ store, media, accounts, authAdmin, now = Date.now }) {
  async function cleanup(record) {
    if (!record?.photoPath) return;
    try { await media.privateDelete('animarket-ids', record.photoPath); }
    catch { await store.transact(async (tx) => tx.set(`mediaCleanup/${record.submissionId}`, { id: record.submissionId, bucket: 'animarket-ids', path: record.photoPath, expiresAt: now() })); }
  }
  async function cleanupPublic(publicId) {
    if (!publicId) return;
    try { await media.deletePublic(publicId); }
    catch { const cleanupId = crypto.randomUUID(); await store.transact(async (tx) => tx.set(`mediaCleanup/${cleanupId}`, { id: cleanupId, publicId, expiresAt: now() })); }
  }
  async function reviewer(uid) { if ((await store.get(`roles/${uid}`))?.reviewer !== true) throw new BackendError('Reviewer access is required.', 403); }
  async function directory(tx, uid, person, verified) {
    tx.set(`directory/${uid}`, { id: uid, fullName: person.personal.fullName, nameLower: person.personal.fullName.toLowerCase(), city: person.personal.city, verified });
    const listings = await tx.query('listings', [{ fieldFilter: { field: { fieldPath: 'seller.id' }, op: 'EQUAL', value: { stringValue: uid } } }]);
    for (const listing of listings) tx.set(`listings/${listing.id}`, { ...listing, verified, seller: { ...listing.seller, name: person.personal.fullName } });
    const chats = await tx.query('conversations', [{ fieldFilter: { field: { fieldPath: 'participants' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } } }]);
    for (const chat of chats) tx.set(`conversations/${chat.id}`, { ...chat, peers: { ...chat.peers, [uid]: { ...chat.peers[uid], name: person.personal.fullName, city: person.personal.city, verified } } });
  }
  return async (session, path, body, method) => {
    const uid = session.uid;
    if (path === '/auth/email' && method === 'POST') {
      const email = text(body.email, 'email address', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isFinite(session.authTime) || now() / 1000 - session.authTime > 300) throw new BackendError('Confirm your current password before changing your email.', 403);
      const person = await accounts.profile(uid); const previousEmail = session.record.email;
      if (email !== previousEmail) await authAdmin('update', { localId: uid, email });
      try { await store.transact(async (tx) => { const current = await accounts.profile(uid, tx); tx.set(`users/${uid}`, { ...current, personal: { ...current.personal, email } }); }); }
      catch (error) { if (email !== previousEmail) await authAdmin('update', { localId: uid, email: previousEmail }).catch(() => {}); throw error; }
      return { email };
    }
    if (path === '/auth/me' && method === 'PATCH') {
      const personal = { fullName: text(body.fullName, 'full name', 100), email: session.record.email, phone: text(body.phone, 'phone number', 20), city: body.city };
      if (!/^[+\d\s()-]{7,20}$/.test(personal.phone) || (personal.city !== '' && !localities.includes(personal.city))) throw new BackendError('Choose a valid phone number and Davao del Norte locality.', 400);
      const address = Object.fromEntries(['street', 'barangay', 'postalCode'].filter((key) => body[key] !== undefined).map((key) => {
        const value = body[key]; const max = key === 'street' ? 150 : key === 'barangay' ? 100 : 4;
        if (typeof value !== 'string' || value.trim().length > max) throw new BackendError('Enter a valid address.', 400);
        return [key, value.trim()];
      }));
      if (address.postalCode && !/^\d{4}$/.test(address.postalCode)) throw new BackendError('Enter a four-digit postal code.', 400);
      if (personal.city === '' && Object.values(address).some(Boolean)) throw new BackendError('Choose a city or municipality for your address.', 400);
      const old = await store.transact(async (tx) => {
        const before = await accounts.profile(uid, tx); const review = await tx.get(`verifications/${uid}`);
        const changed = before.personal.fullName !== personal.fullName;
        const next = { ...before, ...address, personal, username: personal.fullName }; tx.set(`users/${uid}`, next);
        if (changed && review) tx.set(`verifications/${uid}`, { ...review, status: 'expired', reason: 'Submit a new ID matching your updated full name.', photoPath: null, expiresAt: null });
        await directory(tx, uid, next, !changed && accounts.status(review, next).status === 'verified');
        return changed ? review : null;
      });
      await cleanup(old); return { account: await accounts.account(uid) };
    }
    if (path === '/auth/photo' && method === 'POST') {
      imageBytes(body.photo, 1048576); const version = crypto.randomUUID(); const uploaded = await media.publicPhoto(uid, body.photo, version);
      let previous;
      try { previous = await store.transact(async (tx) => { const person = await accounts.profile(uid, tx); tx.set(`users/${uid}`, { ...person, avatar: { ...uploaded, version } }); return person.avatar; }); }
      catch (error) { await media.deletePublic(uploaded.publicId).catch(() => {}); throw error; }
      await cleanupPublic(previous?.publicId);
      return { account: await accounts.account(uid) };
    }
    if (path === '/auth/photo/remove' && method === 'POST') {
      const previous = await store.transact(async (tx) => { const person = await accounts.profile(uid, tx); tx.set(`users/${uid}`, { ...person, avatar: null }); return person.avatar; });
      await cleanupPublic(previous?.publicId); return { account: await accounts.account(uid) };
    }
    if (path === '/verification/id' && method === 'POST') {
      const person = await accounts.profile(uid); const old = await store.get(`verifications/${uid}`);
      if (accounts.status(old, person).status === 'pending' || accounts.status(old, person).status === 'verified') throw new BackendError('Your ID is already submitted or approved.', 409);
      if (!types.includes(body.idType) || body.consent !== true || body.fullName !== person.personal.fullName) throw new BackendError('Choose a valid ID and confirm that its name matches your account.', 400);
      const { mime } = imageBytes(body.photo); const submissionId = crypto.randomUUID(); const photoPath = `${uid}/${submissionId}.${mime === 'image/png' ? 'png' : 'jpg'}`;
      await media.privatePhoto('animarket-ids', photoPath, body.photo);
      try { await store.transact(async (tx) => {
        const fresh = await accounts.profile(uid, tx); const review = await tx.get(`verifications/${uid}`);
        if (fresh.personal.fullName !== body.fullName || ['pending', 'verified'].includes(accounts.status(review, fresh).status)) throw new BackendError('Your account or ID submission changed. Please refresh.', 409);
        tx.set(`verifications/${uid}`, { userId: uid, submissionId, fullName: body.fullName, idType: body.idType, status: 'pending', submittedAt: new Date(now()).toISOString(), reviewedAt: null, reason: '', photoPath, expiresAt: now() + 30 * 86400000 });
      }); } catch (error) { await cleanup({ submissionId, photoPath }); throw error; }
      await cleanup(old); return { account: await accounts.account(uid) };
    }
    if (path === '/verification/id' && method === 'GET') {
      const record = await store.get(`verifications/${uid}`);
      if (!record?.photoPath || record.status !== 'pending' || record.expiresAt <= now()) throw new BackendError('No pending ID photo is available.', 404);
      return { ...accounts.status(record, await accounts.profile(uid)), photo: await media.privateRead('animarket-ids', record.photoPath) };
    }
    if (['/verification/id/withdraw', '/verification/withdraw'].includes(path) && method === 'POST') {
      const old = await store.transact(async (tx) => { const record = await tx.get(`verifications/${uid}`); if (record?.status !== 'pending') throw new BackendError('Only a pending submission can be withdrawn.', 409); tx.delete(`verifications/${uid}`); return record; });
      await cleanup(old); return { account: await accounts.account(uid) };
    }
    if (path === '/verification/reviews' && method === 'GET') {
      await reviewer(uid); const rows = await store.query('verifications', [{ fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } }]);
      return { reviews: rows.filter((row) => row.status === 'pending' && row.expiresAt > now() && row.userId !== uid).map(({ userId, submissionId, fullName, idType, submittedAt }) => ({ userId, submissionId, fullName, idType, submittedAt })) };
    }
    const match = path.match(/^\/verification\/reviews\/([\w-]+)$/);
    if (match) {
      await reviewer(uid); const target = id(match[1]); if (uid === target) throw new BackendError('You cannot review your own ID.', 403);
      if (method === 'GET') {
        const row = await store.get(`verifications/${target}`);
        if (!row?.photoPath || row.status !== 'pending' || row.expiresAt <= now()) throw new BackendError('This submission is no longer pending.', 409);
        return { userId: target, submissionId: row.submissionId, fullName: row.fullName, idType: row.idType, submittedAt: row.submittedAt, city: (await accounts.profile(target)).personal.city, photo: await media.privateRead('animarket-ids', row.photoPath) };
      }
      if (method === 'POST') {
        if (!['verified', 'rejected'].includes(body.decision)) throw new BackendError('Choose approve or reject.', 400);
        const reason = text(body.reason ?? '', 'review reason', 500, body.decision === 'verified');
        const old = await store.transact(async (tx) => {
          if (!(await tx.get(`roles/${uid}`))?.reviewer) throw new BackendError('Reviewer access is required.', 403);
          const row = await tx.get(`verifications/${target}`); const person = await accounts.profile(target, tx);
          if (!row || row.submissionId !== body.submissionId || row.status !== 'pending' || row.expiresAt <= now() || row.fullName !== person.personal.fullName) throw new BackendError('This submission has changed or expired.', 409);
          tx.set(`verifications/${target}`, { ...row, status: body.decision, reviewedAt: new Date(now()).toISOString(), reviewerId: uid, reason, photoPath: null, expiresAt: null });
          await directory(tx, target, person, body.decision === 'verified'); return row;
        }); await cleanup(old); return { account: await accounts.account(target) };
      }
    }
    return undefined;
  };
}
