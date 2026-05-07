import React, { useState, useEffect } from 'react';
import {
  Users, LogIn, LogOut, Calendar, Search,
  Download,
  FileText, Plus, X, Edit2, Save, Trash2, QrCode,
  Dumbbell, Waves, Activity, Flame
} from 'lucide-react';
import { AvatarImage } from './Common';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import {
  collection, query, where, onSnapshot,
  Timestamp, limit, getDocs, setDoc, updateDoc,
  doc, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { AccessLog, UserProfile } from '../types';
import { isUserInZone } from '../lib/logic';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function AccessLogsModule({ onScan }: { onScan?: () => void } = {}) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [utentesInside, setUtentesInside] = useState<UserProfile[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  
  // Manual Entry States
  const [showManualModal, setShowManualModal] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedModality, setSelectedModality] = useState('Piscina Livre');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editDate, setEditDate] = useState('');

  const modalities = ['Piscina Livre', 'Ginásio', 'Hidroginástica', 'Natação (Nível 1/2)', 'Natação (Nível 3)', 'Bebés / AMA'];

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/users`;
    const q = query(collection(db, path), where('isInside', '==', true));
    return onSnapshot(q, snap => {
      setUtentesInside(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    }, () => {});
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/users`), limit(500)))
      .then(snap => {
        const m: Record<string, UserProfile> = {};
        snap.docs.forEach(d => { m[d.id] = { id: d.id, ...d.data() } as UserProfile; });
        setUsersMap(m);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const path = `artifacts/${APP_ID}/public/data/logs_acesso`;
    
    // We filter by 'date' field which is YYYY-MM-DD
    const q = query(
      collection(db, path),
      where('date', '==', selectedDate),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as AccessLog))
        .sort((a, b) => {
          const ta = a.checkIn instanceof Timestamp ? a.checkIn.seconds : 0;
          const tb = b.checkIn instanceof Timestamp ? b.checkIn.seconds : 0;
          return tb - ta;
        });
      setLogs(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate]);

  useEffect(() => {
    if (userSearchText.length < 2) {
      setFoundUsers([]);
      return;
    }

    const searchUsers = async () => {
      const q = query(
        collection(db, `artifacts/${APP_ID}/public/data/users`),
        where('role', '==', 'utente'),
        limit(50)
      );
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
      setFoundUsers(allUsers.filter(u => 
        (u.n || u.nome || '').toLowerCase().includes(userSearchText.toLowerCase())
      ));
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [userSearchText]);

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

        setSelectedDate(today);
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
  };

  const openEditModal = (log: AccessLog) => {
    setEditingLogId(log.id);
    setSelectedUser({ id: log.userId, n: log.userName } as any);
    setSelectedModality(log.modalidade || 'Piscina Livre');
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

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Tem a certeza que deseja eliminar este registo permanentemente?')) return;
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/logs_acesso`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'logs_acesso');
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

      // Update UserProfile status
      const userRef = doc(db, `artifacts/${APP_ID}/public/data/users`, log.userId);
      await updateDoc(userRef, {
        isInside: false,
        location: null,
        lastOut: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'logs_acesso');
    }
  };

  const filteredLogs = logs.filter(l => 
    l.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    const header = "Data,Nome,Modalidade,Entrada,Saida,Duração (min)\n";
    const rows = filteredLogs.map(l => {
      const checkIn = l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString() : l.checkIn;
      const checkOut = l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString() : l.checkOut) : '---';
      return `${l.date},"${l.userName}","${l.modalidade || ''}",${checkIn},${checkOut},${l.durationMinutes || 0}`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_acessos_${selectedDate}.csv`);
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
    doc.text(`Data: ${selectedDate}`, 14, 30);
    doc.text(`Total de entradas: ${filteredLogs.length}`, 14, 35);
    
    const tableData = filteredLogs.map(l => [
      l.userName,
      l.modalidade || '---',
      l.checkIn instanceof Timestamp ? l.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkIn,
      l.checkOut ? (l.checkOut instanceof Timestamp ? l.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : l.checkOut) : 'Dentro',
      l.durationMinutes ? `${l.durationMinutes} min` : '---',
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Utente', 'Modalidade', 'Entrada', 'Saída', 'Duração']],
      body: tableData,
      headStyles: { fillColor: [0, 77, 113], textColor: [247, 181, 0] }, // #004D71 and #F7B500
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 45 },
      styles: { fontSize: 8, font: 'helvetica' }
    });

    doc.save(`relatorio_acessos_${selectedDate}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      <div className="px-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Users className="text-[#F7B500]"/> Registo de Acessos
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Controlo histórico de entradas e saídas</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase text-[#004D71] outline-none focus:border-[#004D71]/20 shadow-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            {onScan && (
              <button
                onClick={onScan}
                className="px-6 py-2.5 bg-[#004D71] text-[#F7B500] rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 font-black uppercase text-[10px]"
              >
                <QrCode size={18}/> Ler QR
              </button>
            )}
            <button
              onClick={() => setShowManualModal(true)}
              className="px-6 py-2.5 bg-[#F7B500] text-[#004D71] rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 border-2 border-[#F7B500] font-black uppercase text-[10px]"
            >
              <Plus size={18}/> Registo Manual
            </button>
            <button 
              onClick={downloadCSV}
              className="px-4 py-2.5 bg-[#004D71] text-[#F7B500] rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
            >
              <Download size={18}/> <span className="text-[10px] font-black uppercase">CSV</span>
            </button>
            <button 
              onClick={downloadPDF}
              className="px-4 py-2.5 bg-[#F7B500] text-[#004D71] rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
            >
              <FileText size={18}/> <span className="text-[10px] font-black uppercase">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in">
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
                 {/* Step 1: User Search (only if not editing or if explicitly changing) */}
                 {!selectedUser ? (
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

                       <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {foundUsers.map(u => (
                            <button 
                              key={u.id}
                              onClick={() => setSelectedUser(u)}
                              className="w-full p-4 rounded-xl border-2 border-slate-100 flex items-center gap-3 hover:border-[#F7B500] text-left transition-all"
                            >
                               <div className="w-10 h-10 rounded-lg bg-[#004D71]/5 flex items-center justify-center text-[#004D71] font-black text-xs uppercase shrink-0">
                                  {u.n?.substring(0,2) || 'UT'}
                               </div>
                               <div>
                                  <p className="font-black text-[#004D71] text-xs uppercase">{u.n || u.nome}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{u.email}</p>
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
                    </div>
                 ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4">
                       <div className="p-4 bg-slate-50 rounded-2xl border-2 border-[#004D71]/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-lg bg-[#004D71] flex items-center justify-center text-[#F7B500] font-black text-xs uppercase">
                                {selectedUser.n?.substring(0,2) || 'UT'}
                             </div>
                             <div>
                                <p className="font-black text-[#004D71] text-xs uppercase">{selectedUser.n || selectedUser.nome}</p>
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
                         <div className="grid grid-cols-2 gap-4">
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
                             onClick={() => handleDeleteLog(editingLogId)}
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

      {/* 4 quadrados em tempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { id: 'gym',      label: 'Ginásio',       icon: <Dumbbell size={28}/>, color: 'text-[#F7B500]',    bg: 'bg-[#004D71]',        count: utentesInside.filter(u => isUserInZone(u, 'gym')).length },
          { id: 'pool_in',  label: 'Piscina',        icon: <Waves size={28}/>,    color: 'text-sky-300',      bg: 'bg-sky-600',          count: utentesInside.filter(u => isUserInZone(u, 'pool_in')).length },
          { id: 'fit',      label: 'Aulas Fitness',  icon: <Activity size={28}/>, color: 'text-purple-200',   bg: 'bg-purple-600',       count: utentesInside.filter(u => isUserInZone(u, 'fit')).length },
          { id: 'sauna',    label: 'Sauna',          icon: <Flame size={28}/>,    color: 'text-orange-200',   bg: 'bg-orange-500',       count: utentesInside.filter(u => isUserInZone(u, 'sauna')).length },
        ].map(z => (
          <div key={z.id} className={`${z.bg} rounded-[2rem] p-6 text-white shadow-xl flex flex-col justify-between gap-4 relative overflow-hidden`}>
            <div className="flex items-center justify-between">
              <span className={`${z.color}`}>{z.icon}</span>
              <p className={`text-5xl font-black tabular-nums leading-none ${z.color}`}>{z.count}</p>
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/70">{z.label}</p>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full blur-2xl" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou modalidade..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border-4 border-slate-100 rounded-[2.5rem] text-sm font-black text-[#004D71] placeholder-slate-300 outline-none shadow-sm focus:border-[#004D71]/5 transition-all"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border-4 border-slate-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Utente</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Modalidade</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Entrada</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Saída</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Duração</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.map(log => {
                    const profile = usersMap[log.userId];
                    return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <AvatarImage
                            src={profile?.img}
                            alt={log.userName}
                            className="w-12 h-12 rounded-xl border-2 border-slate-100 shadow-sm shrink-0 object-cover"
                          />
                          <span className="text-sm font-black text-[#004D71] uppercase leading-tight">{log.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-500 uppercase">{log.modalidade || '---'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl font-black text-sm">
                          <LogIn size={13}/>
                          {log.checkIn instanceof Timestamp ? log.checkIn.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkIn}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {log.checkOut ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl font-black text-sm">
                            <LogOut size={13}/>
                            {log.checkOut instanceof Timestamp ? log.checkOut.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.checkOut}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-black text-[#F7B500] uppercase animate-pulse">No Recinto</span>
                            <button
                              onClick={() => handleManualCheckOut(log)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-black uppercase hover:bg-red-600 transition-colors shadow-sm"
                            >
                              Dar Saída
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black text-[#004D71]">{log.durationMinutes ? `${log.durationMinutes} min` : '---'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openEditModal(log)}
                          className="p-2 text-[#004D71] hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar Registo"
                        >
                          <Edit2 size={15}/>
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-black text-xs uppercase tracking-widest">Sem registos para este dia</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
