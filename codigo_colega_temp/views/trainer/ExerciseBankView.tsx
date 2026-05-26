
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ExerciseLibraryItem } from '../../types';

interface Props {
  onBack: () => void;
}

const MUSCLE_GROUPS = [
    'Peitoral', 'Costas', 'Ombros', 'Trapézio', 'Bíceps', 'Tríceps', 'Antebraços', 'Abdómen / Core', 'Lombar', 'Quadríceps', 'Posterior da coxa / Isquiotibiais', 'Glúteos', 'Adutores', 'Abdutores', 'Gémeos', 'Corpo inteiro / Compostos', 'Cárdio', 'Mobilidade / Alongamentos'
];

let cachedExercises: ExerciseLibraryItem[] | null = null;

export default function ExerciseBankView({ onBack }: Props) {
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>(cachedExercises || []);
  const [isLoading, setIsLoading] = useState(!cachedExercises);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete State
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ExerciseLibraryItem>>({
      name: '',
      primary_muscle: '',
      secondary_muscle: '',
      video_url: ''
  });

  const [activeSelector, setActiveSelector] = useState<'primary_muscle' | 'secondary_muscle' | null>(null);

  // UI State for Accordion
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  // UI State for Desktop Filter
  const [selectedDesktopGroup, setSelectedDesktopGroup] = useState<string>('All');

  const fetchExercises = async () => {
      if (!cachedExercises) {
          setIsLoading(true);
      }
      try {
          const { data, error } = await supabase
            .from('exercise_library')
            .select('*')
            .order('name');
          
          if (error) throw error;
          if (data) {
              cachedExercises = data;
              setExercises(data);
          }
      } catch (e: any) {
          console.error("Erro ao buscar exercícios", e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchExercises();
  }, []);

  const toggleGroup = (group: string) => {
      setExpandedGroups(prev => 
          prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
      );
  };

  const handleOpenModal = (exercise?: ExerciseLibraryItem) => {
      if (exercise) {
          setEditingId(exercise.id);
          setFormData({ ...exercise });
      } else {
          setEditingId(null);
          setFormData({
            name: '',
            primary_muscle: '',
            secondary_muscle: '',
            video_url: ''
          });
      }
      setActiveSelector(null);
      setShowModal(true);
  };

  const toggleMuscle = (field: 'primary_muscle' | 'secondary_muscle', muscle: string) => {
      const currentString = formData[field] || '';
      const currentList = currentString ? currentString.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      let newList;
      if (currentList.includes(muscle)) {
          newList = currentList.filter(m => m !== muscle);
      } else {
          newList = [...currentList, muscle];
      }
      
      setFormData({ ...formData, [field]: newList.join(', ') });
      setActiveSelector(null); // Auto-close after selection
  };

  const handleSave = async () => {
      if (!formData.name || !formData.primary_muscle) {
          alert("Preencha os campos obrigatórios (Nome, Músculo Primário).");
          return;
      }

      setIsSaving(true);
      try {
          if (editingId) {
              const { error } = await supabase
                .from('exercise_library')
                .update(formData)
                .eq('id', editingId);
              if (error) throw error;
          } else {
              const { error } = await supabase
                .from('exercise_library')
                .insert(formData);
              if (error) throw error;
          }
          
          await fetchExercises();
          setShowModal(false);
      } catch (e) {
          console.error("Erro ao salvar", e);
          alert("Erro ao salvar exercício.");
      } finally {
          setIsSaving(false);
      }
  };

  const requestDelete = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExerciseToDelete(id);
  };

  const confirmDelete = async () => {
      if (!exerciseToDelete) return;
      setIsDeleting(true);
      
      try {
          const { error } = await supabase.from('exercise_library').delete().eq('id', exerciseToDelete);
          if (error) throw error;
          setExercises(prev => prev.filter(ex => ex.id !== exerciseToDelete));
          setExerciseToDelete(null);
      } catch (e) {
          console.error(e);
          alert("Erro ao excluir.");
      } finally {
          setIsDeleting(false);
      }
  };

  const normalizeText = (text: string) => 
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredExercises = exercises
      .filter(ex => {
          const searchNormalized = normalizeText(searchTerm);
          const nameNormalized = normalizeText(ex.name);
          const muscleNormalized = normalizeText(ex.primary_muscle || '');
          
          const matchesSearch = nameNormalized.includes(searchNormalized) || 
              muscleNormalized.includes(searchNormalized);
          
          return matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  // Grouping logic
  const groupedExercises = MUSCLE_GROUPS.reduce((acc, muscle) => {
     const muscleNormalized = normalizeText(muscle);
     const muscleExs = filteredExercises.filter(ex => 
         normalizeText(ex.primary_muscle || '').includes(muscleNormalized)
     );
     acc[muscle] = muscleExs;
     return acc;
  }, {} as Record<string, ExerciseLibraryItem[]>);

  // Exercises with no primary muscle or assigned to something not in MUSCLE_GROUPS
  const otherExercises = filteredExercises.filter(ex => {
    const exMuscleNormalized = normalizeText(ex.primary_muscle || '');
    return !ex.primary_muscle || !MUSCLE_GROUPS.some(m => exMuscleNormalized.includes(normalizeText(m)));
  });

  if (otherExercises.length > 0) {
      groupedExercises['Outros'] = otherExercises;
  }

  const renderMuscleSelector = (field: 'primary_muscle' | 'secondary_muscle', label: string) => {
      const currentString = formData[field] || '';
      const currentValues = currentString ? currentString.split(',').map(s => s.trim()).filter(Boolean) : [];

      return (
          <div className="space-y-3 relative">
              <label className="text-xs uppercase tracking-wider font-black text-main">{label}</label>
              <div className="flex flex-wrap gap-2">
                  {currentValues.map((m, idx) => (
                      <span key={`selector-${field}-${m}-${idx}`} className="px-4 py-2 rounded-xl bg-surface text-main text-xs font-bold border border-main/10 flex items-center gap-2 shadow-sm">
                          {m}
                          <button onClick={() => toggleMuscle(field, m)} className="text-muted hover:text-red-500 rounded-full hover:bg-main/5 p-1 transition-colors">
                              <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                          </button>
                      </span>
                  ))}
                  <button 
                      onClick={() => setActiveSelector(activeSelector === field ? null : field)}
                      className="px-4 py-2 rounded-xl border border-dashed border-primary/50 text-primary text-xs font-black hover:bg-primary/10 transition-colors flex items-center gap-2 shadow-sm"
                  >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Adicionar
                  </button>
              </div>
              
              {/* Dropdown/List for selection */}
              {activeSelector === field && (
                  <>
                      {/* Invisible overlay to close on click outside */}
                      <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setActiveSelector(null)}
                      />
                      <div className="mt-2 p-3 bg-surface rounded-2xl border border-main/10 grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 shadow-2xl z-20 absolute top-full left-0 right-0">
                          {MUSCLE_GROUPS.filter(m => !currentValues.includes(m)).map(m => (
                          <button
                              key={m}
                              onClick={() => toggleMuscle(field, m)}
                              className="text-left px-3 py-2.5 rounded-xl hover:bg-main/5 text-main text-xs transition-colors font-bold flex items-center justify-between group"
                          >
                              {m}
                              <span className="material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 text-primary transition-opacity">add</span>
                          </button>
                      ))}
                      {MUSCLE_GROUPS.filter(m => !currentValues.includes(m)).length === 0 && (
                          <p className="col-span-2 text-center text-xs text-muted font-bold py-4 bg-main/5 rounded-xl">Todos selecionados</p>
                      )}
                  </div>
                  </>
              )}
          </div>
      );
  };

  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className={`flex flex-col h-full bg-background ${isDesktopAdmin ? '' : 'pb-8'}`}>
      {/* Header */}
      {!isDesktopAdmin && (
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
          <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold text-main">Banco de Exercícios</h1>
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
              <h2 className="text-2xl font-bold">Banco de Exercícios</h2>
              <button 
                  onClick={() => handleOpenModal()}
                  className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Adicionar Exercício
              </button>
           </div>
        )}
        {isDesktopAdmin ? (
           <div className="flex gap-6 h-[calc(100vh-160px)]">
             {/* Sidebar Filter */}
             <div className="w-72 flex-shrink-0 bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 rounded-3xl p-5 overflow-y-auto flex flex-col gap-2">
                <div className="mb-2">
                   <div className="bg-surface rounded-2xl flex items-center px-4 h-12 border border-main/5 focus-within:border-primary/50 transition-colors shadow-inner">
                       <span className="material-symbols-outlined text-muted mr-3 text-lg">search</span>
                       <input 
                           type="text" 
                           placeholder="Procurar exercício..." 
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                           className="bg-transparent text-main w-full outline-none placeholder:text-zinc-600 text-sm font-medium"
                       />
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1">
                    <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3 px-4 mt-4">Categorias</h3>
                    {['All', ...MUSCLE_GROUPS, 'Outros'].map(group => {
                        const count = group === 'All' ? filteredExercises.length : groupedExercises[group]?.length || 0;
                        const isSelected = selectedDesktopGroup === group;
                        return (
                            <button
                                key={group}
                                onClick={() => setSelectedDesktopGroup(group)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${isSelected ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:bg-main/5 hover:text-main'}`}
                            >
                                <span className="text-left flex-1 leading-tight">{group === 'All' ? 'Todos os Exercícios' : group}</span>
                                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-main/10'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
             </div>

             {/* Main Area */}
             <div className="flex-1 bg-white dark:bg-[#111827] border border-black/5 dark:border-white/5 rounded-3xl p-6 overflow-y-auto">
                 {isLoading ? (
                     <div className="h-full flex items-center justify-center text-muted">
                         <div className="flex flex-col items-center gap-3">
                             <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                             <p className="font-medium text-sm">A carregar exercícios...</p>
                         </div>
                     </div>
                 ) : filteredExercises.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                         <div className="w-20 h-20 bg-main/5 rounded-3xl flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-4xl text-muted">fitness_center</span>
                         </div>
                         <h3 className="text-xl font-bold mb-2">Nenhum exercício</h3>
                         <p className="text-muted text-sm mb-6">Não foram encontrados exercícios que correspondam à sua pesquisa.</p>
                         <button onClick={() => handleOpenModal()} className="text-primary text-sm font-bold px-6 py-2 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors">
                             Adicionar novo exercício
                         </button>
                     </div>
                 ) : (
                     <div className="flex flex-col gap-3">
                         {(selectedDesktopGroup === 'All' ? filteredExercises : (groupedExercises[selectedDesktopGroup] || [])).map(ex => (
                             <div 
                                 key={ex.id} 
                                 onClick={() => handleOpenModal(ex)}
                                 className="bg-background w-full flex items-center rounded-2xl p-4 border border-main/5 hover:border-primary/30 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                             >
                                 <div className="flex-1 flex items-center justify-between">
                                     <div className="flex items-center gap-4">
                                         <div className="h-10 w-10 shrink-0 rounded-xl bg-main/5 flex items-center justify-center text-main group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                             <span className="material-symbols-outlined">fitness_center</span>
                                         </div>
                                         <div>
                                             <h3 className="text-sm font-bold text-main leading-tight group-hover:text-primary transition-colors">{ex.name}</h3>
                                             <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                 {(ex.primary_muscle || '').split(',').filter(Boolean).map((m, idx) => (
                                                     <span key={`${ex.id}-primary-${m.trim()}-${idx}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                                                         {m.trim()}
                                                     </span>
                                                 ))}
                                                 {ex.secondary_muscle && (ex.secondary_muscle || '').split(',').filter(Boolean).map((m, idx) => (
                                                     <span key={`${ex.id}-secondary-${m.trim()}-${idx}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-main/5 text-muted uppercase tracking-tight">
                                                         {m.trim()}
                                                     </span>
                                                 ))}
                                             </div>
                                         </div>
                                     </div>
                                     
                                     <div className="flex items-center gap-4">
                                         {ex.video_url && (
                                             <div className="flex items-center gap-1 text-muted text-[10px] font-bold group-hover:text-orange-500 transition-colors">
                                                 <span className="material-symbols-outlined text-[16px]">play_circle</span>
                                                 <span className="hidden sm:inline">Vídeo</span>
                                             </div>
                                         )}
                                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                             <button 
                                                 onClick={(e) => { e.stopPropagation(); handleOpenModal(ex); }} 
                                                 className="text-muted hover:text-primary p-2 hover:bg-main/5 rounded-lg transition-colors"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">edit</span>
                                             </button>
                                             <button 
                                                 onClick={(e) => requestDelete(ex.id, e)} 
                                                 className="text-muted hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                             >
                                                 <span className="material-symbols-outlined text-[18px]">delete</span>
                                             </button>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
           </div>
        ) : (
            <>
                {/* Search */}
                <div className="space-y-3">
                    <div className="bg-surface rounded-xl flex items-center px-4 h-12 border border-main/5 focus-within:border-primary/50 transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-muted mr-3">search</span>
                        <input 
                            type="text" 
                            placeholder="Procurar exercício no banco..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-transparent text-main w-full outline-none placeholder:text-zinc-600 text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Categorized List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-10 text-muted">
                            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block mb-2"></span>
                            <p>Carregando...</p>
                        </div>
                    ) : Object.keys(groupedExercises).length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-zinc-700 rounded-xl bg-main/5">
                            <span className="material-symbols-outlined text-4xl text-muted mb-2">fitness_center</span>
                            <p className="text-muted font-bold">Nenhum exercício encontrado</p>
                            <button onClick={() => handleOpenModal()} className="text-primary text-sm font-bold mt-2">Adicionar novo</button>
                        </div>
                    ) : (
                        Object.entries(groupedExercises).map(([group, groupExercises]) => {
                            const isExpanded = expandedGroups.includes(group) || searchTerm.length > 0;
                            return (
                                <div key={group} className="bg-surface rounded-2xl border border-main/5 overflow-hidden shadow-lg transition-all">
                                    <button 
                                        onClick={() => toggleGroup(group)}
                                        className="w-full flex items-center justify-between p-4 bg-main/5 hover:bg-main/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                <span className="material-symbols-outlined text-xl">
                                                    {group === 'Aquecimento' ? 'home_health' : 
                                                     group === 'Cárdio' ? 'directions_run' : 
                                                     group === 'Alongamento' ? 'accessibility_new' : 'fitness_center'}
                                                </span>
                                            </div>
                                            <div className="text-left">
                                                <h3 className="text-sm font-bold text-main">{group}</h3>
                                                <p className="text-[10px] text-muted uppercase font-bold">{groupExercises.length} exercícios</p>
                                            </div>
                                        </div>
                                        <span className={`material-symbols-outlined text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="p-2 space-y-2 bg-main/5 animate-in slide-in-from-top-2 duration-300">
                                            {groupExercises.map(ex => (
                                                <div 
                                                    key={ex.id} 
                                                    onClick={() => handleOpenModal(ex)}
                                                    className="bg-surface rounded-xl p-4 border border-main/5 shadow-md relative group cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99]"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-sm font-bold text-main pr-16 leading-tight">{ex.name}</h3>
                                                        <div className="absolute top-3 right-3 flex gap-1">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(ex); }} 
                                                                className="text-muted hover:text-main p-1 hover:bg-main/10 rounded"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => requestDelete(ex.id, e)} 
                                                                className="text-muted hover:text-red-400 p-1 hover:bg-main/10 rounded"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {(ex.primary_muscle || '').split(',').filter(Boolean).map((m, idx) => (
                                                            <span key={`${ex.id}-primary-${m.trim()}-${idx}`} className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20 uppercase">
                                                                {m.trim()}
                                                            </span>
                                                        ))}
                                                        {ex.secondary_muscle && (ex.secondary_muscle || '').split(',').filter(Boolean).map((m, idx) => (
                                                            <span key={`${ex.id}-secondary-${m.trim()}-${idx}`} className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-zinc-500/10 text-muted border-main/10 uppercase">
                                                                {m.trim()}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {ex.video_url && (
                                                        <div className="mt-3 flex items-center gap-2 text-primary text-[10px] font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <span className="material-symbols-outlined text-sm">play_circle</span>
                                                            Vídeo demonstrativo disponível
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </>
        )}
      </main>

      {/* ADD/EDIT MODAL / DRAWER */}
      {showModal && (
        <div className={`fixed inset-0 z-50 flex ${isDesktopAdmin ? 'justify-end' : 'items-end sm:items-center justify-center'} bg-background/50 backdrop-blur-sm ${isDesktopAdmin ? '' : 'sm:p-4'} animate-in fade-in duration-200`}>
           <div className={`bg-surface w-full ${isDesktopAdmin ? 'h-full max-w-md border-l border-main/10 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col' : 'max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl rounded-t-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col'}`}>
              <div className={`p-6 border-b border-main/5 flex items-center justify-between ${isDesktopAdmin ? 'pt-8' : ''}`}>
                  <button onClick={() => setShowModal(false)} className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-muted hover:text-main transition-colors">
                      <span className="material-symbols-outlined">close</span>
                  </button>
                  <h2 className="text-xl font-black text-main">{editingId ? 'Editar Exercício' : 'Novo Exercício'}</h2>
                  <div className="w-10"></div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="space-y-3">
                      <label className="text-xs uppercase tracking-wider font-black text-muted ml-1">Nome do Exercício</label>
                      <input 
                          type="text" 
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-surface/50 rounded-2xl px-5 py-4 text-main border-2 border-main/5 focus:border-primary/50 outline-none transition-all placeholder:text-zinc-500 font-bold shadow-inner"
                          placeholder="Ex: Supino Reto com Barra"
                      />
                  </div>

                  <div className="space-y-6 bg-main/5 rounded-3xl p-6 border border-main/5">
                      {renderMuscleSelector('primary_muscle', 'Músculo Primário')}
                      <div className="h-px bg-main/5 w-full"></div>
                      {renderMuscleSelector('secondary_muscle', 'Músculos Secundários')}
                  </div>

                  <div className="space-y-3">
                      <label className="text-xs uppercase tracking-wider font-black text-muted ml-1">Vídeo Demonstrativo</label>
                      <div className="bg-surface/50 rounded-2xl flex items-center pr-2 border-2 border-main/5 focus-within:border-primary/50 transition-colors shadow-inner overflow-hidden">
                          <span className="material-symbols-outlined text-muted ml-5 mr-3">play_circle</span>
                          <input 
                              type="text" 
                              value={formData.video_url}
                              onChange={e => setFormData({...formData, video_url: e.target.value})}
                              className="w-full bg-transparent py-4 text-main outline-none text-sm font-medium placeholder:text-zinc-500"
                              placeholder="https://youtube.com/..."
                          />
                      </div>
                      <p className="text-[10px] uppercase font-bold text-muted ml-1">Cole o link do YouTube, Vimeo ou mp4.</p>
                  </div>
              </div>

              <div className="p-6 border-t border-main/5 bg-surface/80 backdrop-blur-md">
                  <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full bg-primary text-background font-black uppercase tracking-wider text-sm h-14 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                  >
                      {isSaving ? <span className="material-symbols-outlined animate-spin">refresh</span> : (editingId ? 'Atualizar Exercício' : 'Gravar Exercício')}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {exerciseToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">delete</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Remover Exercício?</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Esta ação removerá o exercício da base de dados permanentemente.
                 </p>
                 
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setExerciseToDelete(null)}
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
