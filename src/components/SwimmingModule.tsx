import React, { useState, useEffect, useMemo } from 'react';
import {
  Waves, Users, Calendar, TrendingUp, Plus, Search, Mail,
  ChevronRight, ChevronLeft, Save, Check, Clock, ArrowLeft,
  AlertCircle, Target, Edit, Trash2, UserPlus, Play, NotebookPen,
  Award, Send, UserCheck, Star, Sparkles, BookOpen, X, FileText, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Legend 
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { 
  collection, doc, setDoc, onSnapshot, query, where, 
  orderBy, limit, getDocs, writeBatch, addDoc, getDoc, deleteDoc 
} from 'firebase/firestore';
import { UserProfile, SwimmingClass, SwimmingLog, SwimmingEvaluation } from '../types';
import { AvatarImage, FormInput, PicotoIcon } from './Common';

// Níveis e Metodologias Padrão
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

export const formatPace = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// ==========================================
// ROTINA DE SEEDING AUTOMÁTICO (SWIM TRACK)
// ==========================================
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

    // 1. Seed de 6 alunos de natação
    const mockStudents: UserProfile[] = [
      {
        id: 'aluno_joao_silva',
        nome: 'João Silva',
        n: 'JOÃO SILVA',
        email: 'joao.silva@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 1',
        idade: '10',
        data_nasc: '2016-04-12',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=joaosilva',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'aluno_maria_santos',
        nome: 'Maria Santos',
        n: 'MARIA SANTOS',
        email: 'maria.santos@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 1',
        idade: '9',
        data_nasc: '2017-08-23',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mariasantos',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'aluno_rita_mendes',
        nome: 'Rita Mendes',
        n: 'RITA MENDES',
        email: 'rita.mendes@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 2',
        idade: '27',
        data_nasc: '1999-02-15',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ritamendes',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'aluno_bruno_ramos',
        nome: 'Bruno Ramos',
        n: 'BRUNO RAMOS',
        email: 'bruno.ramos@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 2',
        idade: '31',
        data_nasc: '1995-10-10',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=brunoramos',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'aluno_pedro_costa',
        nome: 'Pedro Costa',
        n: 'PEDRO COSTA',
        email: 'pedro.costa@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 3',
        idade: '14',
        data_nasc: '2012-01-30',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pedrocosta',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      },
      {
        id: 'aluno_ana_oliveira',
        nome: 'Ana Oliveira',
        n: 'ANA OLIVEIRA',
        email: 'ana.oliveira@gmail.com',
        role: 'utente',
        cargo: 'UTENTE',
        modalidade: 'Natação Nível 3',
        idade: '13',
        data_nasc: '2013-11-05',
        img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=anaoliveira',
        isInside: false,
        termo_imagens: true,
        termo_responsabilidade: true
      }
    ];

    const batch = writeBatch(db);

    // Salvar alunos
    mockStudents.forEach(st => {
      batch.set(doc(db, usersPath, st.id), st, { merge: true });
    });

    // 2. Criar 3 turmas para Eduardo Oliveira (professor de natação)
    const class1: SwimmingClass = {
      id: 'turma_kids_nivel1',
      nome: 'Natação Infantil - Nível 1',
      horario: 'Terças e Quintas - 18:00',
      nivel: 'Natação Nível 1',
      professorId: 'eduardo_oliveira',
      alunos: ['aluno_joao_silva', 'aluno_maria_santos'],
      objetivos: DEFAULT_OBJECTIVES['Natação Nível 1']
    };

    const class2: SwimmingClass = {
      id: 'turma_adults_nivel2',
      nome: 'Natação Adultos - Nível 2',
      horario: 'Segundas e Quartas - 19:30',
      nivel: 'Natação Nível 2',
      professorId: 'eduardo_oliveira',
      alunos: ['aluno_rita_mendes', 'aluno_bruno_ramos'],
      objetivos: DEFAULT_OBJECTIVES['Natação Nível 2']
    };

    const class3: SwimmingClass = {
      id: 'turma_comp_nivel3',
      nome: 'Natação Competição - Nível 3',
      horario: 'Terças e Quintas - 19:00',
      nivel: 'Natação Nível 3',
      professorId: 'eduardo_oliveira',
      alunos: ['aluno_pedro_costa', 'aluno_ana_oliveira'],
      objetivos: DEFAULT_OBJECTIVES['Natação Nível 3']
    };

    batch.set(doc(db, classesPath, class1.id), class1, { merge: true });
    batch.set(doc(db, classesPath, class2.id), class2, { merge: true });
    batch.set(doc(db, classesPath, class3.id), class3, { merge: true });

    // 3. Criar Fichas de Avaliação iniciais
    const evals: SwimmingEvaluation[] = [
      {
        id: 'aluno_joao_silva',
        studentId: 'aluno_joao_silva',
        lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        skills: {
          'Adaptação ao Meio Aquático': 'adquirido',
          'Flutuação Ventral Autónoma': 'adquirido',
          'Flutuação Dorsal Autónoma': 'em_desenvolvimento',
          'Respiração Bobbing (10 repetições)': 'em_desenvolvimento',
          'Propulsão de Pernas (Batimento de Crawl)': 'não_iniciado',
          'Mergulho de Joelhos': 'não_iniciado'
        },
        feedback: 'O João adaptou-se muito bem ao meio aquático. Está a trabalhar no equilíbrio dorsal para perder o receio de libertar os apoios.',
        nivelProposto: 'Manter no Nível 1 para consolidar propulsão de pernas.'
      },
      {
        id: 'aluno_rita_mendes',
        studentId: 'aluno_rita_mendes',
        lastUpdated: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        skills: {
          'Mergulho de Cabeça': 'não_iniciado',
          'Técnica de Nado Crawl (15 metros)': 'em_desenvolvimento',
          'Técnica de Nado Costas (15 metros)': 'adquirido',
          'Viragem Elementar (Crawl/Costas)': 'não_iniciado',
          'Nado Subaquático (5 metros)': 'em_desenvolvimento',
          'Propulsão Vertical Sustentada (15 segundos)': 'adquirido'
        },
        feedback: 'Excelente sustentação e propulsão de pernas. O nado de costas está fluído. Necessita de focar-se na coordenação da respiração lateral no crawl.',
        nivelProposto: 'Aperfeiçoar técnica de braçada crawl.'
      },
      {
        id: 'aluno_bruno_ramos',
        studentId: 'aluno_bruno_ramos',
        lastUpdated: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        skills: {
          'Mergulho de Cabeça': 'em_desenvolvimento',
          'Técnica de Nado Crawl (15 metros)': 'adquirido',
          'Técnica de Nado Costas (15 metros)': 'em_desenvolvimento',
          'Viragem Elementar (Crawl/Costas)': 'não_iniciado',
          'Nado Subaquático (5 metros)': 'adquirido',
          'Propulsão Vertical Sustentada (15 segundos)': 'não_iniciado'
        },
        feedback: 'O Bruno já demonstra autonomia no nado crawl de 15m. Apresenta dificuldades no mergulho de cabeça devido a bloqueio psicológico, a trabalhar com calma.',
        nivelProposto: 'Focar na imersão e mergulhos no início da aula.'
      },
      {
        id: 'aluno_pedro_costa',
        studentId: 'aluno_pedro_costa',
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        skills: {
          'Técnica de Nado Bruços (25 metros)': 'adquirido',
          'Técnica de Nado Mariposa (15 metros)': 'em_desenvolvimento',
          'Viragem Avançada de Crawl (Salto)': 'adquirido',
          'Partida de Bloco': 'adquirido',
          'Resistência Aeróbica (100 metros contínuos)': 'em_desenvolvimento',
          'Nado Subaquático (10 metros)': 'não_iniciado'
        },
        feedback: 'Excelente capacidade de força e coordenação. O nado de bruços está perfeito. Focar na flexibilidade dos ombros para o nado de mariposa.',
        nivelProposto: 'Prepara-se para transição para o Nível de Pré-Competição em breve.'
      }
    ];

    evals.forEach(ev => {
      batch.set(doc(db, evaluationsPath, ev.id), ev, { merge: true });
    });

    // 4. Criar histórico de logs (aulas anteriores) para gerar gráficos
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString().split('T')[0];
    };

    const logHistory: SwimmingLog[] = [
      // Turma 1 logs
      {
        id: 'log_c1_1',
        turmaId: 'turma_kids_nivel1',
        data: daysAgo(12),
        sumario: 'Adaptação e flutuação dorsal estática.',
        presencas: ['aluno_joao_silva', 'aluno_maria_santos'],
        distancias: { 'aluno_joao_silva': 100, 'aluno_maria_santos': 80 },
        observacoes: { 'aluno_joao_silva': 'Excelente flutuação.', 'aluno_maria_santos': 'Algum receio na água.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c1_2',
        turmaId: 'turma_kids_nivel1',
        data: daysAgo(10),
        sumario: 'Propulsão de pernas com prancha e respiração.',
        presencas: ['aluno_joao_silva'],
        distancias: { 'aluno_joao_silva': 150 },
        observacoes: { 'aluno_joao_silva': 'Fez 6 comprimentos com prancha.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c1_3',
        turmaId: 'turma_kids_nivel1',
        data: daysAgo(5),
        sumario: 'Respiração rítmica (bobbing) e mergulho.',
        presencas: ['aluno_joao_silva', 'aluno_maria_santos'],
        distancias: { 'aluno_joao_silva': 200, 'aluno_maria_santos': 120 },
        observacoes: { 'aluno_joao_silva': 'Grande progressão na distância.', 'aluno_maria_santos': 'Conseguiu fazer bobbing completo.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c1_4',
        turmaId: 'turma_kids_nivel1',
        data: daysAgo(3),
        sumario: 'Revisão de pernada crawl e teste de autonomia.',
        presencas: ['aluno_joao_silva', 'aluno_maria_santos'],
        distancias: { 'aluno_joao_silva': 250, 'aluno_maria_santos': 180 },
        observacoes: { 'aluno_joao_silva': 'Bate pernas muito forte.', 'aluno_maria_santos': 'Focou-se e nadou mais hoje.' },
        professorId: 'eduardo_oliveira'
      },

      // Turma 2 logs (Adultos Nível 2)
      {
        id: 'log_c2_1',
        turmaId: 'turma_adults_nivel2',
        data: daysAgo(14),
        sumario: 'Técnica de pernada e sustentação vertical.',
        presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'],
        distancias: { 'aluno_rita_mendes': 200, 'aluno_bruno_ramos': 150 },
        observacoes: { 'aluno_rita_mendes': 'Muito focada.', 'aluno_bruno_ramos': 'Demonstra boa energia.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c2_2',
        turmaId: 'turma_adults_nivel2',
        data: daysAgo(11),
        sumario: 'Crawl completo com foco na respiração bilateral.',
        presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'],
        distancias: { 'aluno_rita_mendes': 250, 'aluno_bruno_ramos': 300 },
        observacoes: { 'aluno_rita_mendes': 'Falta rotação de ombros.', 'aluno_bruno_ramos': 'Bom deslize no crawl.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c2_3',
        turmaId: 'turma_adults_nivel2',
        data: daysAgo(7),
        sumario: 'Nado de costas e viragens básicas.',
        presencas: ['aluno_rita_mendes'],
        distancias: { 'aluno_rita_mendes': 350 },
        observacoes: { 'aluno_rita_mendes': 'Costas está excelente.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c2_4',
        turmaId: 'turma_adults_nivel2',
        data: daysAgo(4),
        sumario: 'Subaquáticos de 5 metros e séries de 100m.',
        presencas: ['aluno_rita_mendes', 'aluno_bruno_ramos'],
        distancias: { 'aluno_rita_mendes': 400, 'aluno_bruno_ramos': 450 },
        observacoes: { 'aluno_rita_mendes': 'Grande fôlego.', 'aluno_bruno_ramos': 'Fez 450 metros com facilidade.' },
        professorId: 'eduardo_oliveira'
      },

      // Turma 3 logs
      {
        id: 'log_c3_1',
        turmaId: 'turma_comp_nivel3',
        data: daysAgo(12),
        sumario: 'Séries aeróbicas crawl e braçada bruços.',
        presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'],
        distancias: { 'aluno_pedro_costa': 800, 'aluno_ana_oliveira': 750 },
        observacoes: { 'aluno_pedro_costa': 'Ritmo constante.', 'aluno_ana_oliveira': 'Técnica muito limpa.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c3_2',
        turmaId: 'turma_comp_nivel3',
        data: daysAgo(10),
        sumario: 'Partidas de bloco e transição subaquática.',
        presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'],
        distancias: { 'aluno_pedro_costa': 1000, 'aluno_ana_oliveira': 950 },
        observacoes: { 'aluno_pedro_costa': 'Partidas explosivas.', 'aluno_ana_oliveira': 'Bons apoios no bloco.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c3_3',
        turmaId: 'turma_comp_nivel3',
        data: daysAgo(5),
        sumario: 'Técnica de mariposa e séries de 50m.',
        presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'],
        distancias: { 'aluno_pedro_costa': 1200, 'aluno_ana_oliveira': 1100 },
        observacoes: { 'aluno_pedro_costa': 'Grande esforço em mariposa.', 'aluno_ana_oliveira': 'Fluida na ondulação.' },
        professorId: 'eduardo_oliveira'
      },
      {
        id: 'log_c3_4',
        turmaId: 'turma_comp_nivel3',
        data: daysAgo(3),
        sumario: 'Teste de 200m contínuos e viragens de salto.',
        presencas: ['aluno_pedro_costa', 'aluno_ana_oliveira'],
        distancias: { 'aluno_pedro_costa': 1500, 'aluno_ana_oliveira': 1300 },
        observacoes: { 'aluno_pedro_costa': 'Nadou 1500 metros no total, parabéns.', 'aluno_ana_oliveira': 'Conseguiu 1300m e ótimas viragens.' },
        professorId: 'eduardo_oliveira'
      }
    ];

    logHistory.forEach(lg => {
      batch.set(doc(db, logsPath, lg.id), lg, { merge: true });
    });

    // Seed de Velocidade Crítica inicial para o Pedro Costa (Competição)
    const csPath = `artifacts/${APP_ID}/public/data/swimming_critical_speed`;
    batch.set(doc(db, csPath, 'aluno_pedro_costa'), {
      studentId: 'aluno_pedro_costa',
      distance1: 50,
      time1: 35,
      distance2: 200,
      time2: 170,
      criticalSpeed: 1.11,
      lastUpdated: new Date().toISOString()
    });

    await batch.commit();

    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });

    localStorage.setItem('cpx_seed_swimming_v3', 'true');
    console.log("Seeding de Natação V3 concluído com sucesso!");
  } catch (err) {
    console.error("Erro no Seeding de Natação V3:", err);
  }
}

// ============================================================================
// PORTAL DO PROFESSOR (Gestão de Turmas, Registos Diários, Fichas de Avaliação)
// ============================================================================
export function SwimmingTeacherPortal({ user, utentes }: { user: UserProfile; utentes: UserProfile[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'classes' | 'live' | 'evaluation' | 'analytics'>('classes');
  
  const [classes, setClasses] = useState<SwimmingClass[]>([]);
  const [logs, setLogs] = useState<SwimmingLog[]>([]);
  const [evaluations, setEvaluations] = useState<SwimmingEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showAddClassModal, setShowAddClassModal] = useState(false);

  // Firestore paths
  const classesPath = `artifacts/${APP_ID}/public/data/swimming_classes`;
  const logsPath = `artifacts/${APP_ID}/public/data/swimming_logs`;
  const evaluationsPath = `artifacts/${APP_ID}/public/data/swimming_evaluations`;

  // Real-time synchronization
  useEffect(() => {
    const professorIds = Array.from(new Set([user.id, 'eduardo_oliveira']));

    // 1. Turmas
    const qClasses = query(collection(db, classesPath), where('professorId', 'in', professorIds));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SwimmingClass)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'swimming_classes'));

    // 2. Logs
    const qLogs = query(collection(db, logsPath), where('professorId', 'in', professorIds));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SwimmingLog)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'swimming_logs'));

    // 3. Avaliações
    const qEvals = query(collection(db, evaluationsPath));
    const unsubEvals = onSnapshot(qEvals, (snap) => {
      setEvaluations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SwimmingEvaluation)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'swimming_evaluations'));

    return () => {
      unsubClasses();
      unsubLogs();
      unsubEvals();
    };
  }, [user.id]);

  // Seletor de turmas da escola
  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Criar nova turma
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('Natação Nível 1');
  const [newClassTime, setNewClassTime] = useState('');
  const [selectedStudentsForClass, setSelectedStudentsForClass] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  const availableUtentes = useMemo(() => {
    return utentes
      .filter(u => u.role === 'utente')
      .filter(u => (u.nome || u.n || '').toLowerCase().includes(studentSearchTerm.toLowerCase()));
  }, [utentes, studentSearchTerm]);

  // Estado para adicionar aluno a turma existente
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addStudentSearch, setAddStudentSearch] = useState('');

  const studentsNotInClass = useMemo(() => {
    if (!selectedClass) return [];
    return utentes
      .filter(u => u.role === 'utente' && !selectedClass.alunos.includes(u.id))
      .filter(u => (u.nome || u.n || '').toLowerCase().includes(addStudentSearch.toLowerCase()));
  }, [utentes, selectedClass, addStudentSearch]);

  const handleAddStudentToClass = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      const updated = [...selectedClass.alunos, studentId];
      await setDoc(doc(db, classesPath, selectedClass.id), { alunos: updated }, { merge: true });
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_classes');
    }
  };

  const handleRemoveStudentFromClass = async (studentId: string) => {
    if (!selectedClass) return;
    const pupil = utentes.find(u => u.id === studentId);
    if (!window.confirm(`Remover "${pupil?.n || pupil?.nome}" desta turma?`)) return;
    try {
      const updated = selectedClass.alunos.filter(id => id !== studentId);
      await setDoc(doc(db, classesPath, selectedClass.id), { alunos: updated }, { merge: true });
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_classes');
    }
  };

  // Estado para período do relatório PDF
  const [reportPeriod, setReportPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleGeneratePDF = () => {
    if (!selectedStudentId || !selectedStudent) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const [year, month] = reportPeriod.split('-');
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const periodLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

    // Logs do período
    const periodLogs = logs.filter(l => {
      return l.presencas.includes(selectedStudentId) && l.data.startsWith(`${year}-${month}`);
    });
    const allStudentLogs = logs.filter(l => l.presencas.includes(selectedStudentId));
    const totalMeters = allStudentLogs.reduce((acc, l) => acc + (l.distancias[selectedStudentId] || 0), 0);
    const periodMeters = periodLogs.reduce((acc, l) => acc + (l.distancias[selectedStudentId] || 0), 0);

    const skillStatuses = evalSkills;
    const acquired = Object.values(skillStatuses).filter(s => s === 'adquirido').length;
    const inProgress = Object.values(skillStatuses).filter(s => s === 'em_desenvolvimento').length;
    const total = Object.keys(skillStatuses).length;
    const progressPct = total > 0 ? Math.round(((acquired + inProgress * 0.5) / total) * 100) : 0;

    const W = 210;
    let y = 0;

    // Cabeçalho azul
    doc.setFillColor(0, 77, 113);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFillColor(247, 181, 0);
    doc.rect(0, 38, W, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('COMPLEXO DESPORTIVO', 15, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(247, 181, 0);
    doc.text('VILA DE REI  ·  SWIM TRACK', 15, 21);
    doc.setTextColor(255, 255, 255);
    doc.text('RELATÓRIO DE AVALIAÇÃO PEDAGÓGICA', 15, 32);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(247, 181, 0);
    doc.text(`PERÍODO: ${periodLabel.toUpperCase()}`, W - 15, 32, { align: 'right' });

    y = 54;

    // Secção do aluno
    doc.setFillColor(245, 248, 250);
    doc.roundedRect(10, y - 6, W - 20, 28, 3, 3, 'F');
    doc.setTextColor(0, 77, 113);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const studentName = (selectedStudent.n || selectedStudent.nome || '').toUpperCase();
    doc.text(studentName, 18, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Turma: ${studentClass?.nome || 'N/D'}   |   Nível: ${selectedStudent.modalidade || 'Natação Nível 1'}   |   Idade: ${selectedStudent.idade || '—'} anos`, 18, y + 11);
    doc.text(`Professor: ${user.nome || user.n || user.email}   |   Data do relatório: ${new Date().toLocaleDateString('pt-PT')}`, 18, y + 17);

    // Badge de progresso
    const badgeX = W - 45;
    doc.setFillColor(0, 77, 113);
    doc.roundedRect(badgeX, y - 4, 35, 26, 4, 4, 'F');
    doc.setTextColor(247, 181, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(`${progressPct}%`, badgeX + 17.5, y + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('PROGRESSO', badgeX + 17.5, y + 17, { align: 'center' });

    y += 36;

    // Estatísticas do período
    doc.setFillColor(0, 77, 113);
    doc.rect(10, y, W - 20, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ESTATÍSTICAS DO PERÍODO', 15, y + 4.5);
    y += 10;

    const statsData = [
      { label: 'Aulas no Período', val: `${periodLogs.length}` },
      { label: 'Metros no Período', val: `${periodMeters}m` },
      { label: 'Total Aulas (acum.)', val: `${allStudentLogs.length}` },
      { label: 'Total Metros (acum.)', val: `${totalMeters}m` },
    ];
    const statW = (W - 20) / 4;
    statsData.forEach((s, i) => {
      const sx = 10 + i * statW;
      doc.setFillColor(i % 2 === 0 ? 248 : 241, i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 252 : 250);
      doc.rect(sx, y, statW, 14, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(s.label.toUpperCase(), sx + statW / 2, y + 5, { align: 'center' });
      doc.setTextColor(0, 77, 113);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(s.val, sx + statW / 2, y + 11.5, { align: 'center' });
    });
    y += 20;

    // Grelha de competências
    doc.setFillColor(0, 77, 113);
    doc.rect(10, y, W - 20, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GRELHA DE COMPETÊNCIAS / OBJETIVOS', 15, y + 4.5);
    y += 10;

    Object.entries(skillStatuses).forEach(([skill, status], idx) => {
      const rowY = y + idx * 9;
      doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
      doc.rect(10, rowY, W - 20, 8, 'F');

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${idx + 1}. ${skill}`, 15, rowY + 5);

      const statusColors: Record<string, [number,number,number]> = {
        adquirido: [16, 185, 129],
        em_desenvolvimento: [247, 181, 0],
        não_iniciado: [148, 163, 184],
      };
      const statusLabels: Record<string, string> = {
        adquirido: 'ADQUIRIDO',
        em_desenvolvimento: 'EM PROGRESSO',
        não_iniciado: 'NÃO INICIADO',
      };
      const [r, g, b] = statusColors[status] || [148, 163, 184];
      doc.setFillColor(r, g, b);
      doc.roundedRect(W - 52, rowY + 1.5, 36, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(statusLabels[status] || status.toUpperCase(), W - 34, rowY + 5.2, { align: 'center' });
    });
    y += Object.keys(skillStatuses).length * 9 + 6;

    // Observações do professor
    if (evalFeedback || evalNextStep) {
      doc.setFillColor(0, 77, 113);
      doc.rect(10, y, W - 20, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('PRESCRIÇÃO PEDAGÓGICA DO PROFESSOR', 15, y + 4.5);
      y += 10;

      if (evalFeedback) {
        doc.setFillColor(248, 250, 252);
        const feedLines = doc.splitTextToSize(evalFeedback, W - 30);
        const feedH = feedLines.length * 5 + 6;
        doc.rect(10, y, W - 20, feedH, 'F');
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(feedLines, 15, y + 5);
        y += feedH + 4;
      }

      if (evalNextStep) {
        doc.setFillColor(0, 77, 113);
        doc.roundedRect(10, y, W - 20, 10, 2, 2, 'F');
        doc.setTextColor(247, 181, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('PROPOSTA DE PROGRESSÃO:', 15, y + 4.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        doc.text(evalNextStep, 15, y + 8.5);
        y += 14;
      }
    }

    // Assinaturas
    y += 8;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(15, y + 12, 85, y + 12);
    doc.line(W - 85, y + 12, W - 15, y + 12);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Assinatura do Professor', 50, y + 16, { align: 'center' });
    doc.text('Assinatura do Encarregado de Educação', W - 50, y + 16, { align: 'center' });

    // Rodapé
    doc.setFillColor(0, 77, 113);
    doc.rect(0, 282, W, 15, 'F');
    doc.setTextColor(247, 181, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPLEXO DESPORTIVO MUNICIPAL DE VILA DE REI', W / 2, 288, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text('Swim Track — Sistema de Gestão Pedagógica de Natação', W / 2, 293, { align: 'center' });

    const fileName = `avaliacao_${(selectedStudent.n || selectedStudent.nome || 'aluno').toLowerCase().replace(/\s+/g, '_')}_${reportPeriod}.pdf`;
    doc.save(fileName);
  };

  const handleCreateClass = async () => {
    if (!newClassName || !newClassTime) {
      alert("Nome e Horário são obrigatórios.");
      return;
    }

    try {
      const newId = `class_${Date.now()}`;
      const newClass: SwimmingClass = {
        id: newId,
        nome: newClassName,
        horario: newClassTime,
        nivel: newClassLevel,
        professorId: user.id,
        alunos: selectedStudentsForClass,
        objetivos: DEFAULT_OBJECTIVES[newClassLevel] || []
      };

      await setDoc(doc(db, classesPath, newId), newClass);
      alert(`Turma "${newClassName}" criada com sucesso.`);
      setShowAddClassModal(false);
      setNewClassName('');
      setNewClassTime('');
      setSelectedStudentsForClass([]);
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_classes');
    }
  };

  // State para registo diário de aulas
  const [liveClassId, setLiveClassId] = useState('');
  const [liveDate, setLiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [liveSummary, setLiveSummary] = useState('');
  const [livePresence, setLivePresence] = useState<Record<string, boolean>>({});
  const [liveDistances, setLiveDistances] = useState<Record<string, number>>({});
  const [liveNotes, setLiveNotes] = useState<Record<string, string>>({});

  const activeLiveClass = useMemo(() => {
    return classes.find(c => c.id === liveClassId) || null;
  }, [classes, liveClassId]);

  // Carrega lista de alunos da turma selecionada para o Diário de Aula
  useEffect(() => {
    if (activeLiveClass) {
      const pres: Record<string, boolean> = {};
      const dists: Record<string, number> = {};
      const nts: Record<string, string> = {};

      activeLiveClass.alunos.forEach(aid => {
        pres[aid] = true; // Presente por omissão
        dists[aid] = activeLiveClass.nivel.includes('Nível 3') ? 400 : (activeLiveClass.nivel.includes('Nível 2') ? 200 : 50);
        nts[aid] = '';
      });

      setLivePresence(pres);
      setLiveDistances(dists);
      setLiveNotes(nts);
    }
  }, [activeLiveClass]);

  const handleSaveLiveLog = async () => {
    if (!liveClassId || !liveDate || !liveSummary) {
      alert("Selecione a Turma, a Data e introduza o Sumário Pedagógico.");
      return;
    }

    try {
      const logId = `log_${Date.now()}`;
      const presentStudentIds = Object.keys(livePresence).filter(id => livePresence[id]);

      const logData: SwimmingLog = {
        id: logId,
        turmaId: liveClassId,
        data: liveDate,
        sumario: liveSummary,
        presencas: presentStudentIds,
        distancias: liveDistances,
        observacoes: liveNotes,
        professorId: user.id
      };

      await setDoc(doc(db, logsPath, logId), logData);
      
      // Criar avisos específicos no diário do aluno (ou feed) se o professor escrever observações
      alert("Registo diário de aula guardado com sucesso à beira da piscina!");
      setActiveSubTab('classes');
      setLiveSummary('');
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_logs');
    }
  };

  // State para Ficha de Avaliação de Alunos
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const selectedStudent = useMemo(() => {
    return utentes.find(u => u.id === selectedStudentId) || null;
  }, [utentes, selectedStudentId]);

  // Carrega turma correspondente ao aluno
  const studentClass = useMemo(() => {
    if (!selectedStudentId) return null;
    return classes.find(c => c.alunos.includes(selectedStudentId)) || null;
  }, [classes, selectedStudentId]);

  const studentObjectives = useMemo(() => {
    if (studentClass) return studentClass.objetivos;
    if (selectedStudent?.modalidade) {
      return DEFAULT_OBJECTIVES[selectedStudent.modalidade] || DEFAULT_OBJECTIVES['Natação Nível 1'];
    }
    return DEFAULT_OBJECTIVES['Natação Nível 1'];
  }, [studentClass, selectedStudent]);

  // Carrega avaliação existente do aluno
  const currentEvaluation = useMemo(() => {
    return evaluations.find(e => e.studentId === selectedStudentId) || null;
  }, [evaluations, selectedStudentId]);

  const [evalSkills, setEvalSkills] = useState<Record<string, 'não_iniciado' | 'em_desenvolvimento' | 'adquirido'>>({});
  const [evalFeedback, setEvalFeedback] = useState('');
  const [evalNextStep, setEvalNextStep] = useState('');

  useEffect(() => {
    if (selectedStudentId) {
      const skills: Record<string, 'não_iniciado' | 'em_desenvolvimento' | 'adquirido'> = {};
      
      // Popula com o existente ou não_iniciado
      studentObjectives.forEach(obj => {
        skills[obj] = currentEvaluation?.skills?.[obj] || 'não_iniciado';
      });

      setEvalSkills(skills);
      setEvalFeedback(currentEvaluation?.feedback || '');
      setEvalNextStep(currentEvaluation?.nivelProposto || '');
    }
  }, [selectedStudentId, currentEvaluation, studentObjectives]);

  const handleSaveEvaluation = async () => {
    if (!selectedStudentId) return;

    try {
      const evalData: SwimmingEvaluation = {
        id: selectedStudentId,
        studentId: selectedStudentId,
        lastUpdated: new Date().toISOString(),
        skills: evalSkills,
        feedback: evalFeedback,
        nivelProposto: evalNextStep
      };

      await setDoc(doc(db, evaluationsPath, selectedStudentId), evalData);
      alert(`Avaliação de "${selectedStudent?.n || selectedStudent?.nome}" guardada no sistema.`);
      
      // Atualizar o perfil do aluno com o nível sugerido se aplicável
      if (evalNextStep) {
        await setDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, selectedStudentId), {
          objetivos: evalNextStep
        }, { merge: true });
      }
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_evaluations');
    }
  };

  // State para estatísticas e análises
  const [statsStudentId, setStatsStudentId] = useState<string>('');
  const [criticalSpeedData, setCriticalSpeedData] = useState<any>(null);
  const [isEditingCS, setIsEditingCS] = useState(false);
  const [csD1, setCsD1] = useState(50);
  const [csT1Min, setCsT1Min] = useState(0);
  const [csT1Sec, setCsT1Sec] = useState(45);
  const [csD2, setCsD2] = useState(200);
  const [csT2Min, setCsT2Min] = useState(3);
  const [csT2Sec, setCsT2Sec] = useState(15);

  useEffect(() => {
    if (!statsStudentId) {
      setCriticalSpeedData(null);
      setIsEditingCS(false);
      return;
    }
    const csRef = doc(db, `artifacts/${APP_ID}/public/data/swimming_critical_speed`, statsStudentId);
    return onSnapshot(csRef, (snap) => {
      if (snap.exists()) {
        setCriticalSpeedData(snap.data());
        setIsEditingCS(false);
      } else {
        setCriticalSpeedData(null);
        setIsEditingCS(true);
      }
    });
  }, [statsStudentId]);

  const handleSaveCS = async () => {
    if (!statsStudentId) return;
    const t1 = (csT1Min * 60) + csT1Sec;
    const t2 = (csT2Min * 60) + csT2Sec;
    if (t2 <= t1 || csD2 <= csD1) {
      alert("Erro: A distância 2 e tempo 2 devem ser maiores do que a distância 1 e tempo 1!");
      return;
    }
    const vc = (csD2 - csD1) / (t2 - t1);
    try {
      const csRef = doc(db, `artifacts/${APP_ID}/public/data/swimming_critical_speed`, statsStudentId);
      await setDoc(csRef, {
        studentId: statsStudentId,
        distance1: csD1,
        time1: t1,
        distance2: csD2,
        time2: t2,
        criticalSpeed: Number(vc.toFixed(2)),
        lastUpdated: new Date().toISOString()
      });
      setIsEditingCS(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'swimming_critical_speed');
    }
  };

  const statsStudentLogs = useMemo(() => {
    if (!statsStudentId) return [];
    return logs
      .filter(l => l.presencas.includes(statsStudentId))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [logs, statsStudentId]);

  const statsStudent = useMemo(() => {
    return utentes.find(u => u.id === statsStudentId) || null;
  }, [utentes, statsStudentId]);

  const statsStudentEval = useMemo(() => {
    return evaluations.find(e => e.studentId === statsStudentId) || null;
  }, [evaluations, statsStudentId]);

  // Lista de alunos de todas as turmas deste professor
  const teacherStudents = useMemo(() => {
    const ids = new Set<string>();
    classes.forEach(c => c.alunos.forEach(aid => ids.add(aid)));
    return utentes.filter(u => ids.has(u.id));
  }, [classes, utentes]);

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Waves className="text-[#F7B500] animate-pulse"/> Portal Swim Track
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão de Natação e Aulas à Beira da Piscina</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => {
              setLiveClassId(classes[0]?.id || '');
              setActiveSubTab('live');
            }}
            className="flex-1 sm:flex-none bg-[#F7B500] text-[#004D71] px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-[#F7B500]/80 transition-all"
          >
            <Play size={14}/> Iniciar Aula
          </button>
          <button 
            onClick={() => setShowAddClassModal(true)}
            className="flex-1 sm:flex-none bg-[#004D71] text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-[#004D71]/80 transition-all border border-[#004D71]/25"
          >
            <Plus size={14}/> Criar Turma
          </button>
        </div>
      </div>

      {/* Sub-Navegação */}
      <div className="flex border-b border-slate-200 overflow-x-auto hide-scrollbar gap-4 px-1">
        {[
          { id: 'classes', label: 'Turmas', icon: <Users size={16}/> },
          { id: 'live', label: 'Diário de Aula', icon: <NotebookPen size={16}/> },
          { id: 'evaluation', label: 'Avaliar Aluno', icon: <Award size={16}/> },
          { id: 'analytics', label: 'Análise & Estatísticas', icon: <TrendingUp size={16}/> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 pb-4 pt-1 px-1 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${activeSubTab === tab.id ? 'border-[#F7B500] text-[#004D71]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="py-24 text-center">
          <PicotoIcon className="mx-auto mb-4 animate-spin text-[#004D71]" size={40}/>
          <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">A carregar dados do portal...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ==========================================
              SUB-TAB 1: TURMAS
             ========================================== */}
          {activeSubTab === 'classes' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de Turmas */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest px-2 mb-4">Escolha uma Turma</h3>
                {classes.map(c => {
                  const isActive = selectedClassId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={`w-full p-5 rounded-[2rem] border-4 text-left transition-all active:scale-[0.98] flex justify-between items-center shadow-sm relative ${isActive ? 'bg-[#004D71] border-[#F7B500] text-white' : 'bg-white border-[#004D71]/5 text-[#004D71] hover:border-[#004D71]/15'}`}
                    >
                      <div className="space-y-1">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isActive ? 'bg-white/10 text-[#F7B500]' : 'bg-[#004D71]/5 text-[#004D71]'}`}>
                          {c.nivel}
                        </span>
                        <h4 className="font-black text-sm uppercase leading-none mt-2 truncate max-w-[180px]">{c.nome}</h4>
                        <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide mt-2 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                          <Clock size={10}/> {c.horario}
                        </div>
                      </div>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${isActive ? 'bg-[#F7B500] text-[#004D71]' : 'bg-slate-50 text-[#004D71]'}`}>
                        {c.alunos.length}
                      </div>
                    </button>
                  );
                })}

                {classes.length === 0 && (
                  <div className="bg-white rounded-[2rem] p-10 text-center border-4 border-dashed border-slate-100">
                    <PicotoIcon className="mx-auto mb-3 opacity-20" size={40}/>
                    <p className="font-black text-[10px] uppercase text-slate-400">Nenhuma turma criada por si</p>
                  </div>
                )}
              </div>

              {/* Detalhes da Turma Selecionada */}
              <div className="lg:col-span-2">
                {selectedClass ? (
                  <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm space-y-6">
                    {/* Topo do Detalhe */}
                    <div className="flex justify-between items-start border-b pb-6 border-slate-100">
                      <div>
                        <span className="text-[9px] font-black text-[#F7B500] bg-[#004D71]/5 px-3 py-1 rounded-full uppercase tracking-wider">{selectedClass.nivel}</span>
                        <h3 className="text-xl font-black text-[#004D71] uppercase tracking-tighter mt-3">{selectedClass.nome}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                          <Calendar size={12}/> Horário: {selectedClass.horario}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {user.role === 'admin' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Tem a certeza que deseja apagar a turma "${selectedClass.nome}"? Esta ação não pode ser desfeita.`)) {
                                try {
                                  await deleteDoc(doc(db, classesPath, selectedClass.id));
                                  alert("Turma apagada com sucesso.");
                                  setSelectedClassId(null);
                                } catch (err) {
                                  console.error("Erro ao apagar turma:", err);
                                  alert("Erro ao apagar turma.");
                                }
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-wider flex items-center gap-2 active:scale-95 shadow-md"
                            title="Apagar Turma"
                          >
                            <Trash2 size={12}/> Apagar Turma
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setLiveClassId(selectedClass.id);
                            setActiveSubTab('live');
                          }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-wider flex items-center gap-2 active:scale-95 shadow-md shadow-emerald-500/10"
                        >
                          <Play size={12}/> Dar Aula Hoje
                        </button>
                      </div>
                    </div>

                    {/* Metodologia / Objetivos da Turma */}
                    <div className="space-y-3 bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2">
                          <BookOpen size={14}/> Conteúdos Metodológicos / Objetivos
                        </h4>
                        <button
                          onClick={async () => {
                            const newObj = prompt("Introduza um novo objetivo personalizado para esta turma:");
                            if (newObj && newObj.trim()) {
                              try {
                                const updatedObj = [...selectedClass.objetivos, newObj.trim()];
                                await setDoc(doc(db, classesPath, selectedClass.id), {
                                  objetivos: updatedObj
                                }, { merge: true });
                                alert("Objetivo adicionado à metodologia da turma.");
                              } catch (e) {
                                console.error(e);
                              }
                            }
                          }}
                          className="text-[#004D71] text-[9px] font-black uppercase flex items-center gap-1 hover:text-[#F7B500] transition-colors"
                        >
                          <Plus size={12}/> Adicionar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedClass.objetivos.map((obj, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                            <span className="w-5 h-5 bg-[#004D71]/5 text-[#004D71] rounded-lg flex items-center justify-center text-[9px] font-black">{i + 1}</span>
                            <span className="truncate">{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alunos Inscritos */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pl-2">
                        <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2">
                          <Users size={14}/> Alunos na Turma ({selectedClass.alunos.length})
                        </h4>
                        <button
                          onClick={() => { setAddStudentSearch(''); setShowAddStudentModal(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004D71] text-[#F7B500] rounded-xl text-[8px] font-black uppercase hover:bg-[#004D71]/80 transition-colors"
                        >
                          <UserPlus size={12}/> Adicionar Aluno
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedClass.alunos.map(aid => {
                          const pupil = utentes.find(u => u.id === aid);
                          if (!pupil) return null;
                          return (
                            <div key={aid} className="p-4 bg-white rounded-3xl border-2 border-slate-100 flex items-center justify-between group">
                              <div className="flex items-center gap-3 min-w-0">
                                <AvatarImage src={pupil.img} alt={pupil.n || pupil.nome} className="w-12 h-12 rounded-xl shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-black text-[#004D71] text-xs uppercase truncate leading-none">{pupil.n || pupil.nome}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">{pupil.idade || '—'} Anos • {pupil.modalidade || 'Utente'}</p>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => { setSelectedStudentId(aid); setActiveSubTab('evaluation'); }}
                                  title="Avaliar"
                                  className="p-2 hover:bg-[#F7B500]/10 text-[#004D71] rounded-xl transition-colors"
                                ><Award size={15}/></button>
                                <button
                                  onClick={() => { setStatsStudentId(aid); setActiveSubTab('analytics'); }}
                                  title="Estatísticas"
                                  className="p-2 hover:bg-[#004D71]/5 text-slate-400 hover:text-[#004D71] rounded-xl transition-colors"
                                ><TrendingUp size={15}/></button>
                                <button
                                  onClick={() => handleRemoveStudentFromClass(aid)}
                                  title="Remover da turma"
                                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-all"
                                ><X size={15}/></button>
                              </div>
                            </div>
                          );
                        })}

                        {selectedClass.alunos.length === 0 && (
                          <div className="md:col-span-2 p-12 text-center text-slate-300">
                            <PicotoIcon className="mx-auto mb-2 opacity-20" size={30}/>
                            <p className="text-[10px] font-black uppercase">Nenhum aluno inscrito. Use "+ Adicionar Aluno".</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[2.5rem] p-16 text-center border-4 border-[#004D71]/5 shadow-sm text-slate-300">
                    <Waves className="mx-auto mb-4 opacity-10" size={80} />
                    <h3 className="font-black text-base text-[#004D71] uppercase">Gestão de Turmas Swim Track</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase max-w-sm mx-auto mt-2">Escolha uma turma da lista à esquerda para analisar alunos, conteúdos metodológicos e prescrever evoluções.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              SUB-TAB 2: DIÁRIO DE AULA (REGISTO REAL-TIME)
             ========================================== */}
          {activeSubTab === 'live' && (
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4 border-slate-100">
                <NotebookPen className="text-[#F7B500]"/>
                <div>
                  <h3 className="text-base font-black text-[#004D71] uppercase">Diário de Aula</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Registe dados pedagógicos e distâncias à beira da piscina em tempo real</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Seletores */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecionar Turma</label>
                    <select
                      value={liveClassId}
                      onChange={(e) => setLiveClassId(e.target.value)}
                      className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-3.5 font-black text-xs text-[#004D71] outline-none"
                    >
                      <option value="">-- Escolher Turma --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome} ({c.horario})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data da Aula</label>
                    <input
                      type="date"
                      value={liveDate}
                      onChange={(e) => setLiveDate(e.target.value)}
                      className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-3.5 font-black text-xs text-[#004D71] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conteúdo / Sumário da Aula</label>
                    <textarea
                      value={liveSummary}
                      onChange={(e) => setLiveSummary(e.target.value)}
                      rows={4}
                      placeholder="Ex: Treino de batimento de pernas de costas e técnica de bobbing rítmico."
                      className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-4 font-bold text-xs text-[#004D71] outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Grelha de Alunos na Aula */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest pl-2">Alunos & Avaliação em Tempo Real</h4>
                  
                  {activeLiveClass ? (
                    <div className="space-y-4 max-h-[60dvh] overflow-y-auto pr-1">
                      {activeLiveClass.alunos.map(aid => {
                        const pupil = utentes.find(u => u.id === aid);
                        if (!pupil) return null;

                        const isPresent = livePresence[aid] ?? true;
                        const dist = liveDistances[aid] ?? 50;
                        const note = liveNotes[aid] ?? '';

                        return (
                          <div 
                            key={aid} 
                            className={`p-5 rounded-[2rem] border-4 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${isPresent ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-[#004D71]/5 opacity-60'}`}
                          >
                            {/* Aluno Perfil */}
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <AvatarImage src={pupil.img} alt={pupil.n || pupil.nome} className="w-12 h-12 rounded-xl shrink-0" />
                              <div className="min-w-0">
                                <p className="font-black text-[#004D71] text-xs uppercase truncate leading-none">{pupil.n || pupil.nome}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-2">IDADE: {pupil.idade || '—'}</p>
                              </div>
                            </div>

                            {/* Controlo de Presença */}
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setLivePresence(prev => ({ ...prev, [aid]: !isPresent }))}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm ${isPresent ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                              >
                                {isPresent ? 'Presente' : 'Ausente'}
                              </button>
                            </div>

                            {/* Controlo de Distância e Notas se estiver Presente */}
                            {isPresent && (
                              <div className="flex-1 space-y-3">
                                {/* Distância Slider */}
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Distância:</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="2000"
                                    step="25"
                                    value={dist}
                                    onChange={(e) => setLiveDistances(prev => ({ ...prev, [aid]: parseInt(e.target.value) }))}
                                    className="flex-1 accent-[#004D71] h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <span className="text-xs font-black text-[#004D71] tabular-nums whitespace-nowrap min-w-[50px] text-right">{dist}m</span>
                                </div>
                                {/* Increments rápidos */}
                                <div className="flex gap-1.5 justify-end pl-16">
                                  {['+25', '+50', '+100'].map(val => (
                                    <button
                                      key={val}
                                      onClick={() => {
                                        const inc = parseInt(val.replace('+', ''));
                                        setLiveDistances(prev => ({ ...prev, [aid]: Math.min(2000, (prev[aid] || 0) + inc) }));
                                      }}
                                      className="px-2 py-1 bg-[#004D71]/5 hover:bg-[#004D71]/10 rounded-md text-[8px] font-black text-[#004D71]"
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                                {/* Notas Rápidas */}
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-16">Nota:</span>
                                  <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setLiveNotes(prev => ({ ...prev, [aid]: e.target.value }))}
                                    placeholder="Escreva uma observação..."
                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 font-bold text-[10px] text-[#004D71] outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300">
                      <PicotoIcon className="mx-auto mb-3 opacity-20" size={40}/>
                      <p className="font-black text-[10px] uppercase">Selecione uma turma para carregar os alunos.</p>
                    </div>
                  )}
                </div>
              </div>

              {activeLiveClass && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSaveLiveLog}
                    className="bg-[#004D71] text-[#F7B500] px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-[#004D71]/90 active:scale-95 transition-all flex items-center gap-3"
                  >
                    <Save size={16}/> Guardar Registo da Aula
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              SUB-TAB 3: AVALIAÇÕES DE METODOLOGIA
             ========================================== */}
          {activeSubTab === 'evaluation' && (
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4 border-slate-100">
                <Award className="text-[#F7B500]"/>
                <div>
                  <h3 className="text-base font-black text-[#004D71] uppercase">Ficha de Avaliação e Evolução</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Controle a aquisição de competências do aluno</p>
                </div>
              </div>

              {/* Seletor de Aluno */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecionar Aluno</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-3.5 font-black text-xs text-[#004D71] outline-none"
                    >
                      <option value="">-- Escolher Aluno --</option>
                      {teacherStudents.map(ts => (
                        <option key={ts.id} value={ts.id}>{ts.n || ts.nome}</option>
                      ))}
                    </select>
                  </div>

                  {selectedStudent && (
                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-center space-y-3">
                      <AvatarImage src={selectedStudent.img} alt={selectedStudent.n || selectedStudent.nome} className="w-16 h-16 rounded-2xl mx-auto shadow-md" />
                      <div>
                        <h4 className="font-black text-[#004D71] text-xs uppercase leading-none">{selectedStudent.n || selectedStudent.nome}</h4>
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">{studentClass?.nome || 'Sem Turma Oficial'}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-200">
                        <span className="text-[8px] font-black text-white bg-[#004D71] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Nível: {selectedStudent.modalidade || 'Natação Nível 1'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ficha de Avaliação Física */}
                <div className="md:col-span-3 space-y-6">
                  {selectedStudentId ? (
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest pl-2">Grelha de Competências / Objetivos da Turma</h4>
                      
                      <div className="space-y-3">
                        {studentObjectives.map((obj) => {
                          const status = evalSkills[obj] || 'não_iniciado';
                          return (
                            <div key={obj} className="p-4 bg-white rounded-2xl border-2 border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <span className="text-[11px] font-bold text-[#004D71] uppercase">{obj}</span>
                              <div className="flex gap-1.5">
                                {[
                                  { id: 'não_iniciado', label: 'Não Iniciado', color: 'bg-slate-100 text-slate-500 border-slate-100' },
                                  { id: 'em_desenvolvimento', label: 'Em Progresso', color: 'bg-[#F7B500]/10 text-[#004D71] border-[#F7B500]' },
                                  { id: 'adquirido', label: 'Adquirido', color: 'bg-emerald-500 text-white border-emerald-500' }
                                ].map(opt => {
                                  const isSelected = status === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => setEvalSkills(prev => ({ ...prev, [obj]: opt.id as any }))}
                                      className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${isSelected ? opt.color + ' scale-105 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prescrições */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Prescrição Pedagógica</label>
                          <textarea
                            value={evalFeedback}
                            onChange={(e) => setEvalFeedback(e.target.value)}
                            rows={3}
                            placeholder="Escreva conselhos pedagógicos específicos de evolução para o aluno."
                            className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-4 font-bold text-xs text-[#004D71] outline-none resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Planeamento de Próximo Nível / Foco Individual</label>
                          <textarea
                            value={evalNextStep}
                            onChange={(e) => setEvalNextStep(e.target.value)}
                            rows={3}
                            placeholder="Defina o próximo passo para o aluno (ex: Focar em viragens de crawl)."
                            className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-4 font-bold text-xs text-[#004D71] outline-none resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between items-center pt-4 border-t border-slate-100 gap-3">
                        {/* Seletor de período para o PDF */}
                        <div className="flex items-center gap-3">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Período do Relatório:</label>
                          <input
                            type="month"
                            value={reportPeriod}
                            onChange={e => setReportPeriod(e.target.value)}
                            className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-[#004D71] outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEvaluation}
                            className="bg-[#004D71] text-[#F7B500] px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-[#004D71]/90 active:scale-95 transition-all flex items-center gap-2"
                          >
                            <Save size={15}/> Guardar
                          </button>
                          <button
                            onClick={() => { handleSaveEvaluation(); setTimeout(handleGeneratePDF, 500); }}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-emerald-600 active:scale-95 transition-all flex items-center gap-2"
                          >
                            <Download size={15}/> Gerar Relatório PDF
                          </button>
                          <a
                            href={selectedStudent ? `mailto:${selectedStudent.email}?subject=Relatório de Avaliação Swim Track — ${selectedStudent.n || selectedStudent.nome}&body=Exmo(a) Encarregado(a) de Educação,%0A%0ASegue em anexo o relatório de avaliação pedagógica de natação referente ao período selecionado.%0A%0AQualquer dúvida estamos à disposição.%0A%0ACom os melhores cumprimentos,%0A${user.nome || user.n || 'Professor(a)'}` : '#'}
                            className="bg-slate-100 text-[#004D71] px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center gap-2"
                          >
                            <Mail size={15}/> Enviar por Email
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300">
                      <Award className="mx-auto mb-3 opacity-10" size={50}/>
                      <p className="font-black text-[10px] uppercase">Selecione um aluno na coluna da esquerda para avaliar.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              SUB-TAB 4: ANÁLISE & ESTATÍSTICAS
             ========================================== */}
          {activeSubTab === 'analytics' && (
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b pb-4 border-slate-100">
                <TrendingUp className="text-[#F7B500]"/>
                <div>
                  <h3 className="text-base font-black text-[#004D71] uppercase">Análise e Estatísticas Swim Track</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Analise o desempenho coletivo e evolução individual de metros nadados</p>
                </div>
              </div>

              {/* Seletor de Aluno */}
              <div className="space-y-4">
                <div className="max-w-xs space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Análise por Aluno</label>
                  <select
                    value={statsStudentId}
                    onChange={(e) => setStatsStudentId(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-3.5 font-black text-xs text-[#004D71] outline-none"
                  >
                    <option value="">-- Escolher Aluno --</option>
                    {teacherStudents.map(ts => (
                      <option key={ts.id} value={ts.id}>{ts.n || ts.nome}</option>
                    ))}
                  </select>
                </div>

                {statsStudentId && statsStudent ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Cartões Rápidos */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="p-5 bg-[#004D71] text-[#F7B500] rounded-3xl space-y-2">
                        <p className="text-[8px] font-black uppercase text-white/50 tracking-widest">Nivel Atual</p>
                        <h4 className="text-base font-black text-white uppercase">{statsStudent.modalidade || 'Natação Nível 1'}</h4>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Aulas Frequentadas</p>
                          <h4 className="text-xl font-black text-[#004D71] uppercase mt-1">{statsStudentLogs.length}</h4>
                        </div>
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 text-[#004D71]"><Calendar size={18}/></div>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Total Metros Nadados</p>
                          <h4 className="text-xl font-black text-[#004D71] uppercase mt-1">
                            {statsStudentLogs.reduce((acc, log) => acc + (log.distancias[statsStudentId] || 0), 0)}m
                          </h4>
                        </div>
                        <div className="p-3 bg-white rounded-2xl border border-slate-100 text-[#004D71]"><Waves size={18}/></div>
                      </div>

                      {statsStudentEval && (
                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Última Prescrição Pedagógica</p>
                          <p className="text-[10px] font-bold text-slate-600 leading-relaxed italic">{statsStudentEval.feedback}</p>
                          {statsStudentEval.nivelProposto && (
                            <div className="pt-2 border-t border-slate-200 mt-2">
                              <span className="text-[8px] font-black uppercase text-[#F7B500] bg-[#004D71] px-2 py-0.5 rounded-full">{statsStudentEval.nivelProposto}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Gráficos Recharts */}
                    <div className="lg:col-span-2 space-y-4">
                      {statsStudentLogs.length > 0 ? (
                        <div className="bg-slate-50 p-5 rounded-[2.5rem] border border-slate-100 space-y-3">
                          <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5 pl-2">
                            <TrendingUp size={12}/> Progressão de Distância (Metros por Aula)
                          </h4>
                          <div className="h-60 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={statsStudentLogs.map(l => ({
                                  data: l.data.split('-').slice(1).reverse().join('/'),
                                  metros: l.distancias[statsStudentId] || 0
                                }))}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id="colorMetros" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#004D71" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#004D71" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="data" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                                <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 'bold' }} />
                                <Area type="monotone" dataKey="metros" stroke="#004D71" strokeWidth={3} fillOpacity={1} fill="url(#colorMetros)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300">
                          <PicotoIcon className="mx-auto mb-2 opacity-25" size={40}/>
                          <p className="font-black text-[10px] uppercase">Ainda sem histórico de aulas registadas para este aluno.</p>
                        </div>
                      )}

                      {/* Bloco de Velocidade Crítica (Aptidão Fisiológica) */}
                      <div className="bg-white p-6 rounded-[2.5rem] border-4 border-[#004D71]/5 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                          <div className="flex items-center gap-2 text-[#004D71]">
                            <Target size={18} className="text-[#F7B500]"/>
                            <h4 className="text-xs font-black uppercase tracking-wider">Aptidão Aeróbia e Velocidade Crítica</h4>
                          </div>
                          {!isEditingCS && criticalSpeedData && (
                            <button
                              onClick={() => {
                                setCsD1(criticalSpeedData.distance1 || 50);
                                const t1 = criticalSpeedData.time1 || 45;
                                setCsT1Min(Math.floor(t1 / 60));
                                setCsT1Sec(t1 % 60);
                                setCsD2(criticalSpeedData.distance2 || 200);
                                const t2 = criticalSpeedData.time2 || 170;
                                setCsT2Min(Math.floor(t2 / 60));
                                setCsT2Sec(t2 % 60);
                                setIsEditingCS(true);
                              }}
                              className="px-3 py-1.5 bg-[#004D71]/5 hover:bg-[#004D71]/10 rounded-xl text-[9px] font-black text-[#004D71] uppercase tracking-wider"
                            >
                              Refazer Teste
                            </button>
                          )}
                        </div>

                        {isEditingCS ? (
                          <div className="space-y-4 animate-in fade-in">
                            <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed bg-blue-50/50 p-3 rounded-xl">
                              Introduza os tempos de esforço máximo de duas distâncias diferentes para calcular a Velocidade Crítica (ex: 50 metros e 200 metros).
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Teste 1 */}
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest border-b pb-1.5 border-slate-200">Teste Curto (Ex: 50m)</p>
                                <div className="flex gap-3">
                                  <div className="flex-1 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Distância (m)</label>
                                    <input
                                      type="number"
                                      value={csD1}
                                      onChange={(e) => setCsD1(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                  <div className="w-16 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Minutos</label>
                                    <input
                                      type="number"
                                      value={csT1Min}
                                      onChange={(e) => setCsT1Min(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                  <div className="w-16 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Segundos</label>
                                    <input
                                      type="number"
                                      value={csT1Sec}
                                      onChange={(e) => setCsT1Sec(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Teste 2 */}
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <p className="text-[9px] font-black text-[#004D71] uppercase tracking-widest border-b pb-1.5 border-slate-200">Teste Longo (Ex: 200m)</p>
                                <div className="flex gap-3">
                                  <div className="flex-1 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Distância (m)</label>
                                    <input
                                      type="number"
                                      value={csD2}
                                      onChange={(e) => setCsD2(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                  <div className="w-16 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Minutos</label>
                                    <input
                                      type="number"
                                      value={csT2Min}
                                      onChange={(e) => setCsT2Min(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                  <div className="w-16 space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Segundos</label>
                                    <input
                                      type="number"
                                      value={csT2Sec}
                                      onChange={(e) => setCsT2Sec(Number(e.target.value))}
                                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-xs text-[#004D71] outline-none focus:border-[#004D71]"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                              {criticalSpeedData && (
                                <button
                                  onClick={() => setIsEditingCS(false)}
                                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-wider"
                                >
                                  Cancelar
                                </button>
                              )}
                              <button
                                onClick={handleSaveCS}
                                className="px-5 py-2.5 bg-[#004D71] text-[#F7B500] hover:bg-[#002B40] rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md"
                              >
                                Guardar Teste
                              </button>
                            </div>
                          </div>
                        ) : criticalSpeedData ? (
                          <div className="space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100 space-y-1">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Velocidade Crítica (VC)</p>
                                <p className="text-xl font-black text-[#004D71] tracking-tighter">{criticalSpeedData.criticalSpeed} <span className="text-sm">m/s</span></p>
                              </div>
                              <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100 space-y-1">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Pace Referência 100m</p>
                                <p className="text-xl font-black text-[#004D71] tracking-tighter">
                                  {formatPace(100 / criticalSpeedData.criticalSpeed)}
                                </p>
                              </div>
                              <div className="p-4 bg-slate-50 rounded-2xl text-center border border-slate-100 space-y-1">
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Último Teste</p>
                                <p className="text-xs font-black text-slate-500 py-1.5 uppercase">
                                  {new Date(criticalSpeedData.lastUpdated).toLocaleDateString('pt-PT')}
                                </p>
                              </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                              <table className="w-full text-left text-[9px] border-collapse">
                                <thead>
                                  <tr className="bg-[#004D71] text-white font-black uppercase tracking-wider">
                                    <th className="px-4 py-2">Zona Fisiológica</th>
                                    <th className="px-4 py-2">% VC</th>
                                    <th className="px-4 py-2">Foco Pedagógico</th>
                                    <th className="px-4 py-2 text-right">Pace por 100m</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-black text-slate-700">Regenerativo (REC)</td>
                                    <td className="px-4 py-2.5">120% tempo</td>
                                    <td className="px-4 py-2.5">Recuperação ativa, técnica</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                                      {formatPace(1.20 * (100 / criticalSpeedData.criticalSpeed))}
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-black text-slate-700">Aeróbico Básico (A1)</td>
                                    <td className="px-4 py-2.5">110% tempo</td>
                                    <td className="px-4 py-2.5">Desenvolvimento de base aeróbica</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                                      {formatPace(1.10 * (100 / criticalSpeedData.criticalSpeed))}
                                    </td>
                                  </tr>
                                  <tr className="bg-blue-50/20 hover:bg-blue-50/40">
                                    <td className="px-4 py-2.5 font-black text-[#004D71]">Limiar Anaeróbico (A2)</td>
                                    <td className="px-4 py-2.5 font-black text-[#004D71]">100% tempo</td>
                                    <td className="px-4 py-2.5">Ritmo crítico de endurance</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                                      {formatPace(1.00 * (100 / criticalSpeedData.criticalSpeed))}
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-black text-slate-700">VO2 Máximo (A3)</td>
                                    <td className="px-4 py-2.5">95% tempo</td>
                                    <td className="px-4 py-2.5">Potência aeróbica máxima</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                                      {formatPace(0.95 * (100 / criticalSpeedData.criticalSpeed))}
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 font-black text-slate-700">Tolerância Lática (AN1)</td>
                                    <td className="px-4 py-2.5">90% tempo</td>
                                    <td className="px-4 py-2.5">Capacidade anaeróbica, tolerância</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                                      {formatPace(0.90 * (100 / criticalSpeedData.criticalSpeed))}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-400 space-y-2">
                            <p className="text-[10px] font-black uppercase">Nenhum teste de Velocidade Crítica registado.</p>
                            <button
                              onClick={() => setIsEditingCS(true)}
                              className="px-4 py-2 bg-[#004D71] text-[#F7B500] hover:bg-[#002B40] rounded-xl text-[9px] font-black uppercase tracking-wider"
                            >
                              Criar Primeiro Teste
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center border-4 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300">
                    <TrendingUp className="mx-auto mb-3 opacity-15" size={50}/>
                    <p className="font-black text-[10px] uppercase">Selecione um aluno para carregar os gráficos de evolução.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL: CRIAR TURMA */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto hide-scrollbar">
            <button 
              onClick={() => setShowAddClassModal(false)}
              className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"
            >
              <X size={20}/>
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#004D71]/5 text-[#004D71] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={32}/>
              </div>
              <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Criar Nova Turma</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Adicione perfis de alunos e defina o horário de natação</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Turma</label>
                <input
                  type="text"
                  placeholder="Ex: Natação Crianças - Terça/Quinta 18h"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível Metodológico</label>
                  <select
                    value={newClassLevel}
                    onChange={(e) => setNewClassLevel(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-5 py-4 font-black text-xs text-[#004D71] outline-none"
                  >
                    <option value="Natação Nível 1">Natação Nível 1</option>
                    <option value="Natação Nível 2">Natação Nível 2</option>
                    <option value="Natação Nível 3">Natação Nível 3</option>
                    <option value="Bebés/AMA">Bebés/AMA</option>
                    <option value="Hidroginástica">Hidroginástica</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horário</label>
                  <input
                    type="text"
                    placeholder="Ex: Seg/Qua - 18h00"
                    value={newClassTime}
                    onChange={(e) => setNewClassTime(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                  />
                </div>
              </div>

              {/* Inscrever Alunos */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inscrever Alunos ({selectedStudentsForClass.length})</label>
                
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Procurar utentes pelo nome..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold outline-none"
                  />
                  <Search size={12} className="absolute left-3.5 top-3 text-slate-400" />
                </div>

                {/* List available */}
                <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 space-y-1.5">
                  {availableUtentes.map(st => {
                    const isSelected = selectedStudentsForClass.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStudentsForClass(prev => prev.filter(id => id !== st.id));
                          } else {
                            setSelectedStudentsForClass(prev => [...prev, st.id]);
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-[10px] font-black uppercase flex justify-between items-center ${isSelected ? 'bg-[#004D71] border-[#004D71] text-white' : 'bg-white border-slate-100 text-[#004D71] hover:border-[#F7B500]'}`}
                      >
                        <span>{st.n || st.nome}</span>
                        {isSelected ? <Check size={12} className="text-[#F7B500]"/> : <Plus size={12} className="opacity-40"/>}
                      </button>
                    );
                  })}
                  {availableUtentes.length === 0 && (
                    <p className="text-[9px] font-bold text-slate-400 text-center py-4 uppercase">Nenhum utente encontrado</p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateClass}
              className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-5 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              Confirmar e Criar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR ALUNO À TURMA */}
      {showAddStudentModal && selectedClass && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative max-h-[80vh] flex flex-col">
            <button onClick={() => setShowAddStudentModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"><X size={18}/></button>
            <div className="mb-5">
              <h3 className="text-base font-black text-[#004D71] uppercase">Adicionar Aluno</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Turma: {selectedClass.nome}</p>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
              <input
                type="text"
                placeholder="Procurar utente..."
                value={addStudentSearch}
                onChange={e => setAddStudentSearch(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-xs font-black text-[#004D71] uppercase outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar">
              {studentsNotInClass.length === 0 ? (
                <p className="text-center text-[10px] font-black text-slate-400 uppercase py-8">Todos os utentes já estão na turma</p>
              ) : (
                studentsNotInClass.map(u => (
                  <button
                    key={u.id}
                    onClick={async () => { await handleAddStudentToClass(u.id); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-slate-100 hover:border-[#004D71]/20 hover:bg-slate-50 transition-all text-left"
                  >
                    <AvatarImage src={u.img} alt={u.n || u.nome} className="w-10 h-10 rounded-xl shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#004D71] text-xs uppercase truncate">{u.n || u.nome}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{u.idade || '—'} Anos · {u.modalidade || 'Utente Geral'}</p>
                    </div>
                    <div className="p-2 bg-[#004D71]/5 rounded-xl text-[#004D71]"><UserPlus size={14}/></div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PORTAL DO ALUNO / ENCARREGADO DE EDUCAÇÃO (Gráficos, Competências, Regime Livre)
// ============================================================================
export function SwimmingStudentPortal({ user }: { user: UserProfile }) {
  const [myClass, setMyClass] = useState<SwimmingClass | null>(null);
  const [logs, setLogs] = useState<SwimmingLog[]>([]);
  const [myEvaluation, setMyEvaluation] = useState<SwimmingEvaluation | null>(null);
  const [criticalSpeedData, setCriticalSpeedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States para convites
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  // States para autoregisto de treino livre
  const [showSelfLogModal, setShowSelfLogModal] = useState(false);
  const [selfDate, setSelfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selfDistance, setSelfDistance] = useState(250);
  const [selfSummary, setSelfSummary] = useState('');

  // Firestore paths
  const classesPath = `artifacts/${APP_ID}/public/data/swimming_classes`;
  const logsPath = `artifacts/${APP_ID}/public/data/swimming_logs`;
  const evaluationsPath = `artifacts/${APP_ID}/public/data/swimming_evaluations`;

  useEffect(() => {
    // 1. Carregar turma do aluno
    const qClass = query(collection(db, classesPath), where('alunos', 'array-contains', user.id));
    const unsubClass = onSnapshot(qClass, (snap) => {
      if (!snap.empty) {
        setMyClass({ id: snap.docs[0].id, ...snap.docs[0].data() } as SwimmingClass);
      } else {
        setMyClass(null);
      }
      setLoading(false);
    });

    // 2. Carregar Logs pedagógicos do aluno
    const unsubLogs = onSnapshot(collection(db, logsPath), (snap) => {
      const allLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SwimmingLog));
      // Filtra logs onde o aluno esteve presente
      const filtered = allLogs.filter(l => l.presencas.includes(user.id));
      setLogs(filtered.sort((a,b) => a.data.localeCompare(b.data)));
    });

    // 3. Carregar avaliação de competências do aluno
    const unsubEval = onSnapshot(doc(db, evaluationsPath, user.id), (snap) => {
      if (snap.exists()) {
        setMyEvaluation({ id: snap.id, ...snap.data() } as SwimmingEvaluation);
      } else {
        setMyEvaluation(null);
      }
    });

    // 4. Carregar Velocidade Crítica do aluno
    const csRef = doc(db, `artifacts/${APP_ID}/public/data/swimming_critical_speed`, user.id);
    const unsubCS = onSnapshot(csRef, (snap) => {
      if (snap.exists()) {
        setCriticalSpeedData(snap.data());
      } else {
        setCriticalSpeedData(null);
      }
    });

    return () => {
      unsubClass();
      unsubLogs();
      unsubEval();
      unsubCS();
    };
  }, [user.id]);

  // Lista de objetivos para exibir
  const myObjectives = useMemo(() => {
    if (myClass) return myClass.objetivos;
    if (user.modalidade) {
      return DEFAULT_OBJECTIVES[user.modalidade] || DEFAULT_OBJECTIVES['Natação Nível 1'];
    }
    return DEFAULT_OBJECTIVES['Natação Nível 1'];
  }, [myClass, user]);

  const skillsStatusCount = useMemo(() => {
    let acq = 0;
    let dev = 0;
    let not = 0;

    myObjectives.forEach(obj => {
      const st = myEvaluation?.skills?.[obj] || 'não_iniciado';
      if (st === 'adquirido') acq++;
      else if (st === 'em_desenvolvimento') dev++;
      else not++;
    });

    return { acquired: acq, developing: dev, notStarted: not };
  }, [myObjectives, myEvaluation]);

  // Gravar autoregisto de distância
  const handleSaveSelfLog = async () => {
    if (!selfDate || !selfDistance) return;

    try {
      // Cria um log fictício onde apenas este aluno está presente
      const logId = `self_log_${Date.now()}`;
      const selfLogData: SwimmingLog = {
        id: logId,
        turmaId: myClass?.id || 'regime_livre',
        data: selfDate,
        sumario: selfSummary || 'Treino autónomo em Regime Livre.',
        presencas: [user.id],
        distancias: { [user.id]: selfDistance },
        observacoes: { [user.id]: 'Registo autónomo do utente.' },
        professorId: 'autonomo'
      };

      await setDoc(doc(db, logsPath, logId), selfLogData);
      alert(`Treino de ${selfDistance}m registado no seu diário de natação.`);
      setShowSelfLogModal(false);
      setSelfSummary('');
    } catch (e: any) {
      console.error(e);
      handleFirestoreError(e, OperationType.WRITE, 'swimming_logs');
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <PicotoIcon className="mx-auto animate-spin text-[#004D71]" size={30}/>
        <p className="text-[10px] font-black uppercase text-slate-400 mt-2">A carregar fichas de piscina...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left font-sans animate-in fade-in pb-16">
      
      {/* Bloco 1: A Minha Aula & Feedback do Professor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Info da Turma */}
        <div className="lg:col-span-1 bg-gradient-to-br from-[#004D71] to-[#002B40] text-white p-6 rounded-[2.5rem] border-4 border-slate-100 shadow-xl space-y-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <Waves size={160}/>
          </div>
          
          <div className="space-y-3 z-10">
            <div className="bg-[#F7B500] text-[#004D71] px-3 py-1 rounded-full text-[8px] font-black uppercase w-fit tracking-wider">
              {myClass ? myClass.nivel : (user.modalidade || 'Natação Regime Livre')}
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter leading-none mt-3">
              {myClass ? myClass.nome : 'Piscina Regime Livre'}
            </h3>
            <div className="text-[10px] font-bold text-blue-100/60 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12}/> {myClass ? myClass.horario : 'Horário Livre'}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=eduardo_oliveira`} className="w-10 h-10 rounded-xl" />
              <div>
                <p className="text-[8px] font-black uppercase text-white/40 leading-none">Professor de Natação</p>
                <p className="text-[11px] font-black uppercase mt-1 text-[#F7B500]">Eduardo Oliveira</p>
              </div>
            </div>
            <button 
              onClick={() => setShowInviteModal(true)}
              className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 transition-all rounded-2xl text-[#F7B500]"
              title="Convidar Amigo"
            >
              <UserPlus size={18}/>
            </button>
          </div>
        </div>

        {/* Conselho Pedagógico (Prescrição do Professor) */}
        <div className="lg:col-span-2 bg-[#F7B500] text-[#004D71] p-6 rounded-[2.5rem] shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Sparkles size={120}/>
          </div>
          
          <div className="space-y-3 z-10">
            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Star size={14} className="animate-spin [animation-duration:6s]"/> Foco de Evolução Individual
            </h4>
            <p className="text-sm font-black uppercase leading-tight mt-3">
              {myEvaluation?.feedback 
                ? `"${myEvaluation.feedback}"` 
                : '“O professor ainda não registou uma prescrição específica. Continue a trabalhar a técnica em cada aula!”'}
            </p>
          </div>

          {myEvaluation?.nivelProposto && (
            <div className="pt-4 border-t border-[#004D71]/10 mt-6 flex justify-between items-center z-10">
              <span className="text-[9px] font-black uppercase tracking-wider bg-[#004D71] text-white px-3 py-1 rounded-full">
                Próxima Meta: {myEvaluation.nivelProposto}
              </span>
              <span className="text-[8px] font-bold uppercase opacity-60">Atualizado: {myEvaluation.lastUpdated ? new Date(myEvaluation.lastUpdated).toLocaleDateString('pt-PT') : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bloco 2: Gráfico de Metros Nadados & Objetivos Pedagógicos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progresso de Metodologia */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-6 border-4 border-slate-100 shadow-sm space-y-6">
          <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest pl-2 flex items-center gap-2">
            <Award size={14}/> Objetivos do Nível ({skillsStatusCount.acquired} / {myObjectives.length})
          </h4>
          
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Progresso</span>
              <span>{Math.round((skillsStatusCount.acquired / myObjectives.length) * 100 || 0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${(skillsStatusCount.acquired / myObjectives.length) * 100 || 0}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {myObjectives.map(obj => {
              const status = myEvaluation?.skills?.[obj] || 'não_iniciado';
              return (
                <div key={obj} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 text-left">
                  <span className="text-[10px] font-bold text-[#004D71] uppercase leading-snug">{obj}</span>
                  {status === 'adquirido' && (
                    <span className="bg-emerald-500 text-white p-1 rounded-lg shadow-sm shrink-0" title="Adquirido">
                      <Check size={12}/>
                    </span>
                  )}
                  {status === 'em_desenvolvimento' && (
                    <span className="bg-[#F7B500] text-[#004D71] px-2 py-0.5 rounded-lg text-[7px] font-black uppercase shrink-0" title="Em Desenvolvimento">
                      ⏳ Progresso
                    </span>
                  )}
                  {status === 'não_iniciado' && (
                    <span className="bg-slate-200 text-slate-400 p-1 rounded-lg shrink-0" title="Não Iniciado">
                      <Clock size={12}/>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico Recharts de Distâncias por Aula */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-6 border-4 border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center pl-2">
            <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={14}/> Evolução de Distância (Metros Nadados)
            </h4>
            <button
              onClick={() => setShowSelfLogModal(true)}
              className="bg-[#004D71] text-white hover:bg-[#004D71]/90 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all shadow-sm"
            >
              <Plus size={10}/> Autoregisto
            </button>
          </div>

          {logs.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={logs.map(l => ({
                    aula: l.data.split('-').slice(1).reverse().join('/'),
                    metros: l.distancias[user.id] || 0
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorStudentMetros" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004D71" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#004D71" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="aula" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                  <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="metros" stroke="#004D71" strokeWidth={3} fillOpacity={1} fill="url(#colorStudentMetros)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300">
              <Waves className="mx-auto mb-2 opacity-25" size={40}/>
              <p className="font-black text-[10px] uppercase">Ainda sem histórico de metros nadados. Comece já a registar.</p>
            </div>
          )}
        </div>

      </div>

      {/* Bloco 3: Perfil Fisiológico & Velocidade Crítica */}
      <div className="bg-white rounded-[2.5rem] p-6 border-4 border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b pb-4 border-slate-100 text-[#004D71]">
          <Target className="text-[#F7B500]"/>
          <div>
            <h4 className="text-base font-black uppercase">O Meu Perfil Fisiológico (Velocidade Crítica)</h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">As suas zonas de treino aeróbico e anaeróbico com base em testes reais</p>
          </div>
        </div>

        {criticalSpeedData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Resumo Fisiológico */}
            <div className="lg:col-span-1 p-6 bg-gradient-to-br from-[#004D71] to-[#002B40] text-white rounded-3xl space-y-4 relative overflow-hidden">
              <div className="absolute -bottom-6 -right-6 opacity-5 text-white pointer-events-none">
                <Target size={120}/>
              </div>
              <div className="space-y-1.5">
                <p className="text-[8px] font-black uppercase text-white/50 tracking-widest">Velocidade Crítica (VC)</p>
                <h4 className="text-3xl font-black text-[#F7B500] leading-none">{criticalSpeedData.criticalSpeed} <span className="text-sm">m/s</span></h4>
              </div>
              <div className="space-y-1.5 pt-4 border-t border-white/10">
                <p className="text-[8px] font-black uppercase text-white/50 tracking-widest">Pace de Referência a 100m</p>
                <h4 className="text-xl font-black text-white leading-none">
                  {formatPace(100 / criticalSpeedData.criticalSpeed)}
                </h4>
              </div>
              <p className="text-[8px] font-bold text-blue-100/50 uppercase pt-2">Última avaliação: {new Date(criticalSpeedData.lastUpdated).toLocaleDateString('pt-PT')}</p>
            </div>

            {/* Tabela de Zonas de Treino */}
            <div className="lg:col-span-2 border border-slate-100 rounded-[2rem] overflow-hidden shadow-inner">
              <table className="w-full text-left text-[9px] border-collapse">
                <thead>
                  <tr className="bg-[#004D71] text-white font-black uppercase tracking-wider">
                    <th className="px-4 py-2">Zona Fisiológica</th>
                    <th className="px-4 py-2">Intensidade</th>
                    <th className="px-4 py-2 text-right">Pace Prescrito por 100m</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-black text-slate-700">Regenerativo (REC)</td>
                    <td className="px-4 py-2.5">Recuperação, técnica de nado</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                      {formatPace(1.20 * (100 / criticalSpeedData.criticalSpeed))}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-black text-slate-700">Aeróbico Básico (A1)</td>
                    <td className="px-4 py-2.5">Base aeróbica, longa distância</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                      {formatPace(1.10 * (100 / criticalSpeedData.criticalSpeed))}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/20 hover:bg-blue-50/40">
                    <td className="px-4 py-2.5 font-black text-[#004D71]">Limiar Anaeróbico (A2)</td>
                    <td className="px-4 py-2.5">Ritmo crítico de endurance</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                      {formatPace(1.00 * (100 / criticalSpeedData.criticalSpeed))}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-black text-slate-700">VO2 Máximo (A3)</td>
                    <td className="px-4 py-2.5">Capacidade e potência aeróbica</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                      {formatPace(0.95 * (100 / criticalSpeedData.criticalSpeed))}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-black text-slate-700">Tolerância Lática (AN1)</td>
                    <td className="px-4 py-2.5">Treino de resistência láctica</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#004D71] font-black">
                      {formatPace(0.90 * (100 / criticalSpeedData.criticalSpeed))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-100 rounded-3xl">
            <Target className="mx-auto text-slate-300 opacity-50" size={36}/>
            <p className="text-[10px] font-black uppercase tracking-wider">Ainda não realizou um teste de Velocidade Crítica.</p>
            <p className="text-[8px] font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
              O seu professor irá avaliar os seus tempos de esforço na piscina para calcular as suas zonas fisiológicas personalizadas.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: AUTOREGISTO DE DISTÂNCIA */}
      {showSelfLogModal && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative">
            <button 
              onClick={() => setShowSelfLogModal(false)}
              className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"
            >
              <X size={20}/>
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#004D71]/5 text-[#004D71] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus size={32}/>
              </div>
              <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Autoregisto de Treino</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Guarde distâncias de treinos extra ou regime livre</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Treino</label>
                <input
                  type="date"
                  value={selfDate}
                  onChange={(e) => setSelfDate(e.target.value)}
                  className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distância Percorrida</label>
                  <span className="text-xs font-black text-[#004D71] tabular-nums">{selfDistance} metros</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="3000"
                  step="25"
                  value={selfDistance}
                  onChange={(e) => setSelfDistance(parseInt(e.target.value))}
                  className="w-full accent-[#004D71] h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer mt-2"
                />
                <div className="flex gap-2 justify-center mt-3">
                  {[250, 500, 1000].map(m => (
                    <button
                      key={m}
                      onClick={() => setSelfDistance(m)}
                      className="px-3 py-1.5 bg-[#004D71]/5 hover:bg-[#004D71]/10 rounded-xl text-[9px] font-black text-[#004D71]"
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas Rápidas (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Treino de velocidade focado em crawl."
                  value={selfSummary}
                  onChange={(e) => setSelfSummary(e.target.value)}
                  className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSelfLog}
              className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-5 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              Guardar Registo
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SIMULADOR DE CONVITE POR EMAIL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative">
            <button 
              onClick={() => { setShowInviteModal(false); setFriendEmail(''); setInviteSent(false); }}
              className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"
            >
              <X size={20}/>
            </button>

            {!inviteSent ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#004D71]/5 text-[#004D71] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Mail size={32}/>
                  </div>
                  <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Convidar Amigo</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Partilhe o Swim Track com outro aluno</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail do Amigo</label>
                  <input
                    type="email"
                    placeholder="amigo@exemplo.com"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    if (friendEmail.trim()) {
                      setInviteSent(true);
                    }
                  }}
                  disabled={!friendEmail.trim()}
                  className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-5 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={14}/> Enviar Convite por E-mail
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <Check size={24}/>
                  </div>
                  <h4 className="font-black text-[#004D71] text-sm uppercase">E-mail Enviado!</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Simulação do e-mail oficial da APP de Natação</p>
                </div>

                {/* Email Preview Mockup */}
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50 font-sans text-left space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#F7B500] text-[#004D71] text-[6px] font-black px-2 py-0.5 uppercase tracking-widest">
                    Complexo Desportivo
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold">
                    DE: <span className="font-mono text-[#004D71] font-black">secretaria@cm-viladerei.pt</span>
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold border-b pb-2">
                    PARA: <span className="font-mono text-[#004D71] font-black">{friendEmail}</span>
                  </p>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#004D71] uppercase">Olá, desafiaram-te para nadar!</p>
                    <p className="text-[9px] font-medium text-slate-600 leading-relaxed">
                      O teu amigo <span className="font-black text-[#004D71]">{user.nome || user.n}</span> enviou-te um convite para te juntares à Escola de Natação do Complexo Desportivo de Vila de Rei.
                    </p>
                    <p className="text-[9px] font-medium text-slate-600 leading-relaxed">
                      Para aceitares e fazeres o teu registo, clica no link abaixo para acederes à APP Swim Track.
                    </p>
                    <div className="w-full bg-[#004D71] text-[#F7B500] text-center font-black py-2 rounded-xl text-[8px] uppercase tracking-wider cursor-pointer active:scale-95 transition-all">
                      Aceder à APP e Registar
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setShowInviteModal(false); setFriendEmail(''); setInviteSent(false); }}
                  className="w-full bg-slate-100 text-[#004D71] hover:bg-slate-200 rounded-2xl py-4 font-black text-xs uppercase tracking-widest transition-all text-center"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
