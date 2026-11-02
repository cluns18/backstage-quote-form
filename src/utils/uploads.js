// Artwork takes two roads to the shop, on purpose.
//
//   1. A LINK. The file is uploaded to the house file bucket (the same Firebase Storage
//      bucket every OBG calculator and the Print Master form use) and the lead email
//      carries a download link. This is the road a big file can take: a 300 dpi PNG or a
//      gang sheet is far larger than an email attachment may be.
//   2. A REAL ATTACHMENT. Files small enough also ride inside the lead request as base64
//      and are attached to the shop's email (see emailService.js).
//
// Neither road is allowed to cost the lead. If the upload fails the attachment still
// goes, if the attachment cannot go the link still goes, and if both fail the shop
// email names the file so it can be chased.
//
// The bucket settings are the public Firebase web config, read from VITE_FIREBASE_*
// at build time (.env.local here, site env vars on the host). They are designed to
// ship in a browser bundle and are not a secret. With them missing, `uploadsEnabled`
// is false and the form quietly falls back to attachments only.
import { SHOP_ID } from '../config';
import { stripControl } from './sanitize';

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// `npm run dev` never touches the real bucket: the dev server answers /__mock/upload.
const MOCKED = Boolean(env.DEV);
export const uploadsEnabled = MOCKED || Boolean(firebaseConfig.apiKey && firebaseConfig.storageBucket);

// The bucket rules allow a write under 25MB. 20MB is the house cap for a form.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const UPLOAD_TIMEOUT_MS = 60000;
const LINK_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
});

/**
 * The object key. FLAT under uploads/ because the bucket rule is
 * `match /uploads/{fileName}` and a single wildcard matches one path segment: a key
 * with a folder in it is refused with a 403. The shop is a prefix on the file name,
 * and the time plus a random piece keep two customers' logo.png from colliding.
 */
export const uploadKey = (name) => {
  const safe = stripControl(name).replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || 'file';
  return `uploads/${SHOP_ID}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
};

let store;
// The library is only fetched when a customer actually adds a file.
const getStore = () => {
  if (!store) {
    store = Promise.all([import('firebase/app'), import('firebase/storage')]).then(([app, st]) => {
      const storage = st.getStorage(app.initializeApp(firebaseConfig));
      // The library retries on its own for minutes. Hold it to the same clock as us.
      storage.maxUploadRetryTime = UPLOAD_TIMEOUT_MS;
      storage.maxOperationRetryTime = LINK_TIMEOUT_MS;
      return { st, storage };
    });
    store.catch(() => { store = null; });
  }
  return store;
};

const mockUpload = async (file, key) => {
  const res = await fetch(`/__mock/upload?name=${encodeURIComponent(key)}&bytes=${file.size}`, { method: 'POST' });
  if (!res.ok) throw new Error(`mock upload ${res.status}`);
  return (await res.json()).url;
};

/** Uploads one file and resolves its download link. Rejects on any failure or after a minute. */
export const uploadFile = async (file, name) => {
  if (!uploadsEnabled) throw new Error('uploads not configured');
  const key = uploadKey(name);
  if (MOCKED) return mockUpload(file, key);
  const { st, storage } = await withTimeout(getStore(), LINK_TIMEOUT_MS);
  const target = st.ref(storage, key);
  await withTimeout(st.uploadBytes(target, file, { contentType: file.type || 'application/octet-stream' }), UPLOAD_TIMEOUT_MS);
  return withTimeout(st.getDownloadURL(target), LINK_TIMEOUT_MS);
};

/** Only a link to the house bucket is ever trusted back out of storage or state. */
export const isUploadUrl = (url) => {
  try {
    const u = new URL(String(url || ''));
    if (MOCKED) return u.pathname.startsWith('/__mock/files/');
    return u.protocol === 'https:' && u.hostname === 'firebasestorage.googleapis.com';
  } catch {
    return false;
  }
};
