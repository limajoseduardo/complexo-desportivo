import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Check, Users, ChevronRight, ArrowLeft, BookOpen,
  Clock, MapPin, User, Plus, Trash2, CheckSquare, Search
} from 'lucide-react';
import { Turma, TurmaAluno } from '../types';
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import {
  collection, onSnapshot, doc, updateDoc, addDoc,
  deleteDoc, getDocs, query, where, serverTimestamp, writeBatch, getDoc, setDoc
} from 'firebase/firestore';

// ─── helpers ────────────────────────────────────────────────────────────────
const TURMAS_PATH = `artifacts/${APP_ID}/public/data/turmas`;
const LOGS_PATH   = `artifacts/${APP_ID}/public/data/logs_acesso`;

const DAY_LABELS: Record<number, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom'
};

const MOD_COLORS: Record<string, string> = {
  'Hidroginástica':       'bg-teal-500',
  'Natação':              'bg-blue-600',
  'Natação Nível 1':      'bg-blue-500',
  'Natação Nível 2':      'bg-blue-600',
  'Natação Nível 3':      'bg-blue-700',
  'Bebés/AMA':            'bg-indigo-500',
  'Aulas Fitness':        'bg-purple-600',
  'Ginásio':              'bg-[#004D71]',
  'Piscina Regime Livre': 'bg-sky-600',
  'Zumba':                'bg-pink-500',
  'Yoga':                 'bg-emerald-600',
  'Ballet':               'bg-rose-400',
  'Karaté':               'bg-red-600',
  'Jazz':                 'bg-amber-500',
  'Hip-Hop':              'bg-violet-600',
};
const modColor = (m: string) => MOD_COLORS[m] || 'bg-slate-500';

const today = () => new Date().toISOString().split('T')[0];
const todayDow = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };

