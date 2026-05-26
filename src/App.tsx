/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ModalitiesDashboard, UtenteDashboard, StaffDashboard } from './components/Dashboards';
import { EntranceDashboard } from './components/EntranceDashboard';
import { UtentesList, ScannerScreen } from './components/Utentes';
import { BugReportModule } from './components/BugReport';
import { ProfileViewModule } from './components/Profile';
import { MapsManager } from './components/Maps';
import { ExerciseGallery } from './components/Exercises';
import { ChatModule } from './components/Chat';
import { UtenteTrainingModule } from './components/UtenteTraining';
import { TrainerTrainingModule } from './components/TrainerTrainingPlans';
import { AccessLogsModule } from './components/AccessLogs';
import { AgendaModule } from './components/Agenda';
import { KioskMode } from './components/KioskMode';
import { SwimmingTeacherPortal, seedSwimmingData } from './components/SwimmingModule';
import { seedUtentesTestData } from './lib/seedUtentes';
import { QrCode, Shield, Radio, X, Check, MonitorSmartphone } from 'lucide-react';
import { LoginScreen, Header, DesktopSidebar, MobileNav, ModePicker } from './components/Layout';
import { UserProfile } from './types';
import { PicotoIcon } from './components/Common';
import { auth, db, handleFirestoreError, OperationType, APP_ID } from './lib/firebase';
import { REAL_STAFF } from './lib/seed';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useRfidScanner, playBeep } from './lib/accessListener';
import { handleCheckIn, handleCheckOut } from './lib/access';
import {
  doc, setDoc, onSnapshot, collection, query,
  where, limit, orderBy, getDocs, writeBatch,
  collectionGroup, getDoc
} from 'firebase/firestore';

export { APP_ID };

const normalizeRole = (role?: string, email?: string): UserProfile['role'] => {
  const e = (email || '').toLowerCase().trim();
  
  // ADMIN & DIREÇÃO TÉCNICA
  if (e.includes('admin@') || e.includes('informatica@') || e === 'eduardo.oliveira@cm-viladerei.pt') return 'admin';
  
  // STAFF E RECEÇÃO
  if (e === 'josemaria.silva@cm-viladerei.pt' || e === 'patricia.novo@cm-viladerei.pt' || e === 'tiago.lopes@cm-viladerei.pt' || e.includes('staff@')) return 'staff';
  
  // PROFESSORES
  if (e === 'nelson.rolo@cm-viladerei.pt' || e === 'claudia.rechena@cm-viladerei.pt' || e.includes('professor@')) return 'professor';
  
  if (e.includes('chefia@')) return 'chefia';
  
  const normalized = (role || 'utente').toString().toLowerCase();
  return ['admin', 'staff', 'chefia', 'professor', 'utente'].includes(normalized)
    ? normalized as UserProfile['role']
    : 'utente';
};

const TABS_BY_ROLE: Record<string, string[]> = {
  admin:     ['inicio', 'utentes', 'acessos', 'alunos', 'planos', 'exercicios', 'mapas', 'agenda', 'mensagens', 'perfil'],
  chefia:    ['inicio', 'utentes', 'acessos', 'exercicios', 'mapas', 'agenda', 'perfil'],
  staff:     ['inicio', 'utentes', 'acessos', 'mapas', 'agenda', 'mensagens', 'perfil'],
  professor: ['inicio', 'alunos', 'planos', 'exercicios', 'mapas', 'agenda', 'mensagens', 'perfil'],
  utente:    ['inicio', 'treino', 'mensagens', 'agenda', 'perfil'],
};

