import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, query, where,
  doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';

// Corre via cron a duas horas UTC candidatas (para sobreviver à mudança de hora
// de verão/inverno) — só executa o checkout quando a hora local de Lisboa for 20h.
function isCheckoutHourInLisbon(): boolean {
  const hour = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hour12: false });
  return hour.trim() === '20';
}

async function main() {
  if (!isCheckoutHourInLisbon() && process.env.FORCE_CHECKOUT !== 'true') {
    console.log('Não são 20h00 em Lisboa ainda — nada a fazer nesta corrida.');
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  await signInAnonymously(auth);

  const usersPath = `artifacts/${APP_ID}/public/data/users`;
  const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;

  const qInside = query(collection(db, usersPath), where('isInside', '==', true));
  const snap = await getDocs(qInside);
  console.log(`20h00 (Lisboa) — a fazer checkout automático de ${snap.size} utente(s) ainda marcados "dentro".`);

  for (const d of snap.docs) {
    const user: any = { id: d.id, ...d.data() };
    try {
      const qLogs = query(collection(db, logsPath), where('userId', '==', user.id));
      const logSnap = await getDocs(qLogs);
      const openLogs = logSnap.docs
        .filter(l => !l.data().checkOut)
        .sort((a, b) => (b.data().checkIn?.seconds || 0) - (a.data().checkIn?.seconds || 0));

      let durationMinutes = 0;
      if (openLogs.length > 0) {
        const logDoc = openLogs[0];
        const checkIn = logDoc.data().checkIn;
        const checkInDate = checkIn instanceof Timestamp ? checkIn.toDate() : new Date(checkIn?.seconds * 1000);
        durationMinutes = Math.max(1, Math.round((Date.now() - checkInDate.getTime()) / 60000));
        await updateDoc(doc(db, logsPath, logDoc.id), {
          checkOut: serverTimestamp(),
          durationMinutes,
          autoCheckout: true,
        });
      }

      await updateDoc(doc(db, usersPath, user.id), { isInside: false, location: null, updatedAt: new Date().toISOString() });
      console.log(`OK: ${user.nome || user.n} -> saída automática registada (${durationMinutes} min)`);
    } catch (e: any) {
      console.error(`FALHOU: ${user.nome || user.n}`, e.message);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
