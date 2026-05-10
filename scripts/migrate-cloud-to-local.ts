import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  collection,
  collectionGroup,
  documentId,
  getDocs,
  getFirestore,
  limit,
  query,
  startAfter,
  writeBatch,
  doc,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';
const PAGE_SIZE = 300;

const CLOUD_COLLECTIONS = [
  'users',
  'logs_acesso',
  'mapas_coberta',
  'mapas_descoberta',
  'agenda',
  'exercicios',
  'treinos',
  'saude',
  'refeicoes',
  'bugs',
];

const cloudApp = initializeApp(firebaseConfig, 'cloud');
const cloudDb = getFirestore(cloudApp, firebaseConfig.firestoreDatabaseId);

const localApp = initializeApp(firebaseConfig, 'local');
const localDb = getFirestore(localApp, firebaseConfig.firestoreDatabaseId);
connectFirestoreEmulator(localDb, '127.0.0.1', 8080);

const isQuotaError = (error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('resource-exhausted') || msg.includes('Quota limit exceeded');
};

async function pagedRead(
  baseQueryFactory: (after?: QueryDocumentSnapshot<DocumentData>) => Query<DocumentData>,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (true) {
    const q = baseQueryFactory(cursor);
    const snap = await getDocs(q);
    if (snap.empty) break;

    docs.push(...snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  return docs;
}

async function copyCollection(shortName: string) {
  const cloudPath = `artifacts/${APP_ID}/public/data/${shortName}`;
  console.log(`\n[${shortName}] a ler cloud...`);

  const docs = await pagedRead((after) => {
    if (!after) {
      return query(collection(cloudDb, cloudPath), limit(PAGE_SIZE));
    }
    return query(collection(cloudDb, cloudPath), startAfter(after), limit(PAGE_SIZE));
  });

  if (!docs.length) {
    console.log(`[${shortName}] sem documentos.`);
    return 0;
  }

  let migrated = 0;
  let batch = writeBatch(localDb);
  let pending = 0;

  for (const d of docs) {
    const localRef = doc(localDb, cloudPath, d.id);
    batch.set(localRef, d.data(), { merge: true });
    pending++;
    migrated++;

    if (pending === 450) {
      await batch.commit();
      batch = writeBatch(localDb);
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  console.log(`[${shortName}] migrados ${migrated} docs.`);
  return migrated;
}

async function copyMessagesGroup() {
  console.log('\n[messages] a ler collectionGroup cloud...');

  const docs = await pagedRead((after) => {
    if (!after) {
      return query(collectionGroup(cloudDb, 'messages'), limit(PAGE_SIZE));
    }
    return query(
      collectionGroup(cloudDb, 'messages'),
      startAfter(after),
      limit(PAGE_SIZE),
    );
  });

  if (!docs.length) {
    console.log('[messages] sem documentos.');
    return 0;
  }

  let migrated = 0;
  let batch = writeBatch(localDb);
  let pending = 0;

  for (const d of docs) {
    const localRef = doc(localDb, d.ref.path);
    batch.set(localRef, d.data(), { merge: true });
    pending++;
    migrated++;

    if (pending === 450) {
      await batch.commit();
      batch = writeBatch(localDb);
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  console.log(`[messages] migrados ${migrated} docs.`);
  return migrated;
}

async function main() {
  console.log('Migracao Cloud -> Local iniciada...');
  let total = 0;

  for (const col of CLOUD_COLLECTIONS) {
    total += await copyCollection(col);
  }

  total += await copyMessagesGroup();

  console.log(`\nMigracao concluida. Total de documentos migrados: ${total}`);
  process.exit(0);
}

main().catch((error) => {
  if (isQuotaError(error)) {
    console.error('\nFalha por quota do Firestore cloud.');
    console.error('Quando a quota renovar, corre novamente: npm run firebase:migrate');
    process.exit(2);
  }

  console.error(error);
  process.exit(1);
});
