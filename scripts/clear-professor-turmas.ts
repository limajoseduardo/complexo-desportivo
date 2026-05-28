import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  const snap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/turmas`));
  const updates = snap.docs.map(d => updateDoc(doc(db, `artifacts/${APP_ID}/public/data/turmas`, d.id), { professor: '' }));
  await Promise.all(updates);
  console.log(`✓ Limpou professor de ${snap.size} turmas.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
