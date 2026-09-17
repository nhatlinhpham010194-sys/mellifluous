import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc as rawSetDoc,
  getDoc,
  updateDoc as rawUpdateDoc,
  increment,
  onSnapshot as rawOnSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  addDoc as rawAddDoc,
  deleteDoc as rawDeleteDoc,
  getDocs,
  writeBatch as rawWriteBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  disableNetwork,
  type Firestore,
  type SetOptions,
  type DocumentReference,
  type DocumentData,
  type UpdateData,
  type CollectionReference,
  type QuerySnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Support both environment variables (for GitHub Pages / Vercel / external hosting) and direct config
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const resolvedFirebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig?.projectId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig?.appId,
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId,
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// Initialize Firestore with specific database ID from config if present
export const db: Firestore = resolvedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ============================================================================
// FIRESTORE QUOTA CIRCUIT BREAKER & GRACEFUL DEGRADATION ENGINE
// Protects the app from daily quota exhaustion (20,000 writes/day free tier)
// and prevents infinite backoff retry loops in console.
// ============================================================================

let isQuotaExhaustedMemory = false;
try {
  if (typeof window !== 'undefined' && sessionStorage.getItem('mel_fs_quota_exceeded') === 'true') {
    isQuotaExhaustedMemory = true;
  }
} catch {}

export const isFirestoreQuotaExhausted = (): boolean => isQuotaExhaustedMemory;

export const markFirestoreQuotaExhausted = () => {
  if (!isQuotaExhaustedMemory) {
    isQuotaExhaustedMemory = true;
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mel_fs_quota_exceeded', 'true');
      }
    } catch {}
    // Disable Firestore network write-stream retries to stop the backoff loop immediately
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
    console.info(
      '[Mellifluous Storage] Firestore write quota reached for today. System seamlessly transitioned to Local & Server persistence engine.'
    );
  }
};

// If session was already marked exhausted, disable network immediately on load
if (isQuotaExhaustedMemory) {
  try {
    disableNetwork(db).catch(() => {});
  } catch {}
}

export const checkAndHandleQuotaError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  if (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units')
  ) {
    markFirestoreQuotaExhausted();
    return true;
  }
  return false;
};

// Safe setDoc wrapper: skips Firestore writes if quota is exceeded
export const setDoc = async (
  docRef: DocumentReference<DocumentData>,
  data: DocumentData,
  options?: SetOptions
): Promise<void> => {
  if (isQuotaExhaustedMemory) {
    return Promise.resolve();
  }
  try {
    if (options) {
      await rawSetDoc(docRef, data, options);
    } else {
      await rawSetDoc(docRef, data);
    }
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Safe updateDoc wrapper: skips Firestore writes if quota is exceeded
export const updateDoc = async (
  docRef: DocumentReference<DocumentData>,
  dataOrField: UpdateData<DocumentData> | string,
  ...moreFieldsAndValues: any[]
): Promise<void> => {
  if (isQuotaExhaustedMemory) {
    return Promise.resolve();
  }
  try {
    await (rawUpdateDoc as any)(docRef, dataOrField, ...moreFieldsAndValues);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Safe deleteDoc wrapper: skips Firestore writes if quota is exceeded
export const deleteDoc = async (docRef: DocumentReference<DocumentData>): Promise<void> => {
  if (isQuotaExhaustedMemory) {
    return Promise.resolve();
  }
  try {
    await rawDeleteDoc(docRef);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve();
    }
    throw err;
  }
};

// Safe addDoc wrapper: skips Firestore writes if quota is exceeded
export const addDoc = async (
  collectionRef: CollectionReference<DocumentData>,
  data: DocumentData
): Promise<any> => {
  if (isQuotaExhaustedMemory) {
    return Promise.resolve({ id: 'local_' + Date.now() });
  }
  try {
    return await rawAddDoc(collectionRef, data);
  } catch (err: any) {
    if (checkAndHandleQuotaError(err)) {
      return Promise.resolve({ id: 'local_' + Date.now() });
    }
    throw err;
  }
};

// Safe writeBatch wrapper
export const writeBatch = (firestore: Firestore) => {
  const batch = rawWriteBatch(firestore);
  return {
    set: (docRef: DocumentReference<DocumentData>, data: DocumentData, options?: SetOptions) => {
      if (!isQuotaExhaustedMemory) {
        if (options) batch.set(docRef, data, options);
        else batch.set(docRef, data);
      }
      return batch;
    },
    update: (docRef: DocumentReference<DocumentData>, dataOrField: any, ...more: any[]) => {
      if (!isQuotaExhaustedMemory) {
        (batch.update as any)(docRef, dataOrField, ...more);
      }
      return batch;
    },
    delete: (docRef: DocumentReference<DocumentData>) => {
      if (!isQuotaExhaustedMemory) {
        batch.delete(docRef);
      }
      return batch;
    },
    commit: async (): Promise<void> => {
      if (isQuotaExhaustedMemory) {
        return Promise.resolve();
      }
      try {
        await batch.commit();
      } catch (err: any) {
        if (checkAndHandleQuotaError(err)) {
          return Promise.resolve();
        }
        throw err;
      }
    },
  };
};

// Safe onSnapshot wrapper: guards error handlers against unhandled exceptions
export const onSnapshot = (
  reference: any,
  observerOrNext: any,
  onError?: (error: any) => void
) => {
  const safeOnError = (err: any) => {
    checkAndHandleQuotaError(err);
    if (onError) {
      onError(err);
    } else {
      console.warn('Firestore snapshot error (handled):', err?.message || err);
    }
  };

  if (typeof observerOrNext === 'function') {
    return rawOnSnapshot(reference, observerOrNext, safeOnError);
  } else if (observerOrNext && typeof observerOrNext === 'object') {
    const origError = observerOrNext.error;
    observerOrNext.error = (err: any) => {
      checkAndHandleQuotaError(err);
      if (origError) origError(err);
      else console.warn('Firestore snapshot error (handled):', err?.message || err);
    };
    return rawOnSnapshot(reference, observerOrNext);
  }
  return rawOnSnapshot(reference, observerOrNext, safeOnError);
};

export {
  doc,
  getDoc,
  getDocs,
  increment,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
};

