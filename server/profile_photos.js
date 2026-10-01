const { randomUUID } = require('node:crypto');

function createProfilePhotos({ db, ApiError, notify }) {
  const maximum = 1024 * 1024;
  const get = (userId) => db.prepare('SELECT * FROM profile_photos WHERE user_id = ?').get(userId);
  const version = (userId) => db.prepare('SELECT version FROM profile_photos WHERE user_id = ?').get(userId)?.version || null;
  async function handle({ user, req, url, bodyJson, respond, account }) {
    if (!['/auth/photo', '/auth/photo/remove'].includes(url.pathname)) return false;
    if (url.pathname === '/auth/photo' && req.method === 'GET') {
      const row = get(user.id);
      if (!row) throw new ApiError(404, 'No profile photo is saved.');
      respond(200, { version: row.version, photo: `data:${row.mime_type};base64,${Buffer.from(row.photo).toString('base64')}` }); return true;
    }
    if (url.pathname === '/auth/photo' && req.method === 'POST') {
      const body = await bodyJson(req, Math.ceil(maximum * 4 / 3) + 4096);
      if (typeof body.photo !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.photo) || body.photo.length % 4 !== 0) throw new ApiError(400, 'Choose a JPEG or PNG profile photo.');
      const photo = Buffer.from(body.photo, 'base64');
      if (photo.length > maximum) throw new ApiError(413, 'Choose a profile photo smaller than 1 MB.');
      const png = photo.length > 45 && photo.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && photo.subarray(12, 16).toString() === 'IHDR' && photo.subarray(-8, -4).toString() === 'IEND';
      const jpeg = photo.length > 4 && photo.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) && photo.subarray(-2).equals(Buffer.from('ffd9', 'hex'));
      if (!png && !jpeg) throw new ApiError(400, 'Choose a JPEG or PNG profile photo.');
      db.prepare(`INSERT INTO profile_photos (user_id, version, photo, mime_type) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, photo = excluded.photo, mime_type = excluded.mime_type`).run(user.id, randomUUID(), photo, png ? 'image/png' : 'image/jpeg');
      notify([user.id]); respond(200, { account: account(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) }); return true;
    }
    if (url.pathname === '/auth/photo/remove' && req.method === 'POST') {
      db.prepare('DELETE FROM profile_photos WHERE user_id = ?').run(user.id);
      notify([user.id]); respond(200, { account: account(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) }); return true;
    }
    throw new ApiError(404, 'Profile photo action not found.');
  }
  return { handle, version };
}
module.exports = { createProfilePhotos };
