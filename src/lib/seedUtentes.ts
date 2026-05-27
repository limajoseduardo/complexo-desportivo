import { db } from './firebase';
import { APP_ID } from '../App';
import { 
  collection, doc, getDocs, writeBatch, getDoc, setDoc
} from 'firebase/firestore';

export async function seedUtentesTestData() {
  if (localStorage.getItem('cpx_clear_all_utentes_v1')) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'clear_all_utentes_v1');
    const sentinelSnap = await getDoc(sentinelRef);
    if (sentinelSnap.exists()) {
      localStorage.setItem('cpx_clear_all_utentes_v1', 'true');
      console.log("Utentes falsos já apagados.");
      return;
    }

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const treinosPath = `artifacts/${APP_ID}/public/data/treinos`;

    console.log("A iniciar eliminação total de utentes, treinos e logs...");

    const usersSnap = await getDocs(collection(db, usersPath));
    const logsSnap = await getDocs(collection(db, logsPath));
    const treinosSnap = await getDocs(collection(db, treinosPath));

    let batch = writeBatch(db);
    let count = 0;

    const commitBatchIfNeeded = async () => {
      if (count > 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    };

    // 1. Delete all users where role is 'utente'
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.role === 'utente') {
        batch.delete(docSnap.ref);
        count++;
      }
    });
    await commitBatchIfNeeded();

    // 2. Delete all logs
    logsSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
    });
    await commitBatchIfNeeded();

    // 3. Delete all treinos
    treinosSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
    });
    
    await batch.commit();

    await setDoc(sentinelRef, { clearedAt: new Date().toISOString() });
    localStorage.setItem('cpx_clear_all_utentes_v1', 'true');
    console.log("Limpeza concluída! A base de dados está limpa para novos utentes reais.");
  } catch (err) {
    console.error("Erro na limpeza de Utentes:", err);
  }
}
