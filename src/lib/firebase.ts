import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const APP_ID = 'cpx-vila-rei-main';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (useEmulator && typeof window !== 'undefined') {
  const globalState = window as typeof window & {
    __cpxFirebaseEmulatorConnected?: boolean;
  };

  if (!globalState.__cpxFirebaseEmulatorConnected) {
    connectFirestoreEmulator(db, import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1', Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080));
    connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true });
    globalState.__cpxFirebaseEmulatorConnected = true;
  }
}

const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, `artifacts/${APP_ID}/public/data/users`, 'connection_test'));
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.warn('Firestore: Client is offline.');
    }
  }
};
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error:', JSON.stringify(errInfo));
}
