import React, { useState, useRef, useEffect } from 'react';
import {
  User, LogOut, Camera, Info, GraduationCap, Award, Clock, Star,
  Phone, Mail, FileText, ArrowLeft, Briefcase, Trophy, Target,
  AlertCircle, MapPin, Activity, LogIn, Calendar, TrendingUp, History,
  Dumbbell, Shield, CreditCard, Heart, CheckSquare, Square, Users, X, Plus, Edit2, Check,
  ArrowUp, ArrowDown, Youtube, Search, ChevronDown
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UserProfile } from '../types';
import { CVCard, FormInput, PicotoIcon, AvatarImage } from './Common';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { handleCheckIn, handleCheckOut } from '../lib/access';
import { QRCodeCanvas } from 'qrcode.react';

const TERMO_IMAGENS =
  'Declaro que autorizo a utilização de imagens (fotos e vídeos) do próprio/meu educando para a utilização eventual em ações de divulgação de carácter diverso promovidos pelo Município de Vila de Rei.';

const TERMO_RESPONSABILIDADE =
  'A Lei n.º 5/2007, de 16 de Janeiro, que aprova a Lei de Bases da Actividade Física e do Desporto, estatui, no n.º 2 do seu artigo 40.º, no âmbito das actividades físicas e desportivas não federadas, que "constitui especial obrigação do praticante assegurar-se, previamente, de que não tem quaisquer contra-indicações para a sua prática". Assim, deixa de ser obrigatório a apresentação de exame médico para a prática desportiva, cabendo ao praticante assegurar que não tem quaisquer contraindicações para o efeito. Declaro que estou ciente e tomei conhecimento da legislação em vigor, pelo que declaro que não possuo quaisquer contra-indicações para a prática de actividades desportivas. A Direção Técnica do Complexo Desportivo de Vila de Rei recomenda a entrega de um atestado médico. Caso, no futuro, as condições actuais sejam alteradas, assumo a responsabilidade de informar a Direção Técnica do Complexo Desportivo de Vila de Rei. Mais declaro que cumprirei todas as regras do regulamento interno do Complexo Desportivo de Vila de Rei.';

export const MODALIDADES = [
  'Piscina Regime Livre',
  'Piscina Exterior',
  'Natação Nível 1',
  'Natação Nível 2',
  'Natação Nível 3',
  'Hidroginástica',
  'Bebés/AMA',
  'Aulas Fitness',
  'Ginásio',
  'Sauna'
];

// Código curto e estável para mostrar no cartão de utente. Não usar slice() do
// id diretamente: muitos ids são gerados a partir do email (ex.: "..._gmail_com")
// e cortar só os últimos caracteres faz colidir todos os utentes do mesmo
// provedor de email (toda a gente com Gmail mostrava "#MAIL_COM").
function shortUserCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

function calcAge(dataNasc?: string): number | null {
  if (!dataNasc) return null;
  const birth = new Date(dataNasc);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-50 pb-4">
      {icon} {label}
    </h3>
  );
}

