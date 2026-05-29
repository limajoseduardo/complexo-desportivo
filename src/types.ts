export type UserRole = 'admin' | 'professor' | 'staff' | 'utente' | 'chefia';

export interface UserProfile {
  id: string;
  nome: string;
  n?: string;
  email: string;
  role: UserRole;
  cargo: string;
  img: string;
  z?: string | null;
  location?: string;
  isInside?: boolean;

  // Identificação
  data_nasc?: string;       // YYYY-MM-DD
  cc?: string;              // Cartão de Cidadão
  cc_validade?: string;     // Validade CC (YYYY-MM-DD)
  nif?: string;
  num_utente?: string;      // Número de utente / SNS

  // Contactos
  telefone?: string;        // Telefone fixo
  telemovel?: string;       // Telemóvel
  phone?: string;           // legacy alias

  // Morada
  endereco?: string;
  cod_postal?: string;
  localidade?: string;

  // Emergência
  nome_emergencia?: string;
  contacto_emergencia?: string;

  // Cartão Municipal
  cartao_municipal?: string;
  municipio_cartao?: string;

  // Menores (idade < 16)
  encarregado_email?: string;
  encarregado_nome?: string;
  encarregado_cc?: string;
  modalidades_autorizadas?: string[];

  // Termos aceites
  termo_imagens?: boolean;
  termo_imagens_data?: string;
  termo_responsabilidade?: boolean;
  termo_responsabilidade_data?: string;

  // Saúde
  restricoes_medicas?: string;
  atestado_medico?: boolean;
  alergias?: string;
  objetivos?: string;
  modalidade?: string;
  iban?: string;
  weight?: number;

  // Financeiro (Carregamentos)
  entradas_disponiveis?: number;

  // Assiduidade e Treino Dinâmico
  lastCheckInDate?: string;
  treino_logs?: Record<string, { weight: number, reps: number, done: boolean }[]>; // chave: ID do exercício

  // Staff / Professor
  profissao?: string;
  formacao?: string;
  experiencia?: string;
  cedula?: string;
  lema?: string;
  cv_edu?: string;
  cv_exp?: string;

  // Sistema
  password?: string;
  idade?: string;
  updatedAt?: string;
  createdAt?: string;
  lastLogin?: string;
  email_verified?: boolean;
  qrToken?: string;
  rfidUid?: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  modalidade: string;
  checkIn: any;
  checkOut?: any;
  durationMinutes?: number;
  zone: string;
  date: string;
  timestamp?: any;
}

export interface Exercicio {
  id: string;
  nomePT: string;
  nomeEN: string;
  grupo: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  desc: string;
  link: string;
  createdBy?: string;
}

export interface HealthMetric {
  id: string;
  userId: string;
  timestamp: any;
  type: 'peso' | 'glicemia' | 'tensao';
  value: number;
  value2?: number;
  unit: string;
}

export interface Refeicao {
  id: string;
  userId: string;
  timestamp: any;
  nome: string;
  alimentos: string;
  feedback?: string;
  feedbackBy?: string;
  feedbackAt?: any;
}

export interface TreinoPlano {
  id: string;
  userId: string;
  nome: string;
  exercicios: {
    exercicioId: string;
    series: string;
    reps: string;
    descanso: string;
  }[];
}

export interface OperationalLog {
  id: string;
  tempAgua: number | string;
  ph: number | string;
  clLivre?: string;
  hora?: string;
  data?: string;
  tecnico?: string;
  utaHum?: string;
  timestamp: any;
  tipo: 'coberta' | 'descoberta';
}

export interface Aula {
  id: string;
  modalidade: string;
  categoria?: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  professor?: string;
  professor2?: string;
  vagas?: number;
  sala?: string;
  color?: string;
  cancelada?: boolean;
}

export interface TurmaAluno {
  id: string;       // unique within turma (may be userId or generated)
  nome: string;
  userId?: string;  // links to users collection if registered
}

export interface Turma {
  id: string;
  nome: string;
  modalidade: string;
  professor: string;
  diasSemana: number[];   // 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sab
  horaInicio: string;     // "HH:MM"
  horaFim: string;
  sala?: string;
  alunos: TurmaAluno[];
  ativa?: boolean;
  cor?: string;
}

export interface SwimmingClass {
  id: string;
  nome: string;
  horario: string;
  nivel: 'Natação Nível 1' | 'Natação Nível 2' | 'Natação Nível 3' | 'Bebés/AMA' | 'Hidroginástica' | string;
  professorId: string;
  alunos: string[];
  objetivos: string[];
}

export interface SwimmingLog {
  id: string;
  turmaId: string;
  data: string;
  sumario: string;
  presencas: string[];
  distancias: Record<string, number>;
  observacoes: Record<string, string>;
  professorId: string;
}

export interface SwimmingEvaluation {
  id: string;
  studentId: string;
  lastUpdated: string;
  skills: Record<string, 'não_iniciado' | 'em_desenvolvimento' | 'adquirido'>;
  feedback?: string;
  nivelProposto?: string;
}

// ==========================================
// NOVOS MODELOS DE TREINO (IMPORTADOS DA COLEGA)
// ==========================================

export interface WorkoutSet {
  id: string;
  reps?: number;
  weight?: number;
  time?: string; // For Cárdio
  intensity?: number; // For Cárdio (1-5)
  notes?: string; // Student notes for the set (e.g. cardio notes)
  completed: boolean;
  trackingMode?: 'reps' | 'seconds';
}

export interface Exercise {
  id: string;
  name: string;
  type?: 'STRENGTH' | 'CARDIO';
  exerciseLibraryId?: string; // Link to global library for PR tracking
  sets: WorkoutSet[];
  notes?: string;
  restTime?: string;
  isHeader?: boolean; // New property for grouping
  isSuperset?: boolean; // New property for supersets
  trackingMode?: 'reps' | 'seconds';
  parent_exercise_id?: string; // For alternative exercises
  alternatives?: Exercise[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  description: string;
  exercises: Exercise[];
  originalExercises?: Exercise[];
  completed: boolean;
  durationSeconds: number;
  plannedDurationMinutes?: number; // New field for specified duration
  date?: string;
  assignedStudentId?: string; // Optional for linking to student
}

export interface WorkoutTemplate {
  id: string;
  trainer_id: string;
  name: string;
  description?: string;
  category?: string; // e.g. "Hypertrophy", "Beginner"
  split_count: number;
  data: {
    sessions: {
      day_label: string;
      title: string;
      exercises: {
        name: string;
        type: 'STRENGTH' | 'CARDIO';
        isHeader?: boolean;
        isSuperset?: boolean;
        notes?: string;
        restTime?: string;
        sets: {
          reps?: number;
          weight?: number;
          time?: string;
          intensity?: number;
          notes?: string;
        }[];
      }[];
    }[];
  };
  created_at: string;
}

