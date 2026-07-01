import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const APP_ID = 'cpx-vila-rei-main';

const app = initializeApp(firebaseConfig);
// Cache em memória — sem IndexedDB persistente que contamina listeners com dados stale
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (useEmulator && typeof window !== 'undefined') {
  const globalState = window as typeof window & {
    __cpxFirebaseEmulatorConnected?: boolean;
  };

  if (!globalState.__cpxFirebaseEmulatorConnected) {
    const host = window.location.hostname || '127.0.0.1';
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
    connectFirestoreEmulator(db, host, firestorePort);
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
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

// Quando o token de autenticação anónima fica obsoleto/inválido, o Firestore devolve
// 'permission-denied' mesmo com as regras a permitir qualquer utilizador autenticado —
// a app continua a mostrar o perfil em cache (localStorage) como se estivesse tudo bem,
// dando a falsa impressão de "sessão ativa sem dados". Recuperamos automaticamente
// renovando a sessão anónima e recarregando, em vez de deixar o utilizador preso nesse estado.
let authRecoveryInFlight = false;

async function attemptAuthRecovery() {
  if (typeof window === 'undefined' || authRecoveryInFlight) return;
  const lastAttempt = Number(sessionStorage.getItem('cpx_auth_recovery_at') || '0');
  if (Date.now() - lastAttempt < 20000) return; // no máximo 1 tentativa a cada 20s, evita loop de reload
  authRecoveryInFlight = true;
  sessionStorage.setItem('cpx_auth_recovery_at', String(Date.now()));
  try {
    await signOut(auth);
    await signInAnonymously(auth);
    window.location.reload();
  } catch (e) {
    console.warn('Falha ao recuperar sessão automaticamente:', e);
    authRecoveryInFlight = false;
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

  if ((error as any)?.code === 'permission-denied') {
    attemptAuthRecovery();
  }
}
