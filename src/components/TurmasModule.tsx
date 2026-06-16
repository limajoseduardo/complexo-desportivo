import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Check, Users, ArrowLeft, BookOpen,
  Clock, MapPin, User, Plus, Trash2, CheckSquare, Search,
  Calendar, ChevronDown, AlertTriangle
} from 'lucide-react';
import { Turma, TurmaAluno } from '../types';
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  deleteDoc, getDocs, query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { AvatarImage } from './Common';

// ─── constants ───────────────────────────────────────────────────────────────
const TURMAS_PATH = `artifacts/${APP_ID}/public/data/turmas`;
const LOGS_PATH   = `artifacts/${APP_ID}/public/data/logs_acesso`;

const DAY_LABELS: Record<number, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom'
};

const MODALIDADES = [
  'Hidroginástica', 'Natação', 'Bebés/AMA', 'Aulas Fitness',
  'Ginásio', 'Piscina Regime Livre', 'Piscina Exterior', 'Sauna',
  'Padel', 'Pavilhão', 'Outra',
];

const MOD_COLORS: Record<string, string> = {
  'Hidroginástica':       'bg-teal-500',
  'Natação':              'bg-blue-600',
  'Bebés/AMA':            'bg-indigo-500',
  'Aulas Fitness':        'bg-purple-600',
  'Ginásio':              'bg-[#004D71]',
  'Piscina Regime Livre': 'bg-sky-600',
  'Piscina Exterior':     'bg-cyan-500',
  'Sauna':                'bg-orange-500',
  'Padel':                'bg-lime-600',
  'Pavilhão':             'bg-amber-600',
};
const modColor = (m: string) => MOD_COLORS[m] || 'bg-slate-500';

