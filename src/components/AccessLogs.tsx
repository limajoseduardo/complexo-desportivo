import React, { useState, useEffect } from 'react';
import {
  Users, LogIn, LogOut, Calendar, Search,
  Download, BookOpen,
  FileText, Plus, X, Edit2, Save, Trash2, QrCode, Key,
  Dumbbell, Waves, Activity, Flame, Sun, Star, Users2, Droplets, CreditCard, Building2, Target
} from 'lucide-react';
import { AvatarImage, PicotoIcon } from './Common';
import { db, handleFirestoreError, OperationType, APP_ID } from '../lib/firebase';
import {
  collection, query, where, onSnapshot,
  Timestamp, limit, getDocs, setDoc, updateDoc,
  doc, serverTimestamp, deleteDoc, orderBy, writeBatch, deleteField
} from 'firebase/firestore';
import { AccessLog, UserProfile, Aula } from '../types';
import { TurmasModule } from './TurmasModule';
import { isUserInZone, normalizeSearchString } from '../lib/logic';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart, Bar, Cell } from 'recharts';
import { GlobalErrorBoundary as ErrorBoundary } from './ErrorBoundary';

export const getBasePrice = (age: number | null, modality: string, isWeekend: boolean) => {
  let basePrice = 0;
  const mod = (modality || '').toLowerCase();

  if (mod.includes('piscina') || mod.includes('natação')) {
    if (age !== null) {
      if (age >= 15) basePrice = isWeekend ? 2.79 : 2.10;
      else if (age >= 7) basePrice = isWeekend ? 1.39 : 1.09;
      else basePrice = 0; // Até 6 anos
    } else {
      basePrice = isWeekend ? 2.79 : 2.10; // Default adult
    }
  } else if (mod.includes('ginásio') || mod.includes('musculação')) {
    basePrice = isWeekend ? 1.69 : 1.39;
  }
  return basePrice;
};

