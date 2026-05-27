import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, Plus, Edit2,
  Trash2, Save, X, GraduationCap, Copy, Users
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { 
  collection, onSnapshot, query, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, where, Timestamp, setDoc
} from 'firebase/firestore';
import { Aula, UserRole, UserProfile } from '../types';

interface AgendaModuleProps {
  userRole: UserRole;
  user?: UserProfile;
}

export function AgendaModule({ userRole, user }: AgendaModuleProps) {
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAula, setEditingAula] = useState<Aula | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 7);
  const [professors, setProfessors] = useState<UserProfile[]>([]);
  const [viewingInscritos, setViewingInscritos] = useState<any[] | null>(null);
  const [viewingAulaNome, setViewingAulaNome] = useState('');
  const [activeHorarioImg, setActiveHorarioImg] = useState<string | null>(null);

  const canEdit = ['admin', 'staff', 'chefia', 'professor'].includes(userRole);

  const dias = [
    { id: 1, label: 'Segunda', short: 'SEG' },
    { id: 2, label: 'Terça', short: 'TER' },
    { id: 3, label: 'Quarta', short: 'QUA' },
    { id: 4, label: 'Quinta', short: 'QUI' },
    { id: 5, label: 'Sexta', short: 'SEX' },
    { id: 6, label: 'Sábado', short: 'SÁB' },
    { id: 7, label: 'Domingo', short: 'DOM' },
  ];


  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/users`;
    const q = query(collection(db, path), where('role', '==', 'professor'));
    return onSnapshot(q, snap => {
      setProfessors(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, () => {});
  }, []);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/agenda`;
    const q = query(collection(db, path), orderBy('horaInicio', 'asc'));
    
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aula));
      setAulas(docs);
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAula || saving) return;
    setSaving(true);
    try {
      const path = `artifacts/${APP_ID}/public/data/agenda`;
      if (isAdding) {
        // Verificar duplicado: mesmo dia, hora início e modalidade
        const existe = aulas.some(a =>
          a.diaSemana === editingAula.diaSemana &&
          a.horaInicio === editingAula.horaInicio &&
          a.modalidade.trim().toLowerCase() === editingAula.modalidade.trim().toLowerCase()
        );
        if (existe) {
          alert('Já existe uma aula com esta modalidade, dia e hora de início.');
          return;
        }
        await addDoc(collection(db, path), { ...editingAula, id: undefined });
      } else {
        await updateDoc(doc(db, path, editingAula.id), { ...editingAula });
      }
      setEditingAula(null);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'agenda');
    } finally {
      setSaving(false);
    }
  };

  const removeDuplicates = async () => {
    if (!window.confirm('Isto irá remover aulas duplicadas (mesmo dia, hora e modalidade). Continuar?')) return;
    const seen = new Set<string>();
    const toDelete: string[] = [];
    // Ordenar por id para manter sempre o primeiro criado
    const sorted = [...aulas].sort((a, b) => a.id.localeCompare(b.id));
    for (const aula of sorted) {
      const key = `${aula.diaSemana}-${aula.horaInicio}-${aula.modalidade.trim().toLowerCase()}`;
      if (seen.has(key)) {
        toDelete.push(aula.id);
      } else {
        seen.add(key);
      }
    }
    if (toDelete.length === 0) {
      alert('Não foram encontradas aulas duplicadas.');
      return;
    }
    const path = `artifacts/${APP_ID}/public/data/agenda`;
    for (const id of toDelete) {
      await deleteDoc(doc(db, path, id));
    }
    alert(`${toDelete.length} aula(s) duplicada(s) removida(s).`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem a certeza que deseja eliminar esta aula?')) return;
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/agenda`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'agenda');
    }
  };

  const handleCancelAndNotify = async (aula: any) => {
    if (!user) return;
    const inscritos = aula.inscritos || [];
    
    const confirmMessage = inscritos.length > 0
      ? `Tem a certeza que deseja CANCELAR a aula de ${aula.modalidade} e NOTIFICAR os ${inscritos.length} inscritos?`
      : `Tem a certeza que deseja CANCELAR a aula de ${aula.modalidade}? (Será publicado um aviso no Mural de Avisos)`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const diaNome = dias.find(d => d.id === aula.diaSemana)?.label || 'dia selecionado';
      const actionText = `✨ COMUNICADO IMPORTANTE: CANCELAMENTO DE AULA ✨\n\nEstimado(a) utente, lamentamos informar que a aula de ${aula.modalidade} agendada para ${diaNome} às ${aula.horaInicio} foi cancelada por motivos de força maior / motivos superiores.\n\nPedimos as nossas sinceras desculpas pelo incómodo causado e agradecemos a sua compreensão. 🙏💙\n\nComplexo Desportivo Vila de Rei`;

      // 1. Enviar mensagens para todos os inscritos
      for (const inscrito of inscritos) {
         const chatId = [user.id, inscrito.id].sort().join('_');
         
         await addDoc(collection(db, `artifacts/${APP_ID}/public/data/conversas/${chatId}/messages`), {
           senderId: user.id, senderEmail: user.email || '',
           receiverId: inscrito.id, receiverEmail: '', 
           participants: [user.id, inscrito.id], participantEmails: [user.email || ''],
           text: actionText,
           createdAt: Timestamp.now(), read: false
         });
      }

      // 2. Publicar no Mural de Avisos (avisos_globais)
      const avisosPath = `artifacts/${APP_ID}/public/data/avisos_globais`;
      const docId = `aviso_cancelamento_${aula.id}_${Date.now()}`;
      await setDoc(doc(db, avisosPath, docId), {
        id: docId,
        titulo: `❌ AULA CANCELADA: ${aula.modalidade.toUpperCase()}`,
        mensagem: `Lamentamos informar que a aula de ${aula.modalidade} de ${diaNome} às ${aula.horaInicio} foi cancelada por motivos de força maior / motivos superiores. Pedimos as nossas sinceras desculpas pelo incómodo causado.`,
        professorId: user.id,
        nomeProfessor: user.nome || user.n || 'Professor',
        dataCriacao: Timestamp.now()
      });
      
      // 3. Não elimina a aula do horário, apenas marca como cancelada no Firestore
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/agenda`, aula.id), { cancelada: true });
      
      alert(`Aula cancelada com sucesso. Foram notificados ${inscritos.length} utentes via chat privado e publicado um aviso no Mural de Avisos.`);
    } catch (error) {
      console.error('Erro ao cancelar e notificar:', error);
      alert('Ocorreu um erro ao cancelar e notificar. Tente novamente.');
    }
  };

  const handleReactivate = async (aula: any) => {
    if (!user) return;
    const inscritos = aula.inscritos || [];
    if (!window.confirm(`Deseja reativar a aula de ${aula.modalidade}? (Serão notificados ${inscritos.length} utentes inscritos)`)) return;

    try {
      const diaNome = dias.find(d => d.id === aula.diaSemana)?.label || 'dia selecionado';
      const actionText = `✨ EXCELENTE NOTÍCIA: AULA REATIVADA! ✨\n\nEstimado(a) utente, informamos que a aula de ${aula.modalidade} agendada para ${diaNome} às ${aula.horaInicio} afinal IRÁ REALIZAR-SE normalmente.\n\nPedimos desculpa por qualquer transtorno anterior e contamos com a sua presença! 🏊‍♂️💙\n\nComplexo Desportivo Vila de Rei`;

      // 1. Enviar mensagens para todos os inscritos
      for (const inscrito of inscritos) {
         const chatId = [user.id, inscrito.id].sort().join('_');
         await addDoc(collection(db, `artifacts/${APP_ID}/public/data/conversas/${chatId}/messages`), {
           senderId: user.id, senderEmail: user.email || '',
           receiverId: inscrito.id, receiverEmail: '', 
           participants: [user.id, inscrito.id], participantEmails: [user.email || ''],
           text: actionText,
           createdAt: Timestamp.now(), read: false
         });
      }

      // 2. Publicar no Mural de Avisos (avisos_globais)
      const avisosPath = `artifacts/${APP_ID}/public/data/avisos_globais`;
      const docId = `aviso_reativacao_${aula.id}_${Date.now()}`;
      await setDoc(doc(db, avisosPath, docId), {
        id: docId,
        titulo: `✅ AULA REATIVADA: ${aula.modalidade.toUpperCase()}`,
        mensagem: `Informamos que a aula de ${aula.modalidade} de ${diaNome} às ${aula.horaInicio} afinal irá realizar-se normalmente. As inscrições voltaram a estar abertas. Contamos com a sua presença!`,
        professorId: user.id,
        nomeProfessor: user.nome || user.n || 'Professor',
        dataCriacao: Timestamp.now()
      });
      
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/agenda`, aula.id), { cancelada: false });
      
      alert(`Aula reativada com sucesso. Foram notificados ${inscritos.length} utentes via chat privado e publicado um aviso no Mural de Avisos.`);
    } catch (error) {
      console.error('Erro ao reativar aula:', error);
      alert('Ocorreu um erro ao reativar a aula. Tente novamente.');
    }
  };

  const toggleInscricao = async (aula: any) => {
    if (!user) return;
    const path = `artifacts/${APP_ID}/public/data/agenda`;
    const inscritos = aula.inscritos || [];
    const isEnrolled = inscritos.some((i: any) => i.id === user.id);
    
    if (!isEnrolled && aula.vagas && inscritos.length >= aula.vagas) {
      alert('Esta aula já está cheia!');
      return;
    }
    
    try {
      const newInscritos = isEnrolled 
        ? inscritos.filter((i: any) => i.id !== user.id)
        : [...inscritos, { id: user.id, nome: user.nome || user.n || 'Utente' }];
        
      await updateDoc(doc(db, path, aula.id), { inscritos: newInscritos });

      // Notificar professor automaticamente no chat
      if (aula.professor) {
        const prof = professors.find(p => (p.n || p.nome) === aula.professor);
        if (prof) {
          const chatId = [user.id, prof.id].sort().join('_');
          const actionText = !isEnrolled 
            ? `✅ [NOVA INSCRIÇÃO]: Olá, inscrevi-me na sua aula de ${aula.modalidade} das ${aula.horaInicio}.`
            : `❌ [CANCELAMENTO]: Olá, cancelei a minha inscrição na aula de ${aula.modalidade} das ${aula.horaInicio}.`;
          
          await addDoc(collection(db, `artifacts/${APP_ID}/public/data/conversas/${chatId}/messages`), {
            senderId: user.id, senderEmail: user.email || '',
            receiverId: prof.id, receiverEmail: prof.email || '',
            participants: [user.id, prof.id], participantEmails: [user.email || '', prof.email || ''],
            text: actionText,
            createdAt: Timestamp.now(), read: false
          }).catch(err => console.warn('Erro ao notificar prof:', err));
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'agenda');
    }
  };

  const openEditor = (aula?: Aula) => {
    if (!canEdit) return;
    if (aula) {
      setEditingAula({ ...aula });
      setIsAdding(false);
    } else {
      setEditingAula({
        id: '',
        modalidade: '',
        categoria: 'Escola de Natação',
        diaSemana: selectedDay,
        horaInicio: '09:00',
        horaFim: '10:00',
        professor: '',
        professor2: '',
        vagas: 20,
        sala: '',
        color: '#004D71'
      });
      setIsAdding(true);
    }
  };

  const filteredAulas = aulas.filter(a =>
    a.diaSemana === selectedDay &&
    a.categoria !== 'Piscina (Livre)' &&
    a.categoria !== 'Ginásio'
  );

  const clearAgenda = async () => {
    if (!window.confirm('AVISO: Isto irá eliminar TODAS as aulas agendadas. Tem a certeza?')) return;
    const path = `artifacts/${APP_ID}/public/data/agenda`;
    try {
      for (const aula of aulas) {
        await deleteDoc(doc(db, path, aula.id));
      }
      alert('Agenda limpa!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'agenda');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar snap-x px-1">
        {dias.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDay(d.id)}
            className={`flex-1 min-w-[80px] snap-center py-4 rounded-3xl border-4 transition-all active:scale-95 flex flex-col items-center gap-1 ${selectedDay === d.id ? 'bg-[#004D71] border-[#F7B500] text-[#F7B500] shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
          >
            <span className="text-[8px] font-black uppercase tracking-widest opacity-60">{d.short}</span>
            <span className="text-xs font-black uppercase tracking-tighter">{d.label}</span>
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="px-1 flex justify-end">
          <div className="inline-flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-slate-100 shadow-sm">
            <button
              onClick={clearAgenda}
              className="h-10 w-10 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center"
              title="Apagar Agenda"
            >
              <Trash2 size={16}/>
            </button>
            <button
              onClick={() => openEditor()}
              className="h-10 px-4 bg-[#004D71] text-[#F7B500] rounded-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={16}/>
              <span className="text-[10px] font-black uppercase">Nova Aula</span>
            </button>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
        {filteredAulas.map(aula => (
          <div 
            key={aula.id} 
            className={`bg-white rounded-[2.5rem] p-6 border-4 border-slate-100 shadow-sm relative overflow-hidden group hover:border-[#004D71]/10 transition-all flex flex-col justify-between ${aula.cancelada ? 'opacity-55 border-red-100/50 bg-slate-50/30' : ''}`}
          >
            <div className={`absolute top-0 left-0 w-2 h-full`} style={{ backgroundColor: aula.cancelada ? '#EF4444' : (aula.color || '#004D71') }} />
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <div className="px-3 py-1 bg-slate-50 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 w-fit">
                       {aula.categoria || 'Geral'}
                     </div>
                     {aula.cancelada && (
                       <span className="px-2.5 py-0.5 bg-red-50 text-red-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-red-100 animate-pulse">
                         Cancelada
                       </span>
                     )}
                   </div>
                   {aula.sala && (
                     <p className="text-[8px] font-black text-[#F7B500] uppercase ml-1">{aula.sala}</p>
                   )}
                </div>
                {canEdit && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditor(aula)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-[#004D71] transition-colors"><Edit2 size={12}/></button>
                    <button onClick={() => handleDelete(aula.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-[#F7B500]"/>
                  <span className="text-2xl font-black text-[#004D71] tabular-nums leading-none">{aula.horaInicio}</span>
                  <span className="text-sm font-black text-slate-400">—</span>
                  <span className="text-2xl font-black text-[#004D71] tabular-nums leading-none">{aula.horaFim}</span>
                </div>
                <h4 className="text-lg font-black text-[#004D71] uppercase leading-tight mt-2">{aula.modalidade}</h4>
              </div>

              <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#004D71]/5 flex items-center justify-center text-[#004D71]">
                       <GraduationCap size={16}/>
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-0.5">Professor</p>
                       <p className="text-[10px] font-black text-[#004D71] uppercase">{aula.professor || 'A Atribuir'}</p>
                       {aula.professor2 && <p className="text-[10px] font-black text-[#004D71]/70 uppercase">{aula.professor2}</p>}
                    </div>
                 </div>
                 <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Ocupação</p>
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-[10px] font-black text-[#F7B500] uppercase">{((aula as any).inscritos || []).length} / {aula.vagas || '---'}</p>
                        {aula.vagas > 0 && (
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full ${(((aula as any).inscritos || []).length / aula.vagas) >= 1 ? 'bg-red-500' : 'bg-[#F7B500]'}`} style={{ width: `${Math.min(100, (((aula as any).inscritos || []).length / aula.vagas) * 100)}%` }}/>
                          </div>
                        )}
                      </div>
                    </div>
                    {userRole === 'utente' && (
                      <button 
                        onClick={() => toggleInscricao(aula)}
                        disabled={aula.cancelada}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          aula.cancelada
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                            : ((aula as any).inscritos || []).some((i: any) => i.id === user?.id)
                            ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100' 
                            : 'bg-[#004D71] text-[#F7B500] active:scale-95 shadow-md'
                        }`}
                      >
                        {aula.cancelada ? 'Cancelada' : ((aula as any).inscritos || []).some((i: any) => i.id === user?.id) ? 'Cancelar' : 'Inscrever'}
                      </button>
                    )}
                 </div>
              </div>
              {canEdit && (
                <div className="flex justify-end gap-2 mt-3 w-full">
                  {((aula as any).inscritos && (aula as any).inscritos.length > 0) && (
                    <button 
                      onClick={() => { setViewingInscritos((aula as any).inscritos); setViewingAulaNome(aula.modalidade); }}
                      className="py-1.5 px-3 bg-slate-50 text-[8px] font-black text-[#004D71] uppercase rounded-lg hover:bg-slate-100 transition-colors border border-slate-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Users size={12}/> Ver {((aula as any).inscritos).length}
                    </button>
                  )}
                  {aula.cancelada ? (
                    <button 
                      onClick={() => handleReactivate(aula)}
                      className="py-1.5 px-3 bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus size={12}/> Reativar Aula
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleCancelAndNotify(aula)}
                      className="py-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 size={12}/> Cancelar & Notificar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredAulas.length === 0 && !loading && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center gap-4 animate-in zoom-in">
             <CalendarIcon size={48} className="text-slate-100" />
             <div className="space-y-1">
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                 {selectedDay === 7 ? 'Instalação Encerrada ao Domingo' : 'Sem aulas agendadas'}
               </p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {selectedDay === 7 ? 'Consulte os horários de Segunda a Sábado' : 'Adiciona uma aula com o botão +'}
               </p>
             </div>
             {selectedDay === 7 && (
               <button 
                 onClick={() => setSelectedDay(1)}
                 className="mt-4 px-6 py-3 bg-[#004D71] text-[#F7B500] rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
               >
                 Ver Segunda-Feira
               </button>
             )}
          </div>
        )}
      </div>

      {viewingInscritos && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[80vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setViewingInscritos(null)} className="absolute top-6 right-6 p-4 bg-slate-50 text-slate-400 rounded-full active:scale-90"><X size={20}/></button>
            <div className="mb-6 pr-10 text-left">
              <h3 className="text-xl font-black text-[#004D71] uppercase">{viewingAulaNome}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lista de Inscritos</p>
            </div>
            <div className="space-y-2">
              {viewingInscritos.map((inscrito: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#004D71] font-black text-xs shadow-sm border border-slate-100 shrink-0">
                    {idx + 1}
                  </div>
                  <p className="font-black text-sm text-[#004D71] uppercase truncate">{inscrito.nome}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingAula && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto custom-scrollbar">
             <button onClick={() => setEditingAula(null)} className="absolute top-6 right-6 p-4 bg-slate-50 text-slate-400 rounded-full active:scale-90"><X size={20}/></button>
             
             <div className="mb-8 text-left">
               <h3 className="text-xl font-black text-[#004D71] uppercase">{isAdding ? 'Nova Aula' : 'Editar Aula'}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração da atividade</p>
             </div>

             <form onSubmit={handleSave} className="space-y-4">
               <div className="space-y-2 text-left">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Categoria</label>
                 <select 
                   value={editingAula.categoria}
                   onChange={e => setEditingAula({...editingAula, categoria: e.target.value})}
                   className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none appearance-none"
                 >
                   <option value="Escola de Natação">Escola de Natação</option>
                   <option value="Aulas Fitness">Aulas Fitness</option>
                   <option value="Hidroginástica">Hidroginástica</option>
                   <option value="Bebés / AMA">Bebés / AMA</option>
                 </select>
               </div>

               <div className="space-y-2 text-left">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Modalidade</label>
                 <input 
                   required
                   value={editingAula.modalidade}
                   onChange={e => setEditingAula({...editingAula, modalidade: e.target.value})}
                   className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20"
                   placeholder="Ex: Hidroginástica"
                 />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2 text-left">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Hora Início</label>
                   <input 
                     type="time"
                     required
                     value={editingAula.horaInicio}
                     onChange={e => setEditingAula({...editingAula, horaInicio: e.target.value})}
                     className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20"
                   />
                 </div>
                 <div className="space-y-2 text-left">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Hora Fim</label>
                   <input 
                     type="time"
                     required
                     value={editingAula.horaFim}
                     onChange={e => setEditingAula({...editingAula, horaFim: e.target.value})}
                     className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Dia da Semana</label>
                    <select 
                      value={editingAula.diaSemana}
                      onChange={e => setEditingAula({...editingAula, diaSemana: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none appearance-none"
                    >
                      {dias.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Vagas</label>
                    <input 
                      type="number"
                      value={editingAula.vagas}
                      onChange={e => setEditingAula({...editingAula, vagas: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-3">
                 <div className="space-y-2 text-left">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Professor 1</label>
                   {professors.length > 0 ? (
                     <select
                       value={editingAula.professor || ''}
                       onChange={e => setEditingAula({...editingAula, professor: e.target.value})}
                       className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none appearance-none"
                     >
                       <option value="">— Selecionar —</option>
                       {professors.map(p => (
                         <option key={p.id} value={p.n || p.nome}>{p.n || p.nome}</option>
                       ))}
                       <option value="A Atribuir">A Atribuir</option>
                     </select>
                   ) : (
                     <input
                       value={editingAula.professor || ''}
                       onChange={e => setEditingAula({...editingAula, professor: e.target.value})}
                       className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                       placeholder="Nome do professor"
                     />
                   )}
                 </div>
                 <div className="space-y-2 text-left">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Professor 2 <span className="text-slate-300">(opcional)</span></label>
                   {professors.length > 0 ? (
                     <select
                       value={editingAula.professor2 || ''}
                       onChange={e => setEditingAula({...editingAula, professor2: e.target.value})}
                       className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none appearance-none"
                     >
                       <option value="">— Nenhum —</option>
                       {professors.map(p => (
                         <option key={p.id} value={p.n || p.nome}>{p.n || p.nome}</option>
                       ))}
                     </select>
                   ) : (
                     <input
                       value={editingAula.professor2 || ''}
                       onChange={e => setEditingAula({...editingAula, professor2: e.target.value})}
                       className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                       placeholder="Nome do 2º professor (opcional)"
                     />
                   )}
                 </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Cor</label>
                    <input 
                      type="color"
                      value={editingAula.color}
                      onChange={e => setEditingAula({...editingAula, color: e.target.value})}
                      className="w-full h-14 bg-slate-50 border-4 border-slate-50 rounded-2xl px-2 py-1 outline-none cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Sala / Local</label>
                    <input 
                      value={editingAula.sala || ''}
                      onChange={e => setEditingAula({...editingAula, sala: e.target.value})}
                      className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                      placeholder="Ex: Piscina Coberta"
                    />
                  </div>
               </div>

               <div className="pt-6">
                 <button
                   type="submit"
                   disabled={saving}
                   className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Save size={18}/> {saving ? 'A Guardar...' : 'Salvar Aula'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {activeHorarioImg && (
        <div className="fixed inset-0 z-[20000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setActiveHorarioImg(null)}>
          <div className="relative max-w-5xl w-full bg-white rounded-[2rem] p-4 shadow-2xl animate-in zoom-in" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActiveHorarioImg(null)}
              className="absolute top-4 right-4 p-3 bg-white text-slate-800 rounded-full shadow-lg active:scale-95 z-50 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>
            <div className="w-full max-h-[85vh] overflow-auto rounded-xl flex items-center justify-center bg-slate-50">
              <img src={activeHorarioImg} alt="Horário Oficial" className="w-full h-auto object-contain max-h-[80vh]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
