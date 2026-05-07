import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Search, X, Trash2, 
  ChevronLeft, ChevronDown, User, Plus
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, addDoc, onSnapshot, query, where, 
  orderBy, Timestamp, limit, deleteDoc, doc, getDocs,
  collectionGroup, updateDoc, writeBatch
} from 'firebase/firestore';
import { UserProfile } from '../types';
import { AvatarImage } from './Common';

const APP_ID = 'cpx-vila-rei-main';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
  read: boolean;
}

function PickerModal({ users, unreadCounts, searchTerm, onSearch, onSelect, onClose }: {
  users: UserProfile[];
  unreadCounts: Record<string, number>;
  searchTerm: string;
  onSearch: (v: string) => void;
  onSelect: (u: UserProfile) => void;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) => setCollapsed(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const inside = users.filter(u => u.isInside);
  const outside = users.filter(u => !u.isInside);
  const byLetter: Record<string, UserProfile[]> = {};
  outside.forEach(u => {
    const l = (u.n || u.nome || '?')[0].toUpperCase();
    if (!byLetter[l]) byLetter[l] = [];
    byLetter[l].push(u);
  });
  const letterGroups = Object.keys(byLetter).sort().map(l => ({ key: l, users: byLetter[l] }));

  const PickerRow = ({ u }: { u: UserProfile }) => (
    <button onClick={() => onSelect(u)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 active:bg-[#F7B500]/10 transition-all text-left">
      <div className="flex items-center gap-4">
        <div className="relative">
          <AvatarImage src={u.img} alt={u.n || u.nome} className="w-12 h-12 rounded-xl border-2 border-white/20" />
          {u.isInside && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#004D71]" />}
          {unreadCounts[u.id] > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#004D71] animate-bounce">
              {unreadCounts[u.id]}
            </div>
          )}
        </div>
        <div>
          <h4 className="font-black text-sm text-white uppercase leading-none line-clamp-1">{u.n || u.nome}</h4>
          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">{u.role} · {u.modalidade || 'Utente'}</p>
        </div>
      </div>
      <ChevronLeft className="rotate-180 text-white/30" size={16} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[20000] bg-[#004D71] flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#003a55] p-6 pt-12 flex items-center justify-between border-b-4 border-[#F7B500] shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl active:scale-90">
            <ChevronLeft size={24} className="text-white" />
          </button>
          <div>
            <h2 className="text-xl font-black text-[#F7B500] uppercase tracking-tighter">Novo Chat</h2>
            <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Escolha um contacto</p>
          </div>
        </div>
      </div>

      <div className="p-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Pesquisar..."
            autoFocus
            value={searchTerm}
            onChange={e => onSearch(e.target.value)}
            className="w-full bg-white/10 border-2 border-white/10 rounded-[2rem] py-4 pl-12 pr-5 font-black text-sm text-white placeholder:text-white/30 outline-none focus:border-[#F7B500]/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
        {/* No Recinto */}
        {inside.length > 0 && (
          <div className="rounded-[1.5rem] border-2 border-green-400/30 overflow-hidden">
            <button onClick={() => toggle('__inside__')} className="w-full flex items-center justify-between px-5 py-3 bg-green-500/10">
              <span className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-widest">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> No Recinto
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-green-400 bg-white/10 px-3 py-1 rounded-full">{inside.length} presentes</span>
                <ChevronDown size={16} className={`text-green-400 transition-transform ${collapsed.has('__inside__') ? '-rotate-90' : ''}`} />
              </div>
            </button>
            {!collapsed.has('__inside__') && <div className="divide-y divide-white/5">{inside.map(u => <PickerRow key={u.id} u={u} />)}</div>}
          </div>
        )}

        {/* Grupos alfabéticos */}
        {letterGroups.map(g => (
          <div key={g.key} className="rounded-[1.5rem] border-2 border-white/10 overflow-hidden">
            <button onClick={() => toggle(g.key)} className="w-full flex items-center justify-between px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F7B500] text-[#004D71] font-black text-sm flex items-center justify-center">{g.key}</span>
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{g.users.length} contacto{g.users.length !== 1 ? 's' : ''}</span>
              </div>
              <ChevronDown size={16} className={`text-white/30 transition-transform ${collapsed.has(g.key) ? '-rotate-90' : ''}`} />
            </button>
            {!collapsed.has(g.key) && <div className="divide-y divide-white/5">{g.users.map(u => <PickerRow key={u.id} u={u} />)}</div>}
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <User size={48} className="text-white mx-auto mb-4" />
            <p className="text-xs font-black text-white uppercase tracking-widest">Nenhum resultado</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatModule({ user, users }: { user: UserProfile, users: UserProfile[] }) {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pickerSearch, setPickerSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [recentConvos, setRecentConvos] = useState<{userId: string, lastMsg: string, lastTime: any}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Listen for recent conversations via collectionGroup
  useEffect(() => {
    const q = query(
      collectionGroup(db, 'messages'),
      where('participants', 'array-contains', user.id),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const unsub = onSnapshot(q, (snap) => {
      const latestByChat: Record<string, {userId: string, lastMsg: string, lastTime: any}> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        // chatId is the parent document id (two levels up from message)
        const chatId = d.ref.parent.parent?.id || '';
        if (!chatId || latestByChat[chatId]) return;
        const otherId = (data.participants as string[]).find((id: string) => id !== user.id) || '';
        if (!otherId) return;
        latestByChat[chatId] = { userId: otherId, lastMsg: data.text, lastTime: data.createdAt };
      });
      const convos = Object.values(latestByChat).sort((a, b) => (b.lastTime?.seconds || 0) - (a.lastTime?.seconds || 0));
      setRecentConvos(convos);
    }, () => {});
    return () => unsub();
  }, [user.id]);

  useEffect(() => {
    // Listen for ALL unread messages for the current user using email (most consistent)
    const q = query(
      collectionGroup(db, 'messages'),
      where('receiverEmail', '==', user.email),
      where('read', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        const senderId = data.senderId;
        counts[senderId] = (counts[senderId] || 0) + 1;
      });
      setUnreadCounts(counts);
    }, (error) => {
      console.warn("Unread sync restricted:", error.message);
    });

    return () => unsub();
  }, [user.email]);

  useEffect(() => {
    if (!selectedUser) return;

    const chatPath = `artifacts/${APP_ID}/public/data/conversas`;
    const participants = [user.id, selectedUser.id].sort();
    const chatId = participants.join('_');

    const msgPath = `${chatPath}/${chatId}/messages`;
    const q = query(
      collection(db, chatPath, chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Mark as read efficiently using a batch
      const unreadFromSelected = snap.docs.filter(d => {
        const data = d.data();
        return data.senderId === selectedUser.id && !data.read;
      });

      if (unreadFromSelected.length > 0) {
        const batch = writeBatch(db);
        unreadFromSelected.forEach(d => {
          batch.update(d.ref, { read: true });
        });
        batch.commit().catch(err => console.error("Batch mark read error:", err));
      }

      // Slightly longer delay to allow DOM to settle
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, msgPath));

    return () => unsub();
  }, [selectedUser?.id, user.id]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const currentMsg = newMessage;
    setNewMessage(""); // Optimistic clear

    const chatPath = `artifacts/${APP_ID}/public/data/conversas`;
    const participants = [user.id, selectedUser.id].sort();
    const chatId = participants.join('_');

    try {
      await addDoc(collection(db, chatPath, chatId, 'messages'), {
        senderId: user.id,
        senderEmail: user.email,
        receiverId: selectedUser.id,
        receiverEmail: selectedUser.email,
        participants: [user.id, selectedUser.id],
        participantEmails: [user.email, selectedUser.email],
        text: currentMsg,
        createdAt: Timestamp.now(),
        read: false
      });
    } catch (e) {
      console.error(e);
      setNewMessage(currentMsg); // Revert on failure
    }
  };

  const deleteConversation = async () => {
    if (!selectedUser || !window.confirm("Apagar histórico de conversa?")) return;

    const chatPath = `artifacts/${APP_ID}/public/data/conversas`;
    const participants = [user.id, selectedUser.id].sort();
    const chatId = participants.join('_');

    try {
      const msgColl = collection(db, chatPath, chatId, 'messages');
      const msgs = await getDocs(msgColl);
      
      const batchSize = 500;
      let batch = writeBatch(db);
      let count = 0;

      for (const m of msgs.docs) {
        batch.delete(m.ref);
        count++;
        if (count >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const sortedUsers = React.useMemo(() => users
    .filter(u => u.id !== user.id)
    .filter(u => (u.n || u.nome || '').toLowerCase().includes(pickerSearch.toLowerCase()))
    .sort((a, b) => {
      const unreadA = unreadCounts[a.id] || 0;
      const unreadB = unreadCounts[b.id] || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      return (a.n || a.nome || '').localeCompare(b.n || b.nome || '');
    }), [users, user.id, pickerSearch, unreadCounts]);

  if (selectedUser) {
    return (
      <div className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-[#004D71] p-6 pt-12 flex items-center justify-between text-white border-b-4 border-[#F7B500]">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2 bg-white/10 rounded-xl">
              <ChevronLeft size={24}/>
            </button>
            <div className="relative">
              <AvatarImage src={selectedUser.img} alt={selectedUser.n || selectedUser.nome} className="w-10 h-10 rounded-xl border-2 border-white/20" />
              {selectedUser.isInside && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#004D71]" />}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase line-clamp-1">{selectedUser.n || selectedUser.nome}</h3>
              <p className="text-[7px] font-black text-[#F7B500] uppercase tracking-widest">{selectedUser.role} • {selectedUser.modalidade || 'Utente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={deleteConversation} 
              className="px-4 py-3 bg-red-500 text-white rounded-2xl active:scale-90 font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Trash2 size={14}/> Limpar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 hide-scrollbar pt-8">
          {messages.map((m, idx) => {
            const isMe = m.senderId === user.id;
            return (
              <div key={m.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-3xl text-sm font-medium shadow-sm ${isMe ? 'bg-[#004D71] text-white rounded-tr-none' : 'bg-white text-[#004D71] rounded-tl-none border border-slate-100'}`}>
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="p-6 bg-white border-t border-slate-100 flex items-center gap-3 pb-10 shadow-2xl">
          <input 
            type="text" 
            placeholder="Mensagem..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-slate-100 border-none rounded-2xl p-4 font-bold text-sm outline-none focus:ring-2 ring-[#004D71]/10"
          />
          <button type="submit" className="p-4 bg-[#004D71] text-[#F7B500] rounded-2xl shadow-lg active:scale-90 transition-all">
            <Send size={20}/>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="space-y-4 animate-in fade-in pb-24 text-left font-sans">
        <div className="px-1 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
              <MessageSquare className="text-[#F7B500]"/> Mensagens
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Complexo Desportivo Vila de Rei</p>
          </div>
        </div>

        {/* Lista de conversas estilo WhatsApp */}
        <div className="bg-white rounded-[2.5rem] border-4 border-[#004D71]/5 overflow-hidden divide-y divide-[#004D71]/5 shadow-sm">
          {recentConvos.length === 0 && (
            <div className="text-center py-16">
              <MessageSquare size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sem conversas ainda</p>
              <p className="text-[9px] text-slate-300 mt-1">Carrega no + para iniciar</p>
            </div>
          )}
          {recentConvos.map(c => {
            const other = users.find(u => u.id === c.userId);
            if (!other) return null;
            const unread = unreadCounts[other.id] || 0;
            const time = c.lastTime?.toDate ? c.lastTime.toDate().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <button key={c.userId} onClick={() => setSelectedUser(other)} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-blue-50 transition-all text-left">
                <div className="relative shrink-0">
                  <AvatarImage src={other.img} alt={other.n || other.nome} className={`w-14 h-14 rounded-2xl border-2 shadow-sm ${other.isInside ? 'border-green-400' : 'border-white'}`} />
                  {other.isInside && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />}
                  {unread > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{unread}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-black text-sm uppercase leading-none truncate ${unread > 0 ? 'text-[#004D71]' : 'text-[#004D71]/70'}`}>{other.n || other.nome}</h4>
                    <span className="text-[8px] text-slate-400 shrink-0 ml-2">{time}</span>
                  </div>
                  <p className={`text-xs mt-1 truncate ${unread > 0 ? 'font-bold text-[#004D71]' : 'text-slate-400'}`}>{c.lastMsg}</p>
                </div>
                {unread > 0 && <div className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowPicker(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-[#004D71] text-[#F7B500] rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all z-[50] group"
      >
        <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* User Picker Modal */}
      {showPicker && (
        <PickerModal
          users={sortedUsers}
          unreadCounts={unreadCounts}
          searchTerm={pickerSearch}
          onSearch={setPickerSearch}
          onSelect={(u) => { setSelectedUser(u); setShowPicker(false); setPickerSearch(''); }}
          onClose={() => { setShowPicker(false); setPickerSearch(''); }}
        />
      )}
    </div>
  );
}
