import { BackendError } from './core.mjs';

export function authorizeProfile(uid, profile, role, staffOnly = false) {
  if (staffOnly || profile == null) {
    if (role?.reviewer !== true) throw new BackendError('Reviewer access is required.', 403);
    return { reviewOnly: true, marketEditor: role.staff === true };
  }
  if (profile.id !== uid || profile.acceptedTerms !== true) throw new BackendError('Finish your AniMarket registration first.', 409);
  return { reviewOnly: false };
}

export function authorizeAction(session, path) {
  const marketAction = session.marketEditor === true && /^\/admin\/market-references(?:\/[\w-]+\/prices\/[\w-]+)?$/.test(path);
  if (session.reviewOnly && !marketAction && !/^\/verification\/reviews(?:\/[\w-]+)?$/.test(path)) {
    throw new BackendError(session.marketEditor ? 'This staff account can only review account IDs and maintain market references.' : 'This staff account can only review account IDs.', 403);
  }
}
