import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, query, where,
  doc, updateDoc, getDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';

type CheckoutMode = 'night' | 'lunch';

// Corre via cron a horas UTC candidatas por modo, para sobreviver à mudança de hora
// de verão/inverno. O GitHub Actions atrasa frequentemente os crons (15-60min+), por
// isso aceitamos uma janela de tolerância em vez da hora local exata. O fecho de
// almoço tem de parar de atuar antes da reabertura às 15h — janela mais estreita.
function getActiveMode(): CheckoutMode | null {
  const hour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hour12: false }).trim());
  if (hour >= 13 && hour < 15) return 'lunch';
  if (hour >= 20 && hour <= 23) return 'night';
  return null;
}

// O fecho de almoço (13h-15h) só existe na temporada de Verão (configurável em
// Horários, na app). Em Inverno o complexo não fecha ao almoço, por isso este job
// não deve forçar saídas — sem precisar de desligar o cron manualmente.
async function isSummerSeasonActive(db: any): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/config`, 'horarios'));
    const temporada = snap.data()?.temporadaAtiva;
    return temporada !== 'inverno'; // default verão, igual ao resto da app
  } catch {
    return true;
  }
}

async function main() {
  const forced = process.env.FORCE_CHECKOUT === 'true';
  const mode: CheckoutMode = getActiveMode() || (process.env.CHECKOUT_MODE === 'lunch' ? 'lunch' : 'night');

  if (!getActiveMode() && !forced) {
    console.log('Fora da janela de checkout (13h-15h ou 20h-23h em Lisboa) — nada a fazer nesta corrida.');
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  await signInAnonymously(auth);

  if (mode === 'lunch' && !(await isSummerSeasonActive(db))) {
    console.log('Temporada de Inverno ativa — sem fecho de almoço, nada a fazer.');
    return;
  }

  const usersPath = `artifacts/${APP_ID}/public/data/users`;
  const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;

  const qInside = query(collection(db, usersPath), where('isInside', '==', true));
  const snap = await getDocs(qInside);
  console.log(`[${mode}] (Lisboa) — a verificar ${snap.size} utente(s) ainda marcados "dentro".`);

  for (const d of snap.docs) {
    const user: any = { id: d.id, ...d.data() };
    try {
      const qLogs = query(collection(db, logsPath), where('userId', '==', user.id));
      const logSnap = await getDocs(qLogs);
      const openLogs = logSnap.docs
        .filter(l => !l.data().checkOut)
        .sort((a, b) => (b.data().checkIn?.seconds || 0) - (a.data().checkIn?.seconds || 0));

      if (openLogs.length === 0) continue;
      const logDoc = openLogs[0];
      const modalidade = logDoc.data().modalidade;

      // Piscina Exterior é bilhete de dia inteiro — não fecha ao almoço.
      if (mode === 'lunch' && modalidade === 'Piscina Exterior') {
        console.log(`SKIP [${mode}]: ${user.nome || user.n} está na Piscina Exterior (bilhete de dia inteiro).`);
        continue;
      }

      const checkIn = logDoc.data().checkIn;
      const checkInDate = checkIn instanceof Timestamp ? checkIn.toDate() : new Date(checkIn?.seconds * 1000);
      const durationMinutes = Math.max(1, Math.round((Date.now() - checkInDate.getTime()) / 60000));
      await updateDoc(doc(db, logsPath, logDoc.id), {
        checkOut: serverTimestamp(),
        durationMinutes,
        autoCheckout: true,
        autoCheckoutMode: mode,
      });

      await updateDoc(doc(db, usersPath, user.id), { isInside: false, location: null, updatedAt: new Date().toISOString() });
      console.log(`OK [${mode}]: ${user.nome || user.n} -> saída automática registada (${durationMinutes} min)`);
    } catch (e: any) {
      console.error(`FALHOU [${mode}]: ${user.nome || user.n}`, e.message);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
