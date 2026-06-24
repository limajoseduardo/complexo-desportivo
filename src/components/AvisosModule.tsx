import React, { useEffect, useState } from 'react';
import { Megaphone, Send, Mail, Loader, Trash2 } from 'lucide-react';
import {
  collection, onSnapshot, query, orderBy, limit, addDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { UserProfile } from '../types';

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  nomeProfessor?: string;
  dataCriacao?: any;
}

export function AvisosModule({ user, utentes, readOnly = false }: { user: UserProfile; utentes: UserProfile[]; readOnly?: boolean }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/avisos_globais`;
    const q = query(collection(db, path), orderBy('dataCriacao', 'desc'), limit(20));
    return onSnapshot(q, snap => {
      setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Aviso)));
    });
  }, []);

  const publicar = async () => {
    if (!titulo.trim() || !mensagem.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const path = `artifacts/${APP_ID}/public/data/avisos_globais`;
      await addDoc(collection(db, path), {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        professorId: user.id,
        nomeProfessor: user.nome || user.n || 'Equipa',
        dataCriacao: Timestamp.now(),
      });

      if (enviarEmail) {
        const recipients = utentes
          .map(u => (u.email || '').trim())
          .filter(e => e.length > 0);

        const resp = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: titulo.trim(),
            html: `<p>${mensagem.trim().replace(/\n/g, '<br/>')}</p><p style="color:#888;font-size:12px">Complexo Desportivo de Vila de Rei</p>`,
            recipients,
          }),
        });

        if (!resp.ok && resp.status !== 207) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || 'Falha ao enviar email.');
        }
        const result = await resp.json();
        setFeedback(`Aviso publicado. Email enviado a ${result.sent}/${recipients.length} utentes.`);
      } else {
        setFeedback('Aviso publicado no Mural de Avisos.');
      }

      setTitulo('');
      setMensagem('');
      setEnviarEmail(false);
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const remover = async (id: string) => {
    if (!window.confirm('Apagar este aviso?')) return;
    await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/avisos_globais`, id));
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24 px-2">
      <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
        <Megaphone className="text-[#F7B500]" /> Avisos Gerais
      </h2>

      {!readOnly && (
        <div className="bg-white rounded-[2.5rem] p-6 border-2 border-slate-50 shadow-sm space-y-4">
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Título do aviso"
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-[#004D71] outline-none focus:border-[#004D71]/20"
          />
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Mensagem"
            rows={4}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium text-[#004D71] outline-none focus:border-[#004D71]/20 resize-none"
          />
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">
            <input type="checkbox" checked={enviarEmail} onChange={e => setEnviarEmail(e.target.checked)} className="w-4 h-4" />
            <Mail size={14} /> Enviar também por email a todos os utentes
          </label>
          {feedback && <p className="text-[11px] font-bold text-slate-500">{feedback}</p>}
          <button
            onClick={publicar}
            disabled={sending || !titulo.trim() || !mensagem.trim()}
            className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />} Publicar Aviso
          </button>
        </div>
      )}

      <div className="space-y-2">
        {avisos.map(a => (
          <div key={a.id} className="bg-white rounded-2xl px-4 py-3 border-2 border-slate-50 shadow-sm flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#004D71]">{a.titulo}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{a.mensagem}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{a.nomeProfessor}</p>
            </div>
            {!readOnly && (
              <button onClick={() => remover(a.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
