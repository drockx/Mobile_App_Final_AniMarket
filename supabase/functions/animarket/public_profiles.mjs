import { BackendError } from './core.mjs';
import { id } from './records.mjs';

// Private account records never leave this handler; expose only these public fields.
export function createPublicProfiles({ store, accounts, now = Date.now }) {
  async function targetProfile(uid, tx) {
    const person = await tx.get(`users/${uid}`);
    if (person?.id !== uid || !person.personal || person.acceptedTerms !== true || (await tx.get(`roles/${uid}`))?.staff === true) {
      throw new BackendError('This user profile is unavailable.', 404);
    }
    return person;
  }
  function view(person, review, summary, ownRating, viewer) {
    const count = summary?.count ?? 0;
    return { profile: {
      id: person.id, fullName: person.personal.fullName, city: person.personal.city,
      phone: person.personal.phone ?? '', email: person.personal.email ?? '',
      memberSince: person.createdAt, verified: accounts.status(review, person).status === 'verified',
      photoUrl: person.avatar?.url ?? null,
      rating: { count, average: count ? Math.round(summary.sum / count * 10) / 10 : null },
      myRating: ownRating?.stars ?? null, canRate: viewer !== person.id,
    } };
  }
  return async (session, path, body, method) => {
    const match = /^\/users\/([a-zA-Z0-9_-]{1,200})(\/rating)?$/.exec(path);
    if (!match) return undefined;
    if (!session.uid) throw new BackendError('Sign in to view user profiles.', 401);
    if (session.reviewOnly) throw new BackendError('Use a personal account to view or rate users.', 403);
    const viewer = id(session.uid), target = id(match[1]);
    const save = !!match[2] && method === 'POST';
    if ((!save && (match[2] || method !== 'GET'))) throw new BackendError('This profile action is unavailable.', 405);
    if (save && viewer === target) throw new BackendError('You cannot rate your own account.', 403);
    if (save && (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isInteger(body.stars) || body.stars < 1 || body.stars > 5)) {
      throw new BackendError('Choose a rating from 1 to 5 stars.', 400);
    }
    const summaryPath = `ratingSummaries/${target}`, ratingPath = `userRatings/${target}/raters/${viewer}`;
    const action = async (tx) => {
      await accounts.profile(viewer, tx);
      const person = await targetProfile(target, tx);
      const [review, summary, previous] = await Promise.all([
        tx.get(`verifications/${target}`), tx.get(summaryPath), tx.get(ratingPath),
      ]);
      if (!save) return view(person, review, summary, previous, viewer);
      // One rating per person. A retry or an edit never increases the count twice.
      const nextSummary = { userId: target, count: (summary?.count ?? 0) + (previous ? 0 : 1),
        sum: (summary?.sum ?? 0) - (previous?.stars ?? 0) + body.stars };
      const updatedAt = new Date(now()).toISOString();
      const rating = { userId: target, raterId: viewer, stars: body.stars, createdAt: previous?.createdAt ?? updatedAt, updatedAt };
      tx.set(ratingPath, rating); tx.set(summaryPath, nextSummary);
      return view(person, review, nextSummary, rating, viewer);
    };
    return save ? store.transact(action) : action(store);
  };
}
