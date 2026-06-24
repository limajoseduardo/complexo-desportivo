import { db, APP_ID } from './firebase';
import { doc, getDoc, setDoc, writeBatch, collection, Timestamp } from 'firebase/firestore';

export async function seedPoolMapsData() {
  const sentinelKey = 'cpx_seed_pool_maps_v2';
  if (localStorage.getItem(sentinelKey)) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'pool_maps_v2');
    const snap = await getDoc(sentinelRef);
    if (snap.exists()) {
      localStorage.setItem(sentinelKey, 'true');
      return;
    }

    const cobertaPath = `artifacts/${APP_ID}/public/data/mapas_coberta`;
    const descobertaPath = `artifacts/${APP_ID}/public/data/mapas_descoberta`;
    const tempInteriorPath = `artifacts/${APP_ID}/public/data/mapas_interior_temperaturas`;
    const tempExteriorPath = `artifacts/${APP_ID}/public/data/mapas_exterior_temperaturas`;
    const batch = writeBatch(db);

    const dataHoje = new Date().toISOString().split('T')[0];

    // Análises — piscina interior
    const registrosCoberta = [
      {
        data: dataHoje, hora: '09:00', tecnico: 'Patrício Novo',
        ph: '7.2', clLivre: '1.5', clTotal: '1.8', clComb: '0.3', acidoCianurico: '35',
        banhistas: '12', obs: 'Parâmetros normais. UTA funcional.',
        timestamp: Timestamp.now(), tipo: 'coberta'
      },
      {
        data: dataHoje, hora: '14:30', tecnico: 'Tiago Lopes',
        ph: '7.3', clLivre: '1.4', clTotal: '1.7', clComb: '0.3', acidoCianurico: '35',
        banhistas: '18', obs: 'Afluência média.',
        timestamp: Timestamp.now(), tipo: 'coberta'
      }
    ];

    // Análises — piscina exterior (Adulto + Infantil)
    const registrosDescoberta = [
      {
        data: dataHoje, hora: '10:15', tecnico: 'Patrício Novo', zona: 'adulto',
        ph: '7.4', clLivre: '1.8', clTotal: '2.0', clComb: '0.2', acidoCianurico: '40',
        banhistas: '8', obs: 'Céu limpo. Funcionamento normal.',
        timestamp: Timestamp.now(), tipo: 'descoberta'
      },
      {
        data: dataHoje, hora: '16:00', tecnico: 'Tiago Lopes', zona: 'adulto',
        ph: '7.4', clLivre: '1.6', clTotal: '1.9', clComb: '0.3', acidoCianurico: '40',
        banhistas: '25', obs: 'Elevada afluência de utentes.',
        timestamp: Timestamp.now(), tipo: 'descoberta'
      },
      {
        data: dataHoje, hora: '10:20', tecnico: 'Patrício Novo', zona: 'infantil',
        ph: '7.3', clLivre: '1.7', clTotal: '1.9', clComb: '0.2', acidoCianurico: '40',
        banhistas: '6', obs: 'Funcionamento normal.',
        timestamp: Timestamp.now(), tipo: 'descoberta'
      }
    ];

    // Temperaturas — piscina interior
    const registrosTempInterior = [
      {
        data: dataHoje, hora: '09:00', tecnico: 'Patrício Novo',
        naveTemp: '26.5', naveHumidade: '62', balneariosTemp: '24.0',
        aguaPiscinaTemp: '28.2', aqsTemp: '55.0', quadroTemp: '23.5', depositoTemp: '22.0',
        timestamp: Timestamp.now()
      }
    ];

    // Temperaturas — piscina exterior (Adulto + Infantil)
    const registrosTempExterior = [
      { data: dataHoje, hora: '10:15', tecnico: 'Patrício Novo', zona: 'adulto', temp: '24.5', timestamp: Timestamp.now() },
      { data: dataHoje, hora: '10:20', tecnico: 'Patrício Novo', zona: 'infantil', temp: '26.0', timestamp: Timestamp.now() }
    ];

    registrosCoberta.forEach((reg) => batch.set(doc(collection(db, cobertaPath)), reg));
    registrosDescoberta.forEach((reg) => batch.set(doc(collection(db, descobertaPath)), reg));
    registrosTempInterior.forEach((reg) => batch.set(doc(collection(db, tempInteriorPath)), reg));
    registrosTempExterior.forEach((reg) => batch.set(doc(collection(db, tempExteriorPath)), reg));

    await batch.commit();
    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
    localStorage.setItem(sentinelKey, 'true');
    console.log('Seed de mapas de piscina concluído com sucesso.');
  } catch (e) {
    console.warn('Falha ao semear mapas de piscina:', e);
  }
}