// ─── main export ─────────────────────────────────────────────────────────────
export function TurmasModule({ onClose, markerUserId, markerUserName }:
  { onClose: () => void; markerUserId: string; markerUserName: string }) {

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selected, setSelected] = useState<Turma | null>(null);
  const [view, setView] = useState<'list' | 'attend' | 'manage'>('list');
  const [filterToday, setFilterToday] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, TURMAS_PATH), snap => {
      setTurmas(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Turma))
        .filter(t => t.ativa !== false)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    }, () => {});
  }, []);

  const dow = todayDow();
  const todayTurmas  = turmas.filter(t => t.diasSemana?.includes(dow));
  const displayTurmas = filterToday ? todayTurmas : turmas;

  if (view === 'attend' && selected) {
    return <AttendanceSheet turma={selected} markerUserId={markerUserId} markerUserName={markerUserName}
      onBack={() => { setView('list'); setSelected(null); }} />;
  }

  if (view === 'manage' && selected) {
    return <ManageTurma turma={selected} onBack={() => { setView('list'); setSelected(null); }} />;
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom-8">

        {/* header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#004D71]/8 text-[#004D71] rounded-xl"><BookOpen size={20}/></div>
            <div>
              <h2 className="text-base font-black text-[#004D71] uppercase">Turmas</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marcar presenças por turma</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl active:scale-90 text-slate-400"><X size={20}/></button>
        </div>

        {/* toggle today / all */}
        <div className="px-7 pt-4 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setFilterToday(true)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
              Hoje ({todayTurmas.length})
            </button>
            <button onClick={() => setFilterToday(false)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!filterToday ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-400'}`}>
              Todas ({turmas.length})
            </button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-7 py-4 space-y-3 hide-scrollbar">
          {displayTurmas.length === 0 && (
            <div className="py-16 text-center text-slate-300">
              <BookOpen size={48} className="mx-auto mb-3 opacity-30"/>
              <p className="uppercase font-black text-[10px] tracking-widest">
                {filterToday ? 'Sem turmas hoje' : 'Sem turmas criadas'}
              </p>
            </div>
          )}
          {displayTurmas.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className={`w-1.5 self-stretch rounded-full shrink-0 ${modColor(t.modalidade)}`}/>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#004D71] text-sm uppercase leading-tight truncate">{t.nome}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.modalidade}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                    <Clock size={9}/> {t.horaInicio}–{t.horaFim}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                    <Users size={9}/> {t.alunos?.length ?? 0} alunos
                  </span>
                  {t.sala && <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase">
                    <MapPin size={9}/> {t.sala}
                  </span>}
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    {t.diasSemana?.map(d => DAY_LABELS[d]).join(' · ')}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => { setSelected(t); setView('attend'); }}
                  className="flex items-center gap-1.5 bg-[#004D71] text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                  <Check size={12}/> Presenças
                </button>
                <button onClick={() => { setSelected(t); setView('manage'); }}
                  className="flex items-center gap-1.5 bg-slate-200 text-slate-600 px-3 py-2 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
                  <User size={12}/> Gerir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Sheet ─────────────────────────────────────────────────────────
function AttendanceSheet({ turma, markerUserId, markerUserName, onBack }:
  { turma: Turma; markerUserId: string; markerUserName: string; onBack: () => void }) {

  const [marked, setMarked]     = useState<Set<string>>(new Set());
  const [logIds, setLogIds]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [done, setDone]         = useState(false);

  const dateStr = today();

  // load already-marked for today
  useEffect(() => {
    getDocs(query(collection(db, LOGS_PATH),
      where('turmaId', '==', turma.id),
      where('date', '==', dateStr)
    )).then(snap => {
      const ids: Record<string, string> = {};
      const m = new Set<string>();
      snap.forEach(d => {
        const data = d.data();
        if (data.turmaAlunoId) {
          ids[data.turmaAlunoId] = d.id;
          m.add(data.turmaAlunoId);
        }
      });
      setLogIds(ids);
      setMarked(m);
    }).catch(() => {});
  }, [turma.id, dateStr]);

  const toggle = useCallback((alunoId: string) => {
    setMarked(prev => {
      const next = new Set(prev);
      next.has(alunoId) ? next.delete(alunoId) : next.add(alunoId);
      return next;
    });
  }, []);

  const selectAll = () => setMarked(new Set(turma.alunos.map(a => a.id)));
  const clearAll  = () => setMarked(new Set());

  const confirm = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();
      const checkInTime = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

      // delete unchecked that were previously marked
      for (const [alunoId, logId] of Object.entries(logIds)) {
        if (!marked.has(alunoId)) {
          batch.delete(doc(db, LOGS_PATH, logId));
        }
      }

      // add newly checked
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
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const alunos = turma.alunos.filter(a =>
    !search || a.nome.toLowerCase().includes(search.toLowerCase()));

  const newlyMarked = [...marked].filter(id => !logIds[id]).length;
  const newlyUnmarked = Object.keys(logIds).filter(id => !marked.has(id)).length;

  if (done) {
    return (
      <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
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
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom-8">

        {/* header */}
        <div className={`${modColor(turma.modalidade)} rounded-t-[2.5rem] px-7 pt-6 pb-5 text-white shrink-0`}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 bg-white/15 rounded-xl active:scale-90 transition-all"><ArrowLeft size={16}/></button>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">Marcação de Presenças</p>
              <h2 className="text-base font-black uppercase leading-tight truncate">{turma.nome}</h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-black uppercase text-white/70">
            <span className="flex items-center gap-1"><Clock size={10}/> {turma.horaInicio}–{turma.horaFim}</span>
            <span className="flex items-center gap-1"><Users size={10}/> {turma.alunos.length} alunos</span>
            <span className="flex items-center gap-1"><CheckSquare size={10}/> {marked.size} marcados</span>
          </div>
        </div>

        {/* search + select all */}
        <div className="px-5 pt-4 pb-2 shrink-0 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar aluno..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll}
              className="flex-1 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
              Selecionar Todos
            </button>
            <button onClick={clearAll}
              className="flex-1 py-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
              Limpar Seleção
            </button>
          </div>
        </div>

        {/* alunos list */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 hide-scrollbar">
          <div className="space-y-2">
            {alunos.map(aluno => {
              const isMarked = marked.has(aluno.id);
              const wasMarked = !!logIds[aluno.id];
              return (
                <button key={aluno.id} onClick={() => toggle(aluno.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                    isMarked
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-slate-100 hover:border-slate-200'
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
                    {wasMarked && !isMarked && (
                      <p className="text-[8px] font-black text-amber-500 uppercase mt-0.5">Vai ser removida</p>
                    )}
                    {!wasMarked && isMarked && (
                      <p className="text-[8px] font-black text-green-500 uppercase mt-0.5">Nova presença</p>
                    )}
                    {wasMarked && isMarked && (
                      <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5">Já marcada hoje</p>
                    )}
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

        {/* confirm bar */}
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
            {saving
              ? <div className="w-4 h-4 border-2 border-[#F7B500]/30 border-t-[#F7B500] rounded-full animate-spin"/>
              : <Check size={16}/>}
            Confirmar {marked.size} Presenças
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Turma (add/remove alunos) ────────────────────────────────────────
function ManageTurma({ turma, onBack }: { turma: Turma; onBack: () => void }) {
  const [alunos, setAlunos]     = useState<TurmaAluno[]>(turma.alunos || []);
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const addAluno = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    setAlunos(prev => [...prev, { id, nome }]);
    setNovoNome('');
  };

  const removeAluno = (id: string) => setAlunos(prev => prev.filter(a => a.id !== id));

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, TURMAS_PATH, turma.id), { alunos });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom-8">

        {/* header */}
        <div className="flex items-center gap-3 px-7 pt-7 pb-5 border-b border-slate-100 shrink-0">
          <button onClick={onBack} className="p-2.5 bg-slate-100 rounded-xl active:scale-90 transition-all text-slate-500"><ArrowLeft size={16}/></button>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gerir Alunos</p>
            <h2 className="text-base font-black text-[#004D71] uppercase truncate">{turma.nome}</h2>
          </div>
          <button onClick={save} disabled={saving}
            className={`px-4 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all disabled:opacity-50 ${
              saved ? 'bg-green-500 text-white' : 'bg-[#004D71] text-[#F7B500]'
            }`}>
            {saving ? '...' : saved ? 'Guardado!' : 'Guardar'}
          </button>
        </div>

        {/* add new */}
        <div className="px-7 pt-4 pb-3 shrink-0">
          <div className="flex gap-2">
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAluno()}
              placeholder="Nome do aluno..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#004D71] transition-colors"/>
            <button onClick={addAluno}
              className="px-4 py-2.5 bg-[#F7B500] text-[#004D71] rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all flex items-center gap-1.5">
              <Plus size={14}/> Adicionar
            </button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-7 pb-6 hide-scrollbar">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">{alunos.length} alunos</p>
          <div className="space-y-2">
            {alunos.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-8 h-8 rounded-xl bg-[#004D71]/8 flex items-center justify-center shrink-0">
                  <User size={14} className="text-[#004D71]/50"/>
                </div>
                <p className="flex-1 font-black text-sm text-slate-700 uppercase truncate">{a.nome}</p>
                <button onClick={() => removeAluno(a.id)}
                  className="p-2 bg-red-50 text-red-400 rounded-xl active:scale-90 transition-all hover:bg-red-100">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
            {alunos.length === 0 && (
              <div className="py-10 text-center text-slate-300">
                <p className="font-black text-[10px] uppercase tracking-widest">Sem alunos nesta turma</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