function TermoCheckbox({ checked, disabled, onChange, label, text }: {
  checked: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string; text: string;
}) {
  return (
    <div
      className={`rounded-[2rem] border-2 p-6 transition-all ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'} ${!disabled ? 'cursor-pointer hover:border-[#004D71]/30' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 shrink-0 ${checked ? 'text-emerald-500' : 'text-slate-300'}`}>
          {checked ? <CheckSquare size={22} /> : <Square size={22} />}
        </div>
        <div>
          <p className="text-[10px] font-black text-[#004D71] uppercase tracking-widest mb-2">{label}</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">{text}</p>
          {checked && (
            <p className="text-[9px] font-black text-emerald-600 uppercase mt-2">
              Aceite em {new Date().toLocaleDateString('pt-PT')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfileViewModule({
  user, onLogout, setUser, isExternalView = false, currentRole = 'utente', onReportBug
}: {
  user: UserProfile;
  onLogout: () => void;
  setUser?: (u: UserProfile) => void;
  isExternalView?: boolean;
  currentRole?: string;
  onReportBug?: () => void;
}) {
  const LOCAL_USERS_KEY = 'cpx_local_users_overrides_v1';
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({ ...user });
  const [saving, setSaving] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'contactos' | 'atividade' | 'termos'>('geral');
  const isStaff = ['admin', 'staff', 'professor'].includes(currentRole);

  // Simulador de Pacotes
  const [calcEntries, setCalcEntries] = useState<number>(15);
  const [calcType, setCalcType] = useState<'ginasio' | 'piscina_adulto' | 'piscina_crianca'>('ginasio');
  const [logs, setLogs] = useState<any[]>([]);
  const [durationText, setDurationText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const readLocalOverrides = (): Record<string, UserProfile> => {
    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const writeLocalOverride = (profile: UserProfile) => {
    const map = readLocalOverrides();
    map[profile.id] = profile;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(map));
    if (!isExternalView) {
      localStorage.setItem('cpx_v33_session', JSON.stringify(profile));
    }
  };

  const age = calcAge(formData.data_nasc);
  const isMinor = age !== null && age < 16;
  const canEdit = true;

  useEffect(() => {
    if (!isEditing) {
      let cartao_tipo = user.cartao_tipo || '';
      let cartao_numero = user.cartao_numero || user.cartao_municipal || '';
      let cartao_validade = user.cartao_validade || '';

      if (!cartao_tipo && user.municipio_cartao) {
        if (user.municipio_cartao.includes(' - Nº ')) {
          const parts = user.municipio_cartao.split(' - Nº ');
          cartao_tipo = parts[0];
          if (!cartao_numero) cartao_numero = parts[1];
        } else {
          const known = ['Cartão Jovem Municipal', 'Cartão Municipal Idade-Ativa', 'Cartão do Idoso'];
          if (known.includes(user.municipio_cartao)) {
            cartao_tipo = user.municipio_cartao;
          }
        }
      }

      setFormData({
        ...user,
        cartao_tipo,
        cartao_numero,
        cartao_validade
      });
    }
  }, [user.id, user.updatedAt, user.isInside, user.location, user.cartao_tipo, user.cartao_numero, user.cartao_validade, user.cartao_municipal, user.municipio_cartao, isEditing]);

  useEffect(() => {
    const local = readLocalOverrides()[user.id];
    if (!local) return;
    setFormData(prev => ({ ...prev, ...local }));
    if (setUser) setUser({ ...user, ...local });
  }, [user.id]);

  useEffect(() => {
    if (!user.id) return;
    const logsPath = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const unsubLogs = onSnapshot(
      query(collection(db, logsPath), where('userId', '==', user.id), orderBy('checkIn', 'desc'), limit(10)),
      snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsubLogs();
  }, [user.id, user.role]);

  useEffect(() => {
    if (!user.isInside || !user.updatedAt) { setDurationText(''); return; }
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(user.updatedAt!).getTime()) / 60000);
      if (diff < 1) setDurationText('Acabou de entrar');
      else if (diff < 60) setDurationText(`${diff} min`);
      else setDurationText(`${Math.floor(diff / 60)}h ${diff % 60}m`);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [user.isInside, user.updatedAt]);

  const set = (field: keyof UserProfile, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const toggleModalidade = (m: string) => {
    const current = formData.modalidades_autorizadas || [];
    set('modalidades_autorizadas', current.includes(m) ? current.filter(x => x !== m) : [...current, m]);
  };

  const save = async () => {
    if (saving) return;
    // Validate terms for utentes (Only enforce if it's the user themselves editing, staff can bypass)
    if (!isStaff && formData.role === 'utente' && (!formData.termo_imagens || !formData.termo_responsabilidade)) {
      alert('É obrigatório aceitar os dois termos de responsabilidade para continuar.');
      return;
    }
    setSaving(true);
    try {
      const { id, role, email, ...rest } = formData;
      const now = new Date().toISOString();
      const updateData = {
        ...rest, role, email,
        nome: formData.nome || formData.n || '',
        n: formData.nome || formData.n || '',
        // Sync legacy phone field
        phone: formData.telemovel || formData.phone || '',
        updatedAt: now,
        ...(formData.termo_imagens && !user.termo_imagens_data && { termo_imagens_data: now }),
        ...(formData.termo_responsabilidade && !user.termo_responsabilidade_data && { termo_responsabilidade_data: now }),
      };
      const saved = { ...formData, ...updateData };
      // Save locally first so it always persists even when cloud is unavailable.
      writeLocalOverride(saved);
      try {
        await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, id), updateData);
      } catch (cloudError) {
        handleFirestoreError(cloudError, OperationType.UPDATE, `users/${formData.id}`);
      }
      setFormData(saved);
      if (setUser) setUser(saved);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${formData.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAccessAction = async (action: 'IN' | 'OUT', zone = 'Geral') => {
    setAccessLoading(true);
    try {
      if (action === 'IN') await handleCheckIn(user, zone === 'C. Desportivo' ? (user.modalidade || 'Ginásio') : zone);
      else await handleCheckOut(user);
      
      if (isExternalView) {
        onLogout();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `access/${user.id}`);
    } finally {
      setAccessLoading(false);
    }
  };

  const termsOk = formData.termo_imagens && formData.termo_responsabilidade;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 text-left px-2 pb-24 max-w-4xl mx-auto">

      {/* ID CARD — visível para todos (foto, nome, role, etc.) */}
      <div className="bg-[#004D71] rounded-[2.5rem] shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2">
            {isExternalView && (
              <button onClick={onLogout} className="flex items-center gap-2 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest">
                <ArrowLeft size={16}/> Voltar
              </button>
            )}
            {user.isInside && durationText && (
              <div className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[9px] font-black uppercase border border-emerald-400/20">
                <Clock size={11} className="animate-pulse"/> {durationText}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {['admin', 'staff', 'professor'].includes(currentRole) && (
              !user.isInside ? (
                <button onClick={() => handleAccessAction('IN', 'C. Desportivo')} disabled={accessLoading}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 shadow-lg">
                  {accessLoading ? <Activity className="animate-spin" size={12}/> : <LogIn size={12}/>} Entrada
                </button>
              ) : (
                <button onClick={() => handleAccessAction('OUT')} disabled={accessLoading}
                  className="bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 shadow-lg">
                  {accessLoading ? <Activity className="animate-spin" size={12}/> : <LogOut size={12}/>} Saída
                </button>
              )
            )}
            {canEdit && (
              <button onClick={() => isEditing ? save() : setIsEditing(true)} disabled={saving}
                className="bg-[#F7B500] text-[#004D71] px-4 py-2 rounded-xl font-black text-[9px] uppercase flex items-center gap-1.5 active:scale-95 shadow-lg">
                {saving ? '...' : isEditing ? <><FileText size={12}/> Gravar</> : <><Camera size={12}/> Editar</>}
              </button>
            )}
            <button onClick={() => window.print()} className="bg-white/10 text-white/70 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <FileText size={16}/>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-0">
          <div className="flex flex-col items-center justify-center px-8 py-6 sm:border-r border-white/10 shrink-0">
            <div className="relative">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] overflow-hidden border-4 border-[#F7B500] shadow-2xl bg-white">
                <AvatarImage src={formData.img || ''} alt="Avatar" className="w-full h-full object-cover"/>
                {isEditing && (
                  <button onClick={() => fileRef.current?.click()} className="absolute inset-0 bg-black/50 flex items-center justify-center text-white backdrop-blur-sm rounded-[2rem]">
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
              <p className="text-[11px] font-black text-[#F7B500] font-mono tracking-widest">#{shortUserCode(user.id)}</p>
            </div>
          </div>

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
                {isMinor && (
                  <span className="bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-orange-400/20">
                    Menor
                  </span>
                )}
                {!termsOk && formData.role === 'utente' && (
                  <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-red-400/20 flex items-center gap-1">
                    <AlertCircle size={10}/> Termos pendentes
                  </span>
                )}
                {user.isInside && (
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-400/20 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/> {user.location}
                  </span>
                )}
              </div>
              {age !== null && (
                <p className="text-[10px] text-white/40 font-bold mt-1">{age} anos {isMinor ? '· Encarregado de Educação obrigatório' : ''}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
              <div><p className="text-[8px] font-black text-white/30 uppercase mb-0.5">ID</p><p className="text-base font-black text-white leading-none font-mono">#{shortUserCode(user.id)}</p></div>
              <div><p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Contribuinte</p><p className="text-base font-black text-white leading-none">{formData.nif || '—'}</p></div>
              <div><p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Presenças</p><p className="text-base font-black text-emerald-300 leading-none">{logs.length}<span className="text-[9px] opacity-40 ml-0.5">dias</span></p></div>
              <div><p className="text-[8px] font-black text-white/30 uppercase mb-0.5">Membro</p><p className="text-base font-black text-[#F7B500] leading-none">{user.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}</p></div>
            </div>
          </div>
        </div>
        <div className="h-2 bg-[#F7B500] w-full"/>
      </div>

      <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={e => {
        if (e.target.files?.[0]) {
          const r = new FileReader();
          r.onloadend = () => set('img', r.result as string);
          r.readAsDataURL(e.target.files[0]);
        }
      }}/>

      {/* Barra de edição — visível para todos na vista própria */}
      {!isExternalView && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-[2rem] px-5 py-3 border-2 border-slate-100 shadow-sm gap-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEditing ? 'Modo de edição activo' : 'Dados do perfil'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={onReportBug}
                  className="px-3 py-2 rounded-xl font-black text-[10px] uppercase bg-slate-100 text-slate-500 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-slate-200 hover:bg-slate-200"
                  title="Reportar Bug"
                >
                  <AlertCircle size={13}/> Bug
                </button>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 rounded-xl font-black text-[10px] uppercase bg-red-50 text-red-600 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm border border-red-100 hover:bg-red-100"
                >
                  <LogOut size={13}/> Terminar Sessão
                </button>
              </>
            )}
            {isEditing && (
              <button
                onClick={() => { setIsEditing(false); setFormData({ ...user }); }}
                className="px-4 py-2 rounded-xl font-black text-[10px] uppercase bg-slate-100 text-slate-500 active:scale-95 transition-all"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={() => isEditing ? save() : setIsEditing(true)}
              disabled={saving}
              className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-sm ${isEditing ? 'bg-emerald-500 text-white' : 'bg-[#004D71] text-[#F7B500]'}`}
            >
              {saving ? '…' : isEditing ? <><Check size={13}/> Gravar</> : <><Edit2 size={13}/> Editar Perfil</>}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-2 bg-slate-200/50 backdrop-blur rounded-[2.5rem] gap-1 sticky top-0 z-20 overflow-x-auto hide-scrollbar">
        {[
          { id: 'geral',      label: 'Identificação',   icon: <User size={15}/> },
          { id: 'contactos',  label: 'Contactos',        icon: <Phone size={15}/> },
          ...(formData.role === 'utente' ? [{ id: 'atividade',  label: 'Atividade',        icon: <History size={15}/> }] : []),
          ...(formData.role === 'utente' ? [{ id: 'termos', label: 'Termos', icon: <FileText size={15}/> }] : [])
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-[2rem] text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-[#004D71] text-[#F7B500] shadow-lg scale-[1.02]' : 'text-slate-500 hover:bg-slate-100'}`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: Identificação */}
      {activeTab === 'geral' && (
        <div className="space-y-6 animate-in fade-in">



          {/* Dados Pessoais */}
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
            <SectionTitle icon={<User size={16}/>} label="Dados Pessoais" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput label="Nome Completo" icon={<User size={14}/>}
                value={formData.nome || formData.n || ''} disabled={!isEditing}
                onChange={v => set('nome', v)} />
              <FormInput label="E-mail" icon={<Mail size={14}/>}
                value={formData.email} disabled={true} onChange={() => {}} />

              {/* Data Nascimento + Idade */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FormInput label="Data de Nascimento" icon={<Calendar size={14}/>} type="date"
                    value={formData.data_nasc || ''} disabled={!isEditing || !isStaff}
                    onChange={v => set('data_nasc', v)} />
                </div>
                <div className={`shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-sm border-2 mb-0.5 ${age === null ? 'bg-slate-50 border-slate-100' : isMinor ? 'bg-orange-50 border-orange-200' : 'bg-[#004D71]/5 border-[#004D71]/10'}`}>
                  {age !== null ? (
                    <>
                      <span className={`text-xl font-black leading-none ${isMinor ? 'text-orange-500' : 'text-[#004D71]'}`}>{age}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isMinor ? 'text-orange-400' : 'text-slate-400'}`}>anos</span>
                    </>
                  ) : (
                    <span className="text-[8px] font-black text-slate-300 uppercase text-center leading-tight">Idade</span>
                  )}
                </div>
              </div>

              {/* CC + Validade */}
              <FormInput label="Cartão de Cidadão N.º" icon={<CreditCard size={14}/>}
                value={formData.cc || ''} disabled={!isEditing || !isStaff}
                onChange={v => set('cc', v)} />
              <FormInput label="Validade do CC" icon={<Calendar size={14}/>} type="date"
                value={formData.cc_validade || ''} disabled={!isEditing || !isStaff}
                onChange={v => set('cc_validade', v)} />

              <FormInput label="NIF" icon={<FileText size={14}/>}
                value={formData.nif || ''} disabled={!isEditing || !isStaff}
                onChange={v => set('nif', v)} />
              <FormInput label="Número de Utente / SNS" icon={<Shield size={14}/>}
                value={formData.num_utente || ''} disabled={!isEditing || !isStaff}
                onChange={v => set('num_utente', v)} />
            </div>
          </div>

          {/* Cartão Municipal */}
          {formData.role === 'utente' && (
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
              <SectionTitle icon={<CreditCard size={16}/>} label="Cartão Municipal" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5 text-left w-full">
                  <div className="flex items-center gap-2 ml-1 text-[#004D71]">
                    <CreditCard size={14}/> <label className="text-[10px] font-black uppercase tracking-widest">Tipo de Cartão</label>
                  </div>
                  <select
                    value={formData.cartao_tipo || ''}
                    disabled={!isEditing || !isStaff}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        cartao_tipo: val,
                        municipio_cartao: val ? `${val} - Nº ${prev.cartao_numero || ''}` : ''
                      }));
                    }}
                    className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="">Nenhum</option>
                    <option value="Cartão Jovem Municipal">Cartão Jovem Municipal (0-35 anos) - 20% Desc</option>
                    <option value="Cartão Municipal Idade-Ativa">Cartão Municipal Idade-Ativa (35-65 anos) - 20% Desc</option>
                    <option value="Cartão do Idoso">Cartão do Idoso (65+ anos) - 20% Desc</option>
                    <option value="Cartão Universidade Sénior">Cartão Universidade Sénior - 50% Desc</option>
                    <option value="Família Numerosa">Família Numerosa - 50% Desc</option>
                    <option value="Atestado Médico">Atestado Médico / Reabilitação - Isento</option>
                  </select>
                </div>
                <FormInput label="Número do Cartão" icon={<CreditCard size={14}/>}
                  value={formData.cartao_numero || ''} disabled={!isEditing || !isStaff}
                  onChange={v => {
                    setFormData(prev => ({
                      ...prev,
                      cartao_numero: v,
                      cartao_municipal: v,
                      municipio_cartao: prev.cartao_tipo ? `${prev.cartao_tipo} - Nº ${v}` : ''
                    }));
                  }} />
                <FormInput label="Validade do Cartão" icon={<Calendar size={14}/>} type="date"
                  value={formData.cartao_validade || ''} disabled={!isEditing || !isStaff}
                  onChange={v => set('cartao_validade', v)} />
              </div>
            </div>
          )}

          {/* Financeiro (Gestão de Entradas) */}
          {['admin', 'staff'].includes(currentRole) && formData.role === 'utente' && (
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
              <SectionTitle icon={<CreditCard size={16}/>} label="Gestão de Entradas (Carregamentos)" />
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-full md:w-1/3 bg-slate-50 p-6 rounded-[2rem] text-center border-2 border-slate-100 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo Atual</p>
                  <h3 className={`text-6xl font-black tracking-tighter ${
                    (formData.entradas_disponiveis || 0) > 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {formData.entradas_disponiveis || 0}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-2">entradas</p>
                </div>

                <div className="w-full md:w-2/3 space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregamento Rápido</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 5, 15, 30].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        disabled={!isEditing}
                        onClick={() => set('entradas_disponiveis', (formData.entradas_disponiveis || 0) + amount)}
                        className="bg-[#004D71]/5 hover:bg-[#004D71] hover:text-[#F7B500] text-[#004D71] transition-colors rounded-2xl py-4 font-black text-lg disabled:opacity-50 disabled:hover:bg-[#004D71]/5 disabled:hover:text-[#004D71]"
                      >
                        +{amount}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <FormInput label="Ajuste Manual do Saldo" icon={<CreditCard size={14}/>} type="number"
                      value={formData.entradas_disponiveis || 0} disabled={!isEditing}
                      onChange={v => set('entradas_disponiveis', parseInt(v) || 0)} />
                  </div>
                  
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-1 gap-4 border-t border-slate-100">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <CreditCard size={12}/> Faturação / Acesso
                      </label>
                      <select
                        value={formData.tipoAcesso || 'Diário'}
                        disabled={!isEditing}
                        onChange={e => set('tipoAcesso', e.target.value)}
                        className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all cursor-pointer disabled:opacity-75"
                      >
                        <option value="Diário">Paga Bilhete Diário / Mensalidade</option>
                        <option value="Pacote">Usa Pacote de Entradas</option>
                        <option value="Isento">Acesso Isento / Livre Trânsito</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Simulador de Preço (Venda de Entradas)</h4>
                    <div className="bg-white border-2 border-[#004D71]/10 rounded-2xl p-4 flex flex-col gap-4">
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-[#004D71] outline-none focus:border-[#F7B500]"
                          value={calcType}
                          onChange={e => setCalcType(e.target.value as any)}
                        >
                          <option value="ginasio">Ginásio (Base 15 ent.)</option>
                          <option value="piscina_adulto">Piscina Adulto (Base 20 ent.)</option>
                          <option value="piscina_crianca">Piscina Criança (Base 20 ent.)</option>
                        </select>
                        <input 
                          type="number" 
                          className="w-20 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-black text-[#004D71] outline-none focus:border-[#F7B500] text-center"
                          value={calcEntries}
                          onChange={e => setCalcEntries(parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Valor a Cobrar:</p>
                        <p className="text-xl font-black text-[#004D71]">
                          {(() => {
                            let pricePerEntry = 0;
                            if (calcType === 'ginasio') pricePerEntry = 16.68 / 15;
                            else if (calcType === 'piscina_adulto') pricePerEntry = 32.01 / 20;
                            else if (calcType === 'piscina_crianca') pricePerEntry = 22.17 / 20;
                            return (pricePerEntry * calcEntries).toFixed(2);
                          })()} €
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                Nota: A cada entrada no Quiosque será deduzida 1 entrada. Se o saldo for Zero, o acesso será bloqueado.
              </p>
            </div>
          )}

          {/* Encarregado de Educação (apenas menores) */}
          {(isMinor || formData.encarregado_email) && (
            <div className="bg-orange-50 rounded-[3rem] p-8 border-2 border-orange-200 space-y-6">
              <SectionTitle icon={<Users size={16}/>} label="Encarregado de Educação" />
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest -mt-2">
                Obrigatório para menores de 16 anos
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput label="Nome do Encarregado" icon={<User size={14}/>}
                  value={formData.encarregado_nome || ''} disabled={!isEditing}
                  onChange={v => set('encarregado_nome', v)} />
                <FormInput label="E-mail do Encarregado" icon={<Mail size={14}/>}
                  value={formData.encarregado_email || ''} disabled={!isEditing}
                  onChange={v => set('encarregado_email', v)} />
                <FormInput label="CC do Encarregado" icon={<CreditCard size={14}/>}
                  value={formData.encarregado_cc || ''} disabled={!isEditing}
                  onChange={v => set('encarregado_cc', v)} />
              </div>

              {/* Modalidades autorizadas */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">
                  Modalidades Autorizadas pelo Encarregado
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODALIDADES.map(m => {
                    const checked = (formData.modalidades_autorizadas || []).includes(m);
                    return (
                      <button key={m} type="button"
                        onClick={() => isEditing && toggleModalidade(m)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left text-[10px] font-black uppercase transition-all ${checked ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-orange-100 text-slate-400'} ${isEditing ? 'cursor-pointer hover:border-orange-300' : 'cursor-default'}`}>
                        {checked ? <CheckSquare size={14}/> : <Square size={14}/>}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Segurança */}
          {(user.id === formData.id || currentRole === 'admin') && (
            <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
              <SectionTitle icon={<Shield size={16}/>} label="Segurança da Conta" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput label="Palavra-passe (Login)" icon={<Shield size={14}/>}
                  value={formData.password || '123456'} disabled={!isEditing}
                  onChange={v => set('password', v)} type={isEditing ? 'text' : 'password'} />
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB: Contactos */}
      {activeTab === 'contactos' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
            <SectionTitle icon={<Phone size={16}/>} label="Contactos" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput label="Telefone Fixo" icon={<Phone size={14}/>}
                value={formData.telefone || ''} disabled={!isEditing}
                onChange={v => set('telefone', v)} />
              <FormInput label="Telemóvel" icon={<Phone size={14}/>}
                value={formData.telemovel || formData.phone || ''} disabled={!isEditing}
                onChange={v => set('telemovel', v)} />
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
            <SectionTitle icon={<MapPin size={16}/>} label="Morada" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <FormInput label="Morada Completa" icon={<MapPin size={14}/>}
                  value={formData.endereco || ''} disabled={!isEditing}
                  onChange={v => set('endereco', v)} />
              </div>
              <FormInput label="Código Postal" icon={<MapPin size={14}/>}
                value={formData.cod_postal || ''} disabled={!isEditing}
                onChange={v => set('cod_postal', v)} placeholder="0000-000" />
              <FormInput label="Localidade" icon={<MapPin size={14}/>}
                value={formData.localidade || ''} disabled={!isEditing}
                onChange={v => set('localidade', v)} />
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
            <SectionTitle icon={<AlertCircle size={16}/>} label="Contacto de Emergência" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput label="Nome Completo" icon={<User size={14}/>}
                value={formData.nome_emergencia || ''} disabled={!isEditing}
                onChange={v => set('nome_emergencia', v)} />
              <FormInput label="Número de Contacto" icon={<Phone size={14}/>}
                value={formData.contacto_emergencia || ''} disabled={!isEditing}
                onChange={v => set('contacto_emergencia', v)} />
            </div>
          </div>
        </div>
      )}

      {/* TAB: Atividade */}
      {activeTab === 'atividade' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50">
            <SectionTitle icon={<History size={16}/>} label="Histórico de Acessos" />
            <div className="space-y-3 mt-6">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#004D71] shadow-sm">
                      <Calendar size={20}/>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#004D71] uppercase">{log.date} — {log.zone || 'Complexo'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-2">
                        <LogIn size={10}/> {log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                        <span className="opacity-30">|</span>
                        <LogOut size={10}/> {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#004D71]">{log.durationMinutes || '--'} <small className="text-[8px] uppercase opacity-40">min</small></p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="py-20 text-center text-slate-300">
                  <History size={40} className="mx-auto mb-4 opacity-20"/>
                  <p className="uppercase font-black text-[9px] tracking-[0.2em]">Sem registos de atividade</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Termos */}
      {activeTab === 'termos' && formData.role === 'utente' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-[3rem] p-8 shadow-sm border-2 border-slate-50 space-y-6">
            <SectionTitle icon={<FileText size={16}/>} label="Termos de Responsabilidade" />
            {!isEditing && !termsOk && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                <AlertCircle size={18} className="text-red-500 shrink-0"/>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                  Clique em Editar para aceitar os termos obrigatórios
                </p>
              </div>
            )}
            {termsOk && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckSquare size={18} className="text-emerald-500 shrink-0"/>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  Todos os termos aceites
                </p>
              </div>
            )}
            <div className="space-y-4">
              <TermoCheckbox
                label="Autorização de Utilização de Imagens"
                text={TERMO_IMAGENS}
                checked={!!formData.termo_imagens}
                disabled={!isEditing || !!user.termo_imagens}
                onChange={v => {
                  set('termo_imagens', v);
                  if (v) set('termo_imagens_data', new Date().toISOString());
                }}
              />
              <TermoCheckbox
                label="Termo de Responsabilidade — Lei n.º 5/2007"
                text={TERMO_RESPONSABILIDADE}
                checked={!!formData.termo_responsabilidade}
                disabled={!isEditing || !!user.termo_responsabilidade}
                onChange={v => {
                  set('termo_responsabilidade', v);
                  if (v) set('termo_responsabilidade_data', new Date().toISOString());
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