export const ProfileViewModuleCustom = React.memo(({ user, setActiveTab, onLogout, setUser, onReportBug }: {
  user: UserProfile,
  setActiveTab: (t: string) => void,
  onLogout: () => void,
  setUser?: (u: UserProfile) => void,
  onReportBug?: () => void
}) => {
  return (
    <div className="animate-in fade-in pb-32 font-sans text-left px-1">
      <ProfileViewModule user={user} onLogout={onLogout} setUser={setUser} onReportBug={onReportBug} />
    </div>
  );
});

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cpx_v33_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.role = normalizeRole(parsed.role, parsed.email);
        return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [activeTabState, setActiveTabState] = useState('acessos');
  const activeTab = activeTabState;
  const setActiveTab = (tab: string) => { setActiveTabState(tab); localStorage.setItem('cpx_active_tab', tab); };
  const [authError, setAuthError] = useState('');
  const [showPublicDashboard, setShowPublicDashboard] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [rfidToast, setRfidToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [latestAviso, setLatestAviso] = useState<{ id: string; titulo: string; mensagem: string; nomeProfessor: string } | null>(null);
  const [avisoDismissed, setAvisoDismissed] = useState(false);
  const [showRfidSimulator, setShowRfidSimulator] = useState(false);
  const [simRfidUid, setSimRfidUid] = useState('');
  const [showKioskMode, setShowKioskMode] = useState(false);
  const [kioskScanResult, setKioskScanResult] = useState<{ type: 'success' | 'error'; user?: UserProfile; message: string } | null>(null);

  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = React.useRef(0);

  // Clear RFID Toast after timeout
  useEffect(() => {
    if (rfidToast) {
      const timer = setTimeout(() => setRfidToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [rfidToast]);

  // Sync latest global announcement
  useEffect(() => {
    if (!user) return;
    const path = `artifacts/${APP_ID}/public/data/avisos_globais`;
    const q = query(collection(db, path), orderBy('dataCriacao', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const id = snap.docs[0].id;
        
        const readId = localStorage.getItem('read_announcement_id');
        if (readId === id) {
          setAvisoDismissed(true);
        } else {
          setAvisoDismissed(false);
        }

        const dataCriacao = data.dataCriacao?.toDate ? data.dataCriacao.toDate() : new Date(data.dataCriacao || Date.now());
        const ageHours = (Date.now() - dataCriacao.getTime()) / (1000 * 60 * 60);
        if (ageHours < 48) {
          setLatestAviso({
            id,
            titulo: data.titulo || 'Aviso Importante',
            mensagem: data.mensagem || '',
            nomeProfessor: data.nomeProfessor || 'Professor'
          });
        } else {
          setLatestAviso(null);
        }
      } else {
        setLatestAviso(null);
      }
    }, (err) => {
      console.warn("Avisos sync err:", err);
    });
    return () => unsub();
  }, [user?.id]);

  const dismissAviso = () => {
    if (latestAviso) {
      localStorage.setItem('read_announcement_id', latestAviso.id);
      setAvisoDismissed(true);
    }
  };

  const processRfidScan = async (uid: string) => {
    const foundUser = utentes.find(u => (u.rfidUid || '').trim() === uid.trim());
    if (foundUser) {
      try {
        if (foundUser.isInside) {
          await handleCheckOut(foundUser);
          setRfidToast({ message: `Saída Validada: ${foundUser.nome || foundUser.n || 'Utente'}`, type: 'success' });
          setKioskScanResult({ type: 'success', user: foundUser, message: 'Saída Validada' });
          playBeep('success');
        } else {
          await handleCheckIn(foundUser, foundUser.modalidade || 'Ginásio');
          const remaining = Math.max(0, (foundUser.entradas_disponiveis || 0) - 1);
          setRfidToast({ message: `Entrada Validada: ${foundUser.nome || foundUser.n || 'Utente'} (${foundUser.modalidade || 'Ginásio'})`, type: 'success' });
          setKioskScanResult({ type: 'success', user: foundUser, message: `Entradas Restantes: ${remaining}` });
          playBeep('success');
        }
      } catch (e: any) {
        console.error(e);
        const errMsg = e.message || `Erro ao processar cartão para ${foundUser.nome || foundUser.n}`;
        setRfidToast({ message: errMsg, type: 'error' });
        setKioskScanResult({ type: 'error', user: foundUser, message: errMsg });
        playBeep('error');
      }
    } else {
      setRfidToast({ message: `Cartão RFID não registado: ${uid}`, type: 'error' });
      setKioskScanResult({ type: 'error', message: `Cartão não encontrado no sistema` });
      playBeep('error');
    }
    
    // Auto-dismiss Kiosk screen after 4 seconds
    setTimeout(() => {
      setKioskScanResult(null);
    }, 4000);
  };

  // Setup RFID key listener hook
  useRfidScanner(processRfidScan);

  const handleMainScroll = React.useCallback((e: React.UIEvent<HTMLElement>) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY < 50) {
      setIsNavVisible(true); // Mostrar sempre se estiver no topo
    } else if (currentScrollY > lastScrollY.current + 10) {
      setIsNavVisible(false); // A descer (esconder)
    } else if (currentScrollY < lastScrollY.current - 10) {
      setIsNavVisible(true); // A subir (mostrar)
    }
    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collectionGroup(db, 'messages'),
      where('receiverEmail', '==', user.email),
      where('read', '==', false)
    );
    return onSnapshot(q, (snap) => {
      setTotalUnread(snap.size);
    });
  }, [user?.email]);


  useEffect(() => {
    // Session Restoration and Auth Listeners
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        try {
          await signInAnonymously(auth);
        } catch (e: any) {
          if (e.code === 'auth/admin-restricted-operation' || e.code === 'auth/operation-not-allowed') {
            console.warn("Anonymous auth requested but not enabled in Firebase Console.");
          }
        }
      }
      setLoading(false);
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    // One-time seeding — check database sentinel first
    if (!localStorage.getItem('cpx_init_seed')) {
      const seed = async () => {
        try {
          const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'init');
          const sentinelSnap = await getDoc(sentinelRef);
          if (sentinelSnap.exists()) {
            localStorage.setItem('cpx_init_seed', 'true');
            return;
          }
          const usersPath = `artifacts/${APP_ID}/public/data/users`;
          let batch = writeBatch(db);
          REAL_STAFF.forEach(staff => {
            batch.set(doc(db, usersPath, staff.id), staff, { merge: true });
          });
          await batch.commit();
          await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
          localStorage.setItem('cpx_init_seed', 'true');
        } catch (e) {
          console.warn("Seed failed:", e);
        }
      };
      seed();
    }

    // Auto-inserir aulas de Fitness pedidas
    if (!localStorage.getItem('cpx_seed_fitness')) {
      const seedFitness = async () => {
        try {
          const sentinelRef = doc(db, `artifacts/${APP_ID}/public/data/sentinels`, 'fitness');
          const sentinelSnap = await getDoc(sentinelRef);
          if (sentinelSnap.exists()) {
            localStorage.setItem('cpx_seed_fitness', 'true');
            return;
          }
          const agendaPath = `artifacts/${APP_ID}/public/data/agenda`;
          const batch = writeBatch(db);
          const aulas = [
            { diaSemana: 1, horaInicio: '18:30', horaFim: '19:15', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' },
            { diaSemana: 4, horaInicio: '18:30', horaFim: '19:15', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' },
            { diaSemana: 6, horaInicio: '10:35', horaFim: '11:20', modalidade: 'Aulas Fitness', categoria: 'Aulas Fitness', professor: 'Cláudia Rechena', vagas: 20, sala: 'Estúdio / Ginásio', color: '#a855f7' }
          ];
          aulas.forEach(a => batch.set(doc(collection(db, agendaPath)), a));
          await batch.commit();
          await setDoc(sentinelRef, { seededAt: new Date().toISOString() });
          localStorage.setItem('cpx_seed_fitness', 'true');
        } catch (e) {
          console.warn("Seed fitness failed:", e);
        }
      };
      seedFitness();
    }

    // Auto-inserir dados de natação Swim Track
    if (!localStorage.getItem('cpx_seed_swimming_v3')) {
      seedSwimmingData();
    }

    // Auto-inserir utentes de teste
    if (!localStorage.getItem('cpx_seed_utentes_v3')) {
      seedUtentesTestData();
    }

    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  // Sync Utentes/Staff
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [utentesRecent, setUtentesRecent] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!user) {
       setUtentesInside([]);
       setUtentesRecent([]);
       return;
    }

    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    
    // 1. Carregar quem está no recinto (AGORA PARA TODOS, para os números de afluência funcionarem)
    let unsubInside: () => void;
    const qInside = query(collection(db, usersPath), where('isInside', '==', true));
    unsubInside = onSnapshot(qInside, (snap) => {
      setUtentesInside(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, (error) => {
      console.warn("Inside users query failed:", error.message);
    });

    // 2. Carregar o resto dos utentes conforme o cargo
    let unsubRecent: () => void;
    const isStaff = ['admin', 'chefia', 'staff', 'professor'].includes(user.role);
    
    if (isStaff) {
      const qRecent = query(collection(db, usersPath), limit(500));
      unsubRecent = onSnapshot(qRecent, (snap) => {
        setUtentesRecent(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
      });
    } else {
      const qSelf = query(collection(db, usersPath), where('id', '==', user.id));
      unsubRecent = onSnapshot(qSelf, (snap) => {
        setUtentesRecent(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
      });
    }

    return () => { 
      unsubInside?.(); 
      unsubRecent?.(); 
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.email) return;
    const usersPath = `artifacts/${APP_ID}/public/data/users`;
    const qEmail = query(collection(db, usersPath), where('email', '==', user.email), limit(1));

    const unsub = onSnapshot(qEmail, (snap) => {
      if (snap.empty) return;
      const fresh = { id: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;
      const normalizedRole = normalizeRole(fresh.role, fresh.email || user.email);
      const updatedUser = {
        ...user,
        ...fresh,
        role: normalizedRole,
        cargo: fresh.cargo || (normalizedRole === 'chefia' ? 'Direção Municipal' : normalizedRole.toUpperCase()),
      };

      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        setUser(updatedUser);
        localStorage.setItem('cpx_v33_session', JSON.stringify(updatedUser));
      }
    }, (error) => {
      console.warn('Falha ao atualizar sessão de utilizador:', error.message);
    });

    return () => unsub();
  }, [user?.email]);

  // Combined utentes list
  const utentes = React.useMemo(() => {
    const combined = [...utentesInside];
    
    // Also include those from recent who are inside but maybe missed by the query
    utentesRecent.forEach(r => {
      if (r.isInside && !combined.find(c => c.id === r.id)) {
        combined.push(r);
      }
    });

    utentesRecent.forEach(r => {
      if (!combined.find(c => c.id === r.id)) {
        combined.push(r);
      }
    });
    return combined;
  }, [utentesInside, utentesRecent]);

  // Sync Logs
  useEffect(() => {
    if (!user || user.role === 'utente') return;
    
    const pathC = `artifacts/${APP_ID}/public/data/mapas_coberta`;
    const pathD = `artifacts/${APP_ID}/public/data/mapas_descoberta`;

    const mergeLogs = (newLogs: any[], type: string) => {
      setLogs(prev => {
        const filtered = prev.filter(p => p.tipo !== type);
        return [...filtered, ...newLogs].sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      });
    };

    const qC = query(collection(db, pathC), orderBy('timestamp', 'desc'), limit(50));
    const unsubC = onSnapshot(qC, (snap) => {
      mergeLogs(snap.docs.map(d => ({ ...d.data(), id: d.id, tipo: 'coberta' })), 'coberta');
    }, (err) => handleFirestoreError(err, OperationType.GET, pathC));

    const qD = query(collection(db, pathD), orderBy('timestamp', 'desc'), limit(50));
    const unsubD = onSnapshot(qD, (snap) => {
      mergeLogs(snap.docs.map(d => ({ ...d.data(), id: d.id, tipo: 'descoberta' })), 'descoberta');
    }, (err) => handleFirestoreError(err, OperationType.GET, pathD));

    return () => { unsubC(); unsubD(); };
  }, [user?.id, user?.role]);

  const handleLogin = React.useCallback(async (emailInput: string, pass: string) => {
    setAuthError('');
    setLoading(true);

    try {
      const emailLower = emailInput.toLowerCase();

      let fbUser = auth.currentUser;
      if (!fbUser) {
        try {
          const cred = await signInAnonymously(auth);
          fbUser = cred.user;
        } catch (e) {
          console.warn("Firebase Anonymous Auth failed. Continuing locally.", e);
        }
      }

      let userId = fbUser?.uid || `local_${Date.now()}`;
      let existingProfile = null;
      
      if (fbUser) {
        try {
          const usersPath = `artifacts/${APP_ID}/public/data/users`;
          const qEmail = query(collection(db, usersPath), where('email', '==', emailLower), limit(1));
          const emailSnap = await getDocs(qEmail);
          if (!emailSnap.empty) {
            userId = emailSnap.docs[0].id;
            existingProfile = emailSnap.docs[0].data() as any;
          }
        } catch (err) {
           console.warn("Could not fetch existing profile from Firestore:", err);
        }
      }

        // Verifica a Palavra-passe
        if (existingProfile) {
          const expectedPass = existingProfile.password || '123456';
          if (pass !== expectedPass) {
             setAuthError('Palavra-passe incorreta.');
             setLoading(false);
             return;
          }
        } else {
          // Se a pessoa não existir e tentar outra pass que não a padrão
          if (pass !== '123456' && emailLower !== 'admin@cm-viladerei.pt') {
             setAuthError('Utilizador não encontrado ou palavra-passe errada.');
             setLoading(false);
             return;
          }
        }

      const roleCandidate = existingProfile?.role || (emailLower.includes('admin') ? 'admin' : 'utente');
      const effectiveRole = normalizeRole(roleCandidate?.toString(), emailLower);

      const finalProfile: UserProfile = {
         ...existingProfile,
         id: userId!,
         email: emailLower,
           role: effectiveRole,
           password: existingProfile?.password || pass,
         n: existingProfile?.n || existingProfile?.nome || emailInput.split('@')[0].toUpperCase(),
         nome: existingProfile?.nome || existingProfile?.n || emailInput.split('@')[0].toUpperCase(),
         cargo: (effectiveRole === 'chefia' ? 'Direção Municipal' : effectiveRole.toUpperCase()),
         img: existingProfile?.img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${effectiveRole}`,
         lastLogin: new Date().toISOString()
      };

      const isInfoAccount = emailLower === 'informatica@cm-viladerei.pt';

      // Atomic sync to Firestore
      try {
        if (fbUser) {
          const userDocRef = doc(db, `artifacts/${APP_ID}/public/data/users`, userId!);
          await setDoc(userDocRef, finalProfile, { merge: true });
        }
        setUser(finalProfile);
        localStorage.setItem('cpx_v33_session', JSON.stringify(finalProfile));
        if (isInfoAccount) { setShowModePicker(true); } else { setActiveTab('inicio'); }
      } catch (syncErr: any) {
        console.warn("Cloud Sync Error during jump:", syncErr);
        setUser(finalProfile);
        localStorage.setItem('cpx_v33_session', JSON.stringify(finalProfile));
        if (isInfoAccount) { setShowModePicker(true); } else { setActiveTab('inicio'); }
        if (syncErr.message?.includes('permission')) {
          setAuthError('Ligação local ativa. Nota: Anonymous Auth precisa estar ativo na consola Firebase.');
        } else {
          setAuthError('Sessão local iniciada. Sincronização pendente.');
        }
      }
    } catch (err: any) {
      console.error("Fatal Login Error:", err);
      setAuthError(`Erro de Acesso: ${err.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Sign out failed:", e);
    }
    setUser(null);
    localStorage.removeItem('cpx_v33_session');
    localStorage.removeItem('cpx_active_tab');
    localStorage.removeItem('cpx_init_seed');
    setViewingProfile(null);
    setActiveTabState('inicio');
  }, []);

  if (loading) {
     return (
       <div className="min-h-screen bg-[#004D71] flex items-center justify-center p-6 text-white">
         <div className="text-center space-y-4">
            <QrCode size={60} className="mx-auto animate-pulse text-[#F7B500]" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Vila de Rei</h2>
            <div className="flex gap-1 justify-center">
               <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
               <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
         </div>
       </div>
     );
  }

  const isPublicDashboard = showPublicDashboard || (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('view') === 'tv' || window.location.pathname.includes('/tv')));
  if (isPublicDashboard) return <EntranceDashboard appId={APP_ID} onBack={showPublicDashboard ? () => setShowPublicDashboard(false) : undefined} />;

  if (!user) return <LoginScreen onLogin={handleLogin} error={authError} onPublicDashboard={() => setShowPublicDashboard(true)} />;

  if (showModePicker) return (
    <ModePicker onSelect={(role) => {
      setUser({ ...user, role: role as any, cargo: role === 'chefia' ? 'Direção Municipal' : role.toUpperCase() });
      setActiveTab('inicio');
      setShowModePicker(false);
    }} />
  );

  return (
    <div className="app-shell font-sans">
      {showKioskMode && (
        <KioskMode 
          scanResult={kioskScanResult} 
          onExit={() => setShowKioskMode(false)} 
        />
      )}
      {showScanner && (
        <ScannerScreen 
          utentes={utentes} 
          onBack={() => setShowScanner(false)} 
          onResult={(u) => { setShowScanner(false); setViewingProfile(u); }} 
        />
      )}
      
      <div className="flex h-full w-full bg-slate-50 overflow-hidden relative">
        <DesktopSidebar 
          activeTab={activeTab} 
          setActiveTab={(t) => { setActiveTab(t); setViewingProfile(null); }} 
          onLogout={handleLogout} 
          user={user} 
          unreadCount={totalUnread}
          onSimularRfid={() => setShowRfidSimulator(true)}
          onKioskMode={() => setShowKioskMode(true)}
          onTrocarModo={() => setShowModePicker(true)}
        />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header user={user} unreadCount={totalUnread} isVisible={isNavVisible} />
          <BugReportModule user={user} isOpen={showBugReport} onClose={() => setShowBugReport(false)} showButton={false} />
          
          {latestAviso && !avisoDismissed && (
            <div className="bg-[#F7B500] text-[#004D71] px-6 py-4 flex items-center justify-between border-b-2 border-[#004D71]/10 shadow-sm shrink-0 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <span className="text-xl">📢</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">{latestAviso.titulo}</h4>
                  <p className="text-xs font-medium opacity-90 mt-0.5">{latestAviso.mensagem} — <span className="font-bold">{latestAviso.nomeProfessor}</span></p>
                </div>
              </div>
              <button 
                onClick={dismissAviso}
                className="p-2 hover:bg-[#004D71]/10 rounded-xl transition-colors text-[#004D71]"
              >
                <X size={16}/>
              </button>
            </div>
          )}
          
          <main className="content-area hide-scrollbar p-4 lg:p-10" onScroll={handleMainScroll}>
            {viewingProfile ? (
              <ProfileViewModule 
                user={viewingProfile} 
                onLogout={() => setViewingProfile(null)} 
                isExternalView={true} 
                currentRole={user.role}
              />
            ) : (
              <>
                {user.role === 'utente' && activeTab === 'inicio' && <UtenteDashboard user={user} utentes={utentes} />}
                {activeTab === 'inicio' && user.role === 'staff' && (
                  <StaffDashboard 
                    user={user} 
                    utentes={utentes} 
                    onUserClick={setViewingProfile} 
                    onLogout={handleLogout}
                  />
                )}
                {activeTab === 'inicio' && !['utente', 'staff'].includes(user.role) && (
                  <ModalitiesDashboard 
                    onUserClick={setViewingProfile} 
                    logs={logs} 
                    utentes={utentes} 
                  />
                )}
                {activeTab === 'utentes' && <UtentesList onUserClick={setViewingProfile} utentes={utentes} canAdd={['admin', 'staff', 'chefia'].includes(user.role)} />}
                {activeTab === 'alunos' && (
                  ['professor', 'admin'].includes(user.role) ? (
                    <SwimmingTeacherPortal user={user} utentes={utentes} />
                  ) : (
                    <UtentesList onUserClick={setViewingProfile} utentes={utentes} title="Os Meus Alunos" canAdd={false} />
                  )
                )}
                {activeTab === 'planos' && ['professor', 'admin'].includes(user.role) && <TrainerTrainingModule user={user} />}
                {activeTab === 'exercicios' && <ExerciseGallery user={user} />}
                {activeTab === 'mapas' && <MapsManager user={user} logs={logs} />} {/* Moved maps up */}
                {activeTab === 'treino' && user.role === 'utente' && <UtenteTrainingModule user={user} />}
                {activeTab === 'acessos' && <AccessLogsModule onScan={() => setShowScanner(true)} />}
                {activeTab === 'mensagens' && <ChatModule user={user} users={utentes} />}
                {activeTab === 'agenda' && <AgendaModule userRole={user.role} user={user} />}
                {activeTab === 'perfil' && (
                  <ProfileViewModuleCustom 
                    user={user} 
                    onLogout={handleLogout} 
                    setUser={(updatedUser) => {
                      setUser(updatedUser);
                      localStorage.setItem('cpx_v33_session', JSON.stringify(updatedUser));
                    }}
                    onReportBug={() => setShowBugReport(true)}
                    setActiveTab={setActiveTab}
                  />
                )}
              </>
            )}
          </main>

          <MobileNav 
            role={user.role} 
            activeTab={activeTab} 
            setActiveTab={(t) => { setActiveTab(t); setViewingProfile(null); setIsNavVisible(true); }} 
            unreadCount={totalUnread}
            isVisible={isNavVisible}
          />

          {user.role !== 'utente' && (
            <button
              onClick={() => setShowScanner(true)}
              className="lg:hidden fixed bottom-24 right-6 bg-[#F7B500] text-[#004D71] p-4 rounded-full shadow-2xl z-40 active:scale-95 border-2 border-[#004D71]"
            >
              <QrCode size={24} />
            </button>
          )}

          {/* RFID Scanner Simulator Dialog */}
          {showRfidSimulator && (
            <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative">
                <button 
                  onClick={() => { setShowRfidSimulator(false); setSimRfidUid(''); }} 
                  className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl active:scale-90"
                >
                  <X size={20}/>
                </button>
                
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-[#004D71]/5 text-[#004D71] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Radio size={40} className="animate-pulse"/>
                  </div>
                  <h3 className="text-xl font-black text-[#004D71] uppercase leading-none">Simulador RFID</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Introduza um UID de cartão ou escolha um utente</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">UID do Cartão</label>
                    <input 
                      type="text"
                      placeholder="Ex: 12345678"
                      value={simRfidUid}
                      onChange={(e) => setSimRfidUid(e.target.value)}
                      className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl px-6 py-4 font-black text-xs text-[#004D71] outline-none"
                    />
                  </div>

                  {/* Quick-select registered RFID users */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Utentes com RFID</label>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                      {utentes.filter(u => u.rfidUid).map(u => (
                        <button 
                          key={u.id}
                          onClick={() => setSimRfidUid(u.rfidUid || '')}
                          className="w-full text-left px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-[#F7B500] text-[10px] font-black uppercase text-[#004D71] flex justify-between items-center"
                        >
                          <span>{u.n || u.nome}</span>
                          <span className="text-[8px] font-mono text-slate-400 font-bold">{u.rfidUid}</span>
                        </button>
                      ))}
                      {utentes.filter(u => u.rfidUid).length === 0 && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase text-center py-4">Nenhum utente tem RFID registado</p>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (simRfidUid.trim()) {
                      processRfidScan(simRfidUid.trim());
                      setShowRfidSimulator(false);
                      setSimRfidUid('');
                    }
                  }}
                  disabled={!simRfidUid.trim()}
                  className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-5 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  Simular Leitura
                </button>
              </div>
            </div>
          )}

          {/* Floating RFID Toast */}
          {rfidToast && (
            <div className={`fixed bottom-24 right-6 z-[200000] p-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 ${rfidToast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}>
              <div className="p-2 bg-white/20 rounded-xl">
                {rfidToast.type === 'success' ? <Check size={18}/> : <X size={18}/>}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{rfidToast.type === 'success' ? 'Leitor RFID' : 'Erro RFID'}</p>
                <p className="text-xs font-black uppercase mt-0.5">{rfidToast.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
