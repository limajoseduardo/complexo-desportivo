import React, { useMemo, useState } from 'react';
import { Plus, X, Search, ChevronRight, UserCog, Mail, Briefcase, KeyRound, Check } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { PicotoIcon, FormInput, AvatarImage } from './Common';
import { db, handleFirestoreError, OperationType, APP_ID } from '../lib/firebase';
import { doc, collection, setDoc, updateDoc } from 'firebase/firestore';

const DEFAULT_PASSWORD = '123456';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  chefia: 'Chefia',
  staff: 'Staff',
  professor: 'Professor',
  utente: 'Utente',
};

function rolesAssignableBy(currentRole: UserRole): UserRole[] {
  return currentRole === 'admin'
    ? ['staff', 'professor', 'chefia', 'admin']
    : ['staff', 'professor', 'chefia'];
}

function TeamRow({ u, onClick }: { u: UserProfile, onClick: () => void, key?: any }) {
  return (
    <button onClick={onClick} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 active:bg-blue-50 transition-all text-left">
      <div className="flex items-center gap-4">
        <AvatarImage src={u.img} alt={u.n || u.nome} className="w-14 h-14 rounded-[1.25rem] border-2 border-white shadow-md" />
        <div>
          <h4 className="font-black text-sm text-[#004D71] uppercase leading-none">{u.n || u.nome}</h4>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black text-[#F7B500] bg-[#004D71] px-2 py-0.5 rounded-full uppercase tracking-widest">{ROLE_LABELS[u.role]}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">{u.cargo || '—'}</span>
          </div>
        </div>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl text-slate-300">
        <ChevronRight size={18} />
      </div>
    </button>
  );
}

export function TeamManagementModule({ currentUser, utentes }: { currentUser: UserProfile, utentes: UserProfile[] }) {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const assignableRoles = rolesAssignableBy(currentUser.role);

  const [addForm, setAddForm] = useState({ nome: '', email: '', cargo: '', role: assignableRoles[0] as UserRole });
  const [editForm, setEditForm] = useState<{ nome: string, cargo: string, role: UserRole, password: string }>({ nome: '', cargo: '', role: 'staff', password: '' });

  const teamProfiles = useMemo(() => {
    return utentes
      .filter(u => u.role !== 'utente')
      .filter(u => currentUser.role === 'admin' || u.role !== 'admin')
      .filter(u => {
        if (!search) return true;
        const s = search.toLowerCase();
        return [u.n, u.nome, u.email, u.cargo].filter(Boolean).some(v => String(v).toLowerCase().includes(s));
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [utentes, search, currentUser.role]);

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({ nome: u.nome || u.n || '', cargo: u.cargo || '', role: u.role, password: '' });
  };

  const saveNewUser = async () => {
    if (!addForm.nome || !addForm.email) {
      alert('Nome e Email são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      const usersPath = `artifacts/${APP_ID}/public/data/users`;
      const userRef = doc(collection(db, usersPath));
      const newUser: UserProfile = {
        id: userRef.id,
        nome: addForm.nome,
        n: addForm.nome.toUpperCase(),
        email: addForm.email,
        role: addForm.role,
        cargo: addForm.cargo || ROLE_LABELS[addForm.role].toUpperCase(),
        img: '',
        password: DEFAULT_PASSWORD,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, newUser, { merge: true });
      alert(`Funcionário "${addForm.nome}" criado. Senha inicial: ${DEFAULT_PASSWORD}`);
      setShowAddModal(false);
      setAddForm({ nome: '', email: '', cargo: '', role: assignableRoles[0] });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    if (!editForm.nome) {
      alert('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const usersPath = `artifacts/${APP_ID}/public/data/users`;
      const updateData: Partial<UserProfile> = {
        nome: editForm.nome,
        n: editForm.nome.toUpperCase(),
        cargo: editForm.cargo,
        role: editForm.role,
        updatedAt: new Date().toISOString(),
      };
      if (editForm.password.trim()) {
        updateData.password = editForm.password.trim();
      }
      await updateDoc(doc(db, usersPath, editingUser.id), updateData as any);
      setEditingUser(null);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${editingUser.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 px-2 text-left font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <UserCog size={28} className="text-[#F7B500]" /> Equipa
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Staff, Professores e Chefia</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#004D71] text-[#F7B500] p-2.5 rounded-xl shadow-lg active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="relative px-1">
        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, email ou cargo..."
          className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-[#004D71]"
        />
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/50 divide-y divide-slate-100 overflow-hidden">
        {teamProfiles.map(u => <TeamRow key={u.id} u={u} onClick={() => openEdit(u)} />)}
        {teamProfiles.length === 0 && (
          <div className="p-10 text-center text-slate-300 font-black uppercase text-xs">Nenhum funcionário encontrado</div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#004D71] p-6 pt-12 flex items-center justify-between text-white border-b-4 border-[#F7B500]">
            <div>
              <h3 className="text-xl font-black uppercase">Novo Funcionário</h3>
              <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-[0.2em] mt-1">Senha inicial: {DEFAULT_PASSWORD}</p>
            </div>
            <button onClick={() => setShowAddModal(false)} className="p-3 bg-white/10 rounded-2xl active:scale-90"><X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/50 space-y-6">
              <FormInput
                label="Nome Completo"
                icon={<UserCog size={14} />}
                value={addForm.nome}
                onChange={v => setAddForm({ ...addForm, nome: v })}
              />
              <FormInput
                label="Email (Login)"
                type="email"
                icon={<Mail size={14} />}
                value={addForm.email}
                onChange={v => setAddForm({ ...addForm, email: v })}
              />
              <FormInput
                label="Cargo"
                icon={<Briefcase size={14} />}
                value={addForm.cargo}
                onChange={v => setAddForm({ ...addForm, cargo: v })}
                placeholder="Ex: Receção / Bilheteira"
              />
              <div className="space-y-1.5 text-left w-full text-[#004D71]">
                <div className="flex items-center gap-2 ml-1">
                  <UserCog size={14} /> <label className="text-[10px] font-black uppercase tracking-widest">Função</label>
                </div>
                <select
                  value={addForm.role}
                  onChange={e => setAddForm({ ...addForm, role: e.target.value as UserRole })}
                  className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all cursor-pointer"
                >
                  {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={saveNewUser}
              disabled={saving}
              className="w-full bg-[#004D71] text-[#F7B500] font-black uppercase text-sm py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={16} /> {saving ? 'A guardar...' : 'Criar Conta'}
            </button>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col font-sans animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#004D71] p-6 pt-12 flex items-center justify-between text-white border-b-4 border-[#F7B500]">
            <div>
              <h3 className="text-xl font-black uppercase">{editingUser.nome || editingUser.n}</h3>
              <p className="text-[9px] font-black text-[#F7B500] uppercase tracking-[0.2em] mt-1">{editingUser.email}</p>
            </div>
            <button onClick={() => setEditingUser(null)} className="p-3 bg-white/10 rounded-2xl active:scale-90"><X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200/50 space-y-6">
              <FormInput
                label="Nome Completo"
                icon={<UserCog size={14} />}
                value={editForm.nome}
                onChange={v => setEditForm({ ...editForm, nome: v })}
              />
              <FormInput
                label="Cargo"
                icon={<Briefcase size={14} />}
                value={editForm.cargo}
                onChange={v => setEditForm({ ...editForm, cargo: v })}
              />
              <div className="space-y-1.5 text-left w-full text-[#004D71]">
                <div className="flex items-center gap-2 ml-1">
                  <UserCog size={14} /> <label className="text-[10px] font-black uppercase tracking-widest">Função</label>
                </div>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  disabled={editingUser.role === 'admin' && currentUser.role !== 'admin'}
                  className="w-full border-2 rounded-2xl px-5 py-4 font-bold text-base outline-none bg-white border-slate-200 focus:border-[#004D71] transition-all cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <FormInput
                label="Nova Password (opcional)"
                icon={<KeyRound size={14} />}
                value={editForm.password}
                onChange={v => setEditForm({ ...editForm, password: v })}
                placeholder="Deixar em branco para não alterar"
              />
            </div>

            <button
              onClick={saveEdit}
              disabled={saving}
              className="w-full bg-[#004D71] text-[#F7B500] font-black uppercase text-sm py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={16} /> {saving ? 'A guardar...' : 'Gravar Alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
