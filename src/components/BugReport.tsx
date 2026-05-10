import React, { useState } from 'react';
import { Bug, X, Send, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { APP_ID } from '../App';
import { collection, addDoc, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { UserProfile } from '../types';

export function BugReportModule({ user, isOpen: externalOpen, onClose: externalClose, showButton = true }: { user: UserProfile, isOpen?: boolean, onClose?: () => void, showButton?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    if (externalClose && !val) externalClose();
    setInternalOpen(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/bugs`), {
        userId: user.id,
        userEmail: user.email,
        userName: user.n || user.nome,
        text,
        timestamp: Timestamp.now(),
        status: 'new'
      });

      const q = query(collection(db, `artifacts/${APP_ID}/public/data/users`), where('role', '==', 'admin'), limit(1));
      const adminSnap = await getDocs(q);
      
      if (!adminSnap.empty) {
        const adminData = adminSnap.docs[0].data();
        const adminId = adminSnap.docs[0].id;
        const chatId = [user.id, adminId].sort().join('_');
        const chatPath = `artifacts/${APP_ID}/public/data/conversas/${chatId}/messages`;
        
        await addDoc(collection(db, chatPath), {
          senderId: user.id,
          senderEmail: user.email,
          receiverId: adminId,
          receiverEmail: adminData.email,
          participants: [user.id, adminId],
          participantEmails: [user.email, adminData.email],
          text: `🚨 [RELATÓRIO TÉCNICO]: ${text}`,
          createdAt: Timestamp.now(),
          read: false
        });
      }
      
      setSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
        setText('');
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showButton && (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 p-5 rounded-[2rem] flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                <Bug size={24}/>
            </div>
            <div className="text-left">
                <h4 className="font-black uppercase text-xs">Suporte Técnico</h4>
                <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-0.5">Reportar problemas ou melhorias</p>
            </div>
          </div>
          <ChevronRight size={20} className="opacity-20" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100000] bg-[#004D71]/80 backdrop-blur-md flex items-center justify-center p-6 px-10 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border-4 border-red-500/20 relative">
            <button onClick={() => setIsOpen(false)} className="absolute -top-4 -right-4 p-4 bg-white text-[#004D71] rounded-2xl shadow-xl active:scale-90 flex items-center justify-center">
              <X size={20}/>
            </button>

            {sent ? (
              <div className="text-center py-12 animate-in zoom-in">
                 <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-200">
                    <CheckCircle2 size={40} />
                 </div>
                 <h3 className="font-black text-[#004D71] uppercase text-xl mb-2">Enviado com Sucesso</h3>
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                   A nossa equipa técnica <br/>já foi notificada do erro.
                 </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center gap-4 mb-2">
                   <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
                      <AlertCircle size={24}/>
                   </div>
                   <div className="text-left">
                      <h3 className="font-black text-[#004D71] uppercase text-lg leading-none">Bug ou Sugestão</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Chat direto com administrador</p>
                   </div>
                </div>

                <div className="space-y-3">
                   <p className="text-[10px] font-black text-[#004D71]/60 uppercase leading-relaxed text-left">Descreva o problema de forma clara:</p>
                   <textarea 
                     autoFocus
                     value={text}
                     onChange={e => setText(e.target.value)}
                     className="w-full bg-slate-50 border-4 border-slate-50 rounded-3xl p-5 font-black text-xs text-[#004D71] outline-none focus:border-red-500/20 transition-all resize-none shadow-inner"
                     rows={6}
                     placeholder="Ex: No menu treino, o botão X não funciona..."
                   />
                </div>

                <button 
                  type="submit"
                  disabled={loading || !text.trim()}
                  className="w-full bg-[#004D71] text-[#F7B500] rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={18}/> {loading ? 'A enviar...' : 'Enviar para o Admin'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
