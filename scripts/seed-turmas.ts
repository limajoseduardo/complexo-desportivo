import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const APP_ID = 'cpx-vila-rei-main';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const TURMAS_PATH = `artifacts/${APP_ID}/public/data/turmas`;

function makeId(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function makeAluno(nome: string) {
  const id = makeId(nome) + '_' + Math.floor(Math.random() * 9999);
  return { id, nome };
}

const TURMAS = [
  // ── HIDROGINÁSTICA ──────────────────────────────────────────────────────────
  {
    id: 'hidro_manha_ter_qui',
    nome: 'Hidroginástica Manhã',
    modalidade: 'Hidroginástica',
    professor: 'José Maria',
    diasSemana: [2, 4],          // Ter, Qui
    horaInicio: '09:15',
    horaFim: '10:00',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Isabel Maria L. Lourenço',
      'Carla Sofia Sarmento',
      'Mª Anjos Nunes Martins',
      'Carlos Alberto Pires',
      'Maria João Sousa Soares',
      'Luís Manuel Oliveira',
    ].map(makeAluno),
  },
  {
    id: 'hidro_manha_qui_sex',
    nome: 'Hidroginástica Manhã 2',
    modalidade: 'Hidroginástica',
    professor: 'José Maria',
    diasSemana: [4, 5],          // Qui, Sex
    horaInicio: '10:30',
    horaFim: '11:00',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Maria Fernanda Rodrigues',
      'Ana Luísa Ferreira',
      'Fernanda Marques Costa',
      'António José Nunes',
      'Teresa Conceição Alves',
      'Emília dos Santos Leal',
    ].map(makeAluno),
  },
  {
    id: 'hidro_tarde_qua_sex',
    nome: 'Hidroginástica Tarde',
    modalidade: 'Hidroginástica',
    professor: 'Patrícia Novo',
    diasSemana: [3, 5],          // Qua, Sex
    horaInicio: '18:30',
    horaFim: '19:15',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'António Cardiga Mateus',
      'Mª Alice Martins Aparício',
      'António da Silva Aparício',
      'Ermelinda Nunes Martins',
      'Mª Teresa Santos P. Sousa',
      'Mª Isilda Carvalho Francisco',
      'Henrique Carvalho Francisco',
      'Manuel Martins',
      'Deolinda Moreira Malho',
      'Aldina de Jesus Cardoso',
      'Anabela Silva Lourenço',
      'Mª Rosário Pires Rodrigues',
    ].map(makeAluno),
  },
  {
    id: 'hidro_sabado',
    nome: 'Hidroginástica Sábado',
    modalidade: 'Hidroginástica',
    professor: 'Patrícia Novo',
    diasSemana: [6],             // Sáb
    horaInicio: '09:30',
    horaFim: '10:15',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Marta Oliveira Santos',
      'Conceição Rodrigues Pires',
      'Filomena Alves Martins',
      'Rosária Cardoso Nunes',
    ].map(makeAluno),
  },

  // ── NATAÇÃO NÍVEL 1 e 2 ─────────────────────────────────────────────────────
  {
    id: 'nat_nivel12_tarde',
    nome: 'Natação Nível 1 e 2',
    modalidade: 'Natação',
    professor: 'Tiago Lopes',
    diasSemana: [2, 3, 4, 5],   // Ter–Sex
    horaInicio: '17:00',
    horaFim: '17:45',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Mariana Vicente',
      'Duarte Santos Silva',
      'Sara Agostinho',
      'Letícia Morgado',
      'Rodrigo Vitorino',
      'Salvador Domingos Mendes',
      'Beatriz Casola Crisóstomo',
      'Beatriz Gaspar Marques',
      'Sara Margarida Domingos',
      'Lourenço Vicente Mateus',
      'Mariana Dias Rodrigues',
      'Sara Silva Agostinho',
      'Mariana Sofia B. Vicente',
      'Theodore Varney',
      'Rodrigo Alexandre Pires',
      'Margarida Isabel Pires',
      'Letícia Domingos Morgado',
      'Lúcia Domingos Morgado',
      'Sofia Sarmento Mendes',
      'Sofia Santos Pereira',
      'Sofia Catarino Esteves',
      'Raquel Peto',
      'Cláudia Alexandra Pereira',
      'Fabiana Filipa Marçal',
      'Beatriz Policarpo Manso',
      'Benicio Santos Nonato',
      'Theo Siqueira Salomão',
      'Francisco Garcia Martins',
      'Maria Eduarda Lima Pereira',
      'Miguel Ribeiro Lima Santos',
      'Rafael Marçal Medeiros',
      'Luna dos Santos Martins',
      'João Pedro Henriques',
      'Eva Patrícia Moura',
      'Luiz Phellype de Castro Silva',
      'Leonor Carvalho da Silva',
      'Francisco Carvalho da Silva',
    ].map(makeAluno),
  },

  // ── NATAÇÃO NÍVEL 3 ─────────────────────────────────────────────────────────
  {
    id: 'nat_nivel3_tarde',
    nome: 'Natação Nível 3',
    modalidade: 'Natação',
    professor: 'Tiago Lopes',
    diasSemana: [2, 4],          // Ter, Qui
    horaInicio: '17:45',
    horaFim: '18:30',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Dinís Ventura Santos',
      'Carolina Bernardo Lopes',
      'José Gomes L. Luís',
      'Manuel Gomes L. Luís',
      'Francisco António Aparício',
      'Carolina Fraga Caixeirinho',
      'Lucas Luis Mexa',
      'Rafael Henriques Vitórino',
      'Luis Miguel Bernardo',
      'Madalena Romano Mendes',
      'Martim Veríssimo',
      'Laura Pedro Costa',
      'Helena Pedro Costa',
      'Santiago Duarte Duque',
      'Julia Rosa Moleiro',
      'Henrique Marçal Medeiros',
      'Martim Alves Lucas',
      'Félix Domingos Correia',
      'Petra Mendes Ferreira',
      'Benedita Duque Oliveira',
      'Constança Vicente Mateus',
    ].map(makeAluno),
  },

  // ── NATAÇÃO BEBÉS/AMA ────────────────────────────────────────────────────────
  {
    id: 'nat_bebes_ama_seg_qua_sex',
    nome: 'Natação Bebés/AMA (Seg/Qua/Sex)',
    modalidade: 'Bebés/AMA',
    professor: 'Tiago Lopes',
    diasSemana: [1, 3, 5],       // Seg, Qua, Sex
    horaInicio: '17:45',
    horaFim: '18:30',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Camila Sofia Pedro Alves',
      'Vicente Dias Nunes',
      'Matilde Sofia Cotrim',
      'Gabriel Pereira Fouto',
      'Irís Coelho Moura',
      'Asaf Gomes Fernandes',
      'Lavinia Pinheiro Xavier',
      'Ravi Pinheiro Xavier',
    ].map(makeAluno),
  },
  {
    id: 'nat_bebes_ama_ter',
    nome: 'Natação Bebés/AMA (Terça)',
    modalidade: 'Bebés/AMA',
    professor: 'Tiago Lopes',
    diasSemana: [2],             // Ter
    horaInicio: '18:30',
    horaFim: '19:15',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Camila Sofia Pedro Alves',
      'Vicente Dias Nunes',
      'Gabriel Pereira Fouto',
      'Asaf Gomes Fernandes',
    ].map(makeAluno),
  },
  {
    id: 'nat_bebes_sabado',
    nome: 'Natação Bebés/AMA (Sábado)',
    modalidade: 'Bebés/AMA',
    professor: 'Tiago Lopes',
    diasSemana: [6],             // Sáb
    horaInicio: '10:30',
    horaFim: '11:20',
    sala: 'Piscina Coberta',
    ativa: true,
    alunos: [
      'Matilde Sofia Cotrim',
      'Irís Coelho Moura',
      'Lavinia Pinheiro Xavier',
      'Ravi Pinheiro Xavier',
    ].map(makeAluno),
  },

  // ── AULAS FITNESS ─────────────────────────────────────────────────────────────
  {
    id: 'fitness_us',
    nome: 'Cardio Fitness U. Sénior',
    modalidade: 'Aulas Fitness',
    professor: 'Patrícia Novo',
    diasSemana: [3, 6],          // Qua, Sáb
    horaInicio: '10:30',
    horaFim: '11:00',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [
      'Maria José Lopes',
      'Conceição Nunes Fonseca',
      'Lurdes Rodrigues Silva',
      'Fernanda Pires Martins',
      'Teresa Alves Cardoso',
    ].map(makeAluno),
  },

  // ── SALA DOS ESPELHOS ────────────────────────────────────────────────────────
  {
    id: 'zumba_us_seg',
    nome: 'Zumba (Universidade Sénior)',
    modalidade: 'Aulas Fitness',
    professor: 'Professora US',
    diasSemana: [1],             // Seg
    horaInicio: '09:00',
    horaFim: '10:00',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [
      'Maria da Graça Sousa',
      'Odete Ferreira Nunes',
      'Natália Cardoso Pinto',
      'Elvira Martins Rodrigues',
      'Leopoldina Alves Santos',
    ].map(makeAluno),
  },
  {
    id: 'ballet_a_ter_qui',
    nome: 'Ballet A (7-11 anos)',
    modalidade: 'Aulas Fitness',
    professor: 'Professora VFC',
    diasSemana: [2, 4],          // Ter, Qui
    horaInicio: '17:00',
    horaFim: '18:00',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [].map(makeAluno),
  },
  {
    id: 'ballet_b_qua_sex',
    nome: 'Ballet B (3-6 anos)',
    modalidade: 'Aulas Fitness',
    professor: 'Professora VFC',
    diasSemana: [3, 5],          // Qua, Sex
    horaInicio: '17:30',
    horaFim: '18:30',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [].map(makeAluno),
  },
  {
    id: 'karate_ter_qui',
    nome: 'Karaté',
    modalidade: 'Aulas Fitness',
    professor: 'Professor CBVR',
    diasSemana: [2, 4],          // Ter, Qui
    horaInicio: '17:30',
    horaFim: '18:30',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [].map(makeAluno),
  },
  {
    id: 'yoga_sex',
    nome: 'Yoga',
    modalidade: 'Aulas Fitness',
    professor: 'Professor CBVR',
    diasSemana: [5],             // Sex
    horaInicio: '19:00',
    horaFim: '20:30',
    sala: 'Sala dos Espelhos',
    ativa: true,
    alunos: [].map(makeAluno),
  },
];

async function main() {
  console.log(`A importar ${TURMAS.length} turmas...`);
  const batch = writeBatch(db);

  for (const turma of TURMAS) {
    const ref = doc(db, TURMAS_PATH, turma.id);
    batch.set(ref, turma, { merge: false });
  }

  await batch.commit();
  console.log(`✓ ${TURMAS.length} turmas gravadas com sucesso!`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
