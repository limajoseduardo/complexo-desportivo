import { db, APP_ID } from './firebase';
import { doc, getDoc, setDoc, writeBatch, collection, Timestamp } from 'firebase/firestore';

export async function seedPoolMapsData() {
  const sentinelKey = 'cpx_seed_pool_maps_v1';
  if (localStorage.getItem(sentinelKey)) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'pool_maps_v1');
    const snap = await getDoc(sentinelRef);
    if (snap.exists()) {
      localStorage.setItem(sentinelKey, 'true');
      return;
    }

    const cobertaPath = `artifacts/${APP_ID}/public/data/mapas_coberta`;
    const descobertaPath = `artifacts/${APP_ID}/public/data/mapas_descoberta`;
    const batch = writeBatch(db);

    const dataHoje = new Date().toISOString().split('T')[0];

    // Exemplo de registos para piscina coberta
    const registrosCoberta = [
      {
        data: dataHoje,
        hora: '09:00',
        tecnico: 'Patrício Novo',
        tempAgua: '28.2',
        ph: '7.2',
        clLivre: '1.5',
        clTotal: '1.8',
        clComb: '0.3',
        tempAr: '26.5',
        utaHum: '62',
        acidoCianurico: '35',
        banhistas: '12',
        obs: 'Parâmetros normais. UTA funcional.',
        timestamp: Timestamp.now(),
        tipo: 'coberta'
      },
      {
        data: dataHoje,
        hora: '14:30',
        tecnico: 'Tiago Lopes',
        tempAgua: '28.0',
        ph: '7.3',
        clLivre: '1.4',
        clTotal: '1.7',
        clComb: '0.3',
        tempAr: '27.0',
        utaHum: '60',
        acidoCianurico: '35',
        banhistas: '18',
        obs: 'Afluência média.',
        timestamp: Timestamp.now(),
        tipo: 'coberta'
      }
    ];

    // Exemplo de registos para piscina descoberta
    const registrosDescoberta = [
      {
        data: dataHoje,
        hora: '10:15',
        tecnico: 'Patrício Novo',
        tempAgua: '24.5',
        ph: '7.4',
        clLivre: '1.8',
        clTotal: '2.0',
        clComb: '0.2',
        tempAr: '25.0',
        utaHum: '55',
        acidoCianurico: '40',
        banhistas: '8',
        obs: 'Céu limpo. Funcionamento normal.',
        timestamp: Timestamp.now(),
        tipo: 'descoberta'
      },
      {
        data: dataHoje,
        hora: '16:00',
        tecnico: 'Tiago Lopes',
        tempAgua: '25.2',
        ph: '7.4',
        clLivre: '1.6',
        clTotal: '1.9',
        clComb: '0.3',
        tempAr: '28.0',
        utaHum: '50',
        acidoCianurico: '40',
        banhistas: '25',
        obs: 'Elevada afluência de utentes.',
        timestamp: Timestamp.now(),
        tipo: 'descoberta'
      }
    ];

    registrosCoberta.forEach((reg) => {
      const ref = doc(collection(db, cobertaPath));
      batch.set(ref, reg);
    });

    registrosDescoberta.forEach((reg) => {
      const ref = doc(collection(db, descobertaPath));
      batch.set(ref, reg);
    });

    await batch.commit();
    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
    localStorage.setItem(sentinelKey, 'true');
    console.log('Seed de mapas de piscina concluído com sucesso.');
  } catch (e) {
    console.warn('Falha ao semear mapas de piscina:', e);
  }
}
