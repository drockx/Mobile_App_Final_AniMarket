import { BackendError } from './core.mjs';

export function authorizeProfile(uid, profile, role, staffOnly = false) {
  if (staffOnly || profile == null) {
    if (role?.reviewer !== true) throw new BackendError('Reviewer access is required.', 403);
    return { reviewOnly: true };
  }
  if (profile.id !== uid || profile.acceptedTerms !== true) throw new BackendError('Finish your AniMarket registration first.', 409);
  return { reviewOnly: false };
}

export function authorizeAction(session, path) {
  if (session.reviewOnly && !/^\/verification\/reviews(?:\/[\w-]+)?$/.test(path)) {
    throw new BackendError('This staff account can only review account IDs.', 403);
  }
}
