/**
 * SyncPortalMunicipal.tsx
 * Ferramenta de sincronização de dados entre o Portal Municipal de Vila de Rei
 * e os perfis dos utentes do Complexo Desportivo.
 *
 * Apenas visível para administradores.
 */

import React, { useState, useMemo } from 'react';
import {
  RefreshCw, Search, CheckCircle, AlertCircle, Lock, Unlock,
  User, Phone, MapPin, CreditCard, Calendar, FileText, Eye,
  ChevronRight, X, Save, Download, AlertTriangle, Shield,
  Globe, Loader, Check, Info
} from 'lucide-react';
import { UserProfile } from '../types';
import { db, APP_ID } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { AvatarImage } from './Common';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface PortalCredentials {
  username: string;
  password: string;
}

interface PortalResult {
  nome?: string;
  nif?: string;
  data_nasc?: string;
  cc?: string;
  cc_validade?: string;
  num_utente?: string;
  telefone?: string;
  telemovel?: string;
  endereco?: string;
  cod_postal?: string;
  localidade?: string;
  cartao_tipo?: string;
  cartao_numero?: string;
  cartao_validade?: string;
  municipio_cartao?: string;
  _pageTitle?: string;
  _pageUrl?: string;
}

interface SyncStatus {
  userId: string;
  status: 'idle' | 'searching' | 'found' | 'not_found' | 'error' | 'saved';
  data?: PortalResult;
  error?: string;
}

interface FieldDiff {
  field: string;
  label: string;
  current: string;
  portal: string;
  icon: React.ReactNode;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const FIELD_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  nome:             { label: 'Nome Completo',        icon: <User size={14} /> },
  nif:              { label: 'NIF',                  icon: <FileText size={14} /> },
  data_nasc:        { label: 'Data de Nascimento',   icon: <Calendar size={14} /> },
  cc:               { label: 'Cartão de Cidadão',    icon: <CreditCard size={14} /> },
  cc_validade:      { label: 'Validade CC',           icon: <Calendar size={14} /> },
  num_utente:       { label: 'Nº Utente (SNS)',       icon: <Shield size={14} /> },
  telefone:         { label: 'Telefone Fixo',         icon: <Phone size={14} /> },
  telemovel:        { label: 'Telemóvel',             icon: <Phone size={14} /> },
  endereco:         { label: 'Morada',               icon: <MapPin size={14} /> },
  cod_postal:       { label: 'Código Postal',         icon: <MapPin size={14} /> },
  localidade:       { label: 'Localidade',            icon: <MapPin size={14} /> },
  cartao_tipo:      { label: 'Tipo de Cartão',        icon: <CreditCard size={14} /> },
  cartao_numero:    { label: 'Nº Cartão Municipal',   icon: <CreditCard size={14} /> },
  cartao_validade:  { label: 'Validade Cartão',       icon: <Calendar size={14} /> },
};

function getFieldDiffs(utente: UserProfile, portalData: PortalResult): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const fields = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;

  for (const field of fields) {
    const portalVal = (portalData as any)[field];
    const currentVal = (utente as any)[field];
    const meta = FIELD_LABELS[field];

    if (!portalVal || String(portalVal).trim() === '') continue;
    if (String(portalVal).trim() === String(currentVal || '').trim()) continue;

    diffs.push({
      field,
      label: meta.label,
      current: currentVal || '',
      portal: portalVal,
      icon: meta.icon,
    });
  }

  return diffs;
}

function isProfileIncomplete(u: UserProfile): boolean {
  return !u.data_nasc || !u.nif || !(u.phone || u.telemovel || u.telefone) || !u.endereco || !u.cc;
}

// Calcula percentagem de completude do perfil
function profileCompleteness(u: UserProfile): number {
  const fields = ['nome', 'data_nasc', 'nif', 'cc', 'telefone', 'telemovel', 'endereco', 'cod_postal', 'localidade', 'num_utente'];
  const filled = fields.filter(f => !!(u as any)[f]).length;
  return Math.round((filled / fields.length) * 100);
}

// ─────────────────────────────────────────────
// Sub-componente: Card de credenciais
// ─────────────────────────────────────────────

