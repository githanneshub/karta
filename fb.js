// Firebase connection for the family version of the map (only loaded on the hosted site, not on claude.ai).
// Exposes window.FB with sign-in helpers and a small database wrapper shaped like the claude.ai db capability,
// so the rest of the app talks to either backend the same way.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, updateProfile, connectAuthEmulator, browserLocalPersistence, setPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, setDoc, deleteDoc,
  getDoc, serverTimestamp, connectFirestoreEmulator, writeBatch, deleteField,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG;
const app = initializeApp(cfg);
const auth = getAuth(app);
// Offline cache: the map keeps working with weak signal in the forest and syncs when it comes back.
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
if (cfg.emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(fs, "127.0.0.1", 8080);
}
await setPersistence(auth, browserLocalPersistence).catch(() => {});

const wrapDoc = (d) => ({ id: d.id, exists: d.exists(), data: () => d.data(), metadata: d.metadata });

function docRef(path) {
  const r = doc(fs, path);
  return {
    id: r.id, path,
    get: () => getDoc(r).then(wrapDoc),
    set: (body, opts) => setDoc(r, body, opts || {}),
    update: (body) => setDoc(r, body, { merge: true }),
    delete: () => deleteDoc(r),
    onSnapshot: (next, err) => onSnapshot(r, { includeMetadataChanges: true }, (d) => next(wrapDoc(d)), err),
  };
}

const db = {
  doc: docRef,
  collection: (path) => ({
    path,
    doc: (id) => docRef(`${path}/${id}`),
    onSnapshot: (next, err) => onSnapshot(collection(fs, path), { includeMetadataChanges: true },
      (s) => next({ docs: s.docs.map(wrapDoc), size: s.size, empty: s.empty, metadata: s.metadata }), err),
  }),
  async batchSet(items) {  // [{ path, body }]
    for (let i = 0; i < items.length; i += 400) {
      const b = writeBatch(fs);
      for (const it of items.slice(i, i + 400)) b.set(doc(fs, it.path), it.body);
      await b.commit();
    }
  },
};

// phone notifications (Firebase Cloud Messaging), loaded only when used
const messaging = async () => {
  const m = await import("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js");
  return { m, msg: m.getMessaging(app) };
};
const push = {
  async token(reg) {
    const { m, msg } = await messaging();
    if (!(await m.isSupported())) throw new Error("not supported");
    return m.getToken(msg, { serviceWorkerRegistration: reg, ...(cfg.vapidKey ? { vapidKey: cfg.vapidKey } : {}) });
  },
  async remove() { const { m, msg } = await messaging(); return m.deleteToken(msg); },
};

window.FB = {
  db,
  push,
  deleteField,
  serverTimestamp,
  onAuth: (cb) => onAuthStateChanged(auth, cb),
  currentUser: () => auth.currentUser,
  signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
  async signUp(email, pw, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    if (name) await updateProfile(cred.user, { displayName: name }).catch(() => {});
    await sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  },
  resendVerification: () => sendEmailVerification(auth.currentUser),
  async reloadUser() { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return auth.currentUser; },
  resetPassword: (email) => sendPasswordResetEmail(auth, email),
  signOut: () => signOut(auth),
};
window.dispatchEvent(new Event("fb-ready"));
