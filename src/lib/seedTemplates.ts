import { db } from './firebase';
import { APP_ID } from '../App';
import { doc, getDoc, setDoc, writeBatch, collection } from 'firebase/firestore';

const mkEx = (name: string, nSets: number, reps: number, weight = 0, type: 'STRENGTH' | 'CARDIO' = 'STRENGTH') => ({
  id: Math.random().toString(36).substring(2, 10),
  name, type,
  sets: Array(nSets).fill(null).map(() => ({ reps, weight }))
});

const TEMPLATES = [

  // ─── INICIANTE ────────────────────────────────────────────────────────────

  {
    name: 'Full Body Iniciante A/B',
    category: 'Iniciante · 2x Semana',
    split_count: 2,
    data: { sessions: [
      { day_label: 'A', title: 'Treino A — Full Body', exercises: [
        mkEx('Agachamento', 3, 12, 20),
        mkEx('Supino com Barra', 3, 10, 30),
        mkEx('Remada com Barra', 3, 10, 20),
        mkEx('Desenvolvimento com Halteres', 3, 10, 10),
        mkEx('Prancha', 3, 45, 0),
      ]},
      { day_label: 'B', title: 'Treino B — Full Body', exercises: [
        mkEx('Leg Press', 3, 12, 50),
        mkEx('Supino Inclinado com Halteres', 3, 10, 12),
        mkEx('Puxada na Máquina', 3, 10, 30),
        mkEx('Rosca Direta com Barra', 3, 12, 15),
        mkEx('Crunch Abdominal', 3, 15, 0),
      ]},
    ]},
  },

  {
    name: 'Musculação Iniciante 3x',
    category: 'Iniciante · 3x Semana',
    split_count: 3,
    data: { sessions: [
      { day_label: 'A', title: 'Treino A — Peito e Tríceps', exercises: [
        mkEx('Supino com Barra', 3, 10, 30),
        mkEx('Crucifixo com Halteres', 3, 12, 8),
        mkEx('Extensão de Tríceps', 3, 12, 15),
        mkEx('Flexões', 3, 10, 0),
      ]},
      { day_label: 'B', title: 'Treino B — Costas e Bíceps', exercises: [
        mkEx('Remada com Barra', 3, 10, 20),
        mkEx('Puxada na Máquina', 3, 10, 30),
        mkEx('Rosca Direta com Barra', 3, 12, 15),
        mkEx('Rosca Martelo', 3, 12, 8),
      ]},
      { day_label: 'C', title: 'Treino C — Pernas e Ombros', exercises: [
        mkEx('Agachamento', 3, 12, 20),
        mkEx('Leg Press', 3, 12, 50),
        mkEx('Extensão de Pernas', 3, 15, 20),
        mkEx('Desenvolvimento com Halteres', 3, 10, 10),
        mkEx('Elevação Lateral', 3, 12, 6),
      ]},
    ]},
  },

  {
    name: 'Cardio e Força Iniciante 3x',
    category: 'Iniciante · 3x Semana',
    split_count: 3,
    data: { sessions: [
      { day_label: 'A', title: 'Treino A — Força + Cardio', exercises: [
        mkEx('Supino com Barra', 3, 10, 30),
        mkEx('Agachamento', 3, 12, 20),
        mkEx('Remada com Barra', 3, 10, 20),
        mkEx('Corrida na Passadeira (20 min)', 1, 20, 0, 'CARDIO'),
      ]},
      { day_label: 'B', title: 'Treino B — Força + Cardio', exercises: [
        mkEx('Leg Press', 3, 12, 50),
        mkEx('Puxada na Máquina', 3, 10, 30),
        mkEx('Desenvolvimento com Halteres', 3, 10, 10),
        mkEx('Bicicleta Estática (20 min)', 1, 20, 0, 'CARDIO'),
      ]},
      { day_label: 'C', title: 'Treino C — Força + Cardio', exercises: [
        mkEx('Levantamento Terra', 3, 8, 40),
        mkEx('Rosca Direta com Barra', 3, 12, 15),
        mkEx('Extensão de Tríceps', 3, 12, 15),
        mkEx('Elíptica (25 min)', 1, 25, 0, 'CARDIO'),
      ]},
    ]},
  },

  // ─── INTERMÉDIO ──────────────────────────────────────────────────────────

  {
    name: 'Push Pull Legs (PPL)',
    category: 'Intermédio · 3x Semana',
    split_count: 3,
    data: { sessions: [
      { day_label: 'A', title: 'Push — Peito, Ombros e Tríceps', exercises: [
        mkEx('Supino com Barra', 4, 8, 60),
        mkEx('Supino Inclinado com Halteres', 3, 10, 20),
        mkEx('Desenvolvimento com Halteres', 3, 10, 16),
        mkEx('Elevação Lateral', 3, 15, 8),
        mkEx('Extensão de Tríceps', 3, 12, 25),
        mkEx('Peck Deck (Voador)', 3, 12, 40),
      ]},
      { day_label: 'B', title: 'Pull — Costas e Bíceps', exercises: [
        mkEx('Levantamento Terra', 3, 6, 80),
        mkEx('Remada com Barra', 4, 8, 50),
        mkEx('Puxada na Máquina', 3, 10, 50),
        mkEx('Rosca Direta com Barra', 4, 10, 25),
        mkEx('Rosca Martelo', 3, 12, 12),
      ]},
      { day_label: 'C', title: 'Legs — Pernas', exercises: [
        mkEx('Agachamento', 4, 10, 70),
        mkEx('Leg Press', 4, 12, 100),
        mkEx('Extensão de Pernas', 3, 12, 40),
        mkEx('Flexão de Pernas', 3, 12, 30),
        mkEx('Panturrilha na Máquina', 4, 15, 40),
      ]},
    ]},
  },

  {
    name: 'Upper/Lower 4x Semana',
    category: 'Intermédio · 4x Semana',
    split_count: 4,
    data: { sessions: [
      { day_label: 'A', title: 'Superior A — Força', exercises: [
        mkEx('Supino com Barra', 4, 6, 70),
        mkEx('Remada com Barra', 4, 6, 60),
        mkEx('Desenvolvimento com Halteres', 3, 8, 18),
        mkEx('Rosca Direta com Barra', 3, 10, 25),
        mkEx('Extensão de Tríceps', 3, 10, 25),
      ]},
      { day_label: 'B', title: 'Inferior A — Força', exercises: [
        mkEx('Agachamento', 4, 6, 80),
        mkEx('Extensão de Pernas', 3, 10, 40),
        mkEx('Flexão de Pernas', 3, 10, 30),
        mkEx('Panturrilha na Máquina', 4, 15, 40),
      ]},
      { day_label: 'C', title: 'Superior B — Hipertrofia', exercises: [
        mkEx('Supino Inclinado com Halteres', 4, 10, 18),
        mkEx('Puxada na Máquina', 4, 10, 50),
        mkEx('Elevação Lateral', 3, 15, 8),
        mkEx('Rosca Martelo', 3, 12, 12),
        mkEx('Mergulho em Paralelas', 3, 12, 0),
      ]},
      { day_label: 'D', title: 'Inferior B — Hipertrofia', exercises: [
        mkEx('Leg Press', 4, 12, 100),
        mkEx('Agachamento Búlgaro', 3, 10, 20),
        mkEx('Flexão de Pernas', 3, 12, 30),
        mkEx('Panturrilha na Máquina', 4, 15, 40),
      ]},
    ]},
  },

  {
    name: 'Hipertrofia 4x Semana',
    category: 'Intermédio · 4x Semana',
    split_count: 4,
    data: { sessions: [
      { day_label: 'A', title: 'Treino A — Peito e Tríceps', exercises: [
        mkEx('Supino com Barra', 4, 8, 60),
        mkEx('Supino Inclinado com Halteres', 3, 10, 20),
        mkEx('Crucifixo com Halteres', 3, 12, 12),
        mkEx('Peck Deck (Voador)', 3, 12, 40),
        mkEx('Extensão de Tríceps', 3, 12, 25),
        mkEx('Mergulho em Paralelas', 3, 10, 0),
      ]},
      { day_label: 'B', title: 'Treino B — Costas e Bíceps', exercises: [
        mkEx('Levantamento Terra', 4, 6, 80),
        mkEx('Remada com Barra', 4, 8, 50),
        mkEx('Puxada na Máquina', 3, 10, 50),
        mkEx('Rosca Direta com Barra', 4, 10, 25),
        mkEx('Rosca Martelo', 3, 12, 12),
      ]},
      { day_label: 'C', title: 'Treino C — Pernas', exercises: [
        mkEx('Agachamento', 4, 10, 70),
        mkEx('Leg Press', 4, 12, 100),
        mkEx('Extensão de Pernas', 3, 15, 40),
        mkEx('Flexão de Pernas', 3, 12, 30),
        mkEx('Panturrilha na Máquina', 4, 15, 40),
      ]},
      { day_label: 'D', title: 'Treino D — Ombros e Abdominais', exercises: [
        mkEx('Desenvolvimento com Halteres', 4, 10, 18),
        mkEx('Elevação Lateral', 3, 15, 8),
        mkEx('Elevação Frontal', 3, 12, 8),
        mkEx('Crunch Abdominal', 4, 20, 0),
        mkEx('Prancha', 3, 60, 0),
        mkEx('Russian Twist', 3, 20, 5),
      ]},
    ]},
  },

  // ─── AVANÇADO ─────────────────────────────────────────────────────────────

  {
    name: 'Arnold Split 6x',
    category: 'Avançado · 6x Semana',
    split_count: 6,
    data: { sessions: [
      { day_label: 'A', title: 'Peito + Costas A', exercises: [
        mkEx('Supino com Barra', 5, 5, 100),
        mkEx('Remada com Barra', 5, 5, 80),
        mkEx('Supino Inclinado com Halteres', 4, 8, 28),
        mkEx('Puxada na Máquina', 4, 8, 70),
        mkEx('Crucifixo com Halteres', 3, 12, 16),
      ]},
      { day_label: 'B', title: 'Ombros + Braços A', exercises: [
        mkEx('Desenvolvimento com Halteres', 4, 8, 24),
        mkEx('Elevação Lateral', 4, 12, 12),
        mkEx('Elevação Frontal', 3, 12, 10),
        mkEx('Rosca Direta com Barra', 4, 10, 35),
        mkEx('Extensão de Tríceps', 4, 10, 30),
      ]},
      { day_label: 'C', title: 'Pernas A', exercises: [
        mkEx('Agachamento', 5, 5, 100),
        mkEx('Leg Press', 4, 10, 140),
        mkEx('Extensão de Pernas', 4, 12, 60),
        mkEx('Flexão de Pernas', 4, 12, 50),
        mkEx('Panturrilha na Máquina', 5, 15, 60),
      ]},
      { day_label: 'D', title: 'Peito + Costas B', exercises: [
        mkEx('Peck Deck (Voador)', 4, 12, 60),
        mkEx('Levantamento Terra', 4, 5, 120),
        mkEx('Flexões Declinadas', 4, 15, 0),
        mkEx('Remada com Barra', 4, 10, 70),
      ]},
      { day_label: 'E', title: 'Ombros + Braços B', exercises: [
        mkEx('Desenvolvimento Arnold', 4, 10, 20),
        mkEx('Elevação Lateral', 4, 15, 10),
        mkEx('Rosca Martelo', 4, 12, 16),
        mkEx('Mergulho em Paralelas', 4, 15, 0),
      ]},
      { day_label: 'F', title: 'Pernas B', exercises: [
        mkEx('Levantamento Terra', 4, 5, 120),
        mkEx('Agachamento Frontal', 4, 8, 70),
        mkEx('Leg Press', 4, 12, 140),
        mkEx('Panturrilha na Máquina', 5, 20, 60),
      ]},
    ]},
  },

  {
    name: 'Push Pull Legs Avançado 6x',
    category: 'Avançado · 6x Semana',
    split_count: 6,
    data: { sessions: [
      { day_label: 'A', title: 'Push A — Força', exercises: [
        mkEx('Supino com Barra', 5, 5, 100),
        mkEx('Supino Inclinado com Halteres', 4, 8, 28),
        mkEx('Desenvolvimento com Halteres', 4, 8, 22),
        mkEx('Extensão de Tríceps', 4, 10, 30),
      ]},
      { day_label: 'B', title: 'Pull A — Força', exercises: [
        mkEx('Levantamento Terra', 5, 5, 120),
        mkEx('Remada com Barra', 4, 6, 80),
        mkEx('Puxada na Máquina', 4, 8, 70),
        mkEx('Rosca Direta com Barra', 4, 10, 35),
      ]},
      { day_label: 'C', title: 'Legs A — Força', exercises: [
        mkEx('Agachamento', 5, 5, 110),
        mkEx('Leg Press', 4, 8, 140),
        mkEx('Extensão de Pernas', 4, 12, 60),
        mkEx('Panturrilha na Máquina', 5, 15, 60),
      ]},
      { day_label: 'D', title: 'Push B — Volume', exercises: [
        mkEx('Supino Inclinado com Halteres', 4, 10, 26),
        mkEx('Crucifixo com Halteres', 4, 12, 16),
        mkEx('Elevação Lateral', 4, 15, 12),
        mkEx('Mergulho em Paralelas', 4, 12, 0),
        mkEx('Extensão de Tríceps', 3, 15, 25),
      ]},
      { day_label: 'E', title: 'Pull B — Volume', exercises: [
        mkEx('Remada com Barra', 4, 10, 70),
        mkEx('Puxada na Máquina', 4, 12, 60),
        mkEx('Rosca Martelo', 4, 12, 16),
        mkEx('Rosca Direta com Barra', 3, 15, 25),
      ]},
      { day_label: 'F', title: 'Legs B — Volume Posterior', exercises: [
        mkEx('Levantamento Terra com Pernas Retas', 4, 10, 80),
        mkEx('Flexão de Pernas', 4, 12, 50),
        mkEx('Leg Press', 4, 15, 120),
        mkEx('Panturrilha na Máquina', 5, 20, 60),
      ]},
    ]},
  },

  {
    name: 'Bro Split 5x Semana',
    category: 'Avançado · 5x Semana',
    split_count: 5,
    data: { sessions: [
      { day_label: 'A', title: 'Peito', exercises: [
        mkEx('Supino com Barra', 5, 5, 100),
        mkEx('Supino Inclinado com Halteres', 4, 8, 26),
        mkEx('Crucifixo com Halteres', 4, 12, 16),
        mkEx('Peck Deck (Voador)', 3, 15, 60),
        mkEx('Flexões Declinadas', 3, 20, 0),
      ]},
      { day_label: 'B', title: 'Costas', exercises: [
        mkEx('Levantamento Terra', 4, 5, 120),
        mkEx('Remada com Barra', 4, 8, 80),
        mkEx('Puxada na Máquina', 4, 10, 70),
        mkEx('Rosca Direta com Barra', 3, 12, 30),
      ]},
      { day_label: 'C', title: 'Pernas', exercises: [
        mkEx('Agachamento', 5, 5, 100),
        mkEx('Leg Press', 4, 10, 140),
        mkEx('Extensão de Pernas', 4, 15, 60),
        mkEx('Flexão de Pernas', 4, 12, 50),
        mkEx('Panturrilha na Máquina', 5, 20, 60),
      ]},
      { day_label: 'D', title: 'Ombros', exercises: [
        mkEx('Desenvolvimento com Halteres', 4, 8, 22),
        mkEx('Elevação Lateral', 4, 15, 12),
        mkEx('Elevação Frontal', 3, 12, 10),
        mkEx('Remada ao Queixo', 3, 12, 30),
      ]},
      { day_label: 'E', title: 'Braços', exercises: [
        mkEx('Rosca Direta com Barra', 4, 10, 35),
        mkEx('Rosca Martelo', 3, 12, 16),
        mkEx('Rosca Alternada com Halteres', 3, 12, 14),
        mkEx('Extensão de Tríceps', 4, 10, 30),
        mkEx('Mergulho em Paralelas', 3, 12, 0),
      ]},
    ]},
  },
];

export async function seedWorkoutTemplates() {
  const sentinelKey = 'cpx_seed_templates_v1';
  if (localStorage.getItem(sentinelKey)) return;

  try {
    const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'templates_v1');
    const snap = await getDoc(sentinelRef);
    if (snap.exists()) {
      localStorage.setItem(sentinelKey, 'true');
      return;
    }

    const path = `artifacts/${APP_ID}/public/data/workout_templates`;
    const batch = writeBatch(db);

    TEMPLATES.forEach(t => {
      const ref = doc(collection(db, path));
      batch.set(ref, {
        ...t,
        trainer_id: 'sistema',
        created_at: new Date().toISOString()
      });
    });

    await batch.commit();
    await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
    localStorage.setItem(sentinelKey, 'true');
  } catch (e) {
    console.warn('Template seed failed:', e);
  }
}
