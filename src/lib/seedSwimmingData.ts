import { db, APP_ID } from './firebase';
import { doc, getDoc, writeBatch, setDoc } from 'firebase/firestore';
import { UserProfile, SwimmingClass, SwimmingLog, SwimmingEvaluation } from '../types';

const DEFAULT_OBJECTIVES: Record<string, string[]> = {
  'Natação Nível 1': [
    'Adaptação ao Meio Aquático',
    'Flutuação Ventral Autónoma',
    'Flutuação Dorsal Autónoma',
    'Respiração Bobbing (10 repetições)',
    'Propulsão de Pernas (Batimento de Crawl)',
    'Mergulho de Joelhos'
  ],
  'Natação Nível 2': [
    'Mergulho de Cabeça',
    'Técnica de Nado Crawl (15 metros)',
    'Técnica de Nado Costas (15 metros)',
    'Viragem Elementar (Crawl/Costas)',
    'Nado Subaquático (5 metros)',
    'Propulsão Vertical Sustentada (15 segundos)'
  ],
  'Natação Nível 3': [
    'Técnica de Nado Bruços (25 metros)',
    'Técnica de Nado Mariposa (15 metros)',
    'Viragem Avançada de Crawl (Salto)',
    'Partida de Bloco',
    'Resistência Aeróbica (100 metros contínuos)',
    'Nado Subaquático (10 metros)'
  ],
  'Bebés/AMA': [
    'Equilíbrio e Flutuação Estática',
    'Deslocamento com Apoio',
    'Imersão e Apneia Controlada',
    'Salto para a Piscina com Apoio',
    'Socialização e Estimulação Motora'
  ],
  'Hidroginástica': [
    'Cardio e Resistência Hidrodinâmica',
    'Mobilidade Articular e Flexibilidade',
    'Tonificação Muscular Geral',
    'Ritmo e Coordenação de Exercícios'
  ]
};

