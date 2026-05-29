import React, { useState, useEffect } from 'react';
import {
  Users, LogIn, LogOut, Calendar, Search,
  Download, BookOpen,
  FileText, Plus, X, Edit2, Save, Trash2, QrCode, Key,
  Dumbbell, Waves, Activity, Flame, Sun, Star, Users2, Droplets
} from 'lucide-react';
import { AvatarImage, PicotoIcon } from './Common';
import { db, handleFirestoreError, OperationType, APP_ID } from '../lib/firebase';
import {
  collection, query, where, onSnapshot,
  Timestamp, limit, getDocs, setDoc, updateDoc,
  doc, serverTimestamp, deleteDoc, orderBy
} from 'firebase/firestore';
import { AccessLog, UserProfile } from '../types';
import { TurmasModule } from './TurmasModule';
import { isUserInZone, normalizeSearchString } from '../lib/logic';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart, Bar } from 'recharts';

export function AccessLogsModule({ onScan, currentUser, utentes = [] }: { onScan?: () => void; currentUser?: UserProfile; utentes?: UserProfile[] } = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<AccessLog[]>([]);

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
  const [filterStatus, setFilterStatus] = useState('all');
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
  const [showTurmas, setShowTurmas] = useState(false);
  const [confirmDeleteLog, setConfirmDeleteLog] = useState<AccessLog | null>(null);
  const [deletingLog, setDeletingLog] = useState(false);
  const readOnly = currentUser?.role === 'chefia';

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
    'Sauna'
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
    }, () => {});
  }, []);

  useEffect(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = now.toISOString().split('T')[0];
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    const q = query(collection(db, path), where('date', '>=', monthStart), where('date', '<=', monthEnd));
    return onSnapshot(q, snap => {
      setMonthlyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessLog)));
    }, () => {});
  }, []);



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
          userId: selectedUser.id,
          modalidade: selectedModality,
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
        const logId = `${Date.now()}_${selectedUser.id}`;
        await setDoc(doc(db, path, logId), {
          userId: selectedUser.id,
          userName: selectedUser.n || selectedUser.nome || 'Utente',
          userRole: selectedUser.role,
          checkIn: Timestamp.now(),
          date: today,
          zone: 'Entrada Manual',
          modalidade: selectedModality,
          timestamp: serverTimestamp()
        });

        // Update UserProfile status
        const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, selectedUser.id);
        await updateDoc(userRef, {
          isInside: true,
          location: selectedModality,
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
        entradas_disponiveis: 10,
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
      } catch (_) {}
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs_acesso');
    }
  };

  // All logs within date range — used for charts and stats (unaffected by search/status)
  const allDateLogs = React.useMemo(() => logs.filter(l => {
    let lDate = l.date;
    if (!lDate) {
      if (l.checkIn instanceof Timestamp) lDate = l.checkIn.toDate().toISOString().split('T')[0];
      else if (l.timestamp && (l.timestamp as any).toDate) lDate = (l.timestamp as any).toDate().toISOString().split('T')[0];
      else lDate = '2024-01-01';
    }
    return lDate >= startDate && lDate <= endDate;
  }), [logs, startDate, endDate]);

  // Table view — additionally filtered by search and status toggle
  const filteredLogs = React.useMemo(() => allDateLogs.filter(l => {
    const matchSearch = (l.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
    let matchStatus = true;
    if (filterStatus === 'inside') matchStatus = !l.checkOut;
    if (filterStatus === 'left') matchStatus = !!l.checkOut;
    return matchSearch && matchStatus;
  }), [allDateLogs, searchTerm, filterStatus]);

  const statsByModality = React.useMemo(() => {
    const rows = modalities.map(m => ({
      label: m,
      count: allDateLogs.filter(l => normalizeModality(l.modalidade || '') === m).length
    })).filter(s => s.count > 0);
    const otherCount = allDateLogs.filter(l => !modalities.includes(normalizeModality(l.modalidade || ''))).length;
    if (otherCount > 0) rows.push({ label: 'Outro / Geral', count: otherCount });
    return rows;
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
    const today = new Date().toISOString().split('T')[0];
    const rows = allDateLogs.filter(l => l.date === today);
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const key = (r.modalidade || 'Outro / Geral').trim() || 'Outro / Geral';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([local, entradas]) => ({ local, entradas }))
      .sort((a, b) => b.entradas - a.entradas);
  }, [allDateLogs]);

  const leaderboardByModality = React.useMemo(() => {
    const ranking: Record<string, Array<{ userId: string; userName: string; count: number }>> = {};

    modalities.forEach(m => {
      const modalityLogs = allDateLogs.filter(l => normalizeModality(l.modalidade || '') === m);
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
  }, [allDateLogs]);

  const downloadCSV = () => {
    let csv = "Data,Nome,Modalidade,Entrada,Saida,Duração (min)\n";
    filteredLogs.forEach(l => {
      const checkIn = l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString() : l.checkIn;
      const checkOut = l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString() : l.checkOut) : '---';
      csv += `${l.date},"${l.userName}","${l.modalidade || ''}",${checkIn},${checkOut},${l.durationMinutes || 0}\n`;
    });
    
    csv += "\nResumo por Modalidade\nModalidade,Total de Entradas\n";
    statsByModality.forEach(s => {
      csv += `"${s.label}",${s.count}\n`;
    });
    csv += `"TOTAL GERAL",${filteredLogs.length}\n`;

    // Append Rankings
    csv += "\nRanking de Presenças (Top 3 por Modalidade)\nModalidade,Classificação,Utente,Presenças\n";
    Object.entries(leaderboardByModality).forEach(([modality, users]) => {
      (users as any).forEach((u: any, i: number) => {
        csv += `"${modality}",${i + 1}º Lugar,"${u.userName}",${u.count}\n`;
      });
    });
    
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
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 77, 113); // #004D71
    doc.text('Relatório de Acessos', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 30);
    doc.text(`Total de Entradas: ${filteredLogs.length}`, 14, 35);
    
    const tableData = filteredLogs.map(l => [
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

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 77, 113);
    doc.text('Resumo por Modalidade', 14, finalY);

    const summaryData = statsByModality.map(s => [s.label, s.count.toString()]);
    summaryData.push(['TOTAL', filteredLogs.length.toString()]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Modalidade', 'Total de Entradas']],
      body: summaryData,
      headStyles: { fillColor: [247, 181, 0], textColor: [0, 77, 113] },
      styles: { fontSize: 9, font: 'helvetica' }
    });

    // Add rankings if exists
    const rankTableData: string[][] = [];
    Object.entries(leaderboardByModality).forEach(([modality, users]) => {
      (users as any).forEach((u: any, index: number) => {
        rankTableData.push([
          modality,
          `${index + 1}º Lugar`,
          u.userName,
          `${u.count} presenças`
        ]);
      });
    });

    if (rankTableData.length > 0) {
      const rankY = (doc as any).lastAutoTable.finalY + 15;
      
      // Page break check if near the bottom
      if (rankY > 240) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(0, 77, 113);
        doc.text('Maiores Utilizadores (Top 3 por Modalidade)', 14, 22);
        
        autoTable(doc, {
          startY: 28,
          head: [['Modalidade', 'Posição', 'Utente', 'Presenças']],
          body: rankTableData,
          headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] },
          styles: { fontSize: 8, font: 'helvetica' }
        });
      } else {
        doc.setFontSize(14);
        doc.setTextColor(0, 77, 113);
        doc.text('Maiores Utilizadores (Top 3 por Modalidade)', 14, rankY);
        
        autoTable(doc, {
          startY: rankY + 5,
          head: [['Modalidade', 'Posição', 'Utente', 'Presenças']],
          body: rankTableData,
          headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] },
          styles: { fontSize: 8, font: 'helvetica' }
        });
      }
    }

    doc.save(`relatorio_acessos_${startDate}_a_${endDate}.pdf`);
  };

  return (
    <div className="space-y-4 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      <div className="px-1 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
        <div>
          <h2 className="text-lg font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-2">
            <Users size={18} className="text-[#F7B500]"/> Registo de Acessos
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Controlo histórico de entradas e saídas</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-2">
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
                <Key size={14}/> Gerar Convite
              </button>
            )}
            {!readOnly && onScan && (
              <button
                onClick={onScan}
                className="px-4 py-2 bg-[#004D71] text-[#F7B500] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wide"
              >
                <PicotoIcon size={14}/> Ler QR
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => setShowTurmas(true)}
                className="px-4 py-2 bg-[#004D71] text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wide border border-[#004D71]"
              >
                <BookOpen size={14}/> Turmas
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => setShowManualModal(true)}
                className="px-4 py-2 bg-[#F7B500] text-[#004D71] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5 border border-[#F7B500] font-black uppercase text-[10px] tracking-wide"
              >
                <Plus size={14}/> Registo Manual
              </button>
            )}
            <button 
              onClick={downloadCSV}
              className="px-3 py-2 bg-[#004D71] text-[#F7B500] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Download size={14}/> <span className="text-[10px] font-black uppercase tracking-wide">CSV</span>
            </button>
            <button 
              onClick={downloadPDF}
              className="px-3 py-2 bg-[#F7B500] text-[#004D71] rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
            >
              <FileText size={14}/> <span className="text-[10px] font-black uppercase tracking-wide">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {confirmDeleteLog && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full animate-in zoom-in text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500"/>
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
                  ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  : <Trash2 size={12}/>}
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
                <X size={20}/>
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
                                <div className="w-3 h-3 border-2 border-[#004D71]/30 border-t-[#004D71] rounded-full animate-spin"/>
                             ) : (
                                <Plus size={14}/>
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
                             <Trash2 size={20}/>
                           </button>
                         )}
                         <button 
                           disabled={isSubmitting}
                           onClick={handleManualCheckIn}
                           className="flex-1 bg-[#004D71] text-[#F7B500] py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                           {isSubmitting ? 'A Processar...' : <>{editingLogId ? <Save size={18}/> : <LogIn size={18}/>} {editingLogId ? 'Guardar Correção' : 'Confirmar Entrada'}</>}
                         </button>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Quadrados em tempo real */}
      <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
        {React.useMemo(() => {
          const countMod = (mod: string) => allDateLogs.filter(l => normalizeModality(l.modalidade || '') === mod).length;
          const countMonthly = (mod: string) => monthlyLogs.filter(l => normalizeModality(l.modalidade || '') === mod).length;
          return [
            { id: 'livre',    label: 'Piscina Livre',       icon: <Star size={14}/>,      color: 'text-sky-300',    bg: 'bg-sky-600',    mod: 'Piscina Regime Livre' },
            { id: 'pool_out', label: 'Piscina Exterior',    icon: <Sun size={14}/>,       color: 'text-cyan-200',   bg: 'bg-cyan-500',   mod: 'Piscina Exterior'     },
            { id: 'nat',      label: 'Natação Nível 1-2-3', icon: <Waves size={14}/>,     color: 'text-blue-300',   bg: 'bg-blue-600',   mod: 'Natação'              },
            { id: 'hidro',    label: 'Hidroginástica',      icon: <Droplets size={14}/>,  color: 'text-teal-200',   bg: 'bg-teal-500',   mod: 'Hidroginástica'       },
            { id: 'bebes',    label: 'Bebés / AMA',         icon: <Users2 size={14}/>,    color: 'text-indigo-200', bg: 'bg-indigo-500', mod: 'Bebés/AMA'            },
            { id: 'fit',      label: 'Aulas Fitness',       icon: <Activity size={14}/>,  color: 'text-purple-200', bg: 'bg-purple-600', mod: 'Aulas Fitness'        },
            { id: 'gym',      label: 'Ginásio',             icon: <Dumbbell size={14}/>,  color: 'text-[#F7B500]',  bg: 'bg-[#004D71]',  mod: 'Ginásio'              },
            { id: 'sauna',    label: 'Sauna',               icon: <Flame size={14}/>,     color: 'text-orange-200', bg: 'bg-orange-500', mod: 'Sauna'                },
          ].map(z => ({
            ...z,
            count: countMod(z.mod),
            monthlyCount: countMonthly(z.mod),
            liveCount: utentesInside.filter(u => isUserInZone(u, z.id)).length,
          })).sort((a, b) => b.monthlyCount - a.monthlyCount);
        }, [allDateLogs, monthlyLogs, utentesInside]).map(z => (
          <div key={z.id} className={`${z.bg} rounded-xl p-2.5 text-white shadow-sm flex flex-col gap-2 border border-white/10`}>
            {/* Label row */}
            <div className="flex items-center gap-1.5">
              <span className={`${z.color} bg-white/10 p-1 rounded-md shrink-0`}>{z.icon}</span>
              <p className="text-[8px] font-black uppercase tracking-wide text-white leading-tight line-clamp-2">{z.label}</p>
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-1.5">
              {/* Today total */}
              <div className="flex-1 bg-black/20 rounded-lg px-2 py-1 text-center">
                <p className={`text-lg font-black tabular-nums leading-none ${z.color}`}>{z.count}</p>
                <p className="text-[7px] font-black text-white/50 uppercase mt-0.5">hoje</p>
              </div>
              {/* Live now */}
              <div className={`flex-1 rounded-lg px-2 py-1 text-center ${z.liveCount > 0 ? 'bg-green-500/30 border border-green-400/40' : 'bg-black/20'}`}>
                <p className="text-lg font-black tabular-nums leading-none text-white flex items-center justify-center gap-1">
                  {z.liveCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>}
                  {z.liveCount}
                </p>
                <p className="text-[7px] font-black text-white/50 uppercase mt-0.5">agora</p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Utente</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Modalidade</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Entrada</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Saída</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Dur.</th>
                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider text-center"></th>
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
                          <span className="text-[10px] font-black text-[#004D71] uppercase leading-tight">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[10px] font-bold text-slate-500">{log.date}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{log.modalidade || '---'}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg font-black text-[10px]">
                          <LogIn size={11}/>
                          {log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkIn}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {log.checkOut ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg font-black text-[10px]">
                            <LogOut size={11}/>
                            {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkOut}
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
                        <span className="text-[10px] font-black text-[#004D71]">{log.durationMinutes ? `${log.durationMinutes}m` : '---'}</span>
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => openEditModal(log)}
                              className="p-1 text-[#004D71] hover:bg-slate-100 rounded-md transition-colors"
                              title="Editar Registo"
                            >
                              <Edit2 size={12}/>
                            </button>
                            <button
                              onClick={() => setConfirmDeleteLog(log)}
                              className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                              title="Eliminar Registo"
                            >
                              <Trash2 size={12}/>
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

          {/* Visual Podium Section */}
          {Object.keys(leaderboardByModality).length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest flex items-center gap-1.5">
                    <Star className="text-[#F7B500]" size={14}/> Pódio de Assiduidade por Modalidade
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Top 3 utentes mais assíduos no período
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(leaderboardByModality).map(([modality, users]) => {
                  const first = users[0];
                  const second = users[1] || null;
                  const third = users[2] || null;

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
                              <span className="text-[8px] font-black text-[#004D71] truncate max-w-full text-center mb-0.5" title={second.userName}>
                                {second.userName.split(' ')[0]}
                              </span>
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
                          <span className="text-[8px] font-black text-[#004D71] truncate max-w-full text-center mb-0.5 flex items-center gap-0.5" title={first.userName}>
                            👑 {first.userName.split(' ')[0]}
                          </span>
                          <span className="text-[8px] font-black text-[#F7B500] mb-0.5">{first.count}p</span>
                          <div className="w-full bg-[#004D71] text-[#F7B500] font-black text-[9px] rounded-t-xl h-12 flex items-center justify-center border-t-2 border-[#F7B500] shadow-md">
                            1º
                          </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="flex-1 flex flex-col items-center">
                          {third ? (
                            <>
                              <span className="text-[8px] font-black text-[#004D71] truncate max-w-full text-center mb-0.5" title={third.userName}>
                                {third.userName.split(' ')[0]}
                              </span>
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
                  <Activity className="text-[#F7B500]" size={14}/> Totais do Período por Modalidade
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  Número de entradas no intervalo selecionado
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

          <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-[#004D71] uppercase tracking-widest">Afluência de Hoje por Local</h3>
              <span className="text-[9px] font-black text-slate-400 uppercase">{new Date().toISOString().split('T')[0]}</span>
            </div>
            {todayAffluenceByLocation.length > 0 ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todayAffluenceByLocation} margin={{ top: 6, right: 6, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="local" tick={{ fontSize: 9, fontWeight: 700 }} interval={0} angle={-12} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                    <Tooltip />
                    <Bar dataKey="entradas" fill="#004D71" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase tracking-widest">
                Sem registos de hoje
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