function AccessLogsModuleInner({ onScan, currentUser, utentes = [], onUserClick }: { onScan?: () => void; currentUser?: UserProfile; utentes?: UserProfile[]; onUserClick?: (u: UserProfile) => void } = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AccessLog[]>([]);
  const [agendaAulas, setAgendaAulas] = useState<Aula[]>([]);
  const [profStatsMode, setProfStatsMode] = useState<'mes' | 'custom'>('mes');
  const [profStatsFrom, setProfStatsFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [profStatsTo, setProfStatsTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [profStatsLogs, setProfStatsLogs] = useState<AccessLog[]>([]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const usersMap = React.useMemo(() => {
    const m: Record<string, UserProfile> = {};
    utentes.forEach(u => {
      if (u.id) m[u.id] = u;
    });
    return m;
  }, [utentes]);

  // Manual Entry States
  const [showManualModal, setShowManualModal] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedModality, setSelectedModality] = useState('Piscina Regime Livre');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isRegisteringNewUser, setIsRegisteringNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editDate, setEditDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'inside'|'left'>('inside');
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
  const [showTurmas, setShowTurmas] = useState(false);
  const [confirmDeleteLog, setConfirmDeleteLog] = useState<AccessLog | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);
  const readOnly = currentUser?.role === 'chefia';

  const [modalMode, setModalMode] = useState<'single' | 'outdoor_pool'>('single');
  const [adultEntradas, setAdultEntradas] = useState(0);
  const [childEntradas, setChildEntradas] = useState(0);
  const [pavilhaoEntradas, setPavilhaoEntradas] = useState(0);
  const [padelEntradas, setPadelEntradas] = useState(0);
  const [isSubmittingSimple, setIsSubmittingSimple] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diario' | 'estatisticas' | 'caixa'>('diario');

  // CORREÇÃO E AUTO-CHECKOUT (19h)
  useEffect(() => {
    const runMaintenance = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
        const q = query(collection(db, path), where('date', '==', todayStr), where('modalidade', '==', 'Piscina Exterior'));
        const snap = await getDocs(q);
        
        const batch = writeBatch(db);
        let operations = 0;
        const now = new Date();

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const checkOut = data.checkOut;
          
          // 1. Corrigir os registos antigos (bug dos 60m)
          if (checkOut && data.durationMinutes === 0 && data.checkIn && Math.abs(checkOut.seconds - data.checkIn.seconds) < 5) {
            batch.update(docSnap.ref, { checkOut: deleteField(), durationMinutes: deleteField() });
            operations++;
          }
          else if (checkOut && data.durationMinutes === 0) {
            batch.update(docSnap.ref, { checkOut: deleteField(), durationMinutes: deleteField() });
            operations++;
          }

          // 2. Regra das 19h: se for >= 19h e estiver No Recinto, dar saída às 19:00
          if (!checkOut && now.getHours() >= 19) {
            const closingTime = new Date();
            closingTime.setHours(19, 0, 0, 0);
            const checkInDate = data.checkIn instanceof Timestamp ? data.checkIn.toDate() : new Date(data.checkIn);
            const durationMs = closingTime.getTime() - checkInDate.getTime();
            const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));

            batch.update(docSnap.ref, { 
              checkOut: Timestamp.fromDate(closingTime),
              durationMinutes
            });
            operations++;
          }
        });

        if (operations > 0) {
          await batch.commit();
          console.log(`Manutenção concluída: ${operations} registos da Piscina Exterior atualizados.`);
        }
      } catch (error) {
        console.error("Erro na manutenção da Piscina Exterior:", error);
      }
    };

    runMaintenance();
    const interval = setInterval(runMaintenance, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOutdoorPoolSubmit = () => {
    if (adultEntradas === 0 && childEntradas === 0) {
      alert("Por favor, adicione pelo menos uma entrada.");
      return;
    }

    // 1. Mostrar feedback de carregamento
    setIsSubmitting(true);

    // 2. Usar setTimeout para libertar o botão imediatamente da stack principal
    setTimeout(() => {
      try {
        const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
        const today = new Date().toISOString().split('T')[0];

        const batch = writeBatch(db);

        const addEntries = (count: number, label: string) => {
          const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
          
          for (let i = 0; i < count; i++) {
            const timestampMs = Date.now() + Math.random() * 1000 + i;
            const logId = `ext_${timestampMs}`;
            const logDocRef = doc(db, path, logId);
            
            let vPago = 0;
            if (label === 'ADULTO') {
              vPago = isWeekend ? 2.79 : 2.10;
            } else {
              vPago = isWeekend ? 1.39 : 1.09;
            }

            batch.set(logDocRef, {
              userId: `ext_entrada`,
              userName: `PISCINA EXTERIOR (${label})`,
              userRole: 'utente',
              checkIn: Timestamp.now(),
              date: today,
              zone: 'Piscina Exterior',
              modalidade: 'Piscina Exterior',
              timestamp: serverTimestamp(),
              valorPago: vPago
            });
          }
        };

        // Função auxiliar para remover
        const removeEntries = (countToRemove: number, label: string) => {
          const recentLogs = allDateLogs
            .filter(l => l.userId === 'ext_entrada' && l.date === today && l.userName.includes(label))
            .sort((a, b) => {
              const timeA = a.checkIn instanceof Timestamp ? a.checkIn.toMillis() : 0;
              const timeB = b.checkIn instanceof Timestamp ? b.checkIn.toMillis() : 0;
              return timeB - timeA;
            });
            
          const logsToRemove = recentLogs.slice(0, countToRemove);

          if (logsToRemove.length < countToRemove) {
            alert(`Atenção: Apenas foram encontrados ${logsToRemove.length} registos recentes de ${label} para remover hoje.`);
          }

          logsToRemove.forEach(log => {
            const logDocRef = doc(db, path, log.id);
            batch.delete(logDocRef);
          });
        };

        if (adultEntradas > 0) addEntries(adultEntradas, 'ADULTO');
        if (adultEntradas < 0) removeEntries(Math.abs(adultEntradas), 'ADULTO');

        if (childEntradas > 0) addEntries(childEntradas, 'CRIANÇA');
        if (childEntradas < 0) removeEntries(Math.abs(childEntradas), 'CRIANÇA');

        // 3. Executar o batch de forma "Optimista" sem usar 'await'.
        batch.commit().catch(error => {
          console.error("Erro ao enviar batch para o servidor:", error);
        });

        // 4. Limpar a UI imediatamente
        setAdultEntradas(0);
        setChildEntradas(0);
      } catch (error) {
        console.error("Error building batch:", error);
      } finally {
        setIsSubmitting(false);
      }
    }, 50);
  };

  // Registo rápido genérico de utilização anónima de um espaço (Pavilhão, Padel) —
  // mesmo padrão da Piscina Exterior, mas sem distinção adulto/criança nem preçário,
  // serve só para gerar dados reais de quantidade de uso do espaço.
  const handleSimpleSpaceSubmit = (modalidade: string, count: number, resetCount: () => void) => {
    if (count === 0) {
      alert('Por favor, ajuste o número de entradas.');
      return;
    }
    setIsSubmittingSimple(modalidade);
    setTimeout(() => {
      try {
        const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
        const today = new Date().toISOString().split('T')[0];
        const batch = writeBatch(db);

        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const logId = `ext_${Date.now() + Math.random() * 1000 + i}`;
            batch.set(doc(db, path, logId), {
              userId: 'ext_entrada',
              userName: modalidade.toUpperCase(),
              userRole: 'utente',
              checkIn: Timestamp.now(),
              date: today,
              zone: modalidade,
              modalidade,
              timestamp: serverTimestamp(),
            });
          }
        } else {
          const recentLogs = allDateLogs
            .filter(l => l.userId === 'ext_entrada' && l.date === today && l.modalidade === modalidade)
            .sort((a, b) => {
              const timeA = a.checkIn instanceof Timestamp ? a.checkIn.toMillis() : 0;
              const timeB = b.checkIn instanceof Timestamp ? b.checkIn.toMillis() : 0;
              return timeB - timeA;
            });
          const logsToRemove = recentLogs.slice(0, Math.abs(count));
          if (logsToRemove.length < Math.abs(count)) {
            alert(`Atenção: Apenas foram encontrados ${logsToRemove.length} registos recentes de ${modalidade} para remover hoje.`);
          }
          logsToRemove.forEach(log => batch.delete(doc(db, path, log.id)));
        }

        batch.commit().catch(error => console.error('Erro ao enviar batch para o servidor:', error));
        resetCount();
      } catch (error) {
        console.error('Error building batch:', error);
      } finally {
        setIsSubmittingSimple(null);
      }
    }, 50);
  };

  const generateInviteCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/invites`, code), {
        id: code,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
      setGeneratedInvite(code);
    } catch (e) {
      alert('Erro ao gerar convite.');
      console.error(e);
    }
  };

  const modalities = [
    'Piscina Regime Livre',
    'Piscina Exterior',
    'Natação',
    'Hidroginástica',
    'Bebés/AMA',
    'Aulas Fitness',
    'Ginásio',
    'Sauna',
    'Pavilhão',
    'Padel'
  ];

  const normalizeModality = (m: string) => {
    if (m?.startsWith('Natação Nível')) return 'Natação';
    return m;
  };

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/users`;
    const q = query(collection(db, path), where('isInside', '==', true));
    return onSnapshot(q, snap => {
      setUtentesInside(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, () => { });
  }, []);

  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = now.toISOString().split('T')[0];
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', monthStart), where('date', '<=', monthEnd));
    return onSnapshot(q, snap => {
      setMonthlyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessLog)));
    }, () => { });
  }, []);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/agenda`;
    return onSnapshot(collection(db, path), snap => {
      setAgendaAulas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Aula)));
    }, (err) => handleFirestoreError(err, OperationType.GET, path));
  }, []);

  useEffect(() => {
    const from = profStatsMode === 'mes'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
      : profStatsFrom;
    const to = profStatsMode === 'mes' ? new Date().toISOString().split('T')[0] : profStatsTo;
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, snap => {
      setProfStatsLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessLog)));
    }, (err) => handleFirestoreError(err, OperationType.GET, path));
  }, [profStatsMode, profStatsFrom, profStatsTo]);

  useEffect(() => {
    setLoading(true);
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;

    const q = query(
      collection(db, path),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessLog));
      const sorted = list.sort((a, b) => {
        const ta = a.checkIn instanceof Timestamp ? a.checkIn.seconds : (a.timestamp?.seconds || 0);
        const tb = b.checkIn instanceof Timestamp ? b.checkIn.seconds : (b.timestamp?.seconds || 0);
        return tb - ta;
      });
      setLogs(sorted);
      setLoading(false);
    }, (error) => {
      console.warn("Firestore access log query range error, falling back to all:", error);
      handleFirestoreError(error, OperationType.GET, path);
      const qFallback = query(collection(db, path), limit(500));
      onSnapshot(qFallback, (snapFallback) => {
        const list = snapFallback.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessLog));
        const sorted = list.sort((a, b) => {
          const ta = a.checkIn instanceof Timestamp ? a.checkIn.seconds : (a.timestamp?.seconds || 0);
          const tb = b.checkIn instanceof Timestamp ? b.checkIn.seconds : (b.timestamp?.seconds || 0);
          return tb - ta;
        });
        setLogs(sorted);
        setLoading(false);
      }, (e) => {
        handleFirestoreError(e, OperationType.GET, path);
        setLoading(false);
      });
    });

    return () => unsub();
  }, [startDate, endDate]);

  useEffect(() => {
    if (userSearchText.length < 2) {
      setFoundUsers([]);
      return;
    }

    const searchUsers = () => {
      const term = normalizeSearchString(userSearchText);
      const filtered = utentes.filter(u => {
        const r = (u.role || '').toLowerCase();
        const isStaff = ['admin', 'staff', 'chefia', 'professor'].includes(r);
        return !isStaff && normalizeSearchString(u.n || u.nome || '').includes(term);
      });
      setFoundUsers(filtered.slice(0, 50));
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [userSearchText, utentes]);

  const handleManualCheckIn = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
      const today = new Date().toISOString().split('T')[0];

      if (editingLogId) {
        // Update mode
        const logDoc = doc(db, path, editingLogId);

        // Convert time strings back to timestamps
        const checkInDate = new Date(`${editDate}T${editCheckIn}`);
        const checkOutDate = editCheckOut ? new Date(`${editDate}T${editCheckOut}`) : null;

        let durationMinutes = 0;
        if (checkOutDate) {
          const durationMs = checkOutDate.getTime() - checkInDate.getTime();
          durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));
        }

        await updateDoc(logDoc, {
          userName: selectedUser.n || selectedUser.nome || 'Utente',
          userId: selectedUser.id || 'sem_id',
          modalidade: selectedModality || 'Outra',
          checkIn: Timestamp.fromDate(checkInDate),
          checkOut: checkOutDate ? Timestamp.fromDate(checkOutDate) : null,
          date: editDate,
          durationMinutes: durationMinutes || null
        });

        // Update UserProfile status if it's today's log
        if (editDate === today) {
          const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, selectedUser.id);
          await updateDoc(userRef, {
            isInside: !checkOutDate,
            location: !checkOutDate ? selectedModality : null
          });
        }
      } else {
        // Create mode
        const logId = `${Date.now()}_${selectedUser.id || 'sem_id'}`;
        await setDoc(doc(db, path, logId), {
          userId: selectedUser.id || 'sem_id',
          userName: selectedUser.n || selectedUser.nome || 'Utente',
          userRole: selectedUser.role || 'utente',
          checkIn: Timestamp.now(),
          date: today,
          zone: 'Entrada Manual',
          modalidade: selectedModality || 'Outra',
          timestamp: serverTimestamp()
        });

        const currentEntries = selectedUser.entradas_disponiveis || 0;

        // Update UserProfile status
        const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, selectedUser.id);
        await updateDoc(userRef, {
          isInside: true,
          location: selectedModality,
          ...(currentEntries > 0 ? { entradas_disponiveis: currentEntries - 1 } : {}),
          lastIn: serverTimestamp()
        });

        setStartDate(today);
        setEndDate(today);
      }

      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingLogId ? OperationType.UPDATE : OperationType.CREATE, 'logs_acesso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowManualModal(false);
    setSelectedUser(null);
    setUserSearchText('');
    setEditingLogId(null);
    setEditCheckIn('');
    setEditCheckOut('');
    setEditDate('');
    setIsRegisteringNewUser(false);
    setNewUserName('');
    setNewUserPhone('');
    setModalMode('single');
    setAdultEntradas(0);
    setChildEntradas(0);
  };

  const handleRegisterAndCheckIn = async () => {
    if (!newUserName.trim()) {
      alert("Por favor, preencha o Nome Completo.");
      return;
    }
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const name = newUserName.trim();
      const nameUpper = name.toUpperCase();

      // Check for duplicate name
      const dupCheck = await getDocs(query(
        collection(db, `artifacts/${APP_ID}/public/data/users`),
        where('n', '==', nameUpper)
      ));
      if (!dupCheck.empty) {
        alert(`J\u00e1 existe um utente registado com o nome "${nameUpper}". Verifique na lista.`);
        setIsSubmitting(false);
        return;
      }

      const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const emailPrefix = cleanName.toLowerCase().trim().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const email = `${emailPrefix}.${randomSuffix}@utente.local`;
      const userId = email.replace(/[^a-z0-9]/g, '_');

      const newUserProfile: Record<string, unknown> = {
        id: userId,
        nome: name,
        n: nameUpper,
        email,
        role: 'utente',
        cargo: 'UTENTE',
        isInside: true,
        location: selectedModality,
        lastIn: serverTimestamp(),
        img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        modalidade: selectedModality,
        termo_imagens: true,
        termo_responsabilidade: true,
        termo_imagens_data: new Date().toISOString(),
        termo_responsabilidade_data: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      if (newUserPhone.trim()) newUserProfile.phone = newUserPhone.trim();

      // 1. Write the new user to Firestore
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, userId), newUserProfile);

      // 2. Create the check-in log
      const logId = `${Date.now()}_${userId}`;
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/logs_acesso`, logId), {
        userId,
        userName: nameUpper,
        userRole: 'utente',
        checkIn: Timestamp.now(),
        date: today,
        zone: 'Entrada Manual',
        modalidade: selectedModality,
        timestamp: serverTimestamp()
      });

      alert(`Utente "${nameUpper}" registado e entrada validada com sucesso!`);
      closeModal();
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.CREATE, 'users/logs_acesso');
      alert("Erro ao registar o utente. Verifica a liga\u00e7\u00e3o e tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (log: AccessLog) => {
    setEditingLogId(log.id);
    setSelectedUser({ id: log.userId, n: log.userName } as any);
    setSelectedModality(log.modalidade || 'Piscina Regime Livre');
    setEditDate(log.date);

    const checkInDate = log.checkIn instanceof Timestamp ? log.checkIn.toDate() : new Date(log.checkIn);
    setEditCheckIn(checkInDate.toTimeString().substring(0, 5));

    if (log.checkOut) {
      const checkOutDate = log.checkOut instanceof Timestamp ? log.checkOut.toDate() : new Date(log.checkOut);
      setEditCheckOut(checkOutDate.toTimeString().substring(0, 5));
    } else {
      setEditCheckOut('');
    }

    setShowManualModal(true);
  };

  const handleDeleteLog = async (log: AccessLog) => {
    setDeletingLog(true);
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/logs_acesso`, log.id));
      // If the user was still inside (no checkout), reset their isInside status
      if (!log.checkOut && log.userId) {
        try {
          await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, log.userId), {
            isInside: false,
            location: null,
            z: null,
          });
        } catch (_) { /* user may not exist as registered account */ }
      }
      setConfirmDeleteLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'logs_acesso');
    } finally {
      setDeletingLog(false);
    }
  };

  const handleManualCheckOut = async (log: AccessLog) => {
    if (!window.confirm(`Confirmar saída para ${log.userName}?`)) return;

    try {
      const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
      const checkOutTime = new Date();
      let checkInDate: Date;
      if (log.checkIn instanceof Timestamp) {
        checkInDate = log.checkIn.toDate();
      } else if (log.checkIn && typeof log.checkIn === 'object' && 'seconds' in log.checkIn) {
        checkInDate = new Date(log.checkIn.seconds * 1000);
      } else if (log.checkIn) {
        checkInDate = new Date(log.checkIn);
      } else {
        checkInDate = new Date(); // Fallback
      }

      if (isNaN(checkInDate.getTime())) {
        checkInDate = new Date();
      }

      const durationMs = checkOutTime.getTime() - checkInDate.getTime();
      const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));

      await updateDoc(doc(db, path, log.id), {
        checkOut: Timestamp.fromDate(checkOutTime),
        durationMinutes: durationMinutes
      });

      // Update UserProfile status (silently skip if user doc doesn't exist, e.g. turma alunos)
      try {
        const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, log.userId);
        await updateDoc(userRef, { isInside: false, location: null, lastOut: serverTimestamp() });
      } catch (_) { }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs_acesso');
    }
  };

  const handleUndoCheckOut = async (log: AccessLog) => {
    try {
      const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
      
      await updateDoc(doc(db, path, log.id), {
        checkOut: deleteField(),
        durationMinutes: deleteField()
      });

      try {
        const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, log.userId);
        await updateDoc(userRef, { isInside: true, location: log.modalidade || 'C. Desportivo' });
      } catch (_) { }
    } catch (error: any) {
      console.error("ERRO DESFAZER SAIDA:", error);
      alert("Erro ao desfazer saída: " + error.message);
      handleFirestoreError(error, OperationType.UPDATE, 'logs_acesso');
    }
  };

  const handleCheckOutAll = async () => {
    const insideLogs = filteredLogs.filter(l => !l.checkOut);
    if (insideLogs.length === 0) {
      alert("Não há utentes para dar saída nesta lista.");
      return;
    }
    if (!window.confirm(`Tem a certeza que quer dar saída a TODOS os ${insideLogs.length} utentes que ainda estão no recinto?`)) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
      const checkOutTime = new Date();

      insideLogs.forEach(log => {
        let checkInDate: Date;
        if (log.checkIn instanceof Timestamp) {
          checkInDate = log.checkIn.toDate();
        } else if (log.checkIn && typeof (log.checkIn as any).seconds === 'number') {
          checkInDate = new Date((log.checkIn as any).seconds * 1000);
        } else if (log.checkIn) {
          checkInDate = new Date(log.checkIn as string | number);
        } else {
          checkInDate = new Date();
        }

        if (isNaN(checkInDate.getTime())) {
          checkInDate = new Date();
        }

        const durationMs = checkOutTime.getTime() - checkInDate.getTime();
        const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));

        const logRef = doc(db, path, log.id);
        batch.update(logRef, {
          checkOut: Timestamp.fromDate(checkOutTime),
          durationMinutes: durationMinutes
        });

        if (log.userId && log.userId !== 'ext_entrada') {
          const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, log.userId);
          batch.update(userRef, { isInside: false, location: null, lastOut: serverTimestamp() });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error("Error checking out all:", error);
      alert("Ocorreu um erro ao dar saídas.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDateFilter = (type: 'hoje' | 'ontem' | 'mes') => {
    const now = new Date();
    if (type === 'hoje') {
      const ts = now.toISOString().split('T')[0];
      setStartDate(ts);
      setEndDate(ts);
    } else if (type === 'ontem') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const ys = yesterday.toISOString().split('T')[0];
      setStartDate(ys);
      setEndDate(ys);
    } else if (type === 'mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  };

  // All logs within date range — used for charts and stats (unaffected by search/status)
  const allDateLogs = React.useMemo(() => logs.filter(l => {
    const lDate = l.date || (l.checkIn instanceof Timestamp ? l.checkIn.toDate().toISOString().split('T')[0] : '');
    return lDate >= startDate && lDate <= endDate;
  }), [logs, startDate, endDate]);

  const dailyStats = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const countMod = (mod: string) => allDateLogs.filter(l => normalizeModality(l.modalidade || '') === mod).length;
    const countMonthly = (mod: string) => monthlyLogs.filter(l => normalizeModality(l.modalidade || '') === mod).length;
    // Count today's logs without checkout — direct modality match, no isUserInZone needed
    const countLive = (mod: string) => monthlyLogs.filter(l =>
      l.date === todayStr && !l.checkOut && normalizeModality(l.modalidade || '') === mod
    ).length;
    return [
      { id: 'livre', label: 'Piscina Livre', icon: <Star size={14} />, color: 'text-sky-300', bg: 'bg-sky-600', mod: 'Piscina Regime Livre' },
      { id: 'pool_out', label: 'Piscina Exterior', icon: <Sun size={14} />, color: 'text-cyan-200', bg: 'bg-cyan-500', mod: 'Piscina Exterior' },
      { id: 'nat', label: 'Natação Nível 1-2-3', icon: <Waves size={14} />, color: 'text-blue-300', bg: 'bg-blue-600', mod: 'Natação' },
      { id: 'hidro', label: 'Hidroginástica', icon: <Droplets size={14} />, color: 'text-teal-200', bg: 'bg-teal-500', mod: 'Hidroginástica' },
      { id: 'bebes', label: 'Bebés / AMA', icon: <Users2 size={14} />, color: 'text-indigo-200', bg: 'bg-indigo-500', mod: 'Bebés/AMA' },
      { id: 'fit', label: 'Aulas Fitness', icon: <Activity size={14} />, color: 'text-purple-200', bg: 'bg-purple-600', mod: 'Aulas Fitness' },
      { id: 'gym', label: 'Ginásio', icon: <Dumbbell size={14} />, color: 'text-[#F7B500]', bg: 'bg-[#004D71]', mod: 'Ginásio' },
      { id: 'sauna', label: 'Sauna', icon: <Flame size={14} />, color: 'text-orange-200', bg: 'bg-orange-500', mod: 'Sauna' },
    ].map(z => ({
      ...z,
      count: countMod(z.mod),
      monthlyCount: countMonthly(z.mod),
      liveCount: countLive(z.mod),
    })).sort((a, b) => b.monthlyCount - a.monthlyCount);
  }, [allDateLogs, monthlyLogs]);

  // Table view — additionally filtered by search and status toggle
  const filteredLogs = React.useMemo(() => allDateLogs.filter(l => {
    const matchSearch = (l.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
    let matchStatus = true;
    if (filterStatus === 'inside') {
      matchStatus = !l.checkOut && l.modalidade !== 'Piscina Exterior';
    }
    if (filterStatus === 'left') {
      matchStatus = !!l.checkOut && l.modalidade !== 'Piscina Exterior';
    }
    return matchSearch && matchStatus;
  }), [allDateLogs, searchTerm, filterStatus]);

  const statsByModality = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allDateLogs.forEach(l => {
      const mod = l.modalidade?.trim() || 'Outro / Geral';
      counts[mod] = (counts[mod] || 0) + 1;
    });
    
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [allDateLogs]);

  const hourlyData = React.useMemo(() => {
    const hours = new Array(24).fill(0);
    allDateLogs.forEach(log => {
      let hour = -1;
      if (log.checkIn instanceof Timestamp) {
        hour = log.checkIn.toDate().getHours();
      } else if (typeof log.checkIn === 'string' && log.checkIn.includes(':')) {
        hour = parseInt(log.checkIn.split(':')[0], 10);
      } else if (log.checkIn && typeof (log.checkIn as any).seconds === 'number') {
        hour = new Date((log.checkIn as any).seconds * 1000).getHours();
      }
      if (hour >= 0 && hour <= 23) {
        hours[hour]++;
      }
    });
    const data = [];
    for (let i = 7; i <= 22; i++) {
      data.push({ hora: `${i.toString().padStart(2, '0')}h`, entradas: hours[i] });
    }
    return data;
  }, [allDateLogs]);

  const todayAffluenceByLocation = React.useMemo(() => {
    const counts: Record<string, number> = {};
    monthlyLogs.forEach((r) => {
      const key = (r.modalidade || 'Outro / Geral').trim() || 'Outro / Geral';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([local, entradas]) => ({ local, entradas }))
      .sort((a, b) => b.entradas - a.entradas);
  }, [monthlyLogs]);

  const professorStats = React.useMemo(() => {
    const from = profStatsMode === 'mes'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
      : profStatsFrom;
    const to = profStatsMode === 'mes' ? new Date().toISOString().split('T')[0] : profStatsTo;

    const countOccurrences = (diaSemana: number) => {
      const target = diaSemana === 7 ? 0 : diaSemana;
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
      let count = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (cur.getDay() === target) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    };

    // Presenças registadas por modalidade no período (logs_acesso não distingue qual aula/professor específico).
    const presencasPorModalidade: Record<string, number> = {};
    profStatsLogs.forEach(l => {
      const key = (l.modalidade || '').trim();
      if (!key) return;
      presencasPorModalidade[key] = (presencasPorModalidade[key] || 0) + 1;
    });

    // Ocorrências totais por modalidade no período, para repartir as presenças proporcionalmente entre professores que partilham a modalidade.
    const ocorrenciasPorModalidade: Record<string, number> = {};
    agendaAulas.forEach(a => {
      if (a.cancelada) return;
      const key = (a.modalidade || '').trim();
      if (!key) return;
      ocorrenciasPorModalidade[key] = (ocorrenciasPorModalidade[key] || 0) + countOccurrences(a.diaSemana);
    });

    type Stat = { professor: string; dadas: number; canceladas: number; presencas: number; vagas: number };
    const byProf: Record<string, Stat> = {};

    const addToProf = (nome: string, aula: Aula, oc: number) => {
      const key = nome.trim();
      if (!key) return;
      if (!byProf[key]) byProf[key] = { professor: key, dadas: 0, canceladas: 0, presencas: 0, vagas: 0 };
      const stat = byProf[key];
      if (aula.cancelada) { stat.canceladas += oc; return; }
      stat.dadas += oc;
      stat.vagas += (aula.vagas || 0) * oc;
      const modKey = (aula.modalidade || '').trim();
      const totalOc = ocorrenciasPorModalidade[modKey] || 0;
      const totalPres = presencasPorModalidade[modKey] || 0;
      stat.presencas += totalOc > 0 ? (totalPres * oc) / totalOc : 0;
    };

    agendaAulas.forEach(a => {
      const oc = countOccurrences(a.diaSemana);
      if (oc === 0) return;
      if (a.professor) addToProf(a.professor, a, oc);
      if (a.professor2) addToProf(a.professor2, a, oc);
    });

    return Object.values(byProf)
      .map(s => ({
        ...s,
        presencas: Math.round(s.presencas),
        ocupacao: s.vagas > 0 ? Math.round((s.presencas / s.vagas) * 100) : null,
      }))
      .sort((a, b) => b.dadas - a.dadas);
  }, [agendaAulas, profStatsLogs, profStatsMode, profStatsFrom, profStatsTo]);

  const demographicsStats = React.useMemo(() => {
    const ageGroups = { '< 18': 0, '18-35': 0, '36-55': 0, '> 55': 0 };
    const cardStats: Record<string, number> = {};
    let atestadoCount = 0;
    
    const processedUsers = new Set<string>();
    
    allDateLogs.forEach(log => {
      if (!log.userId || log.userId === 'ext_entrada') return;
      if (processedUsers.has(log.userId)) return;
      processedUsers.add(log.userId);
      
      const profile = utentes.find(u => u.id === log.userId);
      if (!profile) return;
      
      if (profile.data_nasc) {
        const age = new Date().getFullYear() - new Date(profile.data_nasc).getFullYear();
        if (age < 18) ageGroups['< 18']++;
        else if (age <= 35) ageGroups['18-35']++;
        else if (age <= 55) ageGroups['36-55']++;
        else ageGroups['> 55']++;
      }
      
      if (profile.cartao_tipo) {
        const c = profile.cartao_tipo.trim();
        if (c) cardStats[c] = (cardStats[c] || 0) + 1;
      }
      
      if (profile.atestado_medico) {
        atestadoCount++;
      }
    });

    return {
      ageGroups: Object.entries(ageGroups).map(([label, count]) => ({ label, count })),
      cards: Object.entries(cardStats).map(([label, count]) => ({ label, count })).sort((a,b)=>b.count-a.count),
      atestado: atestadoCount,
      totalUsers: processedUsers.size
    };
  }, [allDateLogs, utentes]);

  const leaderboardByModality = React.useMemo(() => {
    const ranking: Record<string, Array<{ userId: string; userName: string; count: number }>> = {};

    modalities.forEach(m => {
      const modalityLogs = monthlyLogs.filter(l => normalizeModality(l.modalidade || '') === m);
      const userCounts: Record<string, { userName: string; count: number }> = {};

      modalityLogs.forEach(l => {
        if (!l.userId) return;
        if (!userCounts[l.userId]) {
          userCounts[l.userId] = { userName: l.userName || 'Utente', count: 0 };
        }
        userCounts[l.userId].count++;
      });

      const sortedUsers = Object.entries(userCounts)
        .map(([userId, { userName, count }]) => ({ userId, userName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      if (sortedUsers.length > 0) {
        ranking[m] = sortedUsers;
      }
    });

    return ranking;
  }, [monthlyLogs]);

  const downloadCSV = () => {
    let csv = "Data,Utente,Modalidade,Entrada,Saída,Duração\n";
    allDateLogs.forEach(l => {
      csv += `"${l.date}","${l.userName}","${l.modalidade}","${l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkIn}","${l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkOut) : 'Dentro'}","${l.durationMinutes || ''}"\n`;
    });

    csv += "\nResumo por Modalidade\nModalidade,Total\n";
    statsByModality.forEach(s => {
      csv += `"${s.label}",${s.count}\n`;
    });
    csv += `"TOTAL GERAL",${allDateLogs.length}\n`;

    // Top 3 Ranking Removido a pedido do cliente

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_acessos_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 77, 113); // #004D71
      doc.text('Relatório de Acessos', 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${startDate} a ${endDate}`, 14, 30);
      const isSingleDay = startDate === endDate;

      let finalY = 45;

      if (isSingleDay) {
        const tableData = allDateLogs.map(l => [
          l.date,
          l.userName,
          l.modalidade || '---',
          l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkIn,
          l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkOut) : 'Dentro',
          l.durationMinutes ? `${l.durationMinutes} min` : '---',
        ]);

        autoTable(doc, {
          startY: 45,
          head: [['Data', 'Utente', 'Modalidade', 'Entrada', 'Saída', 'Duração']],
          body: tableData,
          headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] }, // #004D71 and #F7B500
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { top: 45 },
          styles: { fontSize: 8, font: 'helvetica' }
        });

        finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 60;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 77, 113);
      doc.text('Resumo por Modalidade', 14, finalY);

      const summaryData = statsByModality.map(s => [s.label, s.count.toString()]);
      summaryData.push(['TOTAL', allDateLogs.length.toString()]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Modalidade', 'Total de Entradas']],
        body: summaryData,
        headStyles: { fillColor: [247, 181, 0], textColor: [0, 77, 113] },
        styles: { fontSize: 9, font: 'helvetica' }
      });

      doc.save(`relatorio_acessos_${startDate}_a_${endDate}.pdf`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + error.message);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      <div className="px-1 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
        <div>
          <h2 className="text-lg font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-2">
            <Users size={18} className="text-[#F7B500]" /> Registo de Acessos
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Controlo histórico de entradas e saídas</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button onClick={() => setDateFilter('hoje')} className="px-2 py-1 rounded text-[9px] font-black uppercase text-slate-500 hover:text-[#004D71] hover:bg-white transition-colors">Hoje</button>
              <button onClick={() => setDateFilter('ontem')} className="px-2 py-1 rounded text-[9px] font-black uppercase text-slate-500 hover:text-[#004D71] hover:bg-white transition-colors">Ontem</button>
              <button onClick={() => setDateFilter('mes')} className="px-2 py-1 rounded text-[9px] font-black uppercase text-slate-500 hover:text-[#004D71] hover:bg-white transition-colors">Mês</button>
            </div>
            <div className="relative w-28 md:w-36">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-[#004D71] outline-none focus:border-[#004D71]/20 shadow-sm w-full"
              />
            </div>
            <span className="text-slate-400 font-bold text-[10px] uppercase">a</span>
            <div className="relative w-28 md:w-36">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-[#004D71] outline-none focus:border-[#004D71]/20 shadow-sm w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {!readOnly && (
              <button
                onClick={generateInviteCode}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wide"
              >
                <Key size={14} /> Gerar Convite
              </button>
            )}
            {!readOnly && onScan && (
              <button
                onClick={onScan}
                className="px-4 py-2 bg-[#004D71] text-[#F7B500] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wide"
              >
                <PicotoIcon size={14} /> Ler QR
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => setShowTurmas(true)}
                className="px-4 py-2 bg-[#004D71] text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wide border border-[#004D71]"
              >
                <BookOpen size={14} /> Turmas
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-[#F7B500] text-[#004D71] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 border border-[#F7B500] font-black uppercase text-[10px] tracking-wide"
              >
                <Plus size={14} /> Registo Manual
              </button>
            )}
            <button
              onClick={downloadCSV}
              className="px-3 py-2 bg-[#004D71] text-[#F7B500] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Download size={14} /> <span className="text-[10px] font-black uppercase tracking-wide">CSV</span>
            </button>
            <button
              onClick={downloadPDF}
              className="px-3 py-2 bg-[#F7B500] text-[#004D71] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <FileText size={14} /> <span className="text-[10px] font-black uppercase tracking-wide">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteLog && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full animate-in zoom-in text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black text-[#004D71] uppercase mb-1">Eliminar Registo?</h3>
            <p className="text-sm font-bold text-slate-600 mb-1">{confirmDeleteLog.userName}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">{confirmDeleteLog.modalidade} · {confirmDeleteLog.date}</p>
            {!confirmDeleteLog.checkOut && (
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-wide mt-2 mb-1">
                O utente ficará marcado como saído
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-bold mt-2 mb-6">Este registo será removido das estatísticas.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteLog(null)}
                disabled={deletingLog}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteLog(confirmDeleteLog)}
                disabled={deletingLog}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingLog
                  ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={12} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTurmas && (
        <TurmasModule
          onClose={() => setShowTurmas(false)}
          markerUserId={currentUser?.id || 'staff'}
          markerUserName={currentUser?.n || currentUser?.nome || 'Staff'}
        />
      )}

      {generatedInvite && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl relative text-center max-w-sm w-full animate-in zoom-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-black text-[#004D71] uppercase mb-2">Código Gerado</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-6">Partilha este código com o utente</p>

            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl py-6 mb-6">
              <span className="text-5xl font-black tracking-[0.2em] text-[#004D71]">{generatedInvite}</span>
            </div>

            <button
              onClick={() => setGeneratedInvite(null)}
              className="w-full py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in">
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 p-4 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-8">
              <h3 className="text-xl font-black text-[#004D71] uppercase">
                {editingLogId ? 'Corrigir Registo' : 'Entrada Manual (Contingência)'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {editingLogId ? 'Ajustar horários ou modalidade' : 'Registo sem QR Code'}
              </p>
            </div>

            <div className="space-y-6">
              {isRegisteringNewUser ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 text-left">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nome Completo</label>
                    <input
                      type="text"
                      placeholder="Ex: Maria Albertina Sousa"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-4 border-slate-50 rounded-2xl text-xs font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all uppercase"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Telemóvel (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 912345678"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-4 border-slate-50 rounded-2xl text-xs font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Escolher Modalidade de Entrada</label>
                    <div className="grid grid-cols-2 gap-2">
                      {modalities.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedModality(m)}
                          className={`px-4 py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedModality === m ? 'bg-[#004D71] border-[#004D71] text-[#F7B500]' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsRegisteringNewUser(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all"
                    >
                      Voltar à Pesquisa
                    </button>
                    <button
                      type="button"
                      onClick={handleRegisterAndCheckIn}
                      disabled={isSubmitting || !newUserName.trim()}
                      className="flex-1 py-4 bg-[#F7B500] text-[#004D71] rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-[#F7B500]"
                    >
                      {isSubmitting ? (
                        <div className="w-3 h-3 border-2 border-[#004D71]/30 border-t-[#004D71] rounded-full animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Registar e Entrar
                    </button>
                  </div>
                </div>
              ) : !selectedUser ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Nome do utente..."
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-4 border-slate-50 rounded-2xl text-sm font-black text-[#004D71] placeholder-slate-300 outline-none focus:border-[#F7B500]/20 transition-all"
                    />
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {foundUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className="w-full p-4 rounded-xl border-2 border-slate-100 flex items-center gap-3 hover:border-[#F7B500] text-left transition-all"
                      >
                        <AvatarImage
                          src={u.img}
                          alt={u.n || u.nome}
                          className="w-12 h-12 rounded-xl shrink-0 border border-slate-100 shadow-sm"
                        />
                        <div>
                          <p className="font-black text-[#004D71] text-sm uppercase">{u.n || u.nome}</p>
                        </div>
                      </button>
                    ))}
                    {userSearchText.length >= 2 && foundUsers.length === 0 && (
                      <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Utente não encontrado</p>
                    )}
                    {userSearchText.length < 2 && (
                      <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Digite pelo menos 2 caracteres</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center gap-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Não encontra o utente?</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisteringNewUser(true);
                        if (userSearchText.trim().length > 0) {
                          setNewUserName(userSearchText.toUpperCase());
                        }
                      }}
                      className="px-4 py-2 bg-[#004D71]/5 hover:bg-[#004D71]/10 text-[#004D71] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      + Registar no Momento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-[#004D71]/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AvatarImage
                        src={selectedUser.img}
                        alt={selectedUser.n || selectedUser.nome}
                        className="w-12 h-12 rounded-xl shrink-0 border border-slate-100 shadow-sm"
                      />
                      <div>
                        <p className="font-black text-[#004D71] text-sm uppercase">{selectedUser.n || selectedUser.nome}</p>
                        <p className="text-[9px] font-bold text-[#F7B500] uppercase">Utente Selecionado</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-[10px] font-black text-red-500 uppercase underline">Trocar</button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Escolher Modalidade</label>
                    <div className="grid grid-cols-2 gap-2">
                      {modalities.map(m => (
                        <button
                          key={m}
                          onClick={() => setSelectedModality(m)}
                          className={`px-4 py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${selectedModality === m ? 'bg-[#004D71] border-[#004D71] text-[#F7B500]' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>



                  {editingLogId && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Data</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={e => setEditDate(e.target.value)}
                          className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Entrada</label>
                        <input
                          type="time"
                          value={editCheckIn}
                          onChange={e => setEditCheckIn(e.target.value)}
                          className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Saída</label>
                        <input
                          type="time"
                          value={editCheckOut}
                          onChange={e => setEditCheckOut(e.target.value)}
                          className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {editingLogId && (
                      <button
                        type="button"
                        onClick={() => {
                          const log = filteredLogs.find(l => l.id === editingLogId);
                          if (log) { closeModal(); setConfirmDeleteLog(log); }
                        }}
                        className="p-5 bg-red-50 text-red-500 rounded-2xl active:scale-95 transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button
                      disabled={isSubmitting}
                      onClick={handleManualCheckIn}
                      className="flex-1 bg-[#004D71] text-[#F7B500] py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? 'A Processar...' : <>{editingLogId ? <Save size={18} /> : <LogIn size={18} />} {editingLogId ? 'Guardar Correção' : 'Confirmar Entrada'}</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRAS DE REGISTO RÁPIDO — Piscina Exterior, Pavilhão, Padel (compactas, uma por linha) */}
      <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-50 mb-2 mt-4 overflow-hidden">
        {/* Piscina Exterior — único caso com Adultos/Crianças separados */}
        <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 border-l-4 border-cyan-300">
          <Sun size={15} className="text-cyan-500 shrink-0" />
          <span className="font-black text-[#004D71] text-[11px] uppercase shrink-0">Piscina Exterior</span>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-black uppercase text-slate-400">Ad.</span>
              <button type="button" onClick={() => setAdultEntradas(prev => prev - 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">-</button>
              <span className={`text-sm font-black w-5 text-center ${adultEntradas < 0 ? 'text-red-500' : 'text-[#004D71]'}`}>{adultEntradas}</span>
              <button type="button" onClick={() => setAdultEntradas(prev => prev + 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">+</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-black uppercase text-slate-400">Cri.</span>
              <button type="button" onClick={() => setChildEntradas(prev => prev - 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">-</button>
              <span className={`text-sm font-black w-5 text-center ${childEntradas < 0 ? 'text-red-500' : 'text-[#004D71]'}`}>{childEntradas}</span>
              <button type="button" onClick={() => setChildEntradas(prev => prev + 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">+</button>
            </div>
            <button
              disabled={isSubmitting || (adultEntradas === 0 && childEntradas === 0)}
              onClick={handleOutdoorPoolSubmit}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[9px] active:scale-95 transition-all flex items-center gap-1 disabled:opacity-40 ${adultEntradas < 0 || childEntradas < 0 ? 'bg-red-500 text-white' : 'bg-[#004D71] text-[#F7B500]'}`}
            >
              {isSubmitting ? <div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : (adultEntradas < 0 || childEntradas < 0) ? <Trash2 size={11} /> : <LogIn size={11} />}
              Registar
            </button>
          </div>
        </div>

        {/* Pavilhão / Padel — contador único */}
        {([
          { modalidade: 'Pavilhão', icon: <Building2 size={15} className="text-amber-500 shrink-0" />, count: pavilhaoEntradas, setCount: setPavilhaoEntradas, border: 'border-amber-300' },
          { modalidade: 'Padel', icon: <Target size={15} className="text-lime-600 shrink-0" />, count: padelEntradas, setCount: setPadelEntradas, border: 'border-lime-300' },
        ]).map(space => (
          <div key={space.modalidade} className={`flex items-center gap-2.5 px-3 py-2 border-l-4 ${space.border}`}>
            {space.icon}
            <span className="font-black text-[#004D71] text-[11px] uppercase">{space.modalidade}</span>

            <div className="flex items-center gap-2.5 ml-auto">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => space.setCount(prev => prev - 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">-</button>
                <span className={`text-sm font-black w-5 text-center ${space.count < 0 ? 'text-red-500' : 'text-[#004D71]'}`}>{space.count}</span>
                <button type="button" onClick={() => space.setCount(prev => prev + 1)} className="w-5 h-5 rounded text-slate-400 hover:text-[#004D71] hover:bg-slate-50 font-black text-sm">+</button>
              </div>
              <button
                disabled={isSubmittingSimple === space.modalidade || space.count === 0}
                onClick={() => handleSimpleSpaceSubmit(space.modalidade, space.count, () => space.setCount(0))}
                className={`px-3 py-1.5 rounded-lg font-black uppercase text-[9px] active:scale-95 transition-all flex items-center gap-1 disabled:opacity-40 ${space.count < 0 ? 'bg-red-500 text-white' : 'bg-[#004D71] text-[#F7B500]'}`}
              >
                {isSubmittingSimple === space.modalidade ? <div className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : space.count < 0 ? <Trash2 size={11} /> : <LogIn size={11} />}
                Registar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl w-full sm:w-fit overflow-hidden border border-slate-100 mb-4">
        <button
          onClick={() => setActiveTab('diario')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'diario' ? 'bg-white text-[#004D71] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={14} /> Controlo Diário
        </button>
        <button
          onClick={() => setActiveTab('estatisticas')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'estatisticas' ? 'bg-[#004D71] text-[#F7B500] shadow-sm border border-[#004D71]' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText size={14} /> Relatórios & Estatísticas
        </button>
      </div>

      {activeTab === 'diario' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Quadrados em tempo real */}
          <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
            {dailyStats.map(z => (
              <div key={z.id} className={`${z.bg} rounded-xl p-2.5 text-white shadow-sm border border-white/10 transition-transform hover:scale-[1.02] flex flex-col gap-2`}>
                {/* Topo: ícone + nome — largura toda, nunca compete com os números */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`${z.color} bg-white/10 p-1.5 rounded-lg shrink-0`}>
                    {z.icon}
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-wide text-white leading-tight line-clamp-2 min-w-0 break-words" title={z.label}>
                    {z.label}
                  </p>
                </div>

                {/* Baixo: Hoje / Agora — sempre numa barra própria, nunca ao lado do nome */}
                <div className="flex items-center gap-1.5 mt-auto">
                  <div className="flex-1 flex items-center justify-between px-2 py-1 rounded bg-black/20 min-w-0" title="Total Hoje">
                    <span className="text-[7px] font-black text-white/60 uppercase">Hoje</span>
                    <span className="text-sm font-black text-white tabular-nums">{z.count}</span>
                  </div>
                  <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded min-w-0 ${z.liveCount > 0 ? 'bg-green-500/40 shadow-sm border border-green-400/30' : 'bg-black/20'}`} title="Agora no Recinto">
                    <span className="text-[7px] font-black text-white/60 uppercase flex items-center gap-1">
                      {z.liveCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
                      Agr
                    </span>
                    <span className="text-sm font-black text-white tabular-nums">{z.liveCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-4">

              <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm">
                <div className="px-3 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row gap-2 items-center justify-between bg-slate-50/50">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      placeholder="Pesquisar utente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-[#004D71] outline-none focus:border-[#F7B500] transition-colors shadow-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {!readOnly && filterStatus === 'inside' && filteredLogs.some(l => !l.checkOut) && (
                      <button
                        onClick={handleCheckOutAll}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-colors shadow-sm border border-red-200 flex items-center gap-1"
                      >
                        <LogOut size={12} />
                        {isSubmitting ? '...' : 'Dar Saída a Todos'}
                      </button>
                    )}
                    <div className="flex bg-slate-200 p-0.5 rounded-lg w-full sm:w-auto overflow-hidden">
                      <button
                        onClick={() => setFilterStatus('all')}
                        className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-[#004D71] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Todas
                      </button>
                      <button
                        onClick={() => setFilterStatus('inside')}
                        className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all whitespace-nowrap ${filterStatus === 'inside' ? 'bg-[#004D71] text-[#F7B500] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Dentro
                      </button>
                      <button
                        onClick={() => setFilterStatus('left')}
                        className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all whitespace-nowrap ${filterStatus === 'left' ? 'bg-slate-400 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Saíram
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">Utente</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 text-center">Idade</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 text-center">Cartão</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">Data</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">Modalidade</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center bg-slate-50">Entrada</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center bg-slate-50">Saída</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center bg-slate-50">Dur.</th>
                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center bg-slate-50"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredLogs.map(log => {
                        const profile = usersMap[log.userId];
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <AvatarImage
                                  src={profile?.img}
                                  alt={log.userName}
                                  className="w-7 h-7 rounded-lg border border-slate-100 shadow-sm shrink-0 object-cover"
                                />
                                <div className="flex flex-col">
                                  <span 
                                    className="text-[10px] font-black text-[#004D71] uppercase leading-tight cursor-pointer hover:underline"
                                    onClick={() => onUserClick && profile && onUserClick(profile)}
                                    title="Ver Perfil"
                                  >
                                    {(() => {
                                      const parts = (log.userName || '').trim().split(/\s+/);
                                      if (parts.length > 1) return `${parts[0]} ${parts[parts.length - 1]}`;
                                      return parts[0] || '---';
                                    })()}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 mt-0.5 tracking-widest">
                                    UTENTE: {profile?.nif || '---'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {profile?.data_nasc ? (
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                  {new Date().getFullYear() - new Date(profile.data_nasc).getFullYear()}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-300">--</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {profile?.cartao_tipo ? (
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                                  <CreditCard size={9} className="inline mr-1" />
                                  {profile.cartao_tipo}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-300">--</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-[10px] font-bold text-slate-500">{log.date}</span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{log.modalidade || '---'}</span>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg font-black text-[10px]">
                                <LogIn size={11} />
                                {log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkIn}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {log.checkOut ? (
                                <div className="flex flex-col items-center gap-1">
                                  {readOnly || log.date !== todayStr ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg font-black text-[10px]">
                                      <LogOut size={11} />
                                      {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkOut}
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleUndoCheckOut(log)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg font-black text-[10px] hover:bg-red-600 hover:text-white transition-colors cursor-pointer group"
                                      title="Clique para desfazer a saída e voltar a colocar no recinto"
                                    >
                                      <LogOut size={11} className="group-hover:hidden" />
                                      <span className="group-hover:hidden">
                                        {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkOut}
                                      </span>
                                      <span className="hidden group-hover:inline">Desfazer Saída</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[9px] font-black text-[#F7B500] uppercase animate-pulse">No Recinto</span>
                                  {!readOnly && (
                                    <button
                                      onClick={() => handleManualCheckOut(log)}
                                      className="px-2 py-0.5 bg-red-500 text-white rounded-md text-[9px] font-black uppercase hover:bg-red-600 transition-colors"
                                    >
                                      Dar Saída
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {log.durationMinutes ? (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${log.durationMinutes <= 60 ? 'bg-green-100 text-green-700' :
                                    log.durationMinutes <= 90 ? 'bg-orange-100 text-orange-700' :
                                      'bg-red-100 text-red-700'
                                  }`}>
                                  {log.durationMinutes}m
                                </span>
                              ) : (
                                (() => {
                                  let checkInDate: Date;
                                  if (log.checkIn instanceof Timestamp) {
                                    checkInDate = log.checkIn.toDate();
                                  } else if (log.checkIn && typeof (log.checkIn as any).seconds === 'number') {
                                    checkInDate = new Date((log.checkIn as any).seconds * 1000);
                                  } else if (log.checkIn) {
                                    checkInDate = new Date(log.checkIn as string | number);
                                  } else {
                                    return <span className="text-[10px] font-bold text-slate-300">---</span>;
                                  }
                                  const liveMins = Math.max(0, Math.floor((currentTime.getTime() - checkInDate.getTime()) / 60000));
                                  return (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md animate-pulse ${liveMins <= 60 ? 'text-green-600 bg-green-50' :
                                        liveMins <= 90 ? 'text-orange-600 bg-orange-50' :
                                          'text-red-600 bg-red-50'
                                      }`}>
                                      {liveMins}m
                                    </span>
                                  );
                                })()
                              )}
                            </td>
                            {!readOnly && (
                              <td className="px-3 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => openEditModal(log)}
                                    className="p-1 text-[#004D71] hover:bg-slate-100 rounded-md transition-colors"
                                    title="Editar Registo"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteLog(log)}
                                    className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                                    title="Eliminar Registo"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && !loading && (
                        <tr>
                          <td colSpan={readOnly ? 6 : 7} className="px-6 py-12 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest">Sem registos para este dia</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'estatisticas' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Visual Podium Section */}
          {Object.keys(leaderboardByModality).length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                    <Star className="text-[#F7B500]" size={14} /> Pódio de Assiduidade por Modalidade
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Top 3 utentes mais assíduos no mês corrente
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(leaderboardByModality).map(([modality, users]) => {
                  const first = users[0];
                  const second = users[1] || null;
                  const third = users[2] || null;

                  const renderPodiumName = (userName: string, place: 1 | 2 | 3) => {
                    const parts = String(userName || '').trim().split(/\s+/);
                    const firstName = parts[0] || '';
                    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
                    return (
                      <div className="flex flex-col items-center justify-end min-w-0 w-full mb-0.5 h-6" title={userName}>
                        <span className="text-[8px] font-black text-[#004D71] truncate max-w-full text-center flex items-center justify-center gap-0.5 leading-tight">
                          {place === 1 && "👑 "}
                          {firstName}
                        </span>
                        {lastName && (
                          <span className="text-[7.5px] font-bold text-[#004D71] truncate max-w-full text-center leading-tight">
                            {lastName}
                          </span>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div key={modality} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                      <h4 className="text-[9px] font-black text-[#004D71] uppercase tracking-wider mb-3 text-center border-b pb-2 border-slate-100">
                        {modality}
                      </h4>

                      {/* Visual Podium */}
                      <div className="flex items-end justify-center gap-2 h-20">
                        {/* 2nd Place */}
                        <div className="flex-1 flex flex-col items-center">
                          {second ? (
                            <>
                              {renderPodiumName(second.userName, 2)}
                              <span className="text-[7px] font-bold text-slate-400 mb-0.5">{second.count}p</span>
                              <div className="w-full bg-slate-200 text-[#004D71] font-black text-[8px] rounded-t-lg h-8 flex items-center justify-center border-t border-slate-300">
                                2º
                              </div>
                            </>
                          ) : (
                            <div className="w-full bg-slate-100 rounded-t-lg h-4" />
                          )}
                        </div>

                        {/* 1st Place */}
                        <div className="flex-1 flex flex-col items-center">
                          {renderPodiumName(first.userName, 1)}
                          <span className="text-[8px] font-black text-[#F7B500] mb-0.5">{first.count}p</span>
                          <div className="w-full bg-[#004D71] text-[#F7B500] font-black text-[9px] rounded-t-xl h-12 flex items-center justify-center border-t-2 border-[#F7B500] shadow-md">
                            1º
                          </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="flex-1 flex flex-col items-center">
                          {third ? (
                            <>
                              {renderPodiumName(third.userName, 3)}
                              <span className="text-[7px] font-bold text-slate-400 mb-0.5">{third.count}p</span>
                              <div className="w-full bg-orange-100 text-orange-800 font-black text-[8px] rounded-t-lg h-5 flex items-center justify-center border-t border-orange-200">
                                3º
                              </div>
                            </>
                          ) : (
                            <div className="w-full bg-slate-100 rounded-t-lg h-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="text-[#F7B500]" size={14} /> Totais do Mês por Modalidade
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Número de entradas no mês corrente
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {[...statsByModality].sort((a, b) => b.count - a.count).map(s => (
                <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col justify-center items-center gap-0.5">
                  <p className="text-2xl font-black text-[#004D71] tabular-nums leading-none">{s.count}</p>
                  <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 text-center leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="text-[#F7B500]" size={14} /> Demografia de Assiduidade
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Faixas etárias dos utentes únicos ({demographicsStats.totalUsers}) neste período
                  </p>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demographicsStats.ageGroups} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} width={50} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" fill="#004D71" radius={[0, 4, 4, 0]} barSize={24}>
                      {demographicsStats.ageGroups.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#38bdf8', '#818cf8', '#c084fc', '#f472b6'][index % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                      <CreditCard className="text-[#F7B500]" size={14} /> Tipos de Cartões & Atestados
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      Distribuição dos utentes com presenças
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {demographicsStats.cards.map(c => (
                    <div key={c.label} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-600">{c.label}</span>
                      <span className="text-xs font-black text-[#004D71] bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-200">{c.count}</span>
                    </div>
                  ))}
                  {demographicsStats.cards.length === 0 && (
                    <div className="text-center p-4 text-slate-400 text-[10px] font-black uppercase">
                      Nenhum cartão registado nestas presenças
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Activity className="text-emerald-500" size={16} />
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Atestado Médico Entregue</span>
                  </div>
                  <span className="text-sm font-black text-emerald-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-emerald-200">
                    {demographicsStats.atestado} utentes
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest">Afluência do Mês por Local</h3>
              <span className="text-[9px] font-black text-slate-400 uppercase">{new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
            </div>
            {todayAffluenceByLocation.length > 0 ? (
              <div className="h-52">
                <ErrorBoundary>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todayAffluenceByLocation} margin={{ top: 6, right: 6, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="local" tick={{ fontSize: 9, fontWeight: 700 }} interval={0} angle={-12} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                    <Tooltip />
                    <Bar dataKey="entradas" fill="#004D71" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </ErrorBoundary>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Sem registos de hoje
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                  <BookOpen className="text-[#F7B500]" size={14} /> Estatística de Professores
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Aulas dadas, canceladas, presenças estimadas e ocupação
                </p>
              </div>
              <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                <button onClick={() => setProfStatsMode('mes')} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${profStatsMode === 'mes' ? 'bg-[#004D71] text-[#F7B500] shadow' : 'text-slate-400'}`}>Mês Atual</button>
                <button onClick={() => setProfStatsMode('custom')} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${profStatsMode === 'custom' ? 'bg-[#004D71] text-[#F7B500] shadow' : 'text-slate-400'}`}>Período</button>
              </div>
            </div>

            {profStatsMode === 'custom' && (
              <div className="flex items-center gap-2 mb-4">
                <input type="date" value={profStatsFrom} onChange={e => setProfStatsFrom(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[11px] font-black text-[#004D71] outline-none focus:border-[#004D71]/20" />
                <span className="text-[9px] font-black text-slate-400 uppercase">a</span>
                <input type="date" value={profStatsTo} onChange={e => setProfStatsTo(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-[11px] font-black text-[#004D71] outline-none focus:border-[#004D71]/20" />
              </div>
            )}

            {professorStats.length > 0 ? (
              <div className="space-y-2">
                {professorStats.map(p => (
                  <div key={p.professor} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <span className="flex-1 min-w-0 text-[11px] font-black text-[#004D71] uppercase truncate">{p.professor}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Dadas</span>
                        <span className="text-xs font-black text-[#004D71] tabular-nums">{p.dadas}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Canceladas</span>
                        <span className="text-xs font-black text-red-500 tabular-nums">{p.canceladas}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Presenças</span>
                        <span className="text-xs font-black text-[#004D71] tabular-nums">~{p.presencas}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Ocupação</span>
                        <span className="text-xs font-black text-emerald-600 tabular-nums">{p.ocupacao !== null ? `${p.ocupacao}%` : '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Sem aulas atribuídas a professores
              </div>
            )}

            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider mt-3 leading-relaxed">
              Presenças estimadas por modalidade (sem registo de turma específica) e repartidas entre professores que partilham a mesma modalidade. Canceladas refletem o estado atual da aula, não o histórico exato no período.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export function AccessLogsModule(props: any) {
  return (
    <ErrorBoundary>
      <AccessLogsModuleInner {...props} />
    </ErrorBoundary>
  );
}