export async function seedSwimmingData() {
  if (localStorage.getItem('cpx_seed_swimming_v3')) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'swimming_v3');
    const sentinelSnap = await getDoc(sentinelRef);
    if (sentinelSnap.exists()) {
      localStorage.setItem('cpx_seed_swimming_v3', 'true');
      console.log("Seeding de Natação já existe na base de dados cloud.");
      return;
    }

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const classesPath = `artifacts/${APP_ID}/public/data/swimming_classes`;
    const logsPath = `artifacts/${APP_ID}/public/data/swimming_logs`;
    const evaluationsPath = `artifacts/${APP_ID}/public/data/swimming_evaluations`;

    const mockStudents: UserProfile[] = [
      { id: 'aluno_joao_silva', nome: 'João Silva', n: 'JOÃO SILVA', email: 'joao.silva@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 1', idade: '10', data_nasc: '2016-04-12', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=joaosilva', isInside: false, termo_imagens: true, termo_responsabilidade: true },
      { id: 'aluno_maria_santos', nome: 'Maria Santos', n: 'MARIA SANTOS', email: 'maria.santos@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 1', idade: '9', data_nasc: '2017-08-23', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mariasantos', isInside: false, termo_imagens: true, termo_responsabilidade: true },
      { id: 'aluno_rita_mendes', nome: 'Rita Mendes', n: 'RITA MENDES', email: 'rita.mendes@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 2', idade: '27', data_nasc: '1999-02-15', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ritamendes', isInside: false, termo_imagens: true, termo_responsabilidade: true },
      { id: 'aluno_bruno_ramos', nome: 'Bruno Ramos', n: 'BRUNO RAMOS', email: 'bruno.ramos@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 2', idade: '31', data_nasc: '1995-10-10', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=brunoramos', isInside: false, termo_imagens: true, termo_responsabilidade: true },
      { id: 'aluno_pedro_costa', nome: 'Pedro Costa', n: 'PEDRO COSTA', email: 'pedro.costa@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 3', idade: '14', data_nasc: '2012-01-30', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pedrocosta', isInside: false, termo_imagens: true, termo_responsabilidade: true },
      { id: 'aluno_ana_oliveira', nome: 'Ana Oliveira', n: 'ANA OLIVEIRA', email: 'ana.oliveira@gmail.com', role: 'utente', cargo: 'UTENTE', modalidade: 'Natação Nível 3', idade: '13', data_nasc: '2013-11-05', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=anaoliveira', isInside: false, termo_imagens: true, termo_responsabilidade: true }
    ];

    const batch = writeBatch(db);
    mockStudents.forEach(st => { batch.set(doc(db, usersPath, st.id), st, { merge: true }); });

    const class1: SwimmingClass = { id: 'turma_kids_nivel1', nome: 'Natação Infantil - Nível 1', horario: 'Terças e Quintas - 18:00', nivel: 'Natação Nível 1', professorId: 'eduardo_oliveira', alunos: ['aluno_joao_silva', 'aluno_maria_santos'], objetivos: DEFAULT_OBJECTIVES['Natação Nível 1'] };
    const class2: SwimmingClass = { id: 'turma_adults_nivel2', nome: 'Natação Adultos - Nível 2', horario: 'Segundas e Quartas - 19:30', nivel: 'Natação Nível 2', professorId: 'eduardo_oliveira', alunos: ['aluno_rita_mendes', 'aluno_bruno_ramos'], objetivos: DEFAULT_OBJECTIVES['Natação Nível 2'] };
    const class3: SwimmingClass = { id: 'turma_comp_nivel3', nome: 'Natação Competição - Nível 3', horario: 'Terças e Quintas - 19:00', nivel: 'Natação Nível 3', professorId: 'eduardo_oliveira', alunos: ['aluno_pedro_costa', 'aluno_ana_oliveira'], objetivos: DEFAULT_OBJECTIVES['Natação Nível 3'] };

    batch.set(doc(db, classesPath, class1.id), class1, { merge: true });
    batch.set(doc(db, classesPath, class2.id), class2, { merge: true });
    batch.set(doc(db, classesPath, class3.id), class3, { merge: true });

    const evals: SwimmingEvaluation[] = [
      { id: 'aluno_joao_silva', studentId: 'aluno_joao_silva', lastUpdated: new Date(Date.now() - 3 * 86400000).toISOString(), skills: { 'Adaptação ao Meio Aquático': 'adquirido', 'Flutuação Ventral Autónoma': 'adquirido', 'Flutuação Dorsal Autónoma': 'em_desenvolvimento', 'Respiração Bobbing (10 repetições)': 'em_desenvolvimento', 'Propulsão de Pernas (Batimento de Crawl)': 'não_iniciado', 'Mergulho de Joelhos': 'não_iniciado' }, feedback: 'O João adaptou-se muito bem ao meio aquático.', nivelProposto: 'Manter no Nível 1 para consolidar propulsão de pernas.' },
      { id: 'aluno_rita_mendes', studentId: 'aluno_rita_mendes', lastUpdated: new Date(Date.now() - 4 * 86400000).toISOString(), skills: { 'Mergulho de Cabeça': 'não_iniciado', 'Técnica de Nado Crawl (15 metros)': 'em_desenvolvimento', 'Técnica de Nado Costas (15 metros)': 'adquirido', 'Viragem Elementar (Crawl/Costas)': 'não_iniciado', 'Nado Subaquático (5 metros)': 'em_desenvolvimento', 'Propulsão Vertical Sustentada (15 segundos)': 'adquirido' }, feedback: 'Excelente sustentação e propulsão de pernas.', nivelProposto: 'Aperfeiçoar técnica de braçada crawl.' },
      { id: 'aluno_bruno_ramos', studentId: 'aluno_bruno_ramos', lastUpdated: new Date(Date.now() - 4 * 86400000).toISOString(), skills: { 'Mergulho de Cabeça': 'em_desenvolvimento', 'Técnica de Nado Crawl (15 metros)': 'adquirido', 'Técnica de Nado Costas (15 metros)': 'em_desenvolvimento', 'Viragem Elementar (Crawl/Costas)': 'não_iniciado', 'Nado Subaquático (5 metros)': 'adquirido', 'Propulsão Vertical Sustentada (15 segundos)': 'não_iniciado' }, feedback: 'O Bruno já demonstra autonomia no nado crawl de 15m.', nivelProposto: 'Focar na imersão e mergulhos no início da aula.' },
      { id: 'aluno_pedro_costa', studentId: 'aluno_pedro_costa', lastUpdated: new Date(Date.now() - 5 * 86400000).toISOString(), skills: { 'Técnica de Nado Bruços (25 metros)': 'adquirido', 'Técnica de Nado Mariposa (15 metros)': 'em_desenvolvimento', 'Viragem Avançada de Crawl (Salto)': 'adquirido', 'Partida de Bloco': 'adquirido', 'Resistência Aeróbica (100 metros contínuos)': 'em_desenvolvimento', 'Nado Subaquático (10 metros)': 'não_iniciado' }, feedback: 'Excelente capacidade de força e coordenação.', nivelProposto: 'Prepara-se para transição para o Nível de Pré-Competição em breve.' }
    ];
    evals.forEach(ev => { batch.set(doc(db, evaluationsPath, ev.id), ev, { merge: true }); });

    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

    const logHistory: SwimmingLog[] = [
      { id: 'log_c1_1', turmaId: 'turma_kids_nivel1', data: daysAgo(12), sumario: 'Adaptação e flutuação dorsal estática.', presencas: ['aluno_joao_silva', 'aluno_maria_santos'], distancias: { 'aluno_joao_silva': 100, 'aluno_maria_santos': 80 }, observacoes: { 'aluno_joao_silva': 'Excelente flutuação.', 'aluno_maria_santos': 'Algum receio na água.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c1_2', turmaId: 'turma_kids_nivel1', data: daysAgo(10), sumario: 'Propulsão de pernas com prancha e respiração.', presencas: ['aluno_joao_silva'], distancias: { 'aluno_joao_silva': 150 }, observacoes: { 'aluno_joao_silva': 'Fez 6 comprimentos com prancha.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c1_3', turmaId: 'turma_kids_nivel1', data: daysAgo(5), sumario: 'Respiração rítmica (bobbing) e mergulho.', presencas: ['aluno_joao_silva', 'aluno_maria_santos'], distancias: { 'aluno_joao_silva': 200, 'aluno_maria_santos': 120 }, observacoes: { 'aluno_joao_silva': 'Grande progressão na distância.', 'aluno_maria_santos': 'Conseguiu fazer bobbing completo.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c1_4', turmaId: 'turma_kids_nivel1', data: daysAgo(3), sumario: 'Revisão de pernada crawl e teste de autonomia.', presencas: ['aluno_joao_silva', 'aluno_maria_santos'], distancias: { 'aluno_joao_silva': 250, 'aluno_maria_santos': 180 }, observacoes: { 'aluno_joao_silva': 'Bate pernas muito forte.', 'aluno_maria_santos': 'Focou-se e nadou mais hoje.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c2_1', turmaId: 'turma_adults_nivel2', data: daysAgo(14), sumario: 'Técnica de pernada e sustentação vertical.', presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'], distancias: { 'aluno_rita_mendes': 200, 'aluno_bruno_ramos': 150 }, observacoes: { 'aluno_rita_mendes': 'Muito focada.', 'aluno_bruno_ramos': 'Demonstra boa energia.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c2_2', turmaId: 'turma_adults_nivel2', data: daysAgo(11), sumario: 'Crawl completo com foco na respiração bilateral.', presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'], distancias: { 'aluno_rita_mendes': 250, 'aluno_bruno_ramos': 300 }, observacoes: { 'aluno_rita_mendes': 'Falta rotação de ombros.', 'aluno_bruno_ramos': 'Bom deslize no crawl.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c2_3', turmaId: 'turma_adults_nivel2', data: daysAgo(7), sumario: 'Nado de costas e viragens básicas.', presencas: ['aluno_rita_mendes'], distancias: { 'aluno_rita_mendes': 350 }, observacoes: { 'aluno_rita_mendes': 'Costas está excelente.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c2_4', turmaId: 'turma_adults_nivel2', data: daysAgo(4), sumario: 'Subaquáticos de 5 metros e séries de 100m.', presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'], distancias: { 'aluno_rita_mendes': 400, 'aluno_bruno_ramos': 450 }, observacoes: { 'aluno_rita_mendes': 'Grande fôlego.', 'aluno_bruno_ramos': 'Fez 450 metros com facilidade.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c3_1', turmaId: 'turma_comp_nivel3', data: daysAgo(12), sumario: 'Séries aeróbicas crawl e braçada bruços.', presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'], distancias: { 'aluno_pedro_costa': 800, 'aluno_ana_oliveira': 750 }, observacoes: { 'aluno_pedro_costa': 'Ritmo constante.', 'aluno_ana_oliveira': 'Técnica muito limpa.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c3_2', turmaId: 'turma_comp_nivel3', data: daysAgo(10), sumario: 'Partidas de bloco e transição subaquática.', presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'], distancias: { 'aluno_pedro_costa': 1000, 'aluno_ana_oliveira': 950 }, observacoes: { 'aluno_pedro_costa': 'Partidas explosivas.', 'aluno_ana_oliveira': 'Bons apoios no bloco.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c3_3', turmaId: 'turma_comp_nivel3', data: daysAgo(5), sumario: 'Técnica de mariposa e séries de 50m.', presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'], distancias: { 'aluno_pedro_costa': 1200, 'aluno_ana_oliveira': 1100 }, observacoes: { 'aluno_pedro_costa': 'Grande esforço em mariposa.', 'aluno_ana_oliveira': 'Fluida na ondulação.' }, professorId: 'eduardo_oliveira' },
      { id: 'log_c3_4', turmaId: 'turma_comp_nivel3', data: daysAgo(3), sumario: 'Teste de 200m contínuos e viragens de salto.', presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'], distancias: { 'aluno_pedro_costa': 1500, 'aluno_ana_oliveira': 1300 }, observacoes: { 'aluno_pedro_costa': 'Nadou 1500 metros no total, parabéns.', 'aluno_ana_oliveira': 'Conseguiu 1300m e ótimas viragens.' }, professorId: 'eduardo_oliveira' }
    ];
    logHistory.forEach(lg => { batch.set(doc(db, logsPath, lg.id), lg, { merge: true }); });

    const csPath = `artifacts/${APP_ID}/public/data/swimming_critical_speed`;
    batch.set(doc(db, csPath, 'aluno_pedro_costa'), { studentId: 'aluno_pedro_costa', distance1: 50, time1: 35, distance2: 200, time2: 170, criticalSpeed: 1.11, lastUpdated: new Date().toISOString() });

    await batch.commit();
    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
    localStorage.setItem('cpx_seed_swimming_v3', 'true');
    console.log("Seeding de Natação V3 concluído com sucesso!");
  } catch (err) {
    console.error("Erro no Seeding de Natação V3:", err);
  }
}
