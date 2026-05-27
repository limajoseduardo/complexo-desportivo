import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Trash2, X, Save, Clock, Check, FileText, Search, UserMinus, UserPlus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { 
  collection, onSnapshot, query, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, Timestamp 
} from 'firebase/firestore';
import { UserProfile } from '../types';

interface Evento {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  local: string;
  descricao: string;
  maxParticipantes?: number;
  inscritos: { id: string; nome: string; email: string; dataInscricao: string }[];
  criadoPor: string;
  criadoEm: any;
}

interface EventsModuleProps {
  user: UserProfile;
  utentes: UserProfile[];
}

export function EventsModule({ user, utentes }: EventsModuleProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingInscritos, setViewingInscritos] = useState<Evento | null>(null);
  
  // Search for adding participants manually
  const [searchUtente, setSearchUtente] = useState('');
  
  const [formData, setFormData] = useState({
    titulo: '',
    data: '',
    hora: '',
    local: 'Piscina Coberta',
    descricao: '',
    maxParticipantes: ''
  });

  const isStaff = ['admin', 'staff', 'chefia', 'professor'].includes(user.role);
  const isProfessor = user.role === 'professor';

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const q = query(collection(db, path), orderBy('data', 'asc'));
    
    return onSnapshot(q, (snap) => {
      const list: Evento[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Evento);
      });
      setEventos(list);
      
      // Update viewingInscritos if it's currently open
      if (viewingInscritos) {
        const updated = list.find(e => e.id === viewingInscritos.id);
        if (updated) {
          setViewingInscritos(updated);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Erro ao sincronizar eventos:", error);
      setLoading(false);
    });
  }, [viewingInscritos?.id]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data || !formData.hora || !formData.local) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const path = `artifacts/${APP_ID}/public/data/eventos`;
      const newEvent = {
        titulo: formData.titulo,
        data: formData.data,
        hora: formData.hora,
        local: formData.local,
        descricao: formData.descricao,
        maxParticipantes: formData.maxParticipantes ? Number(formData.maxParticipantes) : undefined,
        inscritos: [],
        criadoPor: user.nome || user.n || 'Staff',
        criadoEm: Timestamp.now()
      };

      await addDoc(collection(db, path), newEvent);
      alert("Evento de natação/prova criado com sucesso!");
      setShowAddModal(false);
      setFormData({
        titulo: '',
        data: '',
        hora: '',
        local: 'Piscina Coberta',
        descricao: '',
        maxParticipantes: ''
      });
    } catch (error) {
      console.error("Erro ao criar evento:", error);
      alert("Erro ao criar o evento. Tente novamente.");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Tem a certeza que deseja eliminar esta prova/evento permanente?")) return;
    try {
      const path = `artifacts/${APP_ID}/public/data/eventos`;
      await deleteDoc(doc(db, path, eventId));
      alert("Evento eliminado.");
    } catch (error) {
      console.error("Erro ao apagar evento:", error);
    }
  };

  const handleToggleRegistration = async (evento: Evento) => {
    const isRegistered = evento.inscritos.some(i => i.id === user.id);
    const path = `artifacts/${APP_ID}/public/data/eventos`;

    let newInscritos = [...evento.inscritos];

    if (isRegistered) {
      if (!window.confirm("Tem a certeza que deseja cancelar a sua inscrição neste evento?")) return;
      newInscritos = newInscritos.filter(i => i.id !== user.id);
    } else {
      if (evento.maxParticipantes && evento.inscritos.length >= evento.maxParticipantes) {
        alert("Desculpe, as inscrições para esta prova já atingiram o limite máximo!");
        return;
      }
      newInscritos.push({
        id: user.id,
        nome: user.nome || user.n || 'Utente',
        email: user.email,
        dataInscricao: new Date().toISOString()
      });
    }

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      alert(isRegistered ? "Inscrição cancelada com sucesso." : "Inscrição realizada com sucesso! Boa sorte para a prova.");
    } catch (error) {
      console.error("Erro ao atualizar inscrição:", error);
      alert("Ocorreu um erro ao processar a inscrição.");
    }
  };

  // Staff Manually Adds Participant
  const handleAddParticipant = async (evento: Evento, utente: UserProfile) => {
    if (evento.inscritos.some(i => i.id === utente.id)) {
      alert("Este utente já se encontra inscrito neste evento!");
      return;
    }

    if (evento.maxParticipantes && evento.inscritos.length >= evento.maxParticipantes) {
      if (!window.confirm("O limite de inscrições já foi atingido. Deseja inscrever mesmo assim?")) return;
    }

    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const newInscritos = [
      ...evento.inscritos,
      {
        id: utente.id,
        nome: utente.nome || utente.n || 'Utente',
        email: utente.email,
        dataInscricao: new Date().toISOString()
      }
    ];

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      setSearchUtente(''); // Clear search
    } catch (error) {
      console.error("Erro ao adicionar participante:", error);
      alert("Erro ao adicionar participante.");
    }
  };

  // Staff Manually Removes Participant
  const handleRemoveParticipant = async (evento: Evento, participantId: string, participantNome: string) => {
    if (!window.confirm(`Tem a certeza que deseja remover ${participantNome.toUpperCase()} desta prova?`)) return;

    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const newInscritos = evento.inscritos.filter(i => i.id !== participantId);

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
    } catch (error) {
      console.error("Erro ao remover participante:", error);
      alert("Erro ao remover participante.");
    }
  };

  // Filter utentes who are NOT enrolled and match search query
  const searchableUtentes = React.useMemo(() => {
    if (!viewingInscritos || !searchUtente.trim()) return [];
    
    // Filter only those who have 'utente' role or no staff roles, and match search
    return utentes
      .filter(u => {
        const r = (u.role || '').toLowerCase();
        return !['admin', 'staff', 'chefia', 'professor'].includes(r);
      })
      .filter(u => !viewingInscritos.inscritos.some(i => i.id === u.id))
      .filter(u => (u.nome || u.n || '').toLowerCase().includes(searchUtente.toLowerCase()))
      .slice(0, 5); // Limit to top 5 results for clean display
  }, [utentes, viewingInscritos, searchUtente]);

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Trophy size={28} className="text-[#F7B500]"/> Provas e Eventos
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão de Provas de Natação e Atividades CD</p>
        </div>
        {['admin', 'staff', 'chefia'].includes(user.role) && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#004D71] text-[#F7B500] p-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={20}/>
            <span className="text-[10px] font-black uppercase hidden sm:inline">Criar Prova</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#004D71] font-black text-xs uppercase animate-pulse">A carregar eventos...</div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border-4 border-[#004D71]/5 text-center py-20 text-slate-200">
          <Trophy size={64} className="mx-auto mb-4 opacity-10" />
          <p className="uppercase font-black text-xs tracking-widest text-slate-400">Sem eventos ou provas planeadas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
          {eventos.map(evento => {
            const isRegistered = evento.inscritos.some(i => i.id === user.id);
            const isFull = evento.maxParticipantes ? evento.inscritos.length >= evento.maxParticipantes : false;

            return (
              <div 
                key={evento.id} 
                className="bg-white rounded-[2.5rem] p-6 border-4 border-slate-100 shadow-sm relative overflow-hidden group hover:border-[#004D71]/10 transition-all flex flex-col justify-between"
              >
                {/* Delete button for Admin/Staff */}
                {['admin', 'staff'].includes(user.role) && (
                  <button 
                    onClick={() => handleDeleteEvent(evento.id)}
                    className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                    title="Eliminar Evento"
                  >
                    <Trash2 size={14}/>
                  </button>
                )}

                <div>
                  {/* Date Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#004D71]/5 text-[#004D71] rounded-full text-[9px] font-black uppercase tracking-wider mb-4">
                    <Calendar size={10}/> {evento.data} ás {evento.hora}
                  </div>

                  <h3 className="text-base font-black text-[#004D71] uppercase leading-tight tracking-tight mb-2 pr-6">
                    {evento.titulo}
                  </h3>

                  <p className="text-xs font-bold text-slate-500 mb-4 line-clamp-3">
                    {evento.descricao || 'Sem descrição detalhada.'}
                  </p>

                  <div className="space-y-2 text-xs font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-[#F7B500]"/>
                      <span className="text-[10px] text-slate-600 font-bold">{evento.local}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-[#004D71]"/>
                      <span className="text-[10px] text-slate-600 font-bold">
                        Inscritos: {evento.inscritos.length} 
                        {evento.maxParticipantes ? ` / ${evento.maxParticipantes} max.` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2">
                  {/* Action button for Utente */}
                  {user.role === 'utente' && (
                    <button
                      onClick={() => handleToggleRegistration(evento)}
                      className={`flex-1 py-3 px-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${
                        isRegistered 
                          ? 'bg-green-50 text-green-600 border-2 border-green-200 hover:bg-green-100' 
                          : isFull 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-[#004D71] text-[#F7B500] hover:bg-[#004C70]/90 shadow-md'
                      }`}
                      disabled={!isRegistered && isFull}
                    >
                      {isRegistered ? (
                        <>
                          <Check size={12}/> Inscrito
                        </>
                      ) : isFull ? (
                        'Esgotado'
                      ) : (
                        'Inscrever-me'
                      )}
                    </button>
                  )}

                  {/* View/Manage participants button for Staff/Professores */}
                  {isStaff && (
                    <button
                      onClick={() => { setViewingInscritos(evento); setSearchUtente(''); }}
                      className="flex-1 py-3 px-4 bg-slate-50 border-2 border-slate-100 text-[#004D71] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Users size={12}/> Gerir Inscritos ({evento.inscritos.length})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR EVENTO */}
      {showAddModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="mb-6 text-left">
              <h3 className="text-xl font-black text-[#004D71] uppercase flex items-center gap-2">
                <Trophy className="text-[#F7B500]"/> Criar Novo Evento / Prova
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Publique uma prova para receber inscrições</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Título do Evento / Prova</label>
                <input 
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={e => setFormData({...formData, titulo: e.target.value})}
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all"
                  placeholder="Ex: Torneio de Natação Vila de Rei"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Data</label>
                  <input 
                    type="date"
                    required
                    value={formData.data}
                    onChange={e => setFormData({...formData, data: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Hora de Início</label>
                  <input 
                    type="time"
                    required
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Local</label>
                  <input 
                    type="text"
                    required
                    value={formData.local}
                    onChange={e => setFormData({...formData, local: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                    placeholder="Ex: Piscina Coberta"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Limite de Participantes (Opcional)</label>
                  <input 
                    type="number"
                    value={formData.maxParticipantes}
                    onChange={e => setFormData({...formData, maxParticipantes: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                    placeholder="Ex: 50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Descrição / Regulamento</label>
                <textarea 
                  value={formData.descricao}
                  onChange={e => setFormData({...formData, descricao: e.target.value})}
                  rows={4}
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none min-h-[100px]"
                  placeholder="Informações adicionais sobre as distâncias, escalões ou prémios..."
                />
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Save size={18}/> Publicar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER/GERIR INSCRITOS */}
      {viewingInscritos && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] flex flex-col justify-between">
            <button 
              onClick={() => setViewingInscritos(null)}
              className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="mb-4 text-left border-b pb-4 shrink-0">
              <h3 className="text-lg font-black text-[#004D71] uppercase leading-tight">
                Gerir Inscritos na Prova
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {viewingInscritos.titulo}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[9px] font-black uppercase tracking-wider">
                Total: {viewingInscritos.inscritos.length} Participantes
              </div>
            </div>

            {/* Staff-only section: Dynamic search to add participant */}
            {isStaff && (
              <div className="mb-4 space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 relative shrink-0">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Inscrever Utente Manualmente</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={searchUtente}
                    onChange={e => setSearchUtente(e.target.value)}
                    placeholder="PROCURAR UTENTE PELO NOME..."
                    className="w-full bg-white border border-slate-200 p-3 pl-10 rounded-xl font-black text-[9px] uppercase tracking-wider outline-none focus:border-[#004D71]/40"
                  />
                </div>

                {/* Dropdown Search Results */}
                {searchableUtentes.length > 0 && (
                  <div className="absolute left-4 right-4 bg-white border border-slate-200 rounded-2xl shadow-xl z-[10001] max-h-[200px] overflow-y-auto mt-1 overflow-hidden divide-y">
                    {searchableUtentes.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAddParticipant(viewingInscritos, u)}
                        className="w-full p-3 text-left hover:bg-slate-50 active:bg-blue-50 transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-black text-[10px] text-[#004D71] uppercase leading-none">{u.nome || u.n}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5">{u.email}</p>
                        </div>
                        <UserPlus size={14} className="text-[#004D71]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Enrolled Participants List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar my-2">
              {viewingInscritos.inscritos.length === 0 ? (
                <div className="text-center py-12 text-slate-300 font-black uppercase text-[10px] tracking-widest">
                  Nenhuma inscrição realizada até ao momento.
                </div>
              ) : (
                viewingInscritos.inscritos.map((inscrito, idx) => (
                  <div 
                    key={inscrito.id} 
                    className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-[#004D71] text-[#F7B500] font-black text-[9px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-black text-xs text-[#004D71] uppercase leading-none">{inscrito.nome}</h4>
                      </div>
                      <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-widest line-clamp-1">{inscrito.email}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-slate-400 bg-white border px-2 py-1 rounded-full shadow-sm hidden sm:inline">
                        {new Date(inscrito.dataInscricao).toLocaleDateString('pt-PT')}
                      </span>
                      {isStaff && (
                        <button
                          onClick={() => handleRemoveParticipant(viewingInscritos, inscrito.id, inscrito.nome)}
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 active:scale-95 transition-all"
                          title="Remover Participante"
                        >
                          <UserMinus size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => setViewingInscritos(null)}
                className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
