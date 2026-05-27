import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, ChevronDown, ArrowLeft, Plus, X, Save, User as UserIcon, Activity, Mail, Smartphone, Shield, Calendar, MapPin, Scan, UserX } from 'lucide-react';
import { UserProfile } from '../types';
import { PicotoIcon, FormInput, AvatarImage } from './Common';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { doc, setDoc } from 'firebase/firestore';

import { handleCheckIn, handleCheckOut } from '../lib/access';

function UtenteRow({ u, onClick }: { u: UserProfile, onClick: () => void, key?: any }) {
  return (
    <button onClick={onClick} className={`w-full p-5 flex items-center justify-between hover:bg-slate-50 active:bg-blue-50 transition-all text-left ${u.isInside ? 'bg-green-50/20' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <AvatarImage src={u.img} alt={u.n || u.nome} className={`w-14 h-14 rounded-[1.25rem] border-2 shadow-md ${u.isInside ? 'border-green-400' : 'border-white'}`} />
          {u.isInside && (
            <>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-white shadow-lg z-10" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full animate-ping opacity-40" />
            </>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-[#004D71] uppercase leading-none">{u.n || u.nome}</h4>
            {u.isInside && <span className="bg-green-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase">No Recinto</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{u.idade || '—'} Anos</span>
            <span className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">{u.location || u.modalidade || 'Utente Geral'}</span>
          </div>
        </div>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl text-slate-300">
        <ChevronRight size={18} />
      </div>
    </button>
  );
}

export function UtentesList({ 
  onUserClick, 
  utentes, 
  title = "Registos Municipais",
  canAdd = false 
}: { 
  onUserClick: (u: UserProfile) => void, 
  utentes: UserProfile[], 
  title?: string,
  canAdd?: boolean 
}) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<'all' | 'at_risk'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const [formData, setFormData] = useState({
    nome: '',
    idade: '',
    data_nasc: '',
    email: '',
    phone: '',
    nif: '',
    endereco: '',
    modalidade: 'Atividade Geral',
    restricoes_medicas: '',
    role: 'utente' as const
  });

  const filtered = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return utentes
      .filter(u => {
        const r = (u.role || '').toLowerCase();
        return !['admin', 'staff', 'chefia', 'professor'].includes(r);
      })
      .filter(u => (u.n || u.nome || '').toLowerCase().includes(search.toLowerCase()))
      .filter(u => {
        if (filterMode === 'all') return true;
        if (filterMode === 'at_risk') {
          if (!u.lastCheckInDate) return true; // Contas sem acessos recentes
          return new Date(u.lastCheckInDate) < thirtyDaysAgo;
        }
        return true;
      })
      .sort((a, b) => (a.n || a.nome || '').localeCompare(b.n || b.nome || '', 'pt'));
  }, [search, utentes, filterMode]);

  const groups = useMemo(() => {
    const inside = filtered.filter(u => u.isInside);
    const outside = filtered.filter(u => !u.isInside);
    const byLetter: Record<string, typeof filtered> = {};
    outside.forEach(u => {
      const letter = (u.n || u.nome || '?')[0].toUpperCase();
      if (!byLetter[letter]) byLetter[letter] = [];
      byLetter[letter].push(u);
    });
    const letterGroups = Object.keys(byLetter).sort().map(letter => ({ key: letter, label: letter, users: byLetter[letter] }));
    return { inside, letterGroups };
  }, [filtered]);

  const saveUser = async () => {
    if (!formData.nome || !formData.email) {
      alert("Nome e Email são obrigatórios para registo.");
      return;
    }

    try {
      // Use clean email as ID
      const userId = formData.email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const docPath = `artifacts/${APP_ID}/public/data/users/${userId}`;
      const userRef = doc(db, docPath);
      
      const newUser: UserProfile = {
        ...formData,
        id: userId,
        cargo: 'UTENTE',
        n: formData.nome.toUpperCase(),
        isInside: false,
        img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.nome}`,
        updatedAt: new Date().toISOString()
      };

      await setDoc(userRef, newUser, { merge: true });
      alert(`Utente "${formData.nome.toUpperCase()}" registado no sistema municipal.`);
      setShowAddModal(false);
      setFormData({ 
        nome: '', idade: '', data_nasc: '', email: '', phone: '', 
        nif: '', endereco: '', modalidade: 'Atividade Geral', restricoes_medicas: '', role: 'utente' 
      });
    } catch (e: any) {
      console.error("Save error:", e);
      handleFirestoreError(e, OperationType.WRITE, 'users');
    }
  };

  const toggleCheckIn = async (utente: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (!utente.isInside) {
        await handleCheckIn(utente, 'Ginásio');
      } else {
        await handleCheckOut(utente);
      }
    } catch (err: any) {
      console.error("Check-in error:", err);
      alert("Erro ao alterar estado de presença.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 px-2 text-left font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <PicotoIcon size={28} className="text-[#F7B500]"/> {title}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Diretório Municipal Vila de Rei</p>
        </div>
        {canAdd && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#004D71] text-[#F7B500] p-4 rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <Plus size={24}/>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="PROCURAR UTENTE..." 
          onChange={e => setSearch(e.target.value)} 
          className="w-full bg-white border-4 border-[#004D71]/5 p-5 pl-14 rounded-[2rem] font-black focus:border-[#004D71]/20 shadow-sm uppercase text-[10px] outline-none" 
        />
      </div>

      <div className="flex px-1">
        <button
          onClick={() => setFilterMode(prev => prev === 'all' ? 'at_risk' : 'all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
            filterMode === 'at_risk' 
              ? 'bg-red-50 text-red-600 border-red-200' 
              : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
          }`}
        >
          <UserX size={14}/> {filterMode === 'at_risk' ? 'Mostrar Todos' : 'Ver Risco de Desistência (> 30 dias)'}
        </button>
      </div>

      <div className="space-y-3">

        {search.trim().length > 0 ? (
          <div className="bg-white rounded-[2rem] border-4 border-[#004D71]/5 overflow-hidden shadow-sm divide-y divide-[#004D71]/5">
            {filtered.map(u => <UtenteRow key={u.id} u={u} onClick={() => onUserClick(u)} />)}
          </div>
        ) : (
          <>
        {/* Grupo: No Recinto */}
        {groups.inside.length > 0 && (
          <div className="bg-white rounded-[2rem] border-4 border-green-200/60 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleGroup('__inside__')}
              className="w-full flex items-center justify-between px-5 py-3 bg-green-50/80"
            >
              <span className="flex items-center gap-2 text-[10px] font-black text-green-700 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> No Recinto
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-green-600 bg-white px-3 py-1 rounded-full shadow-sm border border-green-100">{groups.inside.length} PRESENTES</span>
                <ChevronDown size={16} className={`text-green-500 transition-transform ${collapsedGroups.has('__inside__') ? '-rotate-90' : ''}`} />
              </div>
            </button>
            {!collapsedGroups.has('__inside__') && (
              <div className="divide-y divide-green-100/60">
                {groups.inside.map(u => <UtenteRow key={u.id} u={u} onClick={() => onUserClick(u)} />)}
              </div>
            )}
          </div>
        )}

        {/* Grupos alfabéticos */}
        {groups.letterGroups.map(g => (
          <div key={g.key} className="bg-white rounded-[2rem] border-4 border-[#004D71]/5 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleGroup(g.key)}
              className="w-full flex items-center justify-between px-5 py-3 bg-[#004D71]/3 hover:bg-[#004D71]/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#004D71] text-[#F7B500] font-black text-sm flex items-center justify-center">{g.label}</span>
                <span className="text-[10px] font-black text-[#004D71] uppercase tracking-widest">{g.users.length} utente{g.users.length !== 1 ? 's' : ''}</span>
              </div>
              <ChevronDown size={16} className={`text-[#004D71]/40 transition-transform ${collapsedGroups.has(g.key) ? '-rotate-90' : ''}`} />
            </button>
            {!collapsedGroups.has(g.key) && (
              <div className="divide-y divide-[#004D71]/5">
                {g.users.map(u => <UtenteRow key={u.id} u={u} onClick={() => onUserClick(u)} />)}
              </div>
            )}
          </div>
        ))}
          </>
        )}

        {filtered.length === 0 && (
          <div className="bg-white rounded-[2.5rem] border-4 border-[#004D71]/5 text-center py-20 text-slate-200">
            <PicotoIcon size={64} className="mx-auto mb-4 opacity-10" />
            <p className="uppercase font-black text-xs tracking-widest">Sem registos encontrados</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#004D71] p-6 pt-12 flex items-center justify-between text-white border-b-4 border-[#F7B500]">
             <div>
                <h3 className="text-xl font-black uppercase">Registar Utente</h3>
                <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-[0.2em] mt-1">Apoio ao Munícipe</p>
             </div>
             <button onClick={() => setShowAddModal(false)} className="p-3 bg-white/10 rounded-2xl active:scale-90"><X size={24}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/50 space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Informação Pessoal</h4>
              <FormInput 
                label="Nome Completo" 
                icon={<UserIcon size={14}/>}
                value={formData.nome} 
                onChange={v => setFormData({...formData, nome: v})} 
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput 
                  label="Data de Nascimento" 
                  type="date"
                  icon={<Calendar size={14}/>}
                  value={formData.data_nasc} 
                  onChange={v => {
                    const age = v ? new Date().getFullYear() - new Date(v).getFullYear() : '';
                    setFormData({...formData, data_nasc: v, idade: String(age)});
                  }} 
                />
                <FormInput 
                  label="NIF" 
                  icon={<Activity size={12}/>}
                  value={formData.nif} 
                  onChange={v => setFormData({...formData, nif: v})} 
                />
              </div>
              <FormInput 
                label="Morada Completa" 
                icon={<MapPin size={14}/>}
                value={formData.endereco} 
                onChange={v => setFormData({...formData, endereco: v})} 
              />
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/50 space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Contacto e Acesso</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput 
                  label="Email (Login/QR ID)" 
                  type="email"
                  icon={<Mail size={14}/>}
                  value={formData.email} 
                  onChange={v => setFormData({...formData, email: v})} 
                />
                <FormInput 
                  label="Telemóvel" 
                  icon={<Smartphone size={14}/>}
                  value={formData.phone} 
                  onChange={v => setFormData({...formData, phone: v})} 
                />
              </div>
              <FormInput 
                label="Modalidade Principal" 
                value={formData.modalidade} 
                onChange={v => setFormData({...formData, modalidade: v})} 
                placeholder="Ex: Natação, Hidroginástica..."
              />
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/50 space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Observações / Cadastro</h4>
              <textarea 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-medium focus:border-[#004D71] outline-none min-h-[100px]"
                placeholder="Condições médicas, restrições ou notas de faturação..."
                value={formData.restricoes_medicas}
                onChange={e => setFormData({...formData, restricoes_medicas: e.target.value})}
              ></textarea>
            </div>
            
            <div className="p-6 bg-[#004D71]/5 border-2 border-[#004D71]/10 rounded-[2rem] flex items-center gap-4">
               <Shield className="text-[#004D71] shrink-0" size={32}/>
               <p className="text-[9px] text-[#004D71] font-black uppercase leading-relaxed italic">
                 "O registo de dados pessoais é efetuado em conformidade com o RGPD para fins de gestão de serviços municipais."
               </p>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100 pb-10">
            <button 
              onClick={saveUser}
              className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <Save size={20}/> Confirmar Registo Oficial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScannerScreen({ onBack, onResult, utentes }: { onBack: () => void, onResult: (u: UserProfile) => void, utentes: UserProfile[] }) {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState('Pronto para leitura');
  const [cameraError, setCameraError] = useState('');
  const scannerRegionId = 'qr-reader-region';

  const processScanValue = async (scanValue: string) => {
    const [portal, userId] = scanValue.split(':');
    const utente = utentes.find(u => u.id === userId || u.qrToken === scanValue);

    if (!utente) {
      setStatus('QR inválido');
      return;
    }

    const locationMap: {[key: string]: string} = {
      'G_GINASIO': 'Ginásio',
      'G_PISCINA': 'Piscina Coberta',
      'G_MODALIDADE': utente.modalidade || 'Aula de Grupo',
      'G_LIVRE': 'Ginásio'
    };

    const targetLocation = !utente.isInside ? (locationMap[portal] || 'Ginásio') : null;

    if (!utente.isInside) {
      await handleCheckIn(utente, targetLocation || 'Ginásio');
      setStatus(`Entrada validada: ${utente.n || utente.nome}`);
    } else {
      await handleCheckOut(utente);
      setStatus(`Saída validada: ${utente.n || utente.nome}`);
    }

    onResult({ ...utente, isInside: !utente.isInside, location: targetLocation || undefined });
  };

  const startRealCameraScan = async () => {
    setScanning(true);
    setStatus('A abrir câmara...');
    setCameraError('');

    let scanner: any;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      scanner = new Html5Qrcode(scannerRegionId);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText: string) => {
          setStatus('QR detetado, a validar...');
          await scanner.stop();
          await scanner.clear();
          await processScanValue(decodedText.trim());
          setScanning(false);
        },
        () => {}
      );
      setStatus('Aponte para o QR do utente');
    } catch (e) {
      console.error(e);
      setCameraError('Não foi possível usar a câmara. Verifica permissão e HTTPS.');
      setStatus('Falha na câmara');
      if (scanner) {
        try { await scanner.stop(); } catch {}
        try { await scanner.clear(); } catch {}
      }
      setScanning(false);
    } finally {
      // keep scanning state until successful detection or explicit fail
    }
  };

  const simulateScan = async () => {
    setScanning(true);
    try {
      const sample = utentes.find(u => u.role === 'utente') || utentes[0];
      if (!sample) return;
      const portals = ['G_LIVRE', 'G_GINASIO', 'G_PISCINA', 'G_MODALIDADE'];
      const randomPortal = portals[Math.floor(Math.random() * portals.length)];
      await processScanValue(`${randomPortal}:${sample.id}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar leitura digital.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#004D71] flex flex-col items-center justify-center p-6 text-white text-center">
       <button onClick={onBack} className="absolute top-8 left-6 p-3 bg-white/10 rounded-full active:scale-90 shadow-lg"><ArrowLeft size={24}/></button>
       <div className="space-y-4 mb-12">
          <div className="w-20 h-20 bg-[#F7B500] rounded-3xl mx-auto flex items-center justify-center shadow-lg border-4 border-white/20"><Scan size={40} className="text-[#004D71]"/></div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Validador Vila de Rei</h2>
          <p className="text-sm opacity-60 max-w-xs mx-auto uppercase text-[10px] tracking-widest">Aponte para o QR Code do Utente</p>
       </div>
       <div id={scannerRegionId} className="w-full max-w-[300px] aspect-square bg-black/40 rounded-[3rem] border-4 border-dashed border-[#F7B500] relative flex items-center justify-center overflow-hidden">
          <div className={`scan-line w-full h-[2px] absolute top-0 bg-[#F7B500] shadow-[0_0_15px_#F7B500] ${scanning ? 'animate-bounce' : ''}`}></div>
          <PicotoIcon size={40} className="text-white opacity-20" />
       </div>
       <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-white/70">{status}</p>
       {cameraError && <p className="mt-2 text-[10px] font-black text-red-300 uppercase">{cameraError}</p>}
       <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
       <button 
         onClick={startRealCameraScan} 
         disabled={scanning}
         className="bg-[#F7B500] text-[#004D71] px-8 py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 text-xs disabled:opacity-50"
       >
         {scanning ? 'A VALIDAR...' : 'Ler com Câmara'}
       </button>
       <button 
         onClick={simulateScan} 
         disabled={scanning}
         className="bg-white text-[#004D71] px-8 py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 text-xs disabled:opacity-50"
       >
         Simular Leitura
       </button>
       </div>
    </div>
  );
}
