import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  User, ShieldCheck, AlertCircle, CheckCircle2, ChevronRight, RefreshCw
} from 'lucide-react';
import { UserProfile } from '../types';
import { AvatarImage } from './Common';
import { db, APP_ID } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const MODALITIES = [
  { id: 'ginasio',       label: 'Ginásio',        qrKey: 'Ginásio',       emoji: '🏋️' },
  { id: 'natacao',       label: 'Natação',         qrKey: 'Natação',       emoji: '🏊' },
  { id: 'sauna',         label: 'Sauna',           qrKey: 'Sauna',         emoji: '🧖' },
  { id: 'aula',          label: 'Aula de Grupo',   qrKey: 'Aula de Grupo', emoji: '🤸' },
  { id: 'hidroginastica',label: 'Hidroginástica',  qrKey: 'Hidroginástica',emoji: '💧' },
  { id: 'livre',         label: 'Livre',           qrKey: 'Acesso Livre',  emoji: '🚶' },
];

function profileScore(u: UserProfile): { score: number; missing: string[] } {
  const checks = [
    { label: 'Foto de perfil',            ok: !!u.img && u.img.length > 5 },
    { label: 'Telemóvel',                 ok: !!(u.telemovel || u.phone || u.telefone) },
    { label: 'NIF',                       ok: !!u.nif },
    { label: 'Data de nascimento',        ok: !!u.data_nasc },
    { label: 'Morada',                    ok: !!u.endereco },
    { label: 'Modalidade principal',      ok: !!u.modalidade },
    { label: 'Contacto de emergência',    ok: !!u.contacto_emergencia },
    { label: 'Termo de responsabilidade', ok: !!u.termo_responsabilidade },
  ];
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { score, missing };
}

