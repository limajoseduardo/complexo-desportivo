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
import { AccessLogsModule } from './components/AccessLogs';
import { AgendaModule } from './components/Agenda';
import { QrCode, Shield } from 'lucide-react';
import { LoginScreen, Header, DesktopSidebar, MobileNav, ModePicker } from './components/Layout';
import { UserProfile } from './types';
import { PicotoIcon } from './components/Common';
import { auth, db, handleFirestoreError, OperationType, APP_ID } from './lib/firebase';
import { REAL_STAFF } from './lib/seed';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  doc, setDoc, onSnapshot, collection, query,
  where, limit, orderBy, getDocs, writeBatch,
  collectionGroup
} from 'firebase/firestore';

export { APP_ID };

const normalizeRole = (role?: string, email?: string): UserProfile['role'] => {
  const e = (email || '').toLowerCase().trim();
  if (e.includes('admin@') || e.includes('informatica@')) return 'admin';
  if (e.includes('patricia.novo') || e.includes('tiago.lopes') || e.includes('jose.silva') || e.includes('staff@')) return 'staff';
  if (e.includes('chefia@')) return 'chefia';
  if (e.includes('professor@')) return 'professor';
  const normalized = (role || 'utente').toString().toLowerCase();
  return ['admin', 'staff', 'chefia', 'professor', 'utente'].includes(normalized)
    ? normalized as UserProfile['role']
    : 'utente';
};

const TABS_BY_ROLE: Record<string, string[]> = {
  admin:     ['inicio', 'utentes', 'acessos', 'exercicios', 'mapas', 'agenda', 'mensagens', 'perfil'],
  chefia:    ['inicio', 'utentes', 'acessos', 'exercicios', 'mapas', 'agenda', 'perfil'],
  staff:     ['inicio', 'utentes', 'acessos', 'mapas', 'agenda', 'mensagens', 'perfil'],
  professor: ['inicio', 'alunos', 'exercicios', 'mapas', 'agenda', 'mensagens', 'perfil'],
  utente:    ['inicio', 'treino', 'mensagens', 'agenda', 'perfil'],
};

export const ProfileViewModuleCustom = React.memo(({ user, setActiveTab, onLogout, setUser }: {
  user: UserProfile,
  setActiveTab: (t: string) => void,
  onLogout: () => void,
  setUser?: (u: UserProfile) => void
}) => {
  return (
    <div className="animate-in fade-in pb-32 font-sans text-left px-1">
      <ProfileViewModule user={user} onLogout={onLogout} setUser={setUser} />
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
  const [activeTabState, setActiveTabState] = useState(() => {
    try {
      const saved = localStorage.getItem('cpx_v33_session');
      const savedTab = localStorage.getItem('cpx_active_tab');
      if (saved && savedTab) {
        const parsed = JSON.parse(saved);
        const role = normalizeRole(parsed.role, parsed.email);
        const valid = TABS_BY_ROLE[role] || ['inicio'];
        if (valid.includes(savedTab)) return savedTab;
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        return 'inicio';
      }
    } catch (e) {}
    return 'inicio';
  });
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

  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = React.useRef(0);

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

    // One-time seeding — use localStorage so it survives F5
    if (!localStorage.getItem('cpx_init_seed')) {
      const seed = async () => {
        try {
          const usersPath = `artifacts/${APP_ID}/public/data/users`;
          let batch = writeBatch(db);
          REAL_STAFF.forEach(staff => {
            batch.set(doc(db, usersPath, staff.id), staff, { merge: true });
          });
          await batch.commit();
          localStorage.setItem('cpx_init_seed', 'true');
        } catch (e) {
          console.warn("Seed failed:", e);
        }
      };
      seed();
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
      const qRecent = query(collection(db, usersPath), orderBy('updatedAt', 'desc'), limit(500));
      unsubRecent = onSnapshot(qRecent, (snap) => {
        setUtentesRecent(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
      }, (error) => {
        const qFallback = query(collection(db, usersPath), limit(500));
        unsubRecent = onSnapshot(qFallback, (snapFallback) => {
          setUtentesRecent(snapFallback.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
        });
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

    const qC = query(collection(db, pathC), orderBy('timestamp', 'desc'), limit(15));
    const unsubC = onSnapshot(qC, (snap) => {
      mergeLogs(snap.docs.map(d => ({ ...d.data(), id: d.id, tipo: 'coberta' })), 'coberta');
    }, (err) => handleFirestoreError(err, OperationType.GET, pathC));

    const qD = query(collection(db, pathD), orderBy('timestamp', 'desc'), limit(15));
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
        />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header user={user} onReportBug={() => setShowBugReport(true)} unreadCount={totalUnread} isVisible={isNavVisible} />
          <BugReportModule user={user} isOpen={showBugReport} onClose={() => setShowBugReport(false)} showButton={false} />
          
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
                {activeTab === 'alunos' && <UtentesList onUserClick={setViewingProfile} utentes={utentes} title="Os Meus Alunos" canAdd={user.role === 'professor' || user.role === 'admin'} />}
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

          {user.email === 'informatica@cm-viladerei.pt' && (
            <button
              onClick={() => setShowModePicker(true)}
              className="fixed bottom-24 left-6 bg-slate-800 text-[#F7B500] px-4 py-3 rounded-2xl shadow-2xl z-40 active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase border-2 border-slate-700"
            >
              <Shield size={16}/> Trocar Modo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
