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
  const [confirmDelete, setConfirmDelete] = useState<Turma | null>(null);

  useEffect(() => onSnapshot(collection(db, TURMAS_PATH), snap => {
    setTurmas(snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Turma))
      .filter(t => t.ativa !== false)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
  }, () => {}), []);

  const dow          = todayDow();
  const todayTurmas  = turmas.filter(t => t.diasSemana?.includes(dow));
  const displayTurmas = filterToday ? todayTurmas : turmas;

  const deleteTurma = async (t: Turma) => {
    await deleteDoc(doc(db, TURMAS_PATH, t.id));
    setConfirmDelete(null);
  };

  if (view === 'attend' && selected)
    return <AttendanceSheet turma={selected} markerUserId={markerUserId} markerUserName={markerUserName}
      onBack={() => { setView('list'); setSelected(null); }} />;

  if (view === 'manage' && selected)
    return <ManageTurma turma={selected} onBack={() => { setView('list'); setSelected(null); }} />;

  if (view === 'create')
    return <CreateTurma onBack={() => setView('list')} />;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-end animate-in fade-in"
      onClick={onClose}>

      {/* Wide right-side drawer */}
      <div className="bg-white h-full w-full max-w-3xl shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300"
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
        <div className="px-8 py-4 border-b border-slate-100 flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1 min-w-[200px]">
            <button onClick={() => setFilterToday(true)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
              Hoje ({todayTurmas.length})
            </button>
            <button onClick={() => setFilterToday(false)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
              Todas ({turmas.length})
            </button>
          </div>
          <button onClick={() => setView('create')}
            className="flex items-center gap-2 bg-[#F7B500] text-[#004D71] px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm shrink-0">
            <Plus size={14}/> Nova Turma
          </button>
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
                      {t.professor && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                          <User size={9}/> {t.professor}
                        </span>
                      )}
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

// ─── Attendance Sheet ─────────────────────────────────────────────────────────
function AttendanceSheet({ turma, markerUserId, markerUserName, onBack }:
  { turma: Turma; markerUserId: string; markerUserName: string; onBack: () => void }) {

  const [marked, setMarked]   = useState<Set<string>>(new Set());
  const [logIds, setLogIds]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');
  const [done, setDone]       = useState(false);

  const dateStr = todayStr();

  useEffect(() => {
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
  }, [turma.id, dateStr]);

  const toggle = useCallback((id: string) => {
    setMarked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const confirm = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const checkInTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

      for (const [alunoId, logId] of Object.entries(logIds))
        if (!marked.has(alunoId)) batch.delete(doc(db, LOGS_PATH, logId));

      for (const aluno of turma.alunos) {
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
            markedBy: markerUserId,
            markedByName: markerUserName,
            timestamp: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      setDone(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const alunos = turma.alunos.filter(a => !search || a.nome.toLowerCase().includes(search.toLowerCase()));
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
      <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-300">

        {/* header */}
        <div className={`${modColor(turma.modalidade)} px-7 pt-8 pb-5 text-white shrink-0`}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 bg-white/15 rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Marcação · {new Date().toLocaleDateString('pt-PT')}</p>
              <h2 className="text-base font-black uppercase leading-tight">{turma.nome}</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Total', v: turma.alunos.length },
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
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMarked(new Set(turma.alunos.map(a => a.id)))}
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
              const isMarked  = marked.has(aluno.id);
              const wasMarked = !!logIds[aluno.id];
              return (
                <button key={aluno.id} onClick={() => toggle(aluno.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                    isMarked ? 'bg-green-50 border-green-300' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isMarked ? 'bg-green-500 text-white shadow-sm' : 'bg-slate-100 text-slate-300'
                  }`}>
                    {isMarked ? <Check size={18}/> : <div className="w-4 h-4 rounded-md border-2 border-slate-300"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-black text-sm uppercase leading-tight truncate ${isMarked ? 'text-green-800' : 'text-slate-700'}`}>
                      {aluno.nome}
                    </p>
                    <p className="text-[8px] font-black uppercase mt-0.5">
                      {wasMarked && isMarked  && <span className="text-slate-400">Já marcada hoje</span>}
                      {wasMarked && !isMarked && <span className="text-amber-500">Será removida</span>}
                      {!wasMarked && isMarked && <span className="text-green-500">Nova presença</span>}
                    </p>
                  </div>
                  {isMarked && <Check size={16} className="text-green-500 shrink-0"/>}
                </button>
              );
            })}
            {alunos.length === 0 && (
              <div className="py-12 text-center text-slate-300">
                <p className="font-black text-[10px] uppercase tracking-widest">Nenhum aluno encontrado</p>
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
    </div>
  );
}

// ─── Manage Turma (alunos) ────────────────────────────────────────────────────
function ManageTurma({ turma, onBack }: { turma: Turma; onBack: () => void }) {
  const [alunos, setAlunos]     = useState<TurmaAluno[]>(turma.alunos || []);
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

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
            {alunos.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{i + 1}</span>
                <p className="flex-1 font-black text-sm text-slate-700 uppercase truncate">{a.nome}</p>
                <button onClick={() => setAlunos(prev => prev.filter(x => x.id !== a.id))}
                  className="p-2 bg-red-50 text-red-400 rounded-xl active:scale-90 hover:bg-red-100 transition-all">
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
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