export function UtenteQRCard({ user, onEditProfile }: {
  user: UserProfile;
  onEditProfile?: () => void;
}) {
  const [selectedMod, setSelectedMod] = useState<typeof MODALITIES[0]>(
    MODALITIES.find(m => m.qrKey === user.modalidade) || MODALITIES[0]
  );
  const [tick, setTick] = useState(0);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);

  const { score, missing } = profileScore(user);

  // QR rotates every minute to prevent old screenshots being used
  const epochMin = Math.floor(Date.now() / 60000) + tick;
  const qrValue = `CPX:${user.id}:${selectedMod.qrKey}:${epochMin}`;

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const acceptTerms = async () => {
    setAcceptingTerms(true);
    try {
      await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, user.id), {
        termo_responsabilidade: true,
        termo_responsabilidade_data: new Date().toISOString(),
      });
    } finally {
      setAcceptingTerms(false);
      setShowTerms(false);
    }
  };

  const hasEntries = (user.entradas_disponiveis ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in pb-24 font-sans">

      {/* ── Header ── */}
      <div className="bg-[#004D71] px-5 pt-6 pb-8">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <AvatarImage
              src={user.img}
              alt={user.nome}
              className="w-20 h-20 rounded-[1.5rem] border-4 border-white/30 object-cover shadow-xl"
            />
            {!user.img && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-white/10">
                <User size={32} className="text-white/50"/>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#F7B500]">Cartão Digital</p>
            <h1 className="font-black text-white text-xl leading-tight truncate">
              {user.nome || user.n || '—'}
            </h1>
            <p className="text-[9px] font-bold text-white/50 uppercase mt-1">
              {user.modalidade || 'Modalidade não definida'}
            </p>
            {hasEntries ? (
              <span className="inline-flex items-center gap-1 mt-1.5 bg-green-500/20 border border-green-400/30 text-green-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                <CheckCircle2 size={9}/> {user.entradas_disponiveis} entr{user.entradas_disponiveis !== 1 ? 'adas' : 'ada'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1.5 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                <AlertCircle size={9}/> Carregue entradas na receção
              </span>
            )}
          </div>
        </div>

        {/* Completeness bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Perfil</span>
            <span className={`text-[10px] font-black ${score === 100 ? 'text-green-400' : score >= 60 ? 'text-[#F7B500]' : 'text-red-300'}`}>{score}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${score === 100 ? 'bg-green-400' : score >= 60 ? 'bg-[#F7B500]' : 'bg-red-400'}`}
              style={{ width: `${score}%` }}
            />
          </div>
          {missing.length > 0 && onEditProfile && (
            <button onClick={onEditProfile} className="text-[9px] text-white/40 mt-1.5 hover:text-white/70 transition-colors">
              Falta: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` +${missing.length - 3}` : ''} →
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 -mt-4 space-y-4">

        {/* Termos não aceites */}
        {!user.termo_responsabilidade && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-[1.5rem] p-4 flex gap-3 items-start shadow-sm">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5"/>
            <div className="flex-1">
              <p className="text-xs font-black text-amber-800 uppercase">Termos por assinar</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">O termo de responsabilidade ainda não foi aceite.</p>
              <button onClick={() => setShowTerms(true)} className="mt-1.5 text-[10px] font-black text-amber-700 uppercase underline">
                Ver e Assinar →
              </button>
            </div>
          </div>
        )}

        {/* Seletor de modalidade */}
        <div className="bg-white rounded-[1.5rem] p-4 shadow-sm border-2 border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Escolhe a modalidade de entrada</p>
          <div className="grid grid-cols-3 gap-2">
            {MODALITIES.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMod(m)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 font-black text-[10px] uppercase tracking-wide transition-all active:scale-95 ${
                  selectedMod.id === m.id
                    ? 'bg-[#004D71] border-[#004D71] text-[#F7B500] shadow-md'
                    : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="leading-tight text-center">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR Code — sempre visível */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border-2 border-slate-100 flex flex-col items-center gap-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
            {selectedMod.emoji} {selectedMod.label} · Código de acesso
          </p>
          <div className="p-4 bg-white rounded-2xl border-4 border-[#004D71]/8 shadow-inner">
            <QRCodeSVG
              value={qrValue}
              size={220}
              bgColor="#ffffff"
              fgColor="#004D71"
              level="M"
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-[#004D71] uppercase">{user.nome || user.n}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{selectedMod.label}</p>
          </div>
          <button
            onClick={() => setTick(p => p + 1)}
            className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-[#004D71] transition-colors"
          >
            <RefreshCw size={11}/> Atualizar código
          </button>
          <p className="text-[8px] text-slate-300 text-center">
            Mostra à receção para registar entrada ou saída
          </p>
        </div>

        {/* Ações rápidas */}
        <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
          {[
            {
              icon: <User size={16} className="text-[#004D71]"/>,
              label: 'Ver e Editar Perfil',
              sub: `${score}% completo`,
              onClick: onEditProfile,
            },
            {
              icon: <ShieldCheck size={16} className={user.termo_responsabilidade ? 'text-emerald-500' : 'text-amber-500'}/>,
              label: 'Termos e Condições',
              sub: user.termo_responsabilidade ? '✓ Aceites' : 'Por aceitar',
              onClick: () => setShowTerms(true),
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left border-b-2 border-slate-50 last:border-b-0"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#004D71] text-sm">{item.label}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0"/>
            </button>
          ))}
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b-2 border-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-[#004D71] uppercase text-lg">Termos de Responsabilidade</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Complexo Desportivo · Vila de Rei</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm text-slate-600 leading-relaxed">
              <p className="font-bold text-[#004D71]">1. Responsabilidade pessoal</p>
              <p>O utente é responsável pela sua condição física e deve informar a equipa técnica de qualquer limitação ou condição de saúde que possa condicionar a prática de exercício.</p>
              <p className="font-bold text-[#004D71]">2. Utilização das instalações</p>
              <p>As instalações devem ser utilizadas de acordo com o regulamento interno. É obrigatório o uso de indumentária adequada e o respeito pelo material e pelo espaço partilhado.</p>
              <p className="font-bold text-[#004D71]">3. Supervisão</p>
              <p>A prática de exercício sem supervisão de técnico habilitado é da exclusiva responsabilidade do utente. O Complexo Desportivo de Vila de Rei declina responsabilidade por lesões resultantes de má execução técnica ou uso indevido do equipamento.</p>
              <p className="font-bold text-[#004D71]">4. Dados pessoais (RGPD)</p>
              <p>Os dados recolhidos são tratados nos termos do RGPD, exclusivamente para gestão do utente e acesso às instalações. Não são partilhados com terceiros.</p>
              <p className="font-bold text-[#004D71]">5. QR Code de acesso</p>
              <p>O código QR é pessoal e intransmissível. A partilha ou utilização indevida pode resultar na suspensão do acesso.</p>
            </div>
            <div className="px-6 pb-6 pt-4 border-t-2 border-slate-50 shrink-0 space-y-2">
              {!user.termo_responsabilidade ? (
                <button
                  onClick={acceptTerms}
                  disabled={acceptingTerms}
                  className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                  {acceptingTerms
                    ? <div className="w-4 h-4 border-2 border-[#F7B500]/30 border-t-[#F7B500] rounded-full animate-spin"/>
                    : <CheckCircle2 size={16}/>}
                  Aceito os Termos
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 text-green-600 font-black text-sm uppercase">
                  <CheckCircle2 size={16}/> Termos aceites
                </div>
              )}
              <button
                onClick={() => setShowTerms(false)}
                className="w-full py-3 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-400 hover:bg-slate-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
