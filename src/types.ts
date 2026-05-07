export type UserRole = 'admin' | 'professor' | 'staff' | 'utente' | 'chefia';

export interface UserProfile {
  id: string;
  nome: string;
  n?: string; // name alias used in some parts
  email: string;
  role: UserRole;
  cargo: string;
  img: string;
  z?: string | null; // current zone
  location?: string;
  isInside?: boolean;
  phone?: string;
  nif?: string;
  cc?: string;
  data_nasc?: string;
  endereco?: string;
  cod_postal?: string;
  localidade?: string;
  profissao?: string;
  password?: string;
  iban?: string;
  contacto_emergencia?: string;
  nome_emergencia?: string;
  restricoes_medicas?: string;
  alergias?: string;
  objetivos?: string;
  modalidade?: string;
  idade?: string;
  formacao?: string;
  experiencia?: string;
  cedula?: string;
  lema?: string;
  cv_edu?: string;
  cv_exp?: string;
  updatedAt?: string;
  createdAt?: string;
  lastLogin?: string;
  email_verified?: boolean;
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
  date: string; // YYYY-MM-DD
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
  type: 'peso' | 'glicemia';
  value: number;
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
  categoria?: string; // e.g. 'Escola de Natação', 'Piscina', 'Ginásio'
  diaSemana: number; // 1 (Mon) - 7 (Sun)
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  professor?: string;
  professor2?: string;
  vagas?: number;
  sala?: string;
  color?: string;
}
