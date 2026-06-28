import React, { useState, useEffect } from 'react';
import {
  Users, LogIn, LogOut, Calendar, Search,
  Download, BookOpen,
  FileText, Plus, X, Edit2, Save, Trash2, QrCode, Key,
  Dumbbell, Waves, Activity, Flame, Sun, Star, Users2, Droplets, CreditCard, Building2, Target, Shield, Printer, Info, ShieldAlert,
  Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, TrendingUp
} from 'lucide-react';
import { AvatarImage, PicotoIcon } from './Common';
import { db, handleFirestoreError, OperationType, APP_ID } from '../lib/firebase';
import {
  collection, query, where, onSnapshot,
  Timestamp, limit, getDocs, setDoc, updateDoc,
  doc, serverTimestamp, deleteDoc, orderBy, writeBatch, deleteField
} from 'firebase/firestore';
import { AccessLog, UserProfile } from '../types';
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

function AccessLogsModuleInner({ onScan, currentUser, utentes = [], onUserClick, coberturaInfo, onToggleCobertura }: { onScan?: () => void; currentUser?: UserProfile; utentes?: UserProfile[]; onUserClick?: (u: UserProfile) => void; coberturaInfo?: { ativa: boolean; professorId?: string; professorNome?: string; ativadoEm?: any } | null; onToggleCobertura?: (ativar: boolean) => Promise<void> } = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AccessLog[]>([]);
  const [weekdayWindowLogs, setWeekdayWindowLogs] = useState<AccessLog[]>([]);
  const [weatherByDate, setWeatherByDate] = useState<Record<string, { code: number; max: number; min: number }>>({});
  const [profSessionLogs, setProfSessionLogs] = useState<any[]>([]);
  const [profStatsMode, setProfStatsMode] = useState<'mes' | 'custom'>('mes');
  const [profStatsFrom, setProfStatsFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [profStatsTo, setProfStatsTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProfessorDetail, setSelectedProfessorDetail] = useState<string | null>(null);
  const [selectedNadadorDetail, setSelectedNadadorDetail] = useState<string | null>(null);
  const [selectedZoneDetail, setSelectedZoneDetail] = useState<{ id: string; label: string; mod: string } | null>(null);
  const [selectedCoberturaDetail, setSelectedCoberturaDetail] = useState<string | null>(null);
  const [togglingCobertura, setTogglingCobertura] = useState(false);
  const [showProfOnboarding, setShowProfOnboarding] = useState(() =>
    currentUser?.role === 'professor' && localStorage.getItem('cpx_prof_onboarding_seen_v1') !== 'true'
  );
  const coberturaAtivaForMe = !!(coberturaInfo?.ativa && coberturaInfo.professorId === currentUser?.id);

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
  const [selectedMotivo, setSelectedMotivo] = useState('');
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
  const [nadadoresBase, setNadadoresBase] = useState<string[]>([]);
  const [nadadorHoje, setNadadorHoje] = useState<{ manha?: string; tarde?: string }>({});
  const [nadadorLogs, setNadadorLogs] = useState<{ date: string; periodo: 'manha' | 'tarde'; nome: string }[]>([]);
  const [coberturaLogs, setCoberturaLogs] = useState<any[]>([]);
  const [nadadorDate, setNadadorDate] = useState(todayStr);
  const [nadadorPeriodo, setNadadorPeriodo] = useState<'manha' | 'tarde'>('manha');
  const [nadadorNomeSel, setNadadorNomeSel] = useState('');
  const [novoNadadorNome, setNovoNadadorNome] = useState('');
  const [savingNadador, setSavingNadador] = useState(false);

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
              valorPago: vPago,
              registadoPorNome: currentUser?.n || currentUser?.nome || null,
              registadoPorRole: currentUser?.role || null,
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
              registadoPorNome: currentUser?.n || currentUser?.nome || null,
              registadoPorRole: currentUser?.role || null,
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

  // Motivos pré-definidos para o registo manual — facilita perceber "porquê" mais
  // tarde, sobretudo quando quem registou foi um professor a cobrir a receção.
  const motivosRegisto = [
    'Receção indisponível (doença/baixa/greve)',
    'Erro ou falha no QR/código',
    'Pedido do utente',
    'Outro',
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

  // Janela de 90 dias usada só para calcular o padrão de afluência por dia da
  // semana (qual dia costuma ter mais utentes) — período maior que o mês corrente
  // para a média não ficar enviesada por 1-2 semanas.
  useEffect(() => {
    const to = new Date();
    const toStr = to.toISOString().split('T')[0];
    const from = new Date(to);
    from.setDate(from.getDate() - 89);
    const fromStr = from.toISOString().split('T')[0];
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', fromStr), where('date', '<=', toStr));
    return onSnapshot(q, snap => {
      setWeekdayWindowLogs(snap.docs.map(d => d.data() as AccessLog));
    }, () => { });
  }, []);

  // Meteorologia de Vila de Rei (Open-Meteo, sem chave API) — 7 dias passados +
  // hoje + 7 dias de previsão, para cruzar com a afluência na tira de 15 dias.
  useEffect(() => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=39.6667&longitude=-8.1333&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FLisbon&past_days=7&forecast_days=8';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const daily = data?.daily;
        if (!daily?.time) return;
        const map: Record<string, { code: number; max: number; min: number }> = {};
        daily.time.forEach((dateStr: string, i: number) => {
          map[dateStr] = {
            code: daily.weathercode[i],
            max: daily.temperature_2m_max[i],
            min: daily.temperature_2m_min[i],
          };
        });
        setWeatherByDate(map);
      })
      .catch(() => { });
  }, []);

  // Presenças marcadas em Turmas (cada registo tem turmaId/professorNome/modalidade
  // por sessão dada) — fonte real da Estatística de Professores, em vez da Agenda
  // (que é só um horário previsto e pode mudar de professor de última hora).
  useEffect(() => {
    const from = profStatsMode === 'mes'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
      : profStatsFrom;
    const to = profStatsMode === 'mes' ? new Date().toISOString().split('T')[0] : profStatsTo;
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, snap => {
      setProfSessionLogs(snap.docs.map(d => d.data()).filter(l => l.professorNome && l.turmaId));
    }, (err) => handleFirestoreError(err, OperationType.GET, path));
  }, [profStatsMode, profStatsFrom, profStatsTo]);

  // Base de nomes de nadadores-salvadores (gerida pelo staff)
  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/config`;
    return onSnapshot(doc(db, path, 'nadadores_salvadores'), snap => {
      setNadadoresBase((snap.data()?.nomes as string[]) || []);
    }, () => {});
  }, []);

  // Quem está em serviço hoje (manhã/tarde) — visível a todos, incluindo chefia read-only
  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/nadadores_salvadores_registos`;
    const q = query(collection(db, path), where('date', '==', todayStr));
    return onSnapshot(q, snap => {
      const obj: { manha?: string; tarde?: string } = {};
      snap.docs.forEach(d => {
        const data = d.data() as any;
        if (data.periodo === 'manha') obj.manha = data.nome;
        if (data.periodo === 'tarde') obj.tarde = data.nome;
      });
      setNadadorHoje(obj);
    }, () => {});
  }, [todayStr]);

  // Registos diários de nadador-salvador (manhã/tarde) — mesmo período da Estatística de Professores
  useEffect(() => {
    const from = profStatsMode === 'mes'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
      : profStatsFrom;
    const to = profStatsMode === 'mes' ? new Date().toISOString().split('T')[0] : profStatsTo;
    const path = `artifacts/${APP_ID}/public/data/nadadores_salvadores_registos`;
    const q = query(collection(db, path), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, snap => {
      setNadadorLogs(snap.docs.map(d => d.data() as any));
    }, (err) => handleFirestoreError(err, OperationType.GET, path));
  }, [profStatsMode, profStatsFrom, profStatsTo]);

  // Registos manuais com auditoria (registadoPorNome) — mesmo período da Estatística
  // de Professores. Serve a Estatística de Cobertura: quanto staff/professores
  // registaram entradas "à mão" (contingência), em vez de check-in por QR.
  useEffect(() => {
    const from = profStatsMode === 'mes'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
      : profStatsFrom;
    const to = profStatsMode === 'mes' ? new Date().toISOString().split('T')[0] : profStatsTo;
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, snap => {
      setCoberturaLogs(snap.docs.map(d => d.data() as any).filter(l => l.registadoPorNome));
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
          durationMinutes: durationMinutes || null,
          registadoPorNome: currentUser?.n || currentUser?.nome || null,
          registadoPorRole: currentUser?.role || null,
          motivo: selectedMotivo || null,
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
          timestamp: serverTimestamp(),
          registadoPorNome: currentUser?.n || currentUser?.nome || null,
          registadoPorRole: currentUser?.role || null,
          motivo: selectedMotivo || null,
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
    setSelectedMotivo('');
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
        timestamp: serverTimestamp(),
        registadoPorNome: currentUser?.n || currentUser?.nome || null,
        registadoPorRole: currentUser?.role || null,
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

  // Utentes que passaram hoje na zona selecionada (para o modal de detalhe dos cartões)
  const zoneDetailLogs = React.useMemo(() => {
    if (!selectedZoneDetail) return [];
    return allDateLogs
      .filter(l => normalizeModality(l.modalidade || '') === selectedZoneDetail.mod)
      .sort((a, b) => {
        const ta = a.checkIn instanceof Timestamp ? a.checkIn.toMillis() : 0;
        const tb = b.checkIn instanceof Timestamp ? b.checkIn.toMillis() : 0;
        return tb - ta;
      });
  }, [allDateLogs, selectedZoneDetail]);

  // Afluência por dia da semana (média de utentes, todas as modalidades) nos
  // últimos 90 dias — identifica qual o dia da semana mais cheio.
  const weekdayStats = React.useMemo(() => {
    const labels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const shortLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const counts = new Array(7).fill(0);
    const datesSeen: Set<string>[] = Array.from({ length: 7 }, () => new Set());
    weekdayWindowLogs.forEach(l => {
      if (!l.date) return;
      const wd = new Date(`${l.date}T00:00:00`).getDay();
      counts[wd]++;
      datesSeen[wd].add(l.date);
    });
    const order = [1, 2, 3, 4, 5, 6, 0]; // Segunda a Domingo
    const stats = order.map(wd => ({
      wd,
      label: labels[wd],
      shortLabel: shortLabels[wd],
      avg: datesSeen[wd].size > 0 ? Math.round(counts[wd] / datesSeen[wd].size) : 0,
    }));
    const maxAvg = Math.max(...stats.map(s => s.avg));
    return stats.map(s => ({ ...s, isBusiest: s.avg > 0 && s.avg === maxAvg }));
  }, [weekdayWindowLogs]);

  // Total real de entradas (todas as modalidades) por data — base para a tira de dias
  const dailyTotalsByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    weekdayWindowLogs.forEach(l => {
      if (!l.date) return;
      map[l.date] = (map[l.date] || 0) + 1;
    });
    return map;
  }, [weekdayWindowLogs]);

  const weatherIconFor = (code: number) => {
    if (code === 0) return { Icon: Sun, color: 'text-amber-400', label: 'Céu limpo' };
    if (code <= 3) return { Icon: Cloud, color: 'text-slate-400', label: 'Nublado' };
    if (code === 45 || code === 48) return { Icon: CloudFog, color: 'text-slate-400', label: 'Nevoeiro' };
    if ([51, 53, 55, 56, 57].includes(code)) return { Icon: CloudDrizzle, color: 'text-sky-400', label: 'Chuvisco' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { Icon: CloudRain, color: 'text-sky-500', label: 'Chuva' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { Icon: CloudSnow, color: 'text-sky-300', label: 'Neve' };
    if ([95, 96, 99].includes(code)) return { Icon: CloudLightning, color: 'text-purple-500', label: 'Trovoada' };
    return { Icon: Cloud, color: 'text-slate-400', label: 'Nublado' };
  };

  // Tira de 15 dias: 7 dias passados (afluência real) + hoje + 7 dias seguintes
  // (previsão pela média desse dia da semana), todos com meteorologia de Vila de Rei.
  const fifteenDayStrip = React.useMemo(() => {
    const days = [];
    const today = new Date();
    for (let offset = -7; offset <= 7; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      const wd = d.getDay();
      const isFuture = offset > 0;
      const weekday = weekdayStats.find(w => w.wd === wd);
      days.push({
        date: dateStr,
        dayLabel: d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
        shortLabel: weekday?.shortLabel || '',
        isToday: offset === 0,
        isFuture,
        count: isFuture ? (weekday?.avg ?? 0) : (dailyTotalsByDate[dateStr] ?? 0),
        isForecastCount: isFuture,
        weather: weatherByDate[dateStr],
      });
    }
    return days;
  }, [dailyTotalsByDate, weekdayStats, weatherByDate]);

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
    type Stat = { professor: string; dadas: number; modalidades: Set<string> };
    const byProf: Record<string, Stat> = {};
    // Uma sessão (turmaId+data) gera um registo de presença por aluno marcado —
    // contar sessões únicas em vez de registos, senão uma aula com 10 alunos
    // contava como 10 "aulas dadas".
    const seenSessions = new Set<string>();

    profSessionLogs.forEach(l => {
      const sessionKey = `${l.turmaId}__${l.date}`;
      const display = (l.professorNome || '').trim();
      if (!display) return;
      // Agrupar sem distinguir maiúsculas/minúsculas: a mesma pessoa pode ter sido
      // gravada ora como "Cláudia Rechena" ora como "CLÁUDIA RECHENA".
      const key = display.toUpperCase();
      if (!byProf[key]) byProf[key] = { professor: display, dadas: 0, modalidades: new Set() };
      const stat = byProf[key];
      if (l.modalidade) stat.modalidades.add(String(l.modalidade).trim());
      if (!seenSessions.has(sessionKey)) {
        seenSessions.add(sessionKey);
        stat.dadas += 1;
      }
    });

    return Object.values(byProf)
      .map(s => ({ professor: s.professor, dadas: s.dadas, modalidades: Array.from(s.modalidades).sort() }))
      .sort((a, b) => b.dadas - a.dadas);
  }, [profSessionLogs]);

  // Detalhe por aula (data/turma/modalidade/hora) para a página de registo de cada professor.
  const professorSessionDetails = React.useMemo(() => {
    // Uma aula gera um registo de presença por aluno marcado — agregamos por sessão
    // (turmaId+data) para também sabermos quantos utentes estiveram em cada aula
    // (afluência), em vez de descartar os registos extra como antes.
    type Session = { date: string; turmaNome: string; modalidade: string; checkIn: string; professor: string; utentes: number };
    const bySession: Record<string, Session> = {};

    profSessionLogs.forEach(l => {
      const display = (l.professorNome || '').trim();
      if (!display) return;
      const sessionKey = `${l.turmaId}__${l.date}`;
      if (!bySession[sessionKey]) {
        bySession[sessionKey] = {
          date: l.date,
          turmaNome: l.turmaNome || '---',
          modalidade: l.modalidade || '---',
          checkIn: typeof l.checkIn === 'string' ? l.checkIn : '',
          professor: display,
          utentes: 0,
        };
      }
      bySession[sessionKey].utentes += 1;
    });

    const byProf: Record<string, { date: string; turmaNome: string; modalidade: string; checkIn: string; utentes: number }[]> = {};
    Object.values(bySession).forEach(({ professor, ...rest }) => {
      const key = professor.toUpperCase();
      if (!byProf[key]) byProf[key] = [];
      byProf[key].push(rest);
    });

    Object.values(byProf).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));
    return byProf;
  }, [profSessionLogs]);

  const nadadorStats = React.useMemo(() => {
    const byNome: Record<string, Set<string>> = {};
    nadadorLogs.forEach(l => {
      const nome = (l.nome || '').trim();
      if (!nome) return;
      if (!byNome[nome]) byNome[nome] = new Set();
      if (l.date) byNome[nome].add(l.date);
    });
    return Object.entries(byNome)
      .map(([nome, dias]) => ({ nome, dias: dias.size }))
      .sort((a, b) => b.dias - a.dias);
  }, [nadadorLogs]);

  // Detalhe por dia/período para a página de registo de cada nadador-salvador.
  const nadadorSessionDetails = React.useMemo(() => {
    const byNome: Record<string, { date: string; periodo: 'manha' | 'tarde' }[]> = {};
    nadadorLogs.forEach(l => {
      const nome = (l.nome || '').trim();
      if (!nome || !l.date) return;
      if (!byNome[nome]) byNome[nome] = [];
      byNome[nome].push({ date: l.date, periodo: l.periodo });
    });
    Object.values(byNome).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date) || a.periodo.localeCompare(b.periodo)));
    return byNome;
  }, [nadadorLogs]);

  // Estatística de Cobertura: quantos registos manuais (contingência) foram feitos
  // por staff vs. por professores a substituir a receção, no período selecionado.
  const coberturaStats = React.useMemo(() => {
    const staffCount = coberturaLogs.filter(l => l.registadoPorRole !== 'professor').length;
    const profCount = coberturaLogs.filter(l => l.registadoPorRole === 'professor').length;

    const byProf: Record<string, { nome: string; total: number }> = {};
    coberturaLogs.filter(l => l.registadoPorRole === 'professor').forEach(l => {
      const nome = (l.registadoPorNome || '').trim();
      if (!nome) return;
      const key = nome.toUpperCase();
      if (!byProf[key]) byProf[key] = { nome, total: 0 };
      byProf[key].total += 1;
    });

    return {
      staffCount,
      profCount,
      porProfessor: Object.values(byProf).sort((a, b) => b.total - a.total),
    };
  }, [coberturaLogs]);

  const coberturaSessionDetails = React.useMemo(() => {
    const byProf: Record<string, { date: string; checkIn: string; modalidade: string; userName: string; motivo: string }[]> = {};
    coberturaLogs.filter(l => l.registadoPorRole === 'professor').forEach(l => {
      const nome = (l.registadoPorNome || '').trim();
      if (!nome) return;
      const key = nome.toUpperCase();
      if (!byProf[key]) byProf[key] = [];
      byProf[key].push({
        date: l.date,
        checkIn: typeof l.checkIn === 'string' ? l.checkIn : (l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
        modalidade: l.modalidade || '---',
        userName: l.userName || '---',
        motivo: l.motivo || '',
      });
    });
    Object.values(byProf).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)));
    return byProf;
  }, [coberturaLogs]);

  // Antes das 14h conta como período da manhã, depois como tarde.
  const periodoAtual: 'manha' | 'tarde' = currentTime.getHours() < 14 ? 'manha' : 'tarde';
  const nadadorAtivo = nadadorHoje[periodoAtual];

  const handleAddNadadorNome = async () => {
    const nome = novoNadadorNome.trim();
    if (!nome) return;
    if (nadadoresBase.some(n => n.toLowerCase() === nome.toLowerCase())) {
      setNadadorNomeSel(nome);
      setNovoNadadorNome('');
      return;
    }
    try {
      const path = `artifacts/${APP_ID}/public/data/config`;
      await setDoc(doc(db, path, 'nadadores_salvadores'), { nomes: [...nadadoresBase, nome] }, { merge: true });
      setNadadorNomeSel(nome);
      setNovoNadadorNome('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'nadadores_salvadores');
    }
  };

  const handleRegistarNadador = async () => {
    if (!nadadorNomeSel || !nadadorDate || savingNadador) return;
    setSavingNadador(true);
    try {
      const path = `artifacts/${APP_ID}/public/data/nadadores_salvadores_registos`;
      const id = `${nadadorDate}__${nadadorPeriodo}`;
      await setDoc(doc(db, path, id), {
        date: nadadorDate,
        periodo: nadadorPeriodo,
        nome: nadadorNomeSel,
        registadoPorNome: currentUser?.n || currentUser?.nome || null,
        registadoPorRole: currentUser?.role || null,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'nadadores_salvadores_registos');
    } finally {
      setSavingNadador(false);
    }
  };

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
    let csv = "Data,Utente,Modalidade,Entrada,Saída,Duração,Registado Por,Motivo\n";
    allDateLogs.forEach(l => {
      csv += `"${l.date}","${l.userName}","${l.modalidade}","${l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkIn}","${l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkOut) : 'Dentro'}","${l.durationMinutes || ''}","${l.registadoPorNome || ''}","${l.motivo || ''}"\n`;
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
          l.registadoPorNome || '---',
        ]);

        autoTable(doc, {
          startY: 45,
          head: [['Data', 'Utente', 'Modalidade', 'Entrada', 'Saída', 'Duração', 'Registado Por']],
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

  const periodLabel = profStatsMode === 'mes' ? 'Mês atual' : `${profStatsFrom} a ${profStatsTo}`;

  const MONTH_NAMES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${MONTH_NAMES_PT[parseInt(m, 10) - 1]} ${y}`;
  };
  // Lookup fixo em vez de toLocaleDateString({weekday:'short'}): em alguns motores
  // de browser o pt-PT "short" devolve o nome completo do dia (ex.: "Domingo"), o
  // que rebentava o layout compacto da lista.
  const WEEKDAYS_PT_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const formatDayLabel = (dateStr: string) => {
    const weekday = WEEKDAYS_PT_SHORT[new Date(`${dateStr}T00:00:00`).getDay()];
    return `${weekday} ${dateStr.slice(8, 10)}`;
  };
  function groupByMonth<T extends { date: string }>(items: T[]) {
    const groups: { key: string; items: T[] }[] = [];
    items.forEach(item => {
      const key = item.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(item);
      else groups.push({ key, items: [item] });
    });
    return groups;
  }

  const downloadProfessorPDF = (professorName: string) => {
    try {
      const sessions = professorSessionDetails[professorName.toUpperCase()] || [];
      const avgUtentes = sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.utentes, 0) / sessions.length : 0;
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(0, 77, 113);
      doc.text(`Registo de Aulas - ${professorName}`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${periodLabel}`, 14, 28);
      doc.text(`Total de aulas dadas: ${sessions.length} · Média de utentes por aula: ${avgUtentes.toFixed(1)}`, 14, 34);

      autoTable(doc, {
        startY: 42,
        head: [['Data', 'Turma', 'Modalidade', 'Hora', 'Utentes']],
        body: sessions.map(s => [s.date, s.turmaNome, s.modalidade, s.checkIn || '---', String(s.utentes)]),
        headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 9, font: 'helvetica' }
      });

      doc.save(`aulas_${professorName.replace(/\s+/g, '_')}.pdf`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + error.message);
    }
  };

  const downloadNadadorPDF = (nadadorName: string) => {
    try {
      const dias = nadadorSessionDetails[nadadorName] || [];
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(0, 77, 113);
      doc.text(`Registo de Serviço - ${nadadorName}`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${periodLabel}`, 14, 28);
      doc.text(`Total de dias trabalhados: ${new Set(dias.map(d => d.date)).size}`, 14, 34);

      autoTable(doc, {
        startY: 42,
        head: [['Data', 'Período']],
        body: dias.map(d => [d.date, d.periodo === 'manha' ? 'Manhã' : 'Tarde']),
        headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 9, font: 'helvetica' }
      });

      doc.save(`servico_${nadadorName.replace(/\s+/g, '_')}.pdf`);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + error.message);
    }
  };

  const downloadCoberturaPDF = (professorName: string) => {
    try {
      const registos = coberturaSessionDetails[professorName.toUpperCase()] || [];
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(0, 77, 113);
      doc.text(`Registo de Cobertura de Receção - ${professorName}`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${periodLabel}`, 14, 28);
      doc.text(`Total de registos manuais: ${registos.length}`, 14, 34);

      autoTable(doc, {
        startY: 42,
        head: [['Data', 'Hora', 'Utente', 'Modalidade', 'Motivo']],
        body: registos.map(r => [r.date, r.checkIn || '---', r.userName, r.modalidade, r.motivo || '---']),
        headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 8, font: 'helvetica' }
      });

      doc.save(`cobertura_${professorName.replace(/\s+/g, '_')}.pdf`);
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
        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
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

      {currentUser?.role === 'professor' && (() => {
        const coveredByOther = coberturaInfo?.ativa && coberturaInfo.professorId !== currentUser.id;
        return (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-sky-50 border-2 border-sky-100 rounded-2xl">
            <div className="flex items-start gap-2.5 flex-1">
              <Info size={15} className="text-sky-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-sky-700 leading-relaxed">
                Como professor, podes registar entradas e saídas aqui caso a receção esteja indisponível (doença, baixa ou greve da equipa). Cada registo manual fica associado ao teu nome para auditoria.
                {coveredByOther && (
                  <span className="block mt-1 text-amber-700">{coberturaInfo?.professorNome} já ativou o Modo Cobertura hoje.</span>
                )}
              </p>
            </div>
            <button
              onClick={async () => {
                if (!onToggleCobertura) return;
                setTogglingCobertura(true);
                try { await onToggleCobertura(!coberturaAtivaForMe); } finally { setTogglingCobertura(false); }
              }}
              disabled={!!coveredByOther || togglingCobertura}
              className={`shrink-0 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5 ${coberturaAtivaForMe ? 'bg-amber-500 text-white' : 'bg-[#004D71] text-[#F7B500]'}`}
            >
              <ShieldAlert size={13} />
              {coberturaAtivaForMe ? 'Desligar Modo Cobertura' : 'Ligar Modo Cobertura'}
            </button>
          </div>
        );
      })()}

      {currentUser?.role !== 'professor' && coberturaInfo?.ativa && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-2xl">
          <ShieldAlert size={15} className="text-amber-600 shrink-0" />
          <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
            {coberturaInfo.professorNome} está em Modo Cobertura — a substituir a receção desde {coberturaInfo.ativadoEm instanceof Timestamp ? coberturaInfo.ativadoEm.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'hoje'}.
          </p>
        </div>
      )}

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

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Motivo do Registo Manual (opcional)</label>
                    <select
                      value={selectedMotivo}
                      onChange={e => setSelectedMotivo(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border-4 border-slate-50 rounded-2xl text-[11px] font-black text-[#004D71] outline-none focus:border-[#F7B500]/20"
                    >
                      <option value="">Sem motivo especificado</option>
                      {motivosRegisto.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
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

      {/* NADADOR-SALVADOR — obrigatório na Piscina Exterior, registo diário por período */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Shield size={15} className="text-cyan-600 shrink-0" />
          <span className="font-black text-[#004D71] text-[11px] uppercase">Nadador-Salvador</span>
        </div>

        {/* Estado atual — visível a todos, incluindo contas read-only (chefia) */}
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${nadadorAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[8px] font-black uppercase text-slate-400 whitespace-nowrap">{periodoAtual === 'manha' ? 'Manhã' : 'Tarde'} agora:</span>
          <span className={`text-[10px] font-black uppercase truncate ${nadadorAtivo ? 'text-[#004D71]' : 'text-red-500'}`}>{nadadorAtivo || 'Sem nadador-salvador'}</span>
        </div>

        {!readOnly && (
          <>
            <input
              type="date"
              value={nadadorDate}
              onChange={e => setNadadorDate(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-[#004D71] outline-none"
            />
            <div className="flex gap-0.5 p-0.5 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
              {(['manha', 'tarde'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNadadorPeriodo(p)}
                  className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all ${nadadorPeriodo === p ? 'bg-[#004D71] text-[#F7B500]' : 'text-slate-400'}`}
                >
                  {p === 'manha' ? 'Manhã' : 'Tarde'}
                </button>
              ))}
            </div>
            <select
              value={nadadorNomeSel}
              onChange={e => setNadadorNomeSel(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-[#004D71] outline-none flex-1 min-w-[110px]"
            >
              <option value="">Selecionar nome...</option>
              {nadadoresBase.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              type="button"
              disabled={!nadadorNomeSel || savingNadador}
              onClick={handleRegistarNadador}
              className="px-3 py-1.5 rounded-lg font-black uppercase text-[9px] bg-[#004D71] text-[#F7B500] active:scale-95 transition-all disabled:opacity-40 shrink-0"
            >
              {savingNadador ? '...' : 'Registar'}
            </button>

            <div className="flex items-center gap-1.5 w-full pt-2 mt-1 border-t border-slate-50">
              <input
                type="text"
                value={novoNadadorNome}
                onChange={e => setNovoNadadorNome(e.target.value)}
                placeholder="Novo nome para a base..."
                className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-[#004D71] outline-none placeholder:text-slate-300"
              />
              <button
                type="button"
                disabled={!novoNadadorNome.trim()}
                onClick={handleAddNadadorNome}
                className="p-1.5 bg-slate-50 text-slate-400 hover:text-[#004D71] rounded-lg transition-colors disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
            </div>
          </>
        )}
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
              <button
                key={z.id}
                type="button"
                onClick={() => setSelectedZoneDetail({ id: z.id, label: z.label, mod: z.mod })}
                className={`${z.bg} rounded-xl p-2.5 text-white shadow-sm border border-white/10 transition-transform hover:scale-[1.02] hover:brightness-110 flex flex-col gap-2 text-left cursor-pointer`}
                title={`Ver utentes de ${z.label} hoje`}
              >
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
              </button>
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
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">{log.modalidade || '---'}</span>
                              {log.registadoPorNome && (
                                <span
                                  className="text-[8px] font-bold text-slate-300 uppercase tracking-wide block mt-0.5"
                                  title={`Registo manual feito por ${log.registadoPorNome}${log.registadoPorRole ? ` (${log.registadoPorRole})` : ''}${log.motivo ? ` — Motivo: ${log.motivo}` : ''}`}
                                >
                                  via {log.registadoPorNome}{log.registadoPorRole === 'professor' ? ' · prof.' : ''}{log.motivo ? ` · ${log.motivo}` : ''}
                                </span>
                              )}
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
                                  let checkInDate: Date | null = null;
                                  if (log.checkIn instanceof Timestamp) {
                                    checkInDate = log.checkIn.toDate();
                                  } else if (log.checkIn && typeof (log.checkIn as any).seconds === 'number') {
                                    checkInDate = new Date((log.checkIn as any).seconds * 1000);
                                  } else if (log.checkIn) {
                                    // Registos de presença marcados em Turmas guardam "checkIn" como
                                    // hora em texto (ex.: "10:02"), não uma data/hora completa — não há
                                    // como calcular uma duração real a partir disso.
                                    const parsed = new Date(log.checkIn as string | number);
                                    checkInDate = Number.isNaN(parsed.getTime()) ? null : parsed;
                                  }
                                  if (!checkInDate) {
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
          {/* Afluência por Dia da Semana */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="text-[#F7B500]" size={14} /> Afluência por Dia da Semana
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Média de utentes (todas as modalidades) — últimos 90 dias
                </p>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayStats} margin={{ top: 6, right: 6, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                  <Tooltip formatter={(v: number) => [`${v} utentes`, 'Média']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                    {weekdayStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isBusiest ? '#F7B500' : '#004D71'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tira de 15 dias: passado + hoje + previsão, com meteorologia de Vila de Rei */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                  <Cloud className="text-[#F7B500]" size={14} /> Meteorologia & Afluência — Vila de Rei
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  7 dias passados (real) · hoje · 7 dias seguintes (previsão pela média do dia da semana)
                </p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {fifteenDayStrip.map(day => {
                const w = day.weather ? weatherIconFor(day.weather.code) : null;
                return (
                  <div
                    key={day.date}
                    className={`shrink-0 w-[88px] rounded-xl p-2.5 flex flex-col items-center gap-1.5 border-2 ${
                      day.isToday ? 'bg-[#004D71] border-[#004D71]' : day.isFuture ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100'
                    }`}
                  >
                    <span className={`text-[8px] font-black uppercase tracking-widest ${day.isToday ? 'text-[#F7B500]' : 'text-slate-400'}`}>
                      {day.isToday ? 'Hoje' : day.shortLabel}
                    </span>
                    <span className={`text-[9px] font-bold ${day.isToday ? 'text-white/70' : 'text-slate-300'}`}>{day.dayLabel}</span>
                    {w ? (
                      <w.Icon size={20} className={day.isToday ? 'text-[#F7B500]' : w.color} />
                    ) : (
                      <Cloud size={20} className={day.isToday ? 'text-white/30' : 'text-slate-200'} />
                    )}
                    {day.weather ? (
                      <span className={`text-[9px] font-black tabular-nums ${day.isToday ? 'text-white' : 'text-slate-500'}`}>
                        {Math.round(day.weather.max)}° / {Math.round(day.weather.min)}°
                      </span>
                    ) : (
                      <span className={`text-[9px] font-bold ${day.isToday ? 'text-white/40' : 'text-slate-300'}`}>--°</span>
                    )}
                    <div className={`w-full flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg mt-0.5 ${day.isToday ? 'bg-white/10' : 'bg-slate-50'}`}>
                      <Users size={10} className={day.isToday ? 'text-[#F7B500]' : 'text-slate-400'} />
                      <span className={`text-[10px] font-black tabular-nums ${day.isToday ? 'text-white' : 'text-[#004D71]'}`}>{day.count}</span>
                    </div>
                    {day.isForecastCount && (
                      <span className="text-[6px] font-black text-slate-300 uppercase tracking-widest">Previsto</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
                  Total de aulas dadas e modalidades por professor
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
                  <button
                    key={p.professor}
                    onClick={() => setSelectedProfessorDetail(p.professor)}
                    className="w-full flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 text-left hover:border-[#004D71]/20 active:scale-[0.99] transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-black text-[#004D71] uppercase truncate block underline decoration-dotted decoration-[#004D71]/40">{p.professor}</span>
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {p.modalidades.length > 0 ? p.modalidades.map(m => (
                          <span key={m} className="text-[8px] font-bold text-slate-500 uppercase bg-white px-1.5 py-0.5 rounded-full border border-slate-200">{m}</span>
                        )) : (
                          <span className="text-[8px] font-bold text-slate-300 uppercase">Sem modalidade</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Dadas</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{p.dadas}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Sem aulas atribuídas a professores
              </div>
            )}

            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider mt-3 leading-relaxed">
              Aulas dadas no período selecionado, por modalidade. Aulas canceladas não são contadas.
            </p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Shield className="text-cyan-500" size={14} /> Estatística de Nadadores-Salvadores
            </h3>

            {nadadorStats.length > 0 ? (
              <div className="space-y-2">
                {nadadorStats.map(n => (
                  <button
                    key={n.nome}
                    onClick={() => setSelectedNadadorDetail(n.nome)}
                    className="w-full flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 text-left hover:border-[#004D71]/20 active:scale-[0.99] transition-all"
                  >
                    <span className="flex-1 min-w-0 text-[11px] font-black text-[#004D71] uppercase truncate underline decoration-dotted decoration-[#004D71]/40">{n.nome}</span>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Dias</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{n.dias}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Sem registos no período
              </div>
            )}

            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider mt-3 leading-relaxed">
              Dias trabalhados no período selecionado (manhã + tarde no mesmo dia conta como 1 dia).
            </p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <ShieldAlert className="text-amber-500" size={14} /> Estatística de Cobertura
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Registos manuais (contingência) por quem os fez
            </p>

            <div className="flex items-center gap-4 bg-slate-50 rounded-xl px-3 py-3 border border-slate-100 mb-3">
              <div className="text-center leading-none shrink-0">
                <span className="text-xl font-black text-[#004D71] tabular-nums">{coberturaStats.staffCount}</span>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Equipa</p>
              </div>
              <div className="w-px h-8 bg-slate-200 shrink-0" />
              <div className="text-center leading-none shrink-0">
                <span className="text-xl font-black text-amber-600 tabular-nums">{coberturaStats.profCount}</span>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Professores</p>
              </div>
              <p className="text-[8px] font-bold text-slate-400 leading-relaxed flex-1">
                Total de entradas/saídas registadas manualmente neste período, em vez de check-in por QR.
              </p>
            </div>

            {coberturaStats.porProfessor.length > 0 ? (
              <div className="space-y-2">
                {coberturaStats.porProfessor.map(p => (
                  <button
                    key={p.nome}
                    onClick={() => setSelectedCoberturaDetail(p.nome)}
                    className="w-full flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 text-left hover:border-[#004D71]/20 active:scale-[0.99] transition-all"
                  >
                    <span className="flex-1 min-w-0 text-[11px] font-black text-[#004D71] uppercase truncate underline decoration-dotted decoration-[#004D71]/40">{p.nome}</span>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-0.5">Registos</span>
                      <span className="text-sm font-black text-[#004D71] tabular-nums">{p.total}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Nenhum professor cobriu a receção neste período
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProfessorDetail && (() => {
        const sessions: { date: string; turmaNome: string; modalidade: string; checkIn: string; utentes: number }[] = professorSessionDetails[selectedProfessorDetail.toUpperCase()] || [];
        const modalidadeCounts: Record<string, number> = {};
        sessions.forEach(s => { modalidadeCounts[s.modalidade] = (modalidadeCounts[s.modalidade] || 0) + 1; });
        const breakdown = Object.entries(modalidadeCounts).sort((a, b) => b[1] - a[1]);
        const groups = groupByMonth(sessions);
        const avgUtentes = sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.utentes, 0) / sessions.length : 0;

        return (
          <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in">
              <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#004D71] flex items-center justify-center shrink-0">
                    <BookOpen className="text-[#F7B500]" size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-[#004D71] uppercase text-base leading-tight truncate">{selectedProfessorDetail}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{periodLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProfessorDetail(null)}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-y border-slate-100 shrink-0">
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{sessions.length}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Aulas</p>
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0" />
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{avgUtentes.toFixed(1)}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Média/aula</p>
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                  {breakdown.length > 0 ? breakdown.map(([m, c]) => (
                    <span key={m} className="text-[8px] font-bold text-[#004D71] uppercase bg-white px-2 py-1 rounded-full border border-slate-200">{m} · {c}</span>
                  )) : (
                    <span className="text-[9px] font-bold text-slate-300 uppercase">Sem modalidades</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                {groups.length > 0 ? groups.map(group => (
                  <div key={group.key}>
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between py-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{monthLabel(group.key)}</span>
                      <span className="text-[9px] font-black text-slate-300 tabular-nums">{group.items.length}</span>
                    </div>
                    {group.items.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="w-20 shrink-0 leading-none whitespace-nowrap">
                          <span className="text-[10px] font-black text-[#004D71] block">{formatDayLabel(s.date)}</span>
                          {s.checkIn && <span className="text-[8px] font-bold text-slate-400">{s.checkIn}</span>}
                        </div>
                        <span className="flex-1 min-w-0 text-[10px] font-bold text-slate-500 uppercase truncate">{s.turmaNome}</span>
                        <span className="flex items-center gap-1 text-[9px] font-black text-[#004D71] tabular-nums shrink-0 whitespace-nowrap" title="Utentes presentes">
                          <Users size={10} className="text-slate-400 shrink-0" />{s.utentes}
                        </span>
                        <span className="text-[7px] font-bold text-[#004D71] uppercase bg-[#004D71]/5 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">{s.modalidade}</span>
                      </div>
                    ))}
                  </div>
                )) : (
                  <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                    Sem aulas no período
                  </div>
                )}
              </div>

              <div className="p-5 shrink-0">
                <button
                  onClick={() => downloadProfessorPDF(selectedProfessorDetail)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
                >
                  <Printer size={16} /> Imprimir PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedNadadorDetail && (() => {
        const dias: { date: string; periodo: 'manha' | 'tarde' }[] = nadadorSessionDetails[selectedNadadorDetail] || [];
        const uniqueDays = new Set(dias.map(d => d.date)).size;
        const manhaCount = dias.filter(d => d.periodo === 'manha').length;
        const tardeCount = dias.filter(d => d.periodo === 'tarde').length;
        const groups = groupByMonth(dias);

        return (
          <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in">
              <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#004D71] flex items-center justify-center shrink-0">
                    <Shield className="text-cyan-400" size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-[#004D71] uppercase text-base leading-tight truncate">{selectedNadadorDetail}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{periodLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNadadorDetail(null)}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-y border-slate-100 shrink-0">
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{uniqueDays}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dias</p>
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0" />
                <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[8px] font-bold text-cyan-600 uppercase bg-white px-2 py-1 rounded-full border border-slate-200">Manhã · {manhaCount}</span>
                  <span className="text-[8px] font-bold text-cyan-600 uppercase bg-white px-2 py-1 rounded-full border border-slate-200">Tarde · {tardeCount}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                {groups.length > 0 ? groups.map(group => (
                  <div key={group.key}>
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between py-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{monthLabel(group.key)}</span>
                      <span className="text-[9px] font-black text-slate-300 tabular-nums">{group.items.length}</span>
                    </div>
                    {group.items.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-4 py-2.5 border-b border-slate-100 last:border-0">
                        <span className="flex-1 min-w-0 text-[10px] font-black text-[#004D71] whitespace-nowrap">{formatDayLabel(d.date)}</span>
                        <span className="text-[8px] font-bold text-cyan-600 uppercase bg-cyan-50 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">
                          {d.periodo === 'manha' ? 'Manhã' : 'Tarde'}
                        </span>
                      </div>
                    ))}
                  </div>
                )) : (
                  <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                    Sem registos no período
                  </div>
                )}
              </div>

              <div className="p-5 shrink-0">
                <button
                  onClick={() => downloadNadadorPDF(selectedNadadorDetail)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
                >
                  <Printer size={16} /> Imprimir PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedZoneDetail && (() => {
        const zoneStat = dailyStats.find(z => z.id === selectedZoneDetail.id);
        return (
          <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in">
              <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl ${zoneStat?.bg || 'bg-[#004D71]'} flex items-center justify-center shrink-0`}>
                    <span className={zoneStat?.color || 'text-[#F7B500]'}>{zoneStat?.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-[#004D71] uppercase text-base leading-tight truncate">{selectedZoneDetail.label}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Utentes de hoje</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedZoneDetail(null)}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-y border-slate-100 shrink-0">
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{zoneDetailLogs.length}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Hoje</p>
                </div>
                <div className="w-px h-8 bg-slate-200 shrink-0" />
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{zoneDetailLogs.filter(l => !l.checkOut).length}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">No Recinto</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                {zoneDetailLogs.length > 0 ? zoneDetailLogs.map(log => {
                  const profile = usersMap[log.userId];
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <AvatarImage
                        src={profile?.img}
                        alt={log.userName}
                        className="w-9 h-9 rounded-xl border border-slate-100 shadow-sm shrink-0 object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[11px] font-black text-[#004D71] uppercase leading-tight truncate cursor-pointer hover:underline"
                          onClick={() => onUserClick && profile && onUserClick(profile)}
                          title="Ver Perfil"
                        >
                          {log.userName || '---'}
                        </p>
                        {log.registadoPorNome && (
                          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wide truncate mt-0.5">
                            via {log.registadoPorNome}{log.registadoPorRole === 'professor' ? ' · prof.' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg font-black text-[9px]">
                          <LogIn size={10} />
                          {log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkIn}
                        </span>
                        {log.checkOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg font-black text-[9px]">
                            <LogOut size={10} />
                            {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkOut}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black text-[#F7B500] uppercase animate-pulse">No Recinto</span>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="h-32 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                    Sem entradas hoje
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {selectedCoberturaDetail && (() => {
        const registos: { date: string; checkIn: string; modalidade: string; userName: string; motivo: string }[] = coberturaSessionDetails[selectedCoberturaDetail.toUpperCase()] || [];
        const groups = groupByMonth(registos);

        return (
          <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in">
              <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 shrink-0">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#004D71] flex items-center justify-center shrink-0">
                    <ShieldAlert className="text-amber-400" size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-[#004D71] uppercase text-base leading-tight truncate">{selectedCoberturaDetail}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Cobertura de receção · {periodLabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCoberturaDetail(null)}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-y border-slate-100 shrink-0">
                <div className="shrink-0 text-center leading-none">
                  <span className="text-2xl font-black text-[#004D71] tabular-nums">{registos.length}</span>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Registos</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                {groups.length > 0 ? groups.map(group => (
                  <div key={group.key}>
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between py-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{monthLabel(group.key)}</span>
                      <span className="text-[9px] font-black text-slate-300 tabular-nums">{group.items.length}</span>
                    </div>
                    {group.items.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="w-20 shrink-0 leading-none whitespace-nowrap">
                          <span className="text-[10px] font-black text-[#004D71] block">{formatDayLabel(r.date)}</span>
                          {r.checkIn && <span className="text-[8px] font-bold text-slate-400">{r.checkIn}</span>}
                        </div>
                        <span className="flex-1 min-w-0 text-[10px] font-bold text-slate-500 uppercase truncate">{r.userName}</span>
                        <span className="text-[7px] font-bold text-[#004D71] uppercase bg-[#004D71]/5 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">{r.modalidade}</span>
                        {r.motivo && (
                          <span className="text-[7px] font-bold text-amber-600 uppercase bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap" title={r.motivo}>{r.motivo}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )) : (
                  <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                    Sem registos no período
                  </div>
                )}
              </div>

              <div className="p-5 shrink-0">
                <button
                  onClick={() => downloadCoberturaPDF(selectedCoberturaDetail)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
                >
                  <Printer size={16} /> Imprimir PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showProfOnboarding && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in">
            <div className="w-16 h-16 bg-[#004D71]/5 rounded-full flex items-center justify-center mb-5">
              <ShieldAlert size={28} className="text-[#004D71]" />
            </div>
            <h3 className="text-lg font-black text-[#004D71] uppercase leading-tight mb-1">Acessos para Professores</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">O que precisas de saber</p>

            <ul className="space-y-3 mb-6">
              {[
                'Se a receção estiver indisponível (doença, baixa ou greve), liga o "Modo Cobertura" no topo desta página.',
                'Com o Modo Cobertura ligado, ganhas acesso de leitura a Avisos e Horários, para te orientares.',
                'Regista entradas e saídas normalmente — por QR, ou manualmente em "Registo Manual".',
                'Cada registo manual fica associado ao teu nome, para auditoria.',
                'Desliga o Modo Cobertura quando a receção retomar o serviço.',
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#004D71] text-[#F7B500] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                  <span className="text-[11px] font-bold text-slate-600 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => { localStorage.setItem('cpx_prof_onboarding_seen_v1', 'true'); setShowProfOnboarding(false); }}
              className="w-full py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
            >
              Entendido
            </button>
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