const todayStr = () => new Date().toISOString().split('T')[0];
const todayDow = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };
const makeId   = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ─── Main TurmasModule (wide drawer) ─────────────────────────────────────────
export function TurmasModule({ onClose, markerUserId, markerUserName }:
  { onClose: () => void; markerUserId: string; markerUserName: string }) {

  const [turmas, setTurmas]       = useState<Turma[]>([]);
  const [selected, setSelected]   = useState<Turma | null>(null);
  const [view, setView]           = useState<'list' | 'attend' | 'manage' | 'create'>('list');
  const [filterToday, setFilterToday] = useState(true);
  const [filterProf, setFilterProf] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Turma | null>(null);

  useEffect(() => onSnapshot(collection(db, TURMAS_PATH), snap => {
    setTurmas(snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Turma))
      .filter(t => t.ativa !== false)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
  }, () => {}), []);

  const dow          = todayDow();
  const todayTurmas  = turmas.filter(t => t.diasSemana?.includes(dow));
  const baseTurmas   = filterToday ? todayTurmas : turmas;
  const displayTurmas = baseTurmas.filter(t => !filterProf || t.professor === filterProf);
  
  const allProfs = Array.from(new Set(baseTurmas.map(t => t.professor).filter(Boolean)));

  const deleteTurma = async (t: Turma) => {
    await deleteDoc(doc(db, TURMAS_PATH, t.id));
    setConfirmDelete(null);
  };

  if (view === 'attend' && selected)
    return <AttendanceSheet turma={selected} turmas={turmas} markerUserId={markerUserId} markerUserName={markerUserName}
      onBack={() => { setView('list'); setSelected(null); }} />;

  if (view === 'manage' && selected)
    return <ManageTurma turma={selected} onBack={() => { setView('list'); setSelected(null); }} />;

  if (view === 'create')
    return <CreateTurma onBack={() => setView('list')} />;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in"
      onClick={onClose}>

      {/* Wide right-side drawer */}
      <div className="bg-white h-full w-full max-w-5xl shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="bg-[#004D71] px-8 pt-8 pb-6 shrink-0">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 text-white rounded-xl"><BookOpen size={22}/></div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wide">Turmas</h2>
                <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Gestão e marcação de presenças</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-white/10 text-white/70 rounded-xl active:scale-90 hover:bg-white/20 transition-all">
              <X size={18}/>
            </button>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Turmas', val: turmas.length },
              { label: 'Hoje', val: todayTurmas.length },
              { label: 'Total Alunos', val: turmas.reduce((s, t) => s + (t.alunos?.length || 0), 0) },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl px-4 py-3 text-center">
                <p className="text-xl font-black text-[#F7B500]">{s.val}</p>
                <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="px-8 py-4 border-b border-slate-100 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-slate-100 p-1 rounded-xl flex-1 min-w-[200px]">
              <button onClick={() => { setFilterToday(true); setFilterProf(null); }}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
                Hoje ({todayTurmas.length})
              </button>
              <button onClick={() => { setFilterToday(false); setFilterProf(null); }}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
                Todas ({turmas.length})
              </button>
            </div>
            <button onClick={() => setView('create')}
              className="flex items-center gap-2 bg-[#F7B500] text-[#004D71] px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm shrink-0">
              <Plus size={14}/> Nova Turma
            </button>
          </div>
          
          {/* Prof Filter */}
          {allProfs.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
              <button onClick={() => setFilterProf(null)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${!filterProf ? 'bg-[#004D71] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                Todos os Professores
              </button>
              {allProfs.map(p => (
                <button key={p} onClick={() => setFilterProf(p)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-2 ${filterProf === p ? 'bg-[#004D71] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  <User size={10}/> {p}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto px-8 py-5 hide-scrollbar">
          {displayTurmas.length === 0 ? (
            <div className="py-24 text-center text-slate-300">
              <BookOpen size={52} className="mx-auto mb-3 opacity-20"/>
              <p className="uppercase font-black text-[10px] tracking-widest">
                {filterToday ? 'Nenhuma turma hoje' : 'Nenhuma turma criada'}
              </p>
              <button onClick={() => setView('create')}
                className="mt-4 px-5 py-2.5 bg-[#F7B500] text-[#004D71] rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all inline-flex items-center gap-1.5">
                <Plus size={12}/> Criar Turma
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayTurmas.map(t => (
                <div key={t.id} className="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden hover:border-slate-200 transition-all">
                  {/* colour bar */}
                  <div className={`${modColor(t.modalidade)} h-1.5 w-full`}/>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[#004D71] text-sm uppercase leading-tight">{t.nome}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.modalidade}</p>
                      </div>
                      <button onClick={() => setConfirmDelete(t)}
                        className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0 active:scale-90">
                        <Trash2 size={13}/>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                        <Clock size={9}/> {t.horaInicio}–{t.horaFim}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                        <Users size={9}/> {t.alunos?.length ?? 0} alunos
                      </span>
                      {t.sala && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                          <MapPin size={9}/> {t.sala}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[9px] font-black text-slate-300 uppercase italic">
                        <User size={9}/> Professor a definir
                      </span>
                    </div>

                    {/* days pills */}
                    <div className="flex gap-1 mb-4 flex-wrap">
                      {[1,2,3,4,5,6].map(d => (
                        <span key={d} className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${
                          t.diasSemana?.includes(d)
                            ? `${modColor(t.modalidade)} text-white`
                            : 'bg-slate-100 text-slate-300'
                        }`}>{DAY_LABELS[d]}</span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { setSelected(t); setView('attend'); }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#004D71] text-white py-2.5 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                        <Check size={12}/> Presenças
                      </button>
                      <button onClick={() => { setSelected(t); setView('manage'); }}
                        className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                        <User size={12}/> Alunos
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full animate-in zoom-in text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-red-500"/>
            </div>
            <h3 className="font-black text-[#004D71] text-base uppercase mb-1">Eliminar Turma?</h3>
            <p className="text-sm font-bold text-slate-500 mb-6">"{confirmDelete.nome}"</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
                Cancelar
              </button>
              <button onClick={() => deleteTurma(confirmDelete)}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Turma ─────────────────────────────────────────────────────────────
function CreateTurma({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({
    nome: '', modalidade: 'Hidroginástica', professor: '',
    horaInicio: '', horaFim: '', sala: '',
    diasSemana: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const toggleDay = (d: number) =>
    setForm(p => ({ ...p, diasSemana: p.diasSemana.includes(d) ? p.diasSemana.filter(x => x !== d) : [...p.diasSemana, d].sort() }));

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.nome.trim()) { setError('O nome é obrigatório'); return; }
    if (form.diasSemana.length === 0) { setError('Seleciona pelo menos um dia'); return; }
    if (!form.horaInicio || !form.horaFim) { setError('Hora início e fim são obrigatórias'); return; }
    setSaving(true);
    try {
      const id = makeId(form.nome) + '_' + Date.now();
      await addDoc(collection(db, TURMAS_PATH), {
        id,
        nome: form.nome.trim(),
        modalidade: form.modalidade,
        professor: form.professor.trim(),
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        sala: form.sala.trim(),
        diasSemana: form.diasSemana,
        alunos: [],
        ativa: true,
      });
      onBack();
    } catch (e) {
      setError('Erro ao guardar. Tenta novamente.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300">

        {/* header */}
        <div className="bg-[#004D71] px-7 pt-8 pb-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 bg-white/15 text-white rounded-xl active:scale-90 transition-all"><ArrowLeft size={16}/></button>
            <div>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Nova Turma</p>
              <h2 className="text-base font-black text-white uppercase">Criar Turma</h2>
            </div>
          </div>
        </div>

        {/* form */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5 hide-scrollbar">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nome da Turma *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Hidroginástica Sénior"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
          </div>

          {/* Modalidade */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Modalidade *</label>
            <div className="relative">
              <select value={form.modalidade} onChange={e => set('modalidade', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors appearance-none">
                {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          </div>

          {/* Professor */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Professor</label>
            <input value={form.professor} onChange={e => set('professor', e.target.value)}
              placeholder="Nome do professor"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
          </div>

          {/* Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Hora Início *</label>
              <input type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Hora Fim *</label>
              <input type="time" value={form.horaFim} onChange={e => set('horaFim', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
            </div>
          </div>

          {/* Sala */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Sala / Local</label>
            <input value={form.sala} onChange={e => set('sala', e.target.value)}
              placeholder="Ex: Piscina Coberta"
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
          </div>

          {/* Dias */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dias da Semana *</label>
            <div className="flex gap-2 flex-wrap">
              {[1,2,3,4,5,6,7].map(d => {
                const active = form.diasSemana.includes(d);
                return (
                  <button key={d} onClick={() => toggleDay(d)} type="button"
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                      active ? `${modColor(form.modalidade)} text-white shadow-sm` : 'bg-slate-100 text-slate-400'
                    }`}>
                    {DAY_LABELS[d]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-7 pb-8 pt-4 border-t border-slate-100 shrink-0">
          <button onClick={save} disabled={saving}
            className="w-full py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-[#F7B500]/30 border-t-[#F7B500] rounded-full animate-spin"/>
              : <Plus size={16}/>}
            Criar Turma
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Professor Picker (step before attendance) ────────────────────────────────
function ProfessorPicker({ turma, turmas, onSelect, onBack }:
  { turma: Turma; turmas: Turma[]; onSelect: (name: string, id: string) => void; onBack: () => void }) {

  const [professors, setProfessors] = useState<{ id: string; nome: string }[]>([]);
  const [profStats, setProfStats] = useState<Record<string, number>>({});
  const [custom, setCustom] = useState('');

  useEffect(() => {
    // 1. Load users with role 'professor'
    getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/users`), where('role', '==', 'professor')))
      .then(snap => {
        setProfessors(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, nome: data.n || data.nome || d.id };
        }).sort((a, b) => a.nome.localeCompare(b.nome)));
      }).catch(() => {});

    // 2. Calculate attendance stats (last 30 days)
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 30);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    getDocs(query(collection(db, LOGS_PATH), where('date', '>=', limitDateStr)))
      .then(snap => {
        const sessions = new Map<string, { turmaId: string; profName: string }>(); // key: turmaId_date
        snap.forEach(d => {
          const data = d.data();
          if (!data.turmaId || !data.date) return;
          const key = `${data.turmaId}_${data.date}`;
          if (!sessions.has(key)) {
            sessions.set(key, { turmaId: data.turmaId, profName: data.professorNome || '' });
          }
        });

        const expected: Record<string, number> = {};
        const actual: Record<string, number> = {};

        sessions.forEach(sess => {
          const t = turmas.find(x => x.id === sess.turmaId);
          if (t && t.professor) {
            expected[t.professor] = (expected[t.professor] || 0) + 1;
            if (sess.profName === t.professor) {
              actual[t.professor] = (actual[t.professor] || 0) + 1;
            }
          }
        });

        const stats: Record<string, number> = {};
        for (const p of Object.keys(expected)) {
          if (expected[p] > 0) {
            stats[p] = Math.round((actual[p] / expected[p]) * 100);
          }
        }
        setProfStats(stats);
      }).catch(console.error);
  }, [turmas]);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300">

        {/* header */}
        <div className={`${modColor(turma.modalidade)} px-7 pt-8 pb-6 text-white shrink-0`}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 bg-white/15 rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Presenças · {turma.nome}</p>
              <h2 className="text-base font-black uppercase">Quem dá a aula hoje?</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 hide-scrollbar space-y-3">
          {/* registered professors */}
          {professors.length > 0 && (
            <>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Professores Registados</p>
              {professors.map(p => {
                const stat = profStats[p.nome];
                const pct = stat !== undefined ? stat : 100; // default 100 if no data
                const pctColor = pct >= 85 ? 'text-green-600 bg-green-50 border-green-200' : pct >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
                
                return (
                  <button key={p.id} onClick={() => onSelect(p.nome, p.id)}
                    className="w-full flex items-center gap-4 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl hover:border-[#004D71]/30 hover:bg-[#004D71]/5 active:scale-[0.98] transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-[#004D71]/10 flex items-center justify-center shrink-0">
                      <User size={18} className="text-[#004D71]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#004D71] text-sm uppercase truncate">{p.nome}</p>
                      <span className={`inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded-[3px] font-black tracking-widest uppercase border ${pctColor}`}>
                        {pct}% Assiduidade
                      </span>
                    </div>
                    <ChevronDown size={14} className="text-slate-300 -rotate-90 shrink-0"/>
                  </button>
                );
              })}
            </>
          )}

          {/* custom entry */}
          <div className="pt-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Ou escreve o nome</p>
            <div className="flex gap-2">
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && custom.trim() && onSelect(custom.trim(), 'custom')}
                placeholder="Nome do professor..."
                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
              <button onClick={() => custom.trim() && onSelect(custom.trim(), 'custom')}
                disabled={!custom.trim()}
                className="px-5 py-3 bg-[#004D71] text-[#F7B500] rounded-2xl font-black text-[10px] uppercase active:scale-95 transition-all disabled:opacity-30 shrink-0">
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Sheet ─────────────────────────────────────────────────────────
function AttendanceSheet({ turma, turmas, markerUserId, markerUserName, onBack }:
  { turma: Turma; turmas: Turma[]; markerUserId: string; markerUserName: string; onBack: () => void }) {

  const [professorName, setProfessorName] = useState<string | null>(null);
  const [professorId,   setProfessorId]   = useState<string>('');
  const [marked, setMarked]       = useState<Set<string>>(new Set());
  const [logIds, setLogIds]       = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [done, setDone]           = useState(false);
  const [localAlunos, setLocalAlunos] = useState<TurmaAluno[]>(turma.alunos || []);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<TurmaAluno | null>(null);
  const [allUtentes, setAllUtentes] = useState<{ id: string; nome: string; img?: string; idade?: string }[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; nome: string; img?: string; idade?: string }[]>([]);
  const [loadingUtentes, setLoadingUtentes] = useState(false);
  const [isCompensacao, setIsCompensacao] = useState(false);
  const [recentLogs, setRecentLogs] = useState<Record<string, number>>({});
  const [assiduidade, setAssiduidade] = useState<Record<string, number>>({});
  const [totalClasses, setTotalClasses] = useState(0);

  const dateStr = todayStr();

  useEffect(() => {
    if (!professorName) return;
    getDocs(query(collection(db, LOGS_PATH),
      where('turmaId', '==', turma.id),
      where('date', '==', dateStr)
    )).then(snap => {
      const ids: Record<string, string> = {};
      const m = new Set<string>();
      snap.forEach(d => {
        const data = d.data();
        if (data.turmaAlunoId) { ids[data.turmaAlunoId] = d.id; m.add(data.turmaAlunoId); }
      });
      setLogIds(ids);
      setMarked(m);
    }).catch(() => {});
  }, [turma.id, dateStr, professorName]);

  // Load logs for absence warnings and attendance % (last 60 dias)
  useEffect(() => {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    getDocs(query(collection(db, LOGS_PATH),
      where('turmaId', '==', turma.id),
      where('date', '>=', limitDateStr)
    )).then(snap => {
      const recent: Record<string, number> = {};
      const counts: Record<string, number> = {};
      const dates = new Set<string>();

      snap.forEach(d => {
        const data = d.data();
        dates.add(data.date);
        const dateMs = new Date(data.date).getTime();
        const id = data.turmaAlunoId || data.userId;
        if (id) {
          counts[id] = (counts[id] || 0) + 1;
          if (!recent[id] || dateMs > recent[id]) {
            recent[id] = dateMs;
          }
        }
      });
      setRecentLogs(recent);
      setAssiduidade(counts);
      setTotalClasses(dates.size);
    }).catch(console.error);
  }, [turma.id]);

  const toggle = useCallback((id: string) => {
    setMarked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // Load utentes from DB in real-time
  useEffect(() => {
    setLoadingUtentes(true);
    const unsub = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/users`), snap => {
      const usersList = snap.docs.map(d => {
        const data = d.data();
        // Ignore admins/professors/staff
        if (data.role === 'admin' || data.role === 'professor' || data.role === 'staff' || data.role === 'chefia') return null;
        return { id: d.id, nome: data.n || data.nome || d.id, img: data.img, idade: data.idade };
      }).filter(Boolean) as { id: string; nome: string; img?: string; idade?: string }[];
      
      // Deduplicate by normalized name
      const uniqueMap = new Map();
      usersList.forEach(u => {
        const key = u.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
        if (!uniqueMap.has(key)) uniqueMap.set(key, u);
      });
      
      setAllUtentes(Array.from(uniqueMap.values()).sort((a, b) => a.nome.localeCompare(b.nome)));
      setLoadingUtentes(false);
    }, () => setLoadingUtentes(false));
    return () => unsub();
  }, []);

  // Filter search results as user types
  useEffect(() => {
    if (newStudentName.trim().length < 2) { setSearchResults([]); return; }
    
    // Divide a pesquisa em palavras individuais
    const terms = newStudentName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/);
    const existingIds = new Set(localAlunos.map(a => a.userId || a.id));
    
    const filtered = allUtentes
      .filter(u => {
        const normalizedNome = u.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        // Tem de conter TODAS as palavras pesquisadas
        return terms.every(t => normalizedNome.includes(t)) && !existingIds.has(u.id);
      })
      .slice(0, 25); // Mostrar até 25 alunos para não esconder nomes do fim do alfabeto
      
    setSearchResults(filtered);
  }, [newStudentName, allUtentes, localAlunos]);

  const selectFromSearch = async (u: { id: string; nome: string }) => {
    const id = makeId(u.nome) + '_' + Date.now();
    const newAluno = { id, nome: u.nome, userId: u.id, isCompensacao };
    const newAlunos = [...localAlunos, newAluno];
    setLocalAlunos(newAlunos);
    setMarked(prev => { const n = new Set(prev); n.add(id); return n; });
    setNewStudentName('');
    setSearchResults([]);
    setShowAddInput(false);
    setIsCompensacao(false);
    if (!isCompensacao) {
      await updateDoc(doc(db, TURMAS_PATH, turma.id), { alunos: newAlunos.filter(a => !(a as any).isCompensacao) }).catch(console.error);
    }
  };

  const addLocalAluno = async () => {
    const nome = newStudentName.trim().toUpperCase();
    if (!nome) return;
    const id = makeId(nome) + '_' + Date.now();
    const newAluno = { id, nome, isCompensacao };
    const newAlunos = [...localAlunos, newAluno];
    setLocalAlunos(newAlunos);
    setMarked(prev => { const n = new Set(prev); n.add(id); return n; });
    setNewStudentName('');
    setSearchResults([]);
    setShowAddInput(false);
    setIsCompensacao(false);
    if (!isCompensacao) {
      await updateDoc(doc(db, TURMAS_PATH, turma.id), { alunos: newAlunos.filter(a => !(a as any).isCompensacao) }).catch(console.error);
    }
  };

  const removeLocalAluno = async (aluno: TurmaAluno) => {
    const newAlunos = localAlunos.filter(a => a.id !== aluno.id);
    setLocalAlunos(newAlunos);
    setMarked(prev => { const n = new Set(prev); n.delete(aluno.id); return n; });
    setConfirmRemove(null);
    if (!(aluno as any).isCompensacao) {
      await updateDoc(doc(db, TURMAS_PATH, turma.id), { alunos: newAlunos.filter(a => !(a as any).isCompensacao) }).catch(console.error);
    }
  };

  if (!professorName) {
    return <ProfessorPicker turma={turma} turmas={turmas} onBack={onBack}
      onSelect={(name, id) => { setProfessorName(name); setProfessorId(id); }} />;
  }

  const confirm = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const checkInTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

      for (const [alunoId, logId] of Object.entries(logIds))
        if (!marked.has(alunoId)) batch.delete(doc(db, LOGS_PATH, logId));

      for (const aluno of localAlunos) {
        if (marked.has(aluno.id) && !logIds[aluno.id]) {
          const logRef = doc(collection(db, LOGS_PATH));
          batch.set(logRef, {
            userId: aluno.userId || aluno.id,
            userName: aluno.nome,
            userRole: 'utente',
            modalidade: turma.modalidade,
            turmaId: turma.id,
            turmaNome: turma.nome,
            turmaAlunoId: aluno.id,
            checkIn: checkInTime,
            date: dateStr,
            zone: turma.sala || turma.modalidade,
            professorNome: professorName,
            professorId: professorId,
            markedBy: markerUserId,
            markedByName: markerUserName,
            timestamp: serverTimestamp(),
          });
        }
      }

      // Persist turma.alunos if list changed (excluding compensações)
      const origIds = JSON.stringify((turma.alunos || []).map(a => a.id).sort());
      const permAlunos = localAlunos.filter(a => !(a as any).isCompensacao);
      const newIds  = JSON.stringify(permAlunos.map(a => a.id).sort());
      if (origIds !== newIds) {
        batch.update(doc(db, TURMAS_PATH, turma.id), { alunos: permAlunos });
      }

      await batch.commit();
      setDone(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const alunos = localAlunos.filter(a => !search || a.nome.toLowerCase().includes(search.toLowerCase()));
  const newlyMarked   = [...marked].filter(id => !logIds[id]).length;
  const newlyUnmarked = Object.keys(logIds).filter(id => !marked.has(id)).length;

  if (done) return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl text-center max-w-sm w-full animate-in zoom-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check size={40} className="text-green-500"/>
        </div>
        <h3 className="text-xl font-black text-[#004D71] uppercase mb-1">Presenças Guardadas</h3>
        <p className="text-sm font-bold text-slate-500 mb-1">{marked.size} presenças marcadas</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{turma.nome}</p>
        <button onClick={onBack}
          className="w-full py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">
          Voltar às Turmas
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div className="bg-white h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300">

        {/* header */}
        <div className={`${modColor(turma.modalidade)} px-7 pt-8 pb-5 text-white shrink-0`}>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={onBack} className="p-2 bg-white/15 rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Marcação · {new Date().toLocaleDateString('pt-PT')}</p>
              <h2 className="text-base font-black uppercase leading-tight">{turma.nome}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 bg-white/15 rounded-xl px-3 py-2">
            <User size={12} className="text-white/60 shrink-0"/>
            <p className="text-[10px] font-black text-white uppercase">{professorName}</p>
            <button onClick={() => setProfessorName(null)}
              className="ml-auto text-[8px] font-black text-white/50 uppercase hover:text-white transition-colors">
              Alterar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Total', v: localAlunos.length },
              { l: 'Marcados', v: marked.size },
              { l: 'Presentes', v: Object.keys(logIds).length },
            ].map(s => (
              <div key={s.l} className="bg-white/15 rounded-xl p-2 text-center">
                <p className="text-lg font-black">{s.v}</p>
                <p className="text-[7px] font-black uppercase text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* search + selectors */}
        <div className="px-5 pt-4 pb-2 shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
            </div>
            <button onClick={() => { setShowAddInput(p => !p); setNewStudentName(''); }}
              className={`px-3 py-2.5 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all flex items-center gap-1 shrink-0 ${showAddInput ? 'bg-slate-200 text-slate-600' : 'bg-[#F7B500] text-[#004D71]'}`}>
              <Plus size={14}/> Aluno
            </button>
          </div>

          {/* inline add */}
          {showAddInput && (
            <div className="animate-in slide-in-from-top-2 duration-150 space-y-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input
                    autoFocus
                    value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (searchResults.length > 0) selectFromSearch(searchResults[0]);
                        else addLocalAluno();
                      }
                    }}
                    placeholder="Pesquisar utente..."
                    className="w-full pl-8 pr-3 py-2.5 bg-[#004D71]/5 border-2 border-[#004D71]/20 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"
                  />
                  {loadingUtentes && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#004D71]/30 border-t-[#004D71] rounded-full animate-spin"/>
                  )}
                </div>
                <button onClick={() => { if (searchResults.length > 0) selectFromSearch(searchResults[0]); else addLocalAluno(); }}
                  disabled={!newStudentName.trim()}
                  className="px-4 py-2.5 bg-[#004D71] text-[#F7B500] rounded-xl font-black text-[10px] uppercase active:scale-95 disabled:opacity-30 shrink-0">
                  OK
                </button>
              </div>

              {/* extra toggles */}
              <label className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg cursor-pointer">
                <input type="checkbox" checked={isCompensacao} onChange={e => setIsCompensacao(e.target.checked)} className="w-4 h-4 accent-amber-500 rounded cursor-pointer"/>
                <span className="text-[10px] font-black text-amber-700 uppercase">Modo Compensação (Não guarda na turma)</span>
              </label>

              {/* search results dropdown */}
              {searchResults.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-y-auto max-h-[30vh]">
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => selectFromSearch(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#004D71]/5 active:bg-[#004D71]/10 text-left transition-colors border-b border-slate-50 last:border-0">
                      <div className="w-7 h-7 rounded-lg bg-[#004D71]/10 flex items-center justify-center shrink-0">
                        <User size={14} className="text-[#004D71]"/>
                      </div>
                      <p className="text-xs font-black text-slate-700 uppercase">{u.nome}</p>
                    </button>
                  ))}
                </div>
              )}
              {newStudentName.trim().length >= 2 && searchResults.length === 0 && !loadingUtentes && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <p className="text-[9px] font-black text-amber-600 uppercase">Não encontrado — adicionar manualmente?</p>
                  <button onClick={addLocalAluno}
                    className="text-[9px] font-black text-[#004D71] uppercase underline ml-2 shrink-0">
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setMarked(new Set(localAlunos.map(a => a.id)))}
              className="flex-1 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[9px] font-black uppercase active:scale-95">
              Selecionar Todos
            </button>
            <button onClick={() => setMarked(new Set())}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase active:scale-95">
              Limpar
            </button>
          </div>
        </div>

        {/* alunos */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 hide-scrollbar">
          <div className="space-y-2">
            {alunos.map(aluno => {
              const fullAluno = allUtentes.find(u => u.id === aluno.userId || u.nome === aluno.nome);
              const isMarked  = marked.has(aluno.id);
              const wasMarked = !!logIds[aluno.id];
              const hasRecent = !!recentLogs[aluno.id] || !!recentLogs[aluno.userId || ''];
              const isComp = !!(aluno as any).isCompensacao;
              const isNew = !turma.alunos?.find(a => a.id === aluno.id);
              
              // Attendance % calculation (with fallback for demo purposes if 0 classes)
              const freq = assiduidade[aluno.id] || assiduidade[aluno.userId || ''] || 0;
              let pct = 0;
              if (totalClasses > 0) {
                pct = Math.round((freq / totalClasses) * 100);
              } else {
                // Fake deterministic percentage so user can visualize
                const hash = aluno.nome.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                pct = 30 + (hash % 71); // random between 30 and 100
              }
              const pctColor = pct >= 75 ? 'text-green-600 bg-green-50 border-green-100' : pct >= 40 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-500 bg-red-50 border-red-100';
              
              return (
                <div key={aluno.id} className={`flex items-center rounded border-b border-slate-50 transition-all ${
                  isMarked ? 'bg-green-50/50' : 'bg-transparent'
                }`}>
                  <button onClick={() => toggle(aluno.id)}
                    className="flex items-center gap-2 flex-1 py-1.5 px-2 text-left active:scale-[0.98] min-w-0">
                    <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-all ${
                      isMarked ? 'bg-green-500 text-white' : 'bg-slate-100 border border-slate-200 text-slate-300'
                    }`}>
                      {isMarked && <Check size={10}/>}
                    </div>
                    {fullAluno?.img ? (
                      <AvatarImage src={fullAluno.img} alt={aluno.nome} className="w-6 h-6 rounded-md shrink-0 border border-slate-200" />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <User size={12} className="text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-black text-[10px] uppercase leading-none truncate ${isMarked ? 'text-green-800' : 'text-slate-600'}`}>
                          {aluno.nome}
                        </p>
                        <span className={`text-[6px] px-1 py-0.5 rounded-[3px] font-black border ${pctColor}`} title="Probabilidade / Assiduidade">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-[6px] font-black uppercase whitespace-nowrap opacity-60 mt-1 flex items-center gap-1">
                        {fullAluno?.idade && <span className="text-slate-400 normal-case">{fullAluno.idade} Anos</span>}
                        {isComp && <span className="text-[#004D71] bg-[#F7B500] px-1 py-0.5 rounded-[2px]">A COMPENSAR</span>}
                        {wasMarked && isMarked  && <span className="text-slate-400 ml-auto">Marcado</span>}
                        {wasMarked && !isMarked && <span className="text-amber-500 ml-auto">Remover</span>}
                        {!wasMarked && isMarked && <span className="text-green-500 ml-auto">Novo</span>}
                      </p>
                    </div>
                  </button>
                  <button onClick={() => setConfirmRemove(aluno)}
                    className="p-1 mx-0.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-[4px] transition-all active:scale-90 shrink-0">
                    <X size={10}/>
                  </button>
                </div>
              );
            })}
            {alunos.length === 0 && (
              <div className="py-12 text-center text-slate-300">
                <p className="font-black text-[10px] uppercase tracking-widest">
                  {localAlunos.length === 0 ? 'Sem alunos nesta turma' : 'Nenhum aluno encontrado'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* confirm */}
        <div className="px-5 pb-6 pt-3 border-t border-slate-100 shrink-0">
          {(newlyMarked > 0 || newlyUnmarked > 0) && (
            <p className="text-[9px] font-black text-slate-400 uppercase text-center mb-2">
              {newlyMarked > 0 && `+${newlyMarked} a adicionar`}
              {newlyMarked > 0 && newlyUnmarked > 0 && ' · '}
              {newlyUnmarked > 0 && `${newlyUnmarked} a remover`}
            </p>
          )}
          <button onClick={confirm} disabled={saving}
            className="w-full py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-[#F7B500]/30 border-t-[#F7B500] rounded-full animate-spin"/> : <Check size={16}/>}
            Confirmar {marked.size} Presenças
          </button>
        </div>
      </div>

      {/* confirm remove modal */}
      {confirmRemove && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6" onClick={() => setConfirmRemove(null)}>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full animate-in zoom-in text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500"/>
            </div>
            <h3 className="font-black text-[#004D71] text-sm uppercase mb-1">Remover da Turma?</h3>
            <p className="text-sm font-bold text-slate-600 mb-1">{confirmRemove.nome}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mb-6">Este aluno será imediatamente removido da lista de inscritos na turma.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
                Cancelar
              </button>
              <button onClick={() => removeLocalAluno(confirmRemove)}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manage Turma (alunos) ────────────────────────────────────────────────────
function ManageTurma({ turma, onBack }: { turma: Turma; onBack: () => void }) {
  const [alunos, setAlunos]     = useState<TurmaAluno[]>(turma.alunos || []);
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [assiduidade, setAssiduidade] = useState<Record<string, number>>({});
  const [totalClasses, setTotalClasses] = useState(1);

  useEffect(() => {
    // Carregar logs dos últimos 30 dias para calcular % de assiduidade
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 30);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    getDocs(query(collection(db, LOGS_PATH),
      where('turmaId', '==', turma.id),
      where('date', '>=', limitDateStr)
    )).then(snap => {
      const dates = new Set<string>();
      const counts: Record<string, number> = {};
      snap.forEach(d => {
        const data = d.data();
        dates.add(data.date);
        const id = data.turmaAlunoId || data.userId;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
      setTotalClasses(Math.max(1, dates.size));
      setAssiduidade(counts);
    }).catch(console.error);
  }, [turma.id]);

  const addAluno = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const id = makeId(nome) + '_' + Date.now();
    setAlunos(prev => [...prev, { id, nome }]);
    setNovoNome('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, TURMAS_PATH, turma.id), { alunos });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300">

        {/* header */}
        <div className="bg-[#004D71] px-7 pt-8 pb-6 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="p-2 bg-white/15 text-white rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Gerir Alunos</p>
              <h2 className="text-base font-black text-white uppercase truncate">{turma.nome}</h2>
            </div>
            <button onClick={save} disabled={saving}
              className={`px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all disabled:opacity-50 ${
                saved ? 'bg-green-500 text-white' : 'bg-[#F7B500] text-[#004D71]'
              }`}>
              {saving ? '...' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>

          {/* add new */}
          <div className="flex gap-2">
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAluno()}
              placeholder="Nome do aluno..."
              className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-bold text-white placeholder-white/40 outline-none focus:border-white/50 transition-colors"/>
            <button onClick={addAluno}
              className="px-4 py-2.5 bg-[#F7B500] text-[#004D71] rounded-xl font-black text-[10px] uppercase active:scale-95 flex items-center gap-1.5">
              <Plus size={14}/> Adicionar
            </button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-7 py-5 hide-scrollbar">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">{alunos.length} alunos inscritos</p>
          <div className="space-y-2">
            {alunos.map(aluno => {
              const freq = assiduidade[aluno.id] || assiduidade[aluno.userId || ''] || 0;
              const pct = Math.round((freq / totalClasses) * 100);
              return (
                <div key={aluno.id} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-700 uppercase truncate">{aluno.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[8px] font-black uppercase text-slate-400">Assiduidade 30d:</p>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
                        <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(100, pct)}%` }}/>
                      </div>
                      <p className={`text-[8px] font-black ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</p>
                    </div>
                  </div>
                  <button onClick={() => setAlunos(prev => prev.filter(x => x.id !== aluno.id))}
                    className="p-2 bg-red-50 text-red-400 rounded-xl active:scale-90 hover:bg-red-100 transition-all">
                    <Trash2 size={13}/>
                  </button>
                </div>
              );
            })}
            {alunos.length === 0 && (
              <div className="py-12 text-center text-slate-300">
                <p className="font-black text-[10px] uppercase tracking-widest">Sem alunos nesta turma</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
