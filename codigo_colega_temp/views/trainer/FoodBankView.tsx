
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  onBack: () => void;
}

interface FoodBankItem {
    id: string;
    name: string;
    emoji: string;
}

const FOOD_EMOJIS = [
    '🍗', '🥩', '🥚', '🐟', '🍤', '🦀', '🦞', '🥓', '🍖', '🍔', 
    '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🍳', '🥘', '🍲', 
    '🥣', '🥗', '🍿', '🧂', '🥫', '🍚', '🍝', '🍜', '🍠', '🍢', 
    '🍣', '🍱', '🍛', '🍙', '🍘', '🥟', '🥠', '🥡', '🍞', '🥐', 
    '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🧈', '🥦', '🥕', '🌽', 
    '🍅', '🥑', '🥬', '🥒', '🍄', '🥜', '🌰', '🧅', '🧄', '🥔', 
    '🌶️', '🫑', '🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍑', '🍐', 
    '🍍', '🥥', '🥝', '🍋', '🍊', '🥭', '🍈', '🥛', '☕', '🫖',
    '🍵', '🥤', '🧋', '🍺', '🍷', '🍹', '🧉', '🧃', '🍼', '🧊',
    '🍫', '🍬', '🍭', '🍮', '🍯', '🍰', '🎂', '🍪', '🍩', '🍦', 
    '🍧', '🍨', '🥧', '🧁', '🥢', '🍽️', '🍴', '🥄', '🏺', '💊'
];

let cachedFoods: FoodBankItem[] | null = null;

