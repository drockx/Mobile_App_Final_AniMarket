import { BackendError } from './core.mjs';
import { id, text } from './records.mjs';
import { where } from './firestore.mjs';
import { inside } from './geofence.mjs';
import { documentBytes } from './media.mjs';

const cities = ['Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'Panabo City', 'Island Garden City of Samal', 'Sawata', 'Santo Tomas', 'Tagum City', 'Talaingod'];
const times = ['8:00 AM–10:00 AM', '10:00 AM–12:00 PM', '1:00 PM–3:00 PM', '3:00 PM–4:00 PM'];
const cleanPin = (p) => { if (!inside(p)) throw new BackendError('Choose a location within Davao del Norte.', 400); return { latitude: p.latitude, longitude: p.longitude }; };
function price(value, draft = false) { if (!Number.isFinite(value) || value < (draft ? 0 : 0.01) || value > 100000000) throw new BackendError('Enter a valid livestock price.', 400); return value; }
function date(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value <= new Date(now + 8 * 3600000).toISOString().slice(0, 10)) throw new BackendError('Choose a valid date from tomorrow onward.', 400); return value;
}
function itemOf(listing) {
  return { id: listing.id, title: listing.title, weight: listing.weight, health: listing.health, seller: listing.seller.name, sellerId: listing.seller.id,
    sellerAddress: [listing.streetPurok, listing.barangay, listing.location].filter(Boolean).join(', '), price: listing.price, priceUnit: listing.priceUnit,
    category: listing.category, verified: listing.verified, healthVerified: false, ...(listing.imageUri ? { imageUri: listing.imageUri } : {}), ...(listing.vaccinationProof ? { vaccinationProofName: listing.vaccinationProof.name } : {}) };
}
export function createCommerce({ store, accounts, media, now = Date.now }) {
  async function files(tx, uid, input) {
    const images = input.imageUris ?? (input.imageUri ? [input.imageUri] : []);
    if (!Array.isArray(images) || images.length > 4) throw new BackendError('Choose up to four livestock photos.', 400);
    const refs = [];
    for (const uri of images) {
      const uploadId = typeof uri === 'string' && uri.match(/\/([\w-]+)(?:\.[a-z]+)?$/)?.[1];
      const record = uploadId && await tx.get(`uploads/${id(uploadId)}`);
      if (!record || record.deleting || record.ownerId !== uid || record.kind !== 'listing' || record.url !== uri) throw new BackendError('Upload your livestock photos before saving.', 400); refs.push(record);
    }
    if (input.vaccinationProof) {
      const uploadId = input.vaccinationProof.uri?.match(/^private:\/\/vaccination\/([\w-]+)$/)?.[1];
      const record = uploadId && await tx.get(`uploads/${id(uploadId)}`);
      if (!record || record.deleting || record.ownerId !== uid || record.kind !== 'vaccination') throw new BackendError('Upload the vaccination proof again.', 400); refs.push(record);
    } return { images, refs };
  }
  return async (uid, path, body, method) => {
    if (path === '/uploads' && method === 'POST') {
      if (!['listing', 'vaccination'].includes(body.kind)) throw new BackendError('Choose a supported upload.', 400);
      const uploadId = crypto.randomUUID(); const name = text(body.name ?? 'photo.jpg', 'file name', 150);
      const value = body.kind === 'listing' ? await media.publicPhoto(uid, body.photo, uploadId)
        : { path: `${uid}/${uploadId}.${documentBytes(body.photo).mime === 'application/pdf' ? 'pdf' : documentBytes(body.photo).mime === 'image/png' ? 'png' : 'jpg'}`, bucket: 'animarket-documents', url: `private://vaccination/${uploadId}` };
      if (body.kind === 'vaccination') await media.privateDocument(value.bucket, value.path, body.photo);
      const record = { id: uploadId, ownerId: uid, kind: body.kind, name, ...value, refs: [], expiresAt: now() + 86400000 };
      try { await store.transact(async (tx) => tx.set(`uploads/${uploadId}`, record)); }
      catch (error) { if (value.publicId) await media.deletePublic(value.publicId).catch(() => {}); else await media.privateDelete(value.bucket, value.path).catch(() => {}); throw error; }
      return { uri: value.url, name };
    }
    if (path === '/listings/publish' && method === 'POST') {
      const input = body.listing; const listingId = id(input?.id); const draft = input.status === 'draft';
      if (!['active', 'draft'].includes(input.status) || !['Cow', 'Pig', 'Goat', 'Chicken'].includes(input.category) || !cities.some((city) => input.location === city || input.location === `${city}, Davao del Norte`)) throw new BackendError('Choose a livestock category and Davao del Norte location.', 400);
      const pin = body.pickupPin ? cleanPin(body.pickupPin) : null; if (!draft && !pin) throw new BackendError('Choose your exact pickup point.', 400);
      const fingerprint = JSON.stringify({ ...input, updatedAt: null, createdAt: null, verified: null, seller: null });
      return store.transact(async (tx) => {
        const person = draft ? await accounts.profile(uid, tx) : await accounts.seller(uid, tx);
        const previous = await tx.get(`listings/${listingId}`); const privateRecord = await tx.get(`listingPrivate/${listingId}`);
        if (previous && previous.seller.id !== uid) throw new BackendError('This listing belongs to another seller.', 403);
        if (previous && previous.status !== 'draft') {
          if (privateRecord?.fingerprint === fingerprint && JSON.stringify(privateRecord.pin) === JSON.stringify(pin)) return { listing: previous };
          throw new BackendError('This listing is already published. Open My Listings to edit it.', 409);
        }
        const owned = await tx.query('listings', [where('seller.id', uid)]);
        if (!previous && owned.length >= 20) throw new BackendError('Remove an old listing before creating another. You can keep 20 listings.', 409);
        const { images, refs } = await files(tx, uid, input);
        const saved = { id: listingId, title: text(input.title, 'title', 100), category: input.category, details: text(input.details, 'details', 250, true), price: price(input.price, draft), priceUnit: ['per head', 'per kg', 'total'].includes(input.priceUnit) ? input.priceUnit : 'per head',
          location: input.location, streetPurok: text(input.streetPurok ?? '', 'street', 150, true), barangay: text(input.barangay ?? '', 'barangay', 100, true), weight: text(input.weight, 'weight', 40, true), age: text(input.age, 'age', 50, true),
          health: ['Vaccinated', 'Not vaccinated', 'Unknown'].includes(input.health) ? input.health : 'Unknown', healthVerification: { status: 'unverified' }, description: text(input.description, 'description', 2000, true), imageUris: images,
          ...(images[0] ? { imageUri: images[0] } : {}), ...(input.vaccinationProof ? { vaccinationProof: { name: text(input.vaccinationProof.name, 'proof name', 150), uri: input.vaccinationProof.uri }, vaccinationDate: text(input.vaccinationDate ?? '', 'vaccination date', 20, true), vaccineName: text(input.vaccineName ?? '', 'vaccine name', 100, true) } : {}),
          seller: { id: uid, name: person.personal.fullName, memberSince: new Date(person.createdAt).getFullYear().toString() }, verified: !draft, status: input.status, createdAt: previous?.createdAt ?? new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
        tx.set(`listings/${listingId}`, saved); tx.set(`listingPrivate/${listingId}`, { id: listingId, ownerId: uid, pin, fingerprint, uploadIds: refs.map((ref) => ref.id) });
        for (const ref of refs) tx.set(`uploads/${ref.id}`, { ...ref, refs: [...new Set([...ref.refs, listingId])], expiresAt: null });
        for (const refId of privateRecord?.uploadIds ?? []) if (!refs.some((ref) => ref.id === refId)) { const ref = await tx.get(`uploads/${refId}`); if (ref) tx.set(`uploads/${refId}`, { ...ref, refs: ref.refs.filter((value) => value !== listingId), expiresAt: now() + 86400000 }); }
        return { listing: saved };
      });
    }
    const listingRoute = path.match(/^\/listings\/([\w-]+)\/(save|remove|pin)$/);
    if (listingRoute) {
      const listingId = id(listingRoute[1]);
      return store.transact(async (tx) => {
        const before = await tx.get(`listings/${listingId}`); const privateRecord = await tx.get(`listingPrivate/${listingId}`);
        if (!before) throw new BackendError('This listing is unavailable.', 404);
        if (listingRoute[2] === 'pin' && method === 'GET') {
          // Authenticated checkout needs the seller's meeting point; it is never in public listing records.
          if (before.status !== 'active' && before.seller.id !== uid) throw new BackendError('This listing is unavailable.', 404);
          return { pin: privateRecord?.pin ?? null };
        }
        if (method !== 'POST' || before.seller.id !== uid) throw new BackendError('This listing belongs to another seller.', 403);
        if (privateRecord?.acceptedOrderId) throw new BackendError('Finish or cancel the active order before changing this listing.', 409);
        if (listingRoute[2] === 'remove') {
          const orders = await tx.query('orders', [where('draft.item.id', listingId)]);
          if (orders.some((order) => !['completed', 'cancelled', 'rejected'].includes(order.status))) throw new BackendError('Resolve the listing’s open orders before removing it.', 409);
          for (const refId of privateRecord?.uploadIds ?? []) { const ref = await tx.get(`uploads/${refId}`); if (ref) tx.set(`uploads/${refId}`, { ...ref, refs: ref.refs.filter((value) => value !== listingId), expiresAt: now() + 86400000 }); }
          tx.delete(`listings/${listingId}`); tx.delete(`listingPrivate/${listingId}`); return {};
        }
        if (!['active', 'paused'].includes(before.status) || !['active', 'paused'].includes(body.listing?.status)) throw new BackendError('This listing cannot be changed.', 409);
        if (body.listing.status === 'active') await accounts.seller(uid, tx);
        const saved = { ...before, price: price(body.listing.price), status: body.listing.status, updatedAt: new Date(now()).toISOString() }; tx.set(`listings/${listingId}`, saved); return { listing: saved };
      });
    }
    if (path === '/orders/save' && method === 'POST') {
      const input = body.order; const orderId = id(input?.id);
      return store.transact(async (tx) => {
        const before = await tx.get(`orders/${orderId}`);
        if (before) {
          if (!before.participants.includes(uid)) throw new BackendError('This order is unavailable.', 404);
          if (input.status === before.status || (input.status === 'saved-locally' && before.ownerId === uid)) return { order: before };
          const seller = before.sellerId === uid; const next = input.status;
          const transitions = seller ? { 'awaiting-seller': ['accepted', 'rejected'], accepted: ['scheduled'], scheduled: ['ready'], ready: before.draft.fulfillment === 'delivery' ? ['in-transit'] : [] } : { ready: ['completed'], 'in-transit': ['completed'] };
          const canCancel = !seller && next === 'cancelled' && ['awaiting-seller', 'accepted', 'scheduled'].includes(before.status);
          if (!canCancel && !(transitions[before.status] ?? []).includes(next)) throw new BackendError('This order action is unavailable for your account or current status.', 409);
          const listing = await tx.get(`listings/${before.draft.item.id}`); const priv = await tx.get(`listingPrivate/${before.draft.item.id}`);
          if (next === 'accepted') {
            await accounts.seller(uid, tx);
            if (!listing || listing.status !== 'active' || priv?.acceptedOrderId) throw new BackendError('This livestock is already reserved or unavailable.', 409);
            tx.set(`listings/${listing.id}`, { ...listing, status: 'paused', updatedAt: new Date(now()).toISOString() }); tx.set(`listingPrivate/${listing.id}`, { ...priv, acceptedOrderId: orderId });
          }
          if (listing && priv?.acceptedOrderId === orderId && ['cancelled', 'completed'].includes(next)) {
            tx.set(`listings/${listing.id}`, { ...listing, status: next === 'completed' ? 'sold' : 'active', updatedAt: new Date(now()).toISOString() }); tx.set(`listingPrivate/${listing.id}`, { ...priv, acceptedOrderId: null });
          }
          const saved = { ...before, status: next, updatedAt: new Date(now()).toISOString(), ...(next === 'cancelled' ? { cancelledAt: new Date(now()).toISOString() } : {}) }; tx.set(`orders/${orderId}`, saved); return { order: saved };
        }
        if (input.ownerId !== uid) throw new BackendError('The order must belong to your account.', 403);
        const buyer = await accounts.buyer(uid, tx);
        const draft = input.draft; const listing = await tx.get(`listings/${id(draft?.item?.id)}`);
        if (!listing || listing.status !== 'active' || listing.seller.id === uid) throw new BackendError('Choose an available listing from another seller.', 409);
        await accounts.seller(listing.seller.id, tx);
        if (draft.item.price !== listing.price || draft.item.priceUnit !== listing.priceUnit || draft.item.weight !== listing.weight) throw new BackendError('The price or weight changed. Review checkout again.', 409);
        if (!['cod', 'seller'].includes(draft.payment) || !['pickup', 'delivery'].includes(draft.fulfillment)) throw new BackendError('Choose payment and fulfillment.', 400);
        const existing = await tx.query('orders', [where('ownerId', uid)]);
        if (existing.some((order) => order.draft.item.id === listing.id && !['cancelled', 'completed', 'rejected'].includes(order.status))) throw new BackendError('You already have an open order for this listing.', 409);
        let pickup = null, delivery = null;
        if (draft.fulfillment === 'pickup') { if (!times.includes(draft.pickup?.time)) throw new BackendError('Choose a pickup time.', 400); pickup = { date: date(draft.pickup.date, now()), time: draft.pickup.time }; }
        else {
          const value = draft.delivery;
          if (!value || !cities.includes(value.city) || value.province !== 'Davao del Norte' || value.accessibleDestination !== true || !/^[+\d\s()-]{7,20}$/.test(value.phone) || !/^\d{4}$/.test(value.postal)) throw new BackendError('Complete the delivery address and phone number.', 400);
          const pin = cleanPin(value.location?.coordinate);
          delivery = { date: date(value.date, now()), receiver: text(value.receiver, 'receiver', 100), phone: value.phone, street: text(value.street, 'street', 150), barangay: text(value.barangay, 'barangay', 100), city: value.city, province: value.province, postal: value.postal, landmark: text(value.landmark ?? '', 'landmark', 150, true), notes: text(value.notes ?? '', 'notes', 500, true), accessibleDestination: true, location: { coordinate: pin, address: null, source: 'map' }, feeMin: 2500, feeMax: 3500 };
        }
        const amount = listing.priceUnit === 'per kg' ? listing.price * Number.parseFloat(listing.weight) : listing.price;
        if (!Number.isFinite(amount) || amount <= 0) throw new BackendError('The seller must correct this listing’s price or weight.', 409);
        const privateListing = await tx.get(`listingPrivate/${listing.id}`);
        const saved = { id: orderId, ownerId: uid, sellerId: listing.seller.id, buyerName: buyer.personal.fullName, participants: [uid, listing.seller.id], createdAt: new Date(now()).toISOString(), status: 'awaiting-seller',
          ...(privateListing?.pin ? { pickupPin: privateListing.pin } : {}), draft: { item: itemOf(listing), payment: draft.payment, fulfillment: draft.fulfillment, pickup, delivery, totalMin: amount + (delivery ? 2500 : 0), totalMax: amount + (delivery ? 3500 : 0) } };
        tx.set(`orders/${orderId}`, saved); return { order: saved };
      });
    }
    return undefined;
  };
}