function CredentialsCard({
  credentials,
  onChange,
  onTest,
  testing,
  testResult,
}: {
  credentials: PortalCredentials;
  onChange: (c: PortalCredentials) => void;
  onTest: () => void;
  testing: boolean;
  testResult: 'success' | 'error' | null;
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="bg-white rounded-[2rem] border-4 border-[#004D71]/8 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#004D71] px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-[#F7B500] rounded-2xl flex items-center justify-center shrink-0">
          <Globe size={24} className="text-[#004D71]" />
        </div>
        <div>
          <h3 className="text-white font-black text-base uppercase leading-none">Portal Municipal</h3>
          <p className="text-[#F7B500] text-[9px] font-black uppercase tracking-widest mt-1">
            srv-airc-portal.cm-viladerei.pt
          </p>
        </div>
        {testResult === 'success' && (
          <div className="ml-auto flex items-center gap-2 bg-green-500/20 text-green-300 px-3 py-1.5 rounded-full">
            <CheckCircle size={14} />
            <span className="text-[9px] font-black uppercase">Ligado</span>
          </div>
        )}
        {testResult === 'error' && (
          <div className="ml-auto flex items-center gap-2 bg-red-500/20 text-red-300 px-3 py-1.5 rounded-full">
            <AlertCircle size={14} />
            <span className="text-[9px] font-black uppercase">Erro</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Utilizador
            </label>
            <input
              type="text"
              placeholder="Utilizador do portal..."
              value={credentials.username}
              onChange={e => onChange({ ...credentials, username: e.target.value })}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-sm text-[#004D71] outline-none focus:border-[#004D71]/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Palavra-passe
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Palavra-passe..."
                value={credentials.password}
                onChange={e => onChange({ ...credentials, password: e.target.value })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 pr-12 font-bold text-sm text-[#004D71] outline-none focus:border-[#004D71]/30 transition-all"
              />
              <button
                onClick={() => setShowPass(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#004D71] transition-colors"
              >
                {showPass ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <Shield size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[9px] font-bold text-amber-700 leading-relaxed">
            As credenciais são guardadas apenas no teu browser (localStorage) e nunca enviadas para servidores externos.
            Apenas são usadas para autenticar diretamente com o Portal Municipal.
          </p>
        </div>

        <button
          onClick={onTest}
          disabled={testing || !credentials.username || !credentials.password}
          className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {testing ? (
            <><Loader size={16} className="animate-spin" /> A Verificar Ligação...</>
          ) : (
            <><Globe size={16} /> Testar Ligação ao Portal</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Card de utente com status de sync
// ─────────────────────────────────────────────

function UtenteSyncCard({
  utente,
  syncStatus,
  onSync,
  onReview,
  onSave,
}: {
  utente: UserProfile;
  syncStatus?: SyncStatus;
  onSync: (u: UserProfile) => void | Promise<void>;
  onReview: (u: UserProfile, data: PortalResult) => void;
  onSave: (u: UserProfile, data: PortalResult) => void;
}) {
  const completeness = profileCompleteness(utente);
  const isIncomplete = isProfileIncomplete(utente);
  const status = syncStatus?.status || 'idle';

  const statusConfig = {
    idle:       { color: 'bg-slate-100 text-slate-500',      icon: null,                                       label: null },
    searching:  { color: 'bg-blue-50 text-blue-600',         icon: <Loader size={12} className="animate-spin"/>, label: 'A pesquisar...' },
    found:      { color: 'bg-green-50 text-green-700',       icon: <CheckCircle size={12} />,                  label: 'Dados encontrados' },
    not_found:  { color: 'bg-orange-50 text-orange-600',     icon: <AlertTriangle size={12} />,                label: 'Não encontrado' },
    error:      { color: 'bg-red-50 text-red-600',           icon: <AlertCircle size={12} />,                  label: 'Erro' },
    saved:      { color: 'bg-emerald-50 text-emerald-700',   icon: <Check size={12} />,                        label: 'Atualizado' },
  }[status];

  return (
    <div className={`bg-white rounded-[1.5rem] border-2 shadow-sm overflow-hidden transition-all ${
      status === 'found' ? 'border-green-200' :
      status === 'saved' ? 'border-emerald-200' :
      status === 'error' ? 'border-red-200' :
      'border-slate-100'
    }`}>
      <div className="p-4 flex items-center gap-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <AvatarImage
            src={utente.img}
            alt={utente.nome}
            className="w-12 h-12 rounded-xl border-2 border-white shadow-sm"
          />
          {/* Completeness ring */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black ${
            completeness >= 80 ? 'bg-green-500 text-white' :
            completeness >= 50 ? 'bg-amber-500 text-white' :
            'bg-red-400 text-white'
          }`}>
            {completeness < 100 ? completeness : '✓'}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-[#004D71] text-sm uppercase leading-none truncate">
            {utente.n || utente.nome}
          </h4>
          <div className="flex items-center gap-2 mt-1.5">
            {utente.nif && (
              <span className="text-[8px] font-bold text-slate-400 uppercase">NIF: {utente.nif}</span>
            )}
            {!utente.nif && (
              <span className="text-[8px] font-bold text-orange-400 uppercase">Sem NIF</span>
            )}
            <span className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-[8px] font-bold text-slate-300 uppercase">{completeness}% completo</span>
          </div>

          {/* Campos em falta */}
          <div className="flex flex-wrap gap-1 mt-2">
            {!utente.data_nasc && <span className="text-[7px] font-black bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full uppercase">Data Nasc.</span>}
            {!utente.nif && <span className="text-[7px] font-black bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full uppercase">NIF</span>}
            {!utente.cc && <span className="text-[7px] font-black bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full uppercase">CC</span>}
            {!(utente.telefone || utente.telemovel || utente.phone) && <span className="text-[7px] font-black bg-orange-50 text-orange-400 px-1.5 py-0.5 rounded-full uppercase">Contacto</span>}
            {!utente.endereco && <span className="text-[7px] font-black bg-orange-50 text-orange-400 px-1.5 py-0.5 rounded-full uppercase">Morada</span>}
          </div>
        </div>

        {/* Status e ações */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {statusConfig.label && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${statusConfig.color}`}>
              {statusConfig.icon}
              <span className="text-[8px] font-black uppercase">{statusConfig.label}</span>
            </div>
          )}

          {status === 'idle' && (
            <button
              onClick={() => onSync(utente)}
              className="flex items-center gap-2 bg-[#004D71]/5 hover:bg-[#004D71]/10 text-[#004D71] px-3 py-2 rounded-xl font-black text-[9px] uppercase transition-all active:scale-95"
            >
              <Search size={12} /> Pesquisar
            </button>
          )}

          {status === 'found' && syncStatus?.data && (
            <div className="flex gap-2">
              <button
                onClick={() => onReview(utente, syncStatus.data!)}
                className="flex items-center gap-1.5 bg-[#004D71]/5 text-[#004D71] px-3 py-2 rounded-xl font-black text-[9px] uppercase active:scale-95"
              >
                <Eye size={12} /> Rever
              </button>
              <button
                onClick={() => onSave(utente, syncStatus.data!)}
                className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl font-black text-[9px] uppercase active:scale-95 shadow-sm"
              >
                <Save size={12} /> Guardar
              </button>
            </div>
          )}

          {status === 'saved' && (
            <div className="text-[8px] font-black text-emerald-600 uppercase flex items-center gap-1">
              <CheckCircle size={12} /> Perfil atualizado
            </div>
          )}

          {status === 'error' && (
            <button
              onClick={() => onSync(utente)}
              className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1 hover:underline"
            >
              <RefreshCw size={10} /> Tentar novamente
            </button>
          )}
        </div>
      </div>

      {/* Dados encontrados (preview) */}
      {status === 'found' && syncStatus?.data && (
        <div className="border-t border-green-100 bg-green-50/50 px-4 py-3">
          <p className="text-[8px] font-black text-green-700 uppercase tracking-widest mb-2">
            Dados encontrados no portal:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(syncStatus.data)
              .filter(([k, v]) => v && !k.startsWith('_') && FIELD_LABELS[k])
              .map(([k, v]) => (
                <span key={k} className="text-[8px] font-bold text-green-800 bg-green-100 px-2 py-1 rounded-full">
                  {FIELD_LABELS[k]?.label}: {String(v).substring(0, 20)}
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Modal de revisão de dados
// ─────────────────────────────────────────────

function ReviewModal({
  utente,
  portalData,
  onConfirm,
  onCancel,
  saving,
}: {
  utente: UserProfile;
  portalData: PortalResult;
  onConfirm: (selectedFields: string[]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const diffs = getFieldDiffs(utente, portalData);
  const [selected, setSelected] = useState<string[]>(diffs.map(d => d.field));

  const toggle = (field: string) => {
    setSelected(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  return (
    <div className="fixed inset-0 z-[20000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
        {/* Header */}
        <div className="bg-[#004D71] px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#F7B500] rounded-xl flex items-center justify-center shrink-0">
            <Eye size={20} className="text-[#004D71]" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-black text-base uppercase leading-none">Rever Alterações</h3>
            <p className="text-[#F7B500] text-[9px] font-black uppercase tracking-widest mt-1">
              {utente.n || utente.nome}
            </p>
          </div>
          <button onClick={onCancel} className="p-2 bg-white/10 rounded-xl text-white active:scale-90">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {diffs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="font-black text-slate-600 uppercase text-sm">Perfil já está completo</p>
              <p className="text-xs text-slate-400 mt-1">Nenhuma diferença encontrada entre o perfil atual e os dados do portal.</p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {diffs.length} campo(s) para atualizar — seleciona os que queres guardar:
                </p>
                <button
                  onClick={() => setSelected(diffs.length === selected.length ? [] : diffs.map(d => d.field))}
                  className="text-[9px] font-black text-[#004D71] hover:underline uppercase"
                >
                  {diffs.length === selected.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              </div>

              {diffs.map(diff => (
                <button
                  key={diff.field}
                  onClick={() => toggle(diff.field)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                    selected.includes(diff.field)
                      ? 'border-[#004D71] bg-[#004D71]/3'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      selected.includes(diff.field)
                        ? 'bg-[#004D71] border-[#004D71]'
                        : 'border-slate-200'
                    }`}>
                      {selected.includes(diff.field) && <Check size={11} className="text-[#F7B500]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-400">{diff.icon}</span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{diff.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-50 rounded-xl p-2">
                          <p className="text-[8px] font-black text-red-400 uppercase mb-1">Atual</p>
                          <p className="text-xs font-bold text-red-700 truncate">
                            {diff.current || <span className="italic font-normal text-red-400">vazio</span>}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-2">
                          <p className="text-[8px] font-black text-green-500 uppercase mb-1">Portal</p>
                          <p className="text-xs font-bold text-green-700 truncate">{diff.portal}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-sm uppercase active:scale-95"
          >
            Cancelar
          </button>
          {diffs.length > 0 && (
            <button
              onClick={() => onConfirm(selected)}
              disabled={selected.length === 0 || saving}
              className="flex-1 py-4 rounded-2xl bg-[#004D71] text-[#F7B500] font-black text-sm uppercase shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar {selected.length} campo(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export function SyncPortalMunicipal({ utentes }: { utentes: UserProfile[] }) {
  // Credenciais (guardadas em localStorage)
  const [credentials, setCredentials] = useState<PortalCredentials>(() => {
    try {
      const saved = localStorage.getItem('cpx_portal_credentials');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { username: '', password: '' };
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<'success' | 'error' | null>(null);
  const [connectionError, setConnectionError] = useState('');

  // Estado de sincronização por utente
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({});
  const [reviewModal, setReviewModal] = useState<{ utente: UserProfile; data: PortalResult } | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Filtros
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncLog, setSyncLog] = useState<string[]>([]);

  // Utentes filtrados (apenas utentes, não staff)
  const utentesList = useMemo(() => {
    return utentes.filter(u => {
      const r = (u.role || '').toLowerCase();
      if (['admin', 'staff', 'chefia', 'professor'].includes(r)) return false;
      if (showOnlyIncomplete && !isProfileIncomplete(u)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = (u.n || u.nome || '').toLowerCase();
        const nif = (u.nif || '').toLowerCase();
        return name.includes(term) || nif.includes(term);
      }
      return true;
    });
  }, [utentes, showOnlyIncomplete, searchTerm]);

  const stats = useMemo(() => {
    const allUtentes = utentes.filter(u => !['admin', 'staff', 'chefia', 'professor'].includes((u.role || '').toLowerCase()));
    const incomplete = allUtentes.filter(isProfileIncomplete);
    const synced = Object.values(syncStatuses).filter(s => s.status === 'saved').length;
    const found = Object.values(syncStatuses).filter(s => s.status === 'found').length;
    return { total: allUtentes.length, incomplete: incomplete.length, synced, found };
  }, [utentes, syncStatuses]);

  // Guardar credenciais em localStorage quando mudam
  const handleCredentialsChange = (c: PortalCredentials) => {
    setCredentials(c);
    localStorage.setItem('cpx_portal_credentials', JSON.stringify(c));
  };

  const addLog = (msg: string) => {
    setSyncLog(prev => [`[${new Date().toLocaleTimeString('pt-PT')}] ${msg}`, ...prev.slice(0, 49)]);
  };

  /**
   * Chama o script de scraping via API local do servidor
   * Como estamos num browser, usamos um servidor Express local (porta 3101)
   * que executa o script Puppeteer e devolve o resultado.
   *
   * Em alternativa, se não houver servidor, usa a API de proxy inclusa.
   */
  const callPortalSync = async (searchQuery: string): Promise<PortalResult | null> => {
    // Tentar o servidor de proxy local primeiro
    const proxyUrl = 'http://localhost:3101/api/portal-sync';

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          search: searchQuery,
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      return data.details || data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Servidor de sincronização não está disponível. Execute: node scripts/portal-proxy.cjs');
      }
      throw err;
    }
  };

  const testConnection = async () => {
    if (!credentials.username || !credentials.password) return;
    setTestingConnection(true);
    setConnectionError('');

    try {
      addLog('A testar ligação ao Portal Municipal...');
      await callPortalSync('__test__');
      setConnectionResult('success');
      addLog('✅ Ligação ao portal estabelecida com sucesso!');
    } catch (err: any) {
      setConnectionResult('error');
      setConnectionError(err.message);
      addLog(`❌ Erro na ligação: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const syncUtente = async (utente: UserProfile) => {
    const searchQuery = utente.nif || utente.cc || utente.n || utente.nome || '';
    if (!searchQuery) {
      addLog(`⚠️ ${utente.nome}: Sem NIF/CC/Nome para pesquisar`);
      setSyncStatuses(prev => ({
        ...prev,
        [utente.id]: { userId: utente.id, status: 'error', error: 'Sem dados para pesquisar' }
      }));
      return;
    }

    setSyncStatuses(prev => ({ ...prev, [utente.id]: { userId: utente.id, status: 'searching' } }));
    addLog(`🔍 A pesquisar: ${utente.nome} (${searchQuery})`);

    try {
      const data = await callPortalSync(searchQuery);

      if (data && Object.keys(data).filter(k => !k.startsWith('_')).length > 0) {
        setSyncStatuses(prev => ({
          ...prev,
          [utente.id]: { userId: utente.id, status: 'found', data: data as PortalResult }
        }));
        addLog(`✅ Dados encontrados para: ${utente.nome}`);
      } else {
        setSyncStatuses(prev => ({
          ...prev,
          [utente.id]: { userId: utente.id, status: 'not_found' }
        }));
        addLog(`⚠️ Não encontrado: ${utente.nome}`);
      }
    } catch (err: any) {
      setSyncStatuses(prev => ({
        ...prev,
        [utente.id]: { userId: utente.id, status: 'error', error: err.message }
      }));
      addLog(`❌ Erro ao pesquisar ${utente.nome}: ${err.message}`);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    addLog(`🚀 A iniciar sincronização de ${utentesList.length} utentes...`);

    for (const utente of utentesList) {
      const currentStatus = syncStatuses[utente.id]?.status;
      if (currentStatus === 'saved' || currentStatus === 'searching') continue;

      await syncUtente(utente);
      // Pequena pausa para não sobrecarregar o portal
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setSyncingAll(false);
    addLog('✅ Sincronização em massa concluída!');
  };

  const saveUtenteData = async (utente: UserProfile, portalData: PortalResult, selectedFields: string[]) => {
    setSavingReview(true);
    try {
      const updates: Partial<UserProfile> = {};

      selectedFields.forEach(field => {
        const value = (portalData as any)[field];
        if (value) {
          (updates as any)[field] = value;
        }
      });

      // Normalizar campos derivados
      if (updates.nome) updates.n = updates.nome.toUpperCase();
      if (updates.cartao_tipo && updates.cartao_numero) {
        updates.cartao_municipal = updates.cartao_numero;
        updates.municipio_cartao = `${updates.cartao_tipo} - Nº ${updates.cartao_numero}`;
      }
      updates.updatedAt = new Date().toISOString();

      const userDocRef = doc(db, `artifacts/${APP_ID}/public/data/users`, utente.id);
      await setDoc(userDocRef, updates, { merge: true });

      setSyncStatuses(prev => ({
        ...prev,
        [utente.id]: { userId: utente.id, status: 'saved' }
      }));

      addLog(`💾 Guardado: ${utente.nome} (${selectedFields.length} campos)`);
      setReviewModal(null);
    } catch (err: any) {
      addLog(`❌ Erro ao guardar ${utente.nome}: ${err.message}`);
      alert(`Erro ao guardar: ${err.message}`);
    } finally {
      setSavingReview(false);
    }
  };

  const handleSaveDirect = (utente: UserProfile, data: PortalResult) => {
    const diffs = getFieldDiffs(utente, data);
    if (diffs.length === 0) {
      addLog(`ℹ️ ${utente.nome}: Nenhuma diferença encontrada`);
      return;
    }
    // Abre o modal de revisão
    setReviewModal({ utente, data });
  };

  return (
    <div className="space-y-6 pb-24 px-1 font-sans animate-in fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F7B500] rounded-2xl flex items-center justify-center">
              <RefreshCw size={20} className="text-[#004D71]" />
            </div>
            Sincronização Portal
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Portal Municipal de Vila de Rei · Importar Dados de Utentes
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Utentes', value: stats.total, color: 'text-[#004D71]', bg: 'bg-[#004D71]/5' },
          { label: 'Incompletos', value: stats.incomplete, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Encontrados', value: stats.found, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Atualizados', value: stats.synced, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Configuração de credenciais */}
      <CredentialsCard
        credentials={credentials}
        onChange={handleCredentialsChange}
        onTest={testConnection}
        testing={testingConnection}
        testResult={connectionResult}
      />

      {connectionError && (
        <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-red-700 uppercase">Erro de Ligação</p>
            <p className="text-xs text-red-600 mt-0.5">{connectionError}</p>
            <p className="text-[9px] text-red-400 mt-2 font-bold">
              Para usar esta funcionalidade é necessário ter o servidor de proxy em execução.
              Execute no terminal: <code className="bg-red-100 px-1 rounded font-mono">node scripts/portal-proxy.cjs</code>
            </p>
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-blue-600 shrink-0" />
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Como funciona</p>
        </div>
        <ol className="space-y-2">
          {[
            'Introduz as tuas credenciais do Portal Municipal acima',
            'Clica em "Testar Ligação" para confirmar que funciona',
            'Na lista abaixo, clica em "Pesquisar" para cada utente (ou "Sincronizar Todos")',
            'O sistema pesquisa os dados do utente no portal usando o NIF/CC/Nome',
            'Revê os dados encontrados e confirma os campos a guardar',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-blue-700 font-medium">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Filtrar utentes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3 font-bold text-sm outline-none focus:border-[#004D71]/20"
          />
        </div>

        <button
          onClick={() => setShowOnlyIncomplete(p => !p)}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
            showOnlyIncomplete
              ? 'bg-orange-50 text-orange-600 border-orange-200'
              : 'bg-white text-slate-400 border-slate-100'
          }`}
        >
          <AlertTriangle size={14} />
          {showOnlyIncomplete ? 'Ver Todos' : 'Só Incompletos'}
        </button>

        <button
          onClick={syncAll}
          disabled={syncingAll || !credentials.username || !credentials.password || utentesList.length === 0}
          className="flex items-center gap-2 bg-[#004D71] text-[#F7B500] px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {syncingAll ? (
            <><Loader size={14} className="animate-spin" /> A sincronizar...</>
          ) : (
            <><Download size={14} /> Sincronizar Todos ({utentesList.length})</>
          )}
        </button>
      </div>

      {/* Lista de utentes */}
      <div className="space-y-3">
        {utentesList.length === 0 ? (
          <div className="bg-white rounded-[2rem] border-4 border-slate-100 py-16 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="font-black text-slate-500 uppercase text-sm">
              {showOnlyIncomplete ? 'Todos os perfis estão completos! 🎉' : 'Sem utentes para mostrar'}
            </p>
          </div>
        ) : (
          utentesList.map(utente => (
            <UtenteSyncCard
              key={utente.id}
              utente={utente}
              syncStatus={syncStatuses[utente.id]}
              onSync={syncUtente}
              onReview={(u, d) => setReviewModal({ utente: u, data: d })}
              onSave={handleSaveDirect}
            />
          ))
        )}
      </div>

      {/* Log de operações */}
      {syncLog.length > 0 && (
        <div className="bg-[#004D71] rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-widest">Registo de Operações</p>
            <button
              onClick={() => setSyncLog([])}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {syncLog.map((entry, i) => (
              <p key={i} className="text-[9px] font-mono text-white/70">{entry}</p>
            ))}
          </div>
        </div>
      )}

      {/* Modal de revisão */}
      {reviewModal && (
        <ReviewModal
          utente={reviewModal.utente}
          portalData={reviewModal.data}
          onConfirm={(fields) => saveUtenteData(reviewModal.utente, reviewModal.data, fields)}
          onCancel={() => setReviewModal(null)}
          saving={savingReview}
        />
      )}
    </div>
  );
}
