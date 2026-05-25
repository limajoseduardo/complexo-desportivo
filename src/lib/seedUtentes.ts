import { db } from './firebase';
import { APP_ID } from '../App';
import { 
  collection, doc, setDoc, writeBatch, Timestamp, addDoc, getDoc 
} from 'firebase/firestore';
import { UserProfile, AccessLog, TreinoPlano, Exercicio } from '../types';

export async function seedUtentesTestData() {
  if (localStorage.getItem('cpx_seed_utentes_v3')) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'utentes_v3');
    const sentinelSnap = await getDoc(sentinelRef);
    if (sentinelSnap.exists()) {
      localStorage.setItem('cpx_seed_utentes_v3', 'true');
      console.log("Seeding de Utentes e Logs já existe na base de dados cloud.");
      return;
    }

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const treinosPath = `artifacts/${APP_ID}/public/data/treinos`;
    const exPath = `artifacts/${APP_ID}/public/data/exercicios`;

    const batch = writeBatch(db);

    // 1. Seed de Exercícios base para o Ginásio
    const baseExercises: Exercicio[] = [
      {
        id: 'maq_legpress',
        nomePT: 'Leg Press Horizontal',
        nomeEN: 'Horizontal Leg Press',
        grupo: 'Pernas',
        primaryMuscles: ['Quadriceps', 'Glúteos'],
        secondaryMuscles: ['Isquiotibiais', 'Gémeos'],
        desc: 'Sente-se na máquina com os pés à largura dos ombros na plataforma. Empurre a plataforma estendendo as pernas (sem bloquear os joelhos) e regresse lentamente.',
        link: 'https://www.youtube.com/watch?v=GvRbz_061zs'
      },
      {
        id: 'maq_chestpress',
        nomePT: 'Chest Press Sentado',
        nomeEN: 'Seated Chest Press',
        grupo: 'Peito',
        primaryMuscles: ['Peitoral Maior'],
        secondaryMuscles: ['Tricep Branquial', 'Deltoide Anterior'],
        desc: 'Ajuste o assento para que as pegas fiquem ao nível do peito. Empurre as pegas para a frente estendendo os braços e regresse de forma controlada.',
        link: 'https://www.youtube.com/watch?v=xUm0BiZG3l0'
      },
      {
        id: 'maq_latpulldown',
        nomePT: 'Puxada de Costas',
        nomeEN: 'Lat Pulldown',
        grupo: 'Costas',
        primaryMuscles: ['Grande Dorsal'],
        secondaryMuscles: ['Bicep Branquial', 'Trapézios'],
        desc: 'Segure na barra com uma pega aberta. Sente-se e puxe a barra em direção ao peito, contraindo as costas. Regresse lentamente.',
        link: 'https://www.youtube.com/watch?v=CAwf7n6Luuc'
      },
      {
        id: 'maq_shoulderpress',
        nomePT: 'Press de Ombros',
        nomeEN: 'Shoulder Press Machine',
        grupo: 'Ombros',
        primaryMuscles: ['Deltoide Anterior', 'Deltoide Lateral'],
        secondaryMuscles: ['Tricep Branquial'],
        desc: 'Ajuste o assento. Segure nas pegas e empurre verticalmente até estender os braços. Baixe lentamente até às orelhas.',
        link: 'https://www.youtube.com/watch?v=Wqq43dK15b8'
      }
    ];

    baseExercises.forEach(ex => {
      batch.set(doc(db, exPath, ex.id), ex, { merge: true });
    });

    // Helper para datas retroativas
    const getPastDateString = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    const getPastDateTime = (daysAgo: number, hour: number, minute: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hour, minute, 0, 0);
      return d;
    };

    // 2. Criar 8 Utentes Fictícios com perfis de assiduidade mistos
    const testUtentes: UserProfile[] = [
      {
        id: 'utente_afonso_sousa',
        nome: 'Afonso Sousa',
        n: 'AFONSO SOUSA',
        email: 'afonso.sousa@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Ginásio',
        idade: '28',
        data_nasc: '1998-05-12',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=afonsosousa',
        isInside: true,
        location: 'Ginásio',
        entradas_disponiveis: 12,
        lastCheckInDate: new Date().toISOString(),
        termo_imagens: true,
        termo_responsabilidade: true,
        // Logs de cargas anteriores
        treino_logs: {
          'maq_legpress': [
            { weight: 80, reps: 12, done: true },
            { weight: 90, reps: 10, done: true },
            { weight: 100, reps: 8, done: true }
          ],
          'maq_chestpress': [
            { weight: 40, reps: 12, done: true },
            { weight: 45, reps: 12, done: true },
            { weight: 50, reps: 10, done: true }
          ]
        }
      },
      {
        id: 'utente_beatriz_costa',
        nome: 'Beatriz Costa',
        n: 'BEATRIZ COSTA',
        email: 'beatriz.costa@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Aulas Fitness',
        idade: '34',
        data_nasc: '1992-09-18',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=beatrizcosta',
        isInside: false,
        entradas_disponiveis: 4,
        lastCheckInDate: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(), // Em risco! (Inativo há 32 dias)
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_carlos_santos',
        nome: 'Carlos Santos',
        n: 'CARLOS SANTOS',
        email: 'carlos.santos@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Ginásio',
        idade: '45',
        data_nasc: '1981-11-20',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlossantos',
        isInside: false,
        entradas_disponiveis: 1,
        lastCheckInDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // Em risco! (Inativo há 40 dias)
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_daniela_oliveira',
        nome: 'Daniela Oliveira',
        n: 'DANIELA OLIVEIRA',
        email: 'daniela.oliveira@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Piscina Regime Livre',
        idade: '22',
        data_nasc: '2004-03-05',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=danielaoliveira',
        isInside: false,
        entradas_disponiveis: 22,
        lastCheckInDate: new Date().toISOString(),
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_edgar_silva',
        nome: 'Edgar Silva',
        n: 'EDGAR SILVA',
        email: 'edgar.silva@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Sauna',
        idade: '50',
        data_nasc: '1976-02-14',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=edgarsilva',
        isInside: false,
        entradas_disponiveis: 8,
        lastCheckInDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_francisca_pereira',
        nome: 'Francisca Pereira',
        n: 'FRANCISCA PEREIRA',
        email: 'francisca.pereira@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Hidroginástica',
        idade: '62',
        data_nasc: '1964-07-28',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=franciscapereira',
        isInside: false,
        entradas_disponiveis: 19,
        lastCheckInDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_gustavo_martins',
        nome: 'Gustavo Martins',
        n: 'GUSTAVO MARTINS',
        email: 'gustavo.martins@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Piscina Regime Livre',
        idade: '19',
        data_nasc: '2007-12-09',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=gustavomartins',
        isInside: false,
        entradas_disponiveis: 0,
        lastCheckInDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // Em risco! (Inativo há 35 dias)
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'utente_helena_rodrigues',
        nome: 'Helena Rodrigues',
        n: 'HELENA RODRIGUES',
        email: 'helena.rodrigues@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Aulas Fitness',
        idade: '29',
        data_nasc: '1997-04-03',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=helenarodrigues',
        isInside: false,
        entradas_disponiveis: 9,
        lastCheckInDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        termo_imagens: true,
        termo_responsabilidade: true
      }
    ];

    testUtentes.forEach(ut => {
      batch.set(doc(db, usersPath, ut.id), ut, { merge: true });
    });

    // 3. Criar Planos de Treino para os alunos de Ginásio (Afonso e Carlos)
    const planAfonso: TreinoPlano = {
      id: 'plano_afonso_sousa',
      userId: 'utente_afonso_sousa',
      nome: 'Plano Geral Hipertrofia A',
      exercicios: [
        { exercicioId: 'maq_chestpress', series: '3', reps: '12', descanso: '60' },
        { exercicioId: 'maq_legpress', series: '3', reps: '10', descanso: '90' },
        { exercicioId: 'maq_latpulldown', series: '3', reps: '12', descanso: '60' }
      ]
    };

    const planCarlos: TreinoPlano = {
      id: 'plano_carlos_santos',
      userId: 'utente_carlos_santos',
      nome: 'Circuito Força Inicial',
      exercicios: [
        { exercicioId: 'maq_legpress', series: '3', reps: '12', descanso: '90' },
        { exercicioId: 'maq_shoulderpress', series: '3', reps: '12', descanso: '60' }
      ]
    };

    batch.set(doc(db, treinosPath, planAfonso.id), planAfonso, { merge: true });
    batch.set(doc(db, treinosPath, planCarlos.id), planCarlos, { merge: true });

    await batch.commit();

    // 4. Inserir Logs de Acesso Históricos para simular o Ranking de Assiduidade
    // Afonso Sousa: 26 checkins nos últimos 30 dias (super assíduo, #1)
    // Francisca Pereira: 20 checkins nos últimos 30 dias (#2)
    // Daniela Oliveira: 18 checkins nos últimos 30 dias (#3)
    // Helena Rodrigues: 12 checkins nos últimos 30 dias (#4)
    // Beatriz Costa: 1 checkin há 32 dias
    // Carlos Santos: 1 checkin há 40 dias
    // Gustavo Martins: 1 checkin há 35 dias
    
    // Gerar logs numa coleção em separado para evitar limites de batch (usamos addDoc sequenciais rápidos no Firestore)
    const seedAccessLogs = async () => {
      const logsToSeed: any[] = [];

      // Afonso: 26 logs
      for (let i = 1; i <= 26; i++) {
        const daysAgo = i; // 1 a 26 dias atrás
        logsToSeed.push({
          userId: 'utente_afonso_sousa',
          userName: 'Afonso Sousa',
          userRole: 'utente',
          modalidade: 'Ginásio',
          checkIn: Timestamp.fromDate(getPastDateTime(daysAgo, 18, 0)),
          checkOut: Timestamp.fromDate(getPastDateTime(daysAgo, 19, 15)),
          durationMinutes: 75,
          zone: 'Ginásio',
          date: getPastDateString(daysAgo)
        });
      }

      // Francisca: 20 logs
      for (let i = 1; i <= 20; i++) {
        const daysAgo = Math.floor(i * 1.4); // distribuídos nos últimos 28 dias
        logsToSeed.push({
          userId: 'utente_francisca_pereira',
          userName: 'Francisca Pereira',
          userRole: 'utente',
          modalidade: 'Hidroginástica',
          checkIn: Timestamp.fromDate(getPastDateTime(daysAgo, 9, 30)),
          checkOut: Timestamp.fromDate(getPastDateTime(daysAgo, 10, 15)),
          durationMinutes: 45,
          zone: 'Piscina Coberta',
          date: getPastDateString(daysAgo)
        });
      }

      // Daniela: 18 logs
      for (let i = 1; i <= 18; i++) {
        const daysAgo = Math.floor(i * 1.6);
        logsToSeed.push({
          userId: 'utente_daniela_oliveira',
          userName: 'Daniela Oliveira',
          userRole: 'utente',
          modalidade: 'Piscina Regime Livre',
          checkIn: Timestamp.fromDate(getPastDateTime(daysAgo, 14, 0)),
          checkOut: Timestamp.fromDate(getPastDateTime(daysAgo, 15, 30)),
          durationMinutes: 90,
          zone: 'Piscina Coberta',
          date: getPastDateString(daysAgo)
        });
      }

      // Helena: 12 logs
      for (let i = 1; i <= 12; i++) {
        const daysAgo = Math.floor(i * 2.3);
        logsToSeed.push({
          userId: 'utente_helena_rodrigues',
          userName: 'Helena Rodrigues',
          userRole: 'utente',
          modalidade: 'Aulas Fitness',
          checkIn: Timestamp.fromDate(getPastDateTime(daysAgo, 19, 0)),
          checkOut: Timestamp.fromDate(getPastDateTime(daysAgo, 19, 45)),
          durationMinutes: 45,
          zone: 'Aulas Grupo',
          date: getPastDateString(daysAgo)
        });
      }

      // Inativos logs de entrada únicos para constar no histórico
      logsToSeed.push({
        userId: 'utente_beatriz_costa',
        userName: 'Beatriz Costa',
        userRole: 'utente',
        modalidade: 'Aulas Fitness',
        checkIn: Timestamp.fromDate(getPastDateTime(32, 18, 30)),
        checkOut: Timestamp.fromDate(getPastDateTime(32, 19, 15)),
        durationMinutes: 45,
        zone: 'Aulas Grupo',
        date: getPastDateString(32)
      });

      logsToSeed.push({
        userId: 'utente_carlos_santos',
        userName: 'Carlos Santos',
        userRole: 'utente',
        modalidade: 'Ginásio',
        checkIn: Timestamp.fromDate(getPastDateTime(40, 10, 0)),
        checkOut: Timestamp.fromDate(getPastDateTime(40, 11, 0)),
        durationMinutes: 60,
        zone: 'Ginásio',
        date: getPastDateString(40)
      });

      logsToSeed.push({
        userId: 'utente_gustavo_martins',
        userName: 'Gustavo Martins',
        userRole: 'utente',
        modalidade: 'Piscina Regime Livre',
        checkIn: Timestamp.fromDate(getPastDateTime(35, 15, 0)),
        checkOut: Timestamp.fromDate(getPastDateTime(35, 16, 0)),
        durationMinutes: 60,
        zone: 'Piscina Coberta',
        date: getPastDateString(35)
      });

      // Gravar tudo no Firestore num único batch atómico e ultra-rapido
      const logBatch = writeBatch(db);
      logsToSeed.forEach(log => {
        const newLogRef = doc(collection(db, logsPath));
        logBatch.set(newLogRef, log);
      });
      await logBatch.commit();
    };

    await seedAccessLogs();

    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });

    localStorage.setItem('cpx_seed_utentes_v3', 'true');
    console.log("Seeding de Utentes e Logs de Acesso concluído com sucesso!");
  } catch (err) {
    console.error("Erro no Seeding de Utentes de Teste:", err);
  }
}
