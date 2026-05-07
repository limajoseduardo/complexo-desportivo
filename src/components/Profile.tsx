import React, { useState, useRef, useEffect } from 'react';
import { 
  User, LogOut, Camera, Info, GraduationCap, Award, Clock, Star, 
  Phone, Mail, FileText, ArrowLeft, Briefcase, Trophy, Target, 
  AlertCircle, MapPin, Activity, LogIn, Calendar, TrendingUp, History, Dumbbell, Shield
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UserProfile, HealthMetric } from '../types';
import { CVCard, FormInput, PicotoIcon, AvatarImage } from './Common';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp, serverTimestamp, onSnapshot } from 'firebase/firestore';

import { handleCheckIn, handleCheckOut } from '../lib/access';

export function ProfileViewModule({ user, onLogout, setUser, isExternalView = false, currentRole = 'utente' }: { user: UserProfile, onLogout: () => void, setUser?: (u: UserProfile) => void, isExternalView?: boolean, currentRole?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile & { password?: string }>({ ...user });
  const [saving, setSaving] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'saude' | 'atividade' | 'treino'>('geral');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [plan, setPlan] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep state in sync with external user changes
  useEffect(() => {
    if (!isEditing) {
      setFormData({ ...user });
    }
  }, [user.id, user.updatedAt, isEditing, user.isInside, user.location]);

  // Fetch metrics, logs and training plan
  useEffect(() => {
    if (!user.id) return;
    
    // Fetch Health Metrics
    const saudePath = `artifacts/${APP_ID}/public/data/saude`;
    const qSaude = query(collection(db, saudePath), where('userId', '==', user.id), limit(20));
    const unsubSaude = onSnapshot(qSaude, (snap) => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<HealthMetric, 'id'>) }))
        .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
      setMetrics(sorted as HealthMetric[]);
    }, (error) => {
      console.warn('Erro ao carregar métricas de saúde:', error.message);
    });

    // Fetch Access Logs
    const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const qLogs = query(collection(db, logsPath), where('userId', '==', user.id), orderBy('checkIn', 'desc'), limit(10));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Training Plan
    if (user.role === 'utente') {
       const treinosPath = `artifacts/${APP_ID}/public/data/treinos`;
       const unsubPlan = onSnapshot(query(collection(db, treinosPath), where('userId', '==', user.id)), (snap) => {
         if (!snap.empty) {
           setPlan({ id: snap.docs[0].id, ...snap.docs[0].data() });
         } else {
           setPlan(null);
         }
       });
       return () => { unsubSaude(); unsubLogs(); unsubPlan(); };
    }

    return () => { unsubSaude(); unsubLogs(); };
  }, [user.id, user.role]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const usersPath = `artifacts/${APP_ID}/public/data/users`;
      const userRef = doc(db, usersPath, formData.id);
      
      const { id, role, email, ...rest } = formData;
      const updateData = {
        ...rest,
        role,
        email,
        nome: formData.nome || formData.n || '',
        n: formData.nome || formData.n || '',
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updateData);
      
      if (setUser) {
        setUser({ ...formData, ...updateData });
      }
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${formData.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAccessAction = async (action: 'IN' | 'OUT', zone: string = 'Geral') => {
    setAccessLoading(true);
    try {
      if (action === 'IN') {
        const checkInLocation = zone === 'C. Desportivo' ? (user.modalidade || 'Ginásio') : zone;
        await handleCheckIn(user, checkInLocation);
      } else {
        await handleCheckOut(user);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `access/${user.id}`);
    } finally {
      setAccessLoading(false);
    }
  };

  const [durationText, setDurationText] = useState('');

  useEffect(() => {
    if (!user.isInside || !user.updatedAt) {
      setDurationText('');
      return;
    }

    const update = () => {
      const start = new Date(user.updatedAt!).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 60000);
      if (diff < 1) setDurationText('Acabou de entrar');
      else if (diff < 60) setDurationText(`${diff} min`);
      else setDurationText(`${Math.floor(diff / 60)}h ${diff % 60}m`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [user.isInside, user.updatedAt]);

  const currentWeight = metrics.filter(m => m.type === 'peso').slice(-1)[0]?.value || '--';
  const currentGly = metrics.filter(m => m.type === 'glicemia').slice(-1)[0]?.value || '--';

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 text-left px-2 pb-24 max-w-4xl mx-auto print:p-0 print:m-0 print:max-w-none">

      {/* ID CARD */}
      <div className="bg-[#004D71] rounded-[2.5rem] shadow-2xl overflow-hidden relative print:rounded-none">
        {/* Card top row: back + actions */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 print:hidden">
          <div className="flex items-center gap-2">
            {isExternalView && (
              <button onClick={onLogout} className="flex items-center gap-2 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
                <ArrowLeft size={16}/> Voltar
              </button>
            )}
            {user.isInside && durationText && (
              <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[9px] font-black uppercase border border-emerald-400/20">
                <Clock size={11} className="animate-pulse"/> {durationText}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {['admin', 'staff', 'chefia', 'professor'].includes(currentRole || '') && (
              !user.isInside ? (
                <button onClick={() => handleAccessAction('IN', 'C. Desportivo')} disabled={accessLoading}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-lg">
                  {accessLoading ? <Activity className="animate-spin" size={12}/> : <LogIn size={12}/>} Entrada
                </button>
              ) : (
                <button onClick={() => handleAccessAction('OUT')} disabled={accessLoading}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-lg">
                  {accessLoading ? <Activity className="animate-spin" size={12}/> : <LogOut size={12}/>} Saída
                </button>
              )
            )}
            {(!isExternalView || currentRole === 'admin') && (
              <button onClick={() => isEditing ? save() : setIsEditing(true)} disabled={saving}
                className="bg-[#F7B500] text-[#004D71] px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-lg">
                {saving ? '...' : (isEditing ? <><FileText size={12}/> Gravar</> : <><Camera size={12}/> Editar</>)}
              </button>
            )}
            <button onClick={() => window.print()}
              className="bg-white/10 text-white/70 p-2 rounded-xl hover:bg-white/20 transition-colors active:scale-90">
              <FileText size={16}/>
            </button>
            {!isExternalView && (
              <button onClick={onLogout} className="bg-red-50 text-red-600 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 border border-red-100 active:scale-95 shadow-sm text-nowrap"><LogOut size={16}/> Sair</button>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-0">
          {/* Photo side */}
          <div className="flex flex-col items-center justify-center px-8 py-6 sm:border-r border-white/10 shrink-0">
            <div className="relative">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] overflow-hidden border-4 border-[#F7B500] shadow-2xl bg-white">
                <AvatarImage
                  src={formData.img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
                {isEditing && (
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white backdrop-blur-sm rounded-[2rem]">
                    <Camera size={22}/>
                  </button>
                )}
              </div>
              {user.isInside && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-400 text-white p-2 rounded-xl shadow-lg border-2 border-[#004D71]">
                  <MapPin size={14}/>
                </div>
              )}
            </div>
            <div className="mt-3 text-center">
              <p className="text-[8px] font-black text-[#F7B500]/60 uppercase tracking-widest">ID</p>
              <p className="text-[11px] font-black text-[#F7B500] font-mono tracking-widest">#{user.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* Info side */}
          <div className="flex-1 px-6 sm:px-8 py-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <PicotoIcon size={18} className="text-[#F7B500] opacity-60 shrink-0"/>
                <p className="text-[9px] font-black text-[#F7B500]/60 uppercase tracking-[0.2em]">Complexo Desportivo · Vila de Rei</p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase leading-tight mt-1 mb-2">
                {formData.nome || formData.n}
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="bg-[#F7B500] text-[#004D71] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow">
                  {formData.role === 'utente' ? (formData.modalidade || 'Utente') : formData.cargo}
                </span>
                {user.isInside && (
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-400/20 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/> {user.location}
                  </span>
                )}
              </div>
              {formData.email && (
                <p className="text-[10px] text-white/40 font-bold mt-2 uppercase tracking-wide">{formData.email}</p>
              )}
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Peso</p>
                <p className="text-base font-black text-white leading-none">{currentWeight}<span className="text-[9px] opacity-40 ml-0.5">kg</span></p>
              </div>
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Glicemia</p>
                <p className="text-base font-black text-red-300 leading-none">{currentGly}<span className="text-[9px] opacity-40 ml-0.5">mg/dL</span></p>
              </div>
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Presenças</p>
                <p className="text-base font-black text-emerald-300 leading-none">{logs.length}<span className="text-[9px] opacity-40 ml-0.5">dias</span></p>
              </div>
              <div>
                <p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Membro</p>
                <p className="text-base font-black text-[#F7B500] leading-none">{user.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-2 bg-[#F7B500] w-full"/>
      </div>

      <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
          const r = new FileReader(); 
          r.onloadend = () => setFormData({...formData, img: r.result as string}); 
          r.readAsDataURL(e.target.files[0]);
        }
      }}/>

      {/* Tabs Navigation */}
      <div className="flex p-2 bg-slate-200/50 backdrop-blur rounded-[2.5rem] gap-1 sticky top-0 z-20 overflow-x-auto hide-scrollbar">
         {[
           { id: 'geral', label: 'Dados Gerais', icon: <User size={16}/> },
           { id: 'saude', label: 'Saúde & Metas', icon: <TrendingUp size={16}/> },
           { id: 'atividade', label: 'Atividade', icon: <History size={16}/> },
           ...(user.role === 'utente' ? [{ id: 'treino', label: 'Plano Treino', icon: <Dumbbell size={16}/> }] : [])
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setActiveTab(t.id as any)}
             className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-[2rem] text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-[#004D71] text-[#F7B500] shadow-lg scale-[1.02]' : 'text-slate-500 hover:bg-slate-100'}`}
           >
             {t.icon} <span className="hidden sm:inline">{t.label}</span>
           </button>
         ))}
      </div>

      {/* Tab Content: Geral */}
      {activeTab === 'geral' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-8">
             <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-4"><User size={16}/> Dados Biográficos</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput label="Nome Completo" icon={<User size={14}/>} value={formData.nome || formData.n} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, nome: v})} />
                <FormInput label="E-mail" icon={<Mail size={14}/>} value={formData.email} disabled={true} onChange={(v: string) => {}} />
                <FormInput label="Telemóvel" icon={<Phone size={14}/>} value={formData.phone || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, phone: v})} />
                <FormInput label="NIF" icon={<FileText size={14}/>} value={formData.nif || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, nif: v})} />
                <FormInput label="Cartão Cidadão" icon={<FileText size={14}/>} value={formData.cc || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, cc: v})} />
                <FormInput label="Data Nascimento" icon={<Clock size={14}/>} value={formData.data_nasc || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, data_nasc: v})} placeholder="DD/MM/AAAA" />
             </div>

             {(user.id === formData.id || currentRole === 'admin') && (
               <div className="pt-4 border-t-2 border-slate-50 mt-4">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Segurança da Conta</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2">
                    <FormInput label="Nova Palavra-passe (Login)" icon={<Shield size={14}/>} value={formData.password || '123456'} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, password: v})} type={isEditing ? "text" : "password"} />
                 </div>
               </div>
             )}

             <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-4 mt-8"><MapPin size={16}/> Residência</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput label="Morada" icon={<MapPin size={14}/>} value={formData.endereco || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, endereco: v})} />
                <FormInput label="Código Postal" icon={<MapPin size={14}/>} value={formData.cod_postal || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, cod_postal: v})} />
                <FormInput label="Localidade" icon={<MapPin size={14}/>} value={formData.localidade || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, localidade: v})} />
                <FormInput label="Profissão" icon={<Briefcase size={14}/>} value={formData.profissao || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, profissao: v})} />
             </div>
          </div>
        </div>
      )}

      {/* Tab Content: Saude */}
      {activeTab === 'saude' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
           {/* Charts Section */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-[3rem] p-8 lg:p-10 shadow-sm border-2 border-slate-50">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2"><TrendingUp size={14}/> Evolução de Peso</h4>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Últimos 10 registos</span>
                 </div>
                 <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={metrics.filter(m => m.type === 'peso').map(m => ({ d: (m.timestamp as any)?.toDate().toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit'}), v: m.value }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                          <Tooltip contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 15px rgba(0,0,0,0.1)'}} />
                          <Area type="monotone" dataKey="v" stroke="#004D71" strokeWidth={3} fill="#004D71" fillOpacity={0.05} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
              
              <div className="bg-white rounded-[3rem] p-8 lg:p-10 shadow-sm border-2 border-slate-50">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2"><Activity size={14}/> Glicemia</h4>
                 </div>
                 <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={metrics.filter(m => m.type === 'glicemia').map(m => ({ d: (m.timestamp as any)?.toDate().toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit'}), v: m.value }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                          <Tooltip contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 15px rgba(0,0,0,0.1)'}} />
                          <Area type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={3} fill="#ef4444" fillOpacity={0.05} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50">
              <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-4 mb-8"><Star size={16}/> Saúde e Objetivos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput label="Contacto Emergência" icon={<Phone size={14}/>} value={formData.contacto_emergencia || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, contacto_emergencia: v})} />
                <FormInput label="Nome Contacto" icon={<User size={14}/>} value={formData.nome_emergencia || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, nome_emergencia: v})} />
                <FormInput label="IBAN (Pagamentos)" icon={<FileText size={14}/>} value={formData.iban || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, iban: v})} />
                <FormInput label="Modalidade Atual" icon={<Trophy size={14}/>} value={formData.modalidade || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, modalidade: v})} />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                   <FormInput label="Alergias" icon={<AlertCircle size={14}/>} value={formData.alergias || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, alergias: v})} multiline />
                   <FormInput label="Objetivos" icon={<Target size={14}/>} value={formData.objetivos || ''} disabled={!isEditing} onChange={(v: string) => setFormData({...formData, objetivos: v})} multiline />
                </div>
                <div className="col-span-full">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Restrições Médicas</label>
                   <textarea 
                     value={formData.restricoes_medicas || ''} 
                     disabled={!isEditing}
                     onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, restricoes_medicas: e.target.value})}
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 text-xs font-black text-[#003350] outline-none min-h-[120px] focus:ring-2 ring-[#004D71]/5 transition-all"
                     placeholder="Indique se tem alguma restrição..."
                   />
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Tab Content: Atividade */}
      {activeTab === 'atividade' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
           <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50">
              <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-4 mb-6"><History size={16}/> Histórico de Acessos</h3>
              <div className="space-y-3">
                 {logs.map(log => (
                   <div key={log.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:bg-white hover:shadow-xl transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#004D71] shadow-sm group-hover:bg-[#004D71] group-hover:text-white transition-all">
                            <Calendar size={20}/>
                         </div>
                         <div>
                            <p className="text-xs font-black text-[#004D71] uppercase">{log.date} — {log.zone || 'Complexo'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-2">
                               <LogIn size={10}/> {log.checkIn ? (log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : new Date(log.checkIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})) : '--:--'}
                               <span className="opacity-30">|</span>
                               <LogOut size={10}/> {log.checkOut ? (log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : new Date(log.checkOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})) : '--:--'}
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-[#004D71]">{log.durationMinutes || '--'} <small className="text-[8px] uppercase opacity-40">min</small></p>
                         <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Duração Total</p>
                      </div>
                   </div>
                 ))}
                 {logs.length === 0 && (
                   <div className="py-20 text-center text-slate-300">
                      <History size={40} className="mx-auto mb-4 opacity-20" />
                      <p className="uppercase font-black text-[9px] tracking-[0.2em]">Sem registos de atividade</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Tab Content: Treino */}
      {activeTab === 'treino' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
           {!plan ? (
             <div className="bg-white rounded-[3rem] p-12 text-center border-2 border-slate-50 shadow-sm">
                <Dumbbell size={48} className="mx-auto mb-4 text-slate-200" />
                <h3 className="font-black text-[#004D71] uppercase text-lg mb-2">Sem Plano Ativo</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">Este utente ainda não tem um plano de treino prescrito para o período atual.</p>
             </div>
           ) : (
             <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50">
                <div className="flex justify-between items-center mb-8 border-b-2 border-slate-50 pb-4">
                   <div>
                      <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2">
                        <Trophy size={16} className="text-[#F7B500]"/> Plano Prescrito
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Válido até Junho de 2026</p>
                   </div>
                </div>
                
                <div className="space-y-4">
                   {plan.exercicios?.map((ex: any, idx: number) => (
                     <div key={idx} className="bg-slate-50 rounded-[2rem] p-5 border border-slate-100 flex items-center gap-5 hover:bg-white hover:shadow-lg transition-all">
                        <div className="w-12 h-12 bg-[#004D71] text-[#F7B500] rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                           {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black text-[#004D71] uppercase text-xs mb-2 truncate">{ex.exercicioId}</h4>
                           <div className="flex gap-2">
                              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                 <span className="text-[7px] font-black text-slate-400 block uppercase">Séries</span>
                                 <span className="text-[10px] font-black text-[#004D71]">{ex.series}</span>
                              </div>
                              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                 <span className="text-[7px] font-black text-slate-400 block uppercase">Reps</span>
                                 <span className="text-[10px] font-black text-[#004D71]">{ex.reps}</span>
                              </div>
                              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                 <span className="text-[7px] font-black text-slate-400 block uppercase">Descanso</span>
                                 <span className="text-[10px] font-black text-[#F7B500]">{ex.descanso}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      )}

      {formData.role === 'professor' && activeTab === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <CVCard icon={<GraduationCap size={24}/>} label="Formação" value={formData.formacao || 'Mestrado Desporto'} />
           <CVCard icon={<Award size={24}/>} label="IPDJ" value={formData.cedula || 'IPDJ-0000'} />
           <CVCard icon={<Clock size={24}/>} label="Experiência" value={formData.experiencia || '10+ Anos'} />
           <CVCard icon={<Briefcase size={24}/>} label="Cargo" value="Direção Técnica" />
        </div>
      )}
    </div>
  );
}
