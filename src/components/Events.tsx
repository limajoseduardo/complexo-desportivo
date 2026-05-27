import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Trash2, X, Save, Clock, Check, FileText, Search, UserMinus, UserPlus, Award, GraduationCap, Edit } from 'lucide-react';
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
  inscritos: { id: string; nome: string; email: string; dataInscricao: string; provas: string[] }[];
  professoresAcompanhantes?: string[]; // Up to 5 teachers
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

  // Styles selection state modal
  const [selectingStyles, setSelectingStyles] = useState<{
    evento: Evento;
    utenteId: string;
    utenteNome: string;
    utenteEmail: string;
    isStaffAction: boolean;
  } | null>(null);

  const [selectedProvas, setSelectedProvas] = useState<Record<string, boolean>>({
    Crawl: false,
    Costas: false,
    Bruços: false,
    Mariposa: false
  });
  
  const [formData, setFormData] = useState({
    titulo: '',
    data: '',
    hora: '',
    local: 'Piscina Municipal de Vila de Rei',
    descricao: '',
    maxParticipantes: ''
  });

  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  const isStaff = ['admin', 'staff', 'chefia', 'professor'].includes(user.role);

  const ESTILOS = ['Crawl', 'Costas', 'Bruços', 'Mariposa'];

  // Vibrant, distinct colors for each style
  const STYLE_COLORS: Record<string, string> = {
    Crawl: 'bg-blue-100 text-blue-800 border-blue-200',
    Costas: 'bg-purple-100 text-purple-800 border-purple-200',
    Bruços: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Mariposa: 'bg-rose-100 text-rose-800 border-rose-200'
  };

  const professorsList = React.useMemo(() => {
    return utentes.filter(u => u.role === 'professor');
  }, [utentes]);

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
        professoresAcompanhantes: selectedTeachers,
        criadoPor: user.nome || user.n || 'Staff',
        criadoEm: Timestamp.now()
      };

      await addDoc(collection(db, path), newEvent);
      alert("Evento/Prova criada com sucesso!");
      setShowAddModal(false);
      setFormData({
        titulo: '',
        data: '',
        hora: '',
        local: 'Piscina Municipal de Vila de Rei',
        descricao: '',
        maxParticipantes: ''
      });
      setSelectedTeachers([]);
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

  // Triggers the styles selection overlay (can be used for new registrations or edits)
  const initiateRegistration = (evento: Evento, isStaffAction: boolean, targetUtente?: UserProfile | { id: string; nome: string; email: string; provas?: string[] }) => {
    const participantId = targetUtente ? targetUtente.id : user.id;
    const participantNome = targetUtente ? (targetUtente.nome || (targetUtente as any).n || 'Utente') : (user.nome || user.n || 'Utente');
    const participantEmail = targetUtente ? targetUtente.email : user.email;
    
    const existingEnrollment = evento.inscritos.find(i => i.id === participantId);

    // Set styling target
    setSelectingStyles({
      evento,
      utenteId: participantId,
      utenteNome: participantNome,
      utenteEmail: participantEmail || '',
      isStaffAction
    });

    // Preset selections if they already have styles chosen
    setSelectedProvas({
      Crawl: existingEnrollment?.provas?.includes('Crawl') || false,
      Costas: existingEnrollment?.provas?.includes('Costas') || false,
      Bruços: existingEnrollment?.provas?.includes('Bruços') || false,
      Mariposa: existingEnrollment?.provas?.includes('Mariposa') || false
    });
  };

  const handleToggleUnsubscribe = async (evento: Evento, participantId: string, participantNome: string) => {
    if (!window.confirm(`Tem a certeza que deseja cancelar a inscrição de ${participantNome.toUpperCase()} nesta prova?`)) return;

    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const newInscritos = evento.inscritos.filter(i => i.id !== participantId);

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      alert("Inscrição cancelada.");
    } catch (error) {
      console.error("Erro ao remover participante:", error);
    }
  };

  // Submit Styles selection to Firestore
  const handleConfirmStyles = async () => {
    if (!selectingStyles) return;

    const chosenStyles = Object.keys(selectedProvas).filter(key => selectedProvas[key]);
    if (chosenStyles.length === 0) {
      alert("Por favor, selecione pelo menos 1 estilo de natação em que o atleta irá participar.");
      return;
    }

    const { evento, utenteId, utenteNome, utenteEmail } = selectingStyles;
    const path = `artifacts/${APP_ID}/public/data/eventos`;

    const newInscritos = [
      ...evento.inscritos.filter(i => i.id !== utenteId),
      {
        id: utenteId,
        nome: utenteNome,
        email: utenteEmail,
        dataInscricao: new Date().toISOString(),
        provas: chosenStyles
      }
    ];

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      alert(`Inscrição de "${utenteNome.toUpperCase()}" guardada com sucesso.`);
      setSelectingStyles(null);
      setSearchUtente('');
    } catch (error) {
      console.error("Erro ao guardar inscrição com provas:", error);
      alert("Ocorreu um erro ao guardar a inscrição.");
    }
  };

  const handleTeacherCheckboxChange = (teacherName: string) => {
    setSelectedTeachers(prev => {
      if (prev.includes(teacherName)) {
        return prev.filter(t => t !== teacherName);
      }
      if (prev.length >= 5) {
        alert("Pode selecionar no máximo 5 professores acompanhantes!");
        return prev;
      }
      return [...prev, teacherName];
    });
  };

  // Filter utentes who are NOT enrolled and match search query
  const searchableUtentes = React.useMemo(() => {
    if (!viewingInscritos || !searchUtente.trim()) return [];
    
    return utentes
      .filter(u => {
        const r = (u.role || '').toLowerCase();
        return !['admin', 'staff', 'chefia', 'professor'].includes(r);
      })
      .filter(u => !viewingInscritos.inscritos.some(i => i.id === u.id))
      .filter(u => (u.nome || u.n || '').toLowerCase().includes(searchUtente.toLowerCase()))
      .slice(0, 5);
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
            onClick={() => { setShowAddModal(true); setSelectedTeachers([]); }}
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

                    {/* Accompanying teachers list display */}
                    {evento.professoresAcompanhantes && evento.professoresAcompanhantes.length > 0 && (
                      <div className="flex items-start gap-2">
                        <GraduationCap size={12} className="text-[#004D71] shrink-0 mt-0.5"/>
                        <div className="text-[10px] text-slate-600 font-bold">
                          Acompanhantes: <span className="text-[#004D71] font-black">{evento.professoresAcompanhantes.join(', ')}</span>
                        </div>
                      </div>
                    )}

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
                      onClick={() => initiateRegistration(evento, false)}
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
                    placeholder="Ex: Piscina Municipal de Vila de Rei"
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

              {/* Accompanying teachers selector (Up to 5) */}
              {professorsList.length > 0 && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block">Professores / Treinadores Acompanhantes (Máx. 5)</label>
                  <p className="text-[7px] font-bold text-slate-400 uppercase ml-1 tracking-wider mb-2">Quem irá acompanhar os atletas na prova</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {professorsList.map(prof => {
                      const name = prof.nome || prof.n || '';
                      const isChecked = selectedTeachers.includes(name);
                      return (
                        <label 
                          key={prof.id}
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-black uppercase text-[#004D71] hover:border-[#004D71]/20 select-none"
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTeacherCheckboxChange(name)}
                            className="w-4 h-4 accent-[#004D71] rounded"
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        onClick={() => initiateRegistration(viewingInscritos, true, u)}
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
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar my-2">
              {viewingInscritos.inscritos.length === 0 ? (
                <div className="text-center py-12 text-slate-300 font-black uppercase text-[10px] tracking-widest">
                  Nenhuma inscrição realizada até ao momento.
                </div>
              ) : (
                viewingInscritos.inscritos.map((inscrito, idx) => (
                  <div 
                    key={inscrito.id} 
                    className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col justify-between text-left gap-3 shadow-sm"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-xl bg-[#004D71] text-[#F7B500] font-black text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="font-black text-sm text-[#004D71] uppercase leading-none">{inscrito.nome}</h4>
                        </div>
                        <p className="text-[9px] font-black text-slate-400 mt-2.5 ml-8 uppercase tracking-widest line-clamp-1">{inscrito.email}</p>
                      </div>

                      {/* Controls for editing styles / removing */}
                      {isStaff && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => initiateRegistration(viewingInscritos, true, inscrito)}
                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-95 transition-all border border-blue-100 flex items-center justify-center"
                            title="Editar Estilos"
                          >
                            <Edit size={14}/>
                          </button>
                          <button
                            onClick={() => handleToggleUnsubscribe(viewingInscritos, inscrito.id, inscrito.nome)}
                            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 active:scale-95 transition-all border border-red-100 flex items-center justify-center"
                            title="Remover Participante"
                          >
                            <UserMinus size={14}/>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* LARGER, CLEARLY COLOR-CODED SWIMMING STYLES BADGES */}
                    {inscrito.provas && inscrito.provas.length > 0 && (
                      <div className="flex flex-wrap gap-2 ml-8 border-t border-slate-200/60 pt-3">
                        {inscrito.provas.map(p => (
                          <span 
                            key={p} 
                            className={`px-3.5 py-1.5 border rounded-xl font-black uppercase text-[9px] tracking-wider flex items-center gap-1.5 shadow-sm ${STYLE_COLORS[p] || 'bg-slate-100 text-slate-700'}`}
                          >
                            <Award size={10} className="shrink-0"/> {p}
                          </span>
                        ))}
                      </div>
                    )}
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

      {/* OVERLAY MODAL: SELECIONAR ESTILOS (CRAWL, COSTAS, BRUÇOS, MARIPOSA) */}
      {selectingStyles && (
        <div className="fixed inset-0 z-[20002] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative text-left">
            <button 
              onClick={() => setSelectingStyles(null)}
              className="absolute top-4 right-4 p-2.5 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={16}/>
            </button>

            <div className="mb-6">
              <h3 className="text-base font-black text-[#004D71] uppercase leading-tight">
                Selecionar Estilos
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Atleta: {selectingStyles.utenteNome}
              </p>
            </div>

            <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Selecione uma ou mais modalidades:</p>
              {ESTILOS.map(estilo => (
                <label 
                  key={estilo} 
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#004D71]/20 active:scale-[0.99] transition-all select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedProvas[estilo]}
                    onChange={() => setSelectedProvas(prev => ({ ...prev, [estilo]: !prev[estilo] }))}
                    className="w-4.5 h-4.5 accent-[#004D71] rounded-md cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#004D71] uppercase tracking-wider">{estilo}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectingStyles(null)}
                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors border"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStyles}
                className="flex-1 py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#004D71]/90 shadow-md transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
