import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  writeBatch,
  collection,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { REAL_STAFF } from '../src/lib/seed';

const APP_ID = 'cpx-vila-rei-main';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function main() {
  const usersPath = `artifacts/${APP_ID}/public/data/users`;
  const agendaPath = `artifacts/${APP_ID}/public/data/agenda`;
  const batch = writeBatch(db);

  REAL_STAFF.forEach((staff) => {
    batch.set(doc(db, usersPath, staff.id), staff, { merge: true });
  });

  [
    { diaSemana: 1, horaInicio: '18:30', horaFim: '19:15', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' },
    { diaSemana: 4, horaInicio: '18:30', horaFim: '19:15', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' },
    { diaSemana: 6, horaInicio: '10:35', horaFim: '11:20', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' },
  ].forEach((aula) => {
    batch.set(doc(collection(db, agendaPath)), aula);
  });

  await batch.commit();
  console.log(`Seed local concluido: ${REAL_STAFF.length} utilizadores e aulas base.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