export default function FoodBankView({ onBack }: Props) {
  const [foods, setFoods] = useState<FoodBankItem[]>(cachedFoods || []);
  const [isLoading, setIsLoading] = useState(!cachedFoods);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
      name: '',
      emoji: '🍎'
  });

  // Delete State
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFoods = async () => {
      if (!cachedFoods) {
          setIsLoading(true);
      }
      try {
          const { data, error } = await supabase
            .from('food_bank')
            .select('*')
            .order('name');
          
          if (error) throw error;
          if (data) {
              cachedFoods = data;
              setFoods(data);
          }
      } catch (e) {
          console.error("Erro ao buscar alimentos", e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchFoods();
  }, []);

  const handleOpenModal = (item?: FoodBankItem) => {
      if (item) {
          setEditingId(item.id);
          setFormData({ name: item.name, emoji: item.emoji || '🍽️' });
      } else {
          setEditingId(null);
          setFormData({ name: '', emoji: '🍎' });
      }
      setShowModal(true);
  };

  const handleSave = async () => {
      if (!formData.name) return;
      setIsSaving(true);
      try {
          if (editingId) {
              await supabase.from('food_bank').update({
                  name: formData.name,
                  emoji: formData.emoji
              }).eq('id', editingId);
          } else {
              await supabase.from('food_bank').insert({
                  name: formData.name,
                  emoji: formData.emoji
              });
          }
          await fetchFoods();
          setShowModal(false);
      } catch (e) {
          alert("Erro ao salvar alimento.");
      } finally {
          setIsSaving(false);
      }
  };

  const confirmDelete = async () => {
      if (!itemToDelete) return;
      setIsDeleting(true);
      try {
          await supabase.from('food_bank').delete().eq('id', itemToDelete);
          setFoods(prev => prev.filter(f => f.id !== itemToDelete));
          setItemToDelete(null);
      } catch (e) {
          alert("Erro ao excluir.");
      } finally {
          setIsDeleting(false);
      }
  };

  const filteredFoods = foods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className={`flex flex-col h-full bg-background ${isDesktopAdmin ? '' : 'pb-8'}`}>
      {!isDesktopAdmin && (
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
          <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold text-main">Banco de Alimentos</h1>
          <button 
              onClick={() => handleOpenModal()}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-main/10 text-main hover:bg-main/20 transition-colors"
          >
            <span className="material-symbols-outlined">add_circle</span>
          </button>
        </header>
      )}

      <main className={`flex-1 p-4 space-y-4 overflow-y-auto ${isDesktopAdmin ? 'pt-8' : ''} pb-24`}>
        {isDesktopAdmin && (
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Banco de Alimentos</h2>
              <button 
                  onClick={() => handleOpenModal()}
                  className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Adicionar Alimento
              </button>
           </div>
        )}
        <div className={`bg-surface/50 rounded-2xl flex items-center pr-2 border-2 border-main/5 focus-within:border-primary/50 transition-colors shadow-inner overflow-hidden ${isDesktopAdmin ? 'h-14 mb-8' : 'h-12 mb-4'}`}>
            <span className="material-symbols-outlined text-muted ml-5 mr-3">search</span>
            <input 
                type="text" 
                placeholder="Procurar alimento..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent text-main w-full py-4 outline-none placeholder:text-zinc-500 text-sm font-bold"
            />
        </div>

        <div className={isDesktopAdmin ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" : "space-y-2"}>
            {isLoading ? (
                <div className={`text-center py-10 text-muted ${isDesktopAdmin ? 'col-span-full' : ''}`}>
                    <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block mb-2"></span>
                    <p className="font-bold">Carregando...</p>
                </div>
            ) : filteredFoods.length === 0 ? (
                <div className={`text-center py-10 border-2 border-dashed border-main/10 rounded-3xl bg-main/5 ${isDesktopAdmin ? 'col-span-full mt-10' : ''}`}>
                    <span className="material-symbols-outlined text-4xl text-muted mb-2">no_food</span>
                    <p className="text-muted font-bold">Nenhum alimento encontrado</p>
                    <button onClick={() => handleOpenModal()} className="text-primary text-sm font-bold mt-2 hover:underline">Adicionar novo</button>
                </div>
            ) : (
                filteredFoods.map(food => (
                    <div key={food.id} className={`bg-surface border border-main/5 group flex ${isDesktopAdmin ? 'flex-col p-6 hover:border-primary/30 transition-all rounded-3xl relative overflow-hidden shadow-sm hover:shadow-md' : 'items-center gap-4 p-3 rounded-xl'}`}>
                        {isDesktopAdmin ? (
                            <>
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenModal(food)} className="p-1.5 bg-main/5 backdrop-blur-md rounded-lg text-muted hover:text-main hover:bg-main/10 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button onClick={() => setItemToDelete(food.id)} className="p-1.5 bg-main/5 backdrop-blur-md rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                                <div className="h-16 w-16 mx-auto rounded-2xl bg-surface flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-sm border border-main/5">
                                    {food.emoji}
                                </div>
                                <h3 className="font-black text-main text-[15px] leading-tight text-center truncate w-full">{food.name}</h3>
                            </>
                        ) : (
                           <>
                                <div className="h-12 w-12 rounded-lg bg-main/5 flex items-center justify-center text-2xl">
                                    {food.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-main text-sm truncate">{food.name}</h3>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleOpenModal(food)} className="p-2 text-muted hover:text-main hover:bg-main/10 rounded-lg">
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button onClick={() => setItemToDelete(food.id)} className="p-2 text-muted hover:text-red-400 hover:bg-main/10 rounded-lg">
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                           </>
                        )}
                    </div>
                ))
            )}
        </div>
      </main>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className={`fixed inset-0 z-50 flex ${isDesktopAdmin ? 'justify-end' : 'items-end sm:items-center justify-center'} bg-background/50 backdrop-blur-sm ${isDesktopAdmin ? '' : 'sm:p-4'} animate-in fade-in duration-200`}>
           <div className={`bg-surface w-full ${isDesktopAdmin ? 'h-full max-w-md border-l border-main/10 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col' : 'max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] sm:rounded-3xl rounded-t-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col'}`}>
              <div className={`p-6 border-b border-main/5 flex items-center justify-between ${isDesktopAdmin ? 'pt-8' : ''}`}>
                  <button onClick={() => setShowModal(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-muted hover:text-main transition-colors">
                      <span className="material-symbols-outlined">close</span>
                  </button>
                  <h2 className="text-xl font-black text-main">{editingId ? 'Editar Alimento' : 'Novo Alimento'}</h2>
                  <div className="w-10"></div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  <div className="space-y-3">
                      <label className="text-xs uppercase tracking-wider font-black text-muted ml-1">Nome do Alimento</label>
                      <input 
                          type="text" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-surface/50 rounded-2xl px-5 py-4 text-main border-2 border-main/5 focus:border-primary/50 outline-none transition-all placeholder:text-zinc-500 font-bold shadow-inner"
                          placeholder="Ex: Arroz Integral"
                          autoFocus
                      />
                  </div>

                  <div className="space-y-3">
                        <label className="text-xs uppercase tracking-wider font-black text-muted ml-1">Ícone</label>
                        <div className="grid grid-cols-6 gap-3 bg-surface/50 p-4 rounded-2xl border-2 border-main/5 shadow-inner max-h-64 overflow-y-auto custom-scrollbar">
                            {FOOD_EMOJIS.map(emoji => (
                                <button 
                                    key={emoji}
                                    onClick={() => setFormData({...formData, emoji})}
                                    className={`h-12 w-12 flex items-center justify-center text-2xl rounded-xl transition-all ${formData.emoji === emoji ? 'bg-primary text-background scale-110 shadow-lg shadow-primary/20' : 'hover:bg-main/5 text-muted hover:text-main'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
              </div>

              <div className="p-6 border-t border-main/5 bg-surface/80 backdrop-blur-md">
                  <button 
                      onClick={handleSave}
                      disabled={isSaving || !formData.name}
                      className="w-full bg-primary text-background font-black uppercase tracking-wider text-sm h-14 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
                  >
                      {isSaving ? <span className="material-symbols-outlined animate-spin">refresh</span> : (editingId ? 'Atualizar Alimento' : 'Gravar Alimento')}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">delete</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Remover Alimento?</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Esta ação removerá o alimento da base de dados permanentemente.
                 </p>
                 
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete}
                        disabled={isDeleting}
                        className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center"
                    >
                        {isDeleting ? <span className="w-4 h-4 border-2 border-main border-t-transparent rounded-full animate-spin"></span> : 'Remover'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
