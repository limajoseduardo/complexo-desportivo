import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { Screen, Meal, FoodItem } from '../../types';
import { supabase } from '../../lib/supabaseClient';

interface DietViewProps {
  onBack: () => void;
}

// Emojis disponíveis para o aluno escolher
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

const PRESET_MEALS = [
    'Pequeno Almoço',
    'Lanche da Manhã',
    'Almoço',
    'Lanche da Tarde',
    'Pré-Treino',
    'Pós-Treino',
    'Jantar',
    'Ceia',
    'Suplementos'
];

export default function DietView({ onBack }: DietViewProps) {
  const { user, setScreen, openTrainerChat } = useApp();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Day Selector State
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const [showEmptyPlanModal, setShowEmptyPlanModal] = useState(false);
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  
  // State for Adding Extra Items
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetMealId, setTargetMealId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newItem, setNewItem] = useState({
      name: '',
      quantity: '',
      emoji: '🍎'
  });

  // State for Deleting Extra Items
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Food Bank State
  const [foodBank, setFoodBank] = useState<{id: string, name: string, emoji: string}[]>([]);
  const [foodSearch, setFoodSearch] = useState('');
  const [showFoodSuggestions, setShowFoodSuggestions] = useState(false);

  // Fetch Diet Data directly from Supabase
  const fetchDiet = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
        // Also fetch food bank for suggestions
        const { data: bankData } = await supabase
            .from('food_bank')
            .select('*')
            .order('name');
        if (bankData) setFoodBank(bankData);

        // 1. Fetch Meals - Ordenado por order_index
        const { data: mealsData, error: mealsError } = await supabase
            .from('diet_meals')
            .select('*')
            .eq('student_id', user.id)
            .eq('day_of_week', selectedDay)
            .order('order_index', { ascending: true });

        if (mealsError) {
             // Fallback if day_of_week doesn't exist yet
             if (mealsError.message.includes('column "day_of_week" does not exist')) {
                 const { data: allMeals, error: allErr } = await supabase
                     .from('diet_meals')
                     .select('*')
                     .eq('student_id', user.id)
                     .order('order_index', { ascending: true });
                 
                 if (allErr) throw allErr;
                 if (allMeals && allMeals.length > 0) {
                     const mealsWithItems = await Promise.all(allMeals.map(async (meal: any) => {
                         const { data: items } = await supabase
                             .from('diet_items')
                             .select('*')
                             .eq('meal_id', meal.id)
                             .order('created_at', { ascending: true });
                         
                         return {
                             id: meal.id,
                             name: meal.name,
                             targetCalories: 0, 
                             created_at: meal.created_at,
                             order_index: meal.order_index,
                             items: (items || []).map((i: any) => ({
                                 id: i.id,
                                 name: i.name,
                                 quantity: i.quantity,
                                 calories: 0,
                                 protein: 0,
                                 carbs: 0,
                                 fat: 0,
                                 completed: false,
                                 image: i.image,
                                 is_extra: i.is_extra || false
                             }))
                         };
                     }));
                     setMeals(mealsWithItems);
                     setLoading(false);
                     return;
                 }
             }
             throw mealsError;
        }

        if (mealsData && mealsData.length > 0) {
            // 2. Fetch Items for these meals
            const mealsWithItems = await Promise.all(mealsData.map(async (meal: any) => {
                const { data: items } = await supabase
                    .from('diet_items')
                    .select('*')
                    .eq('meal_id', meal.id)
                    .order('created_at', { ascending: true });
                
                return {
                    id: meal.id,
                    name: meal.name,
                    targetCalories: 0, 
                    created_at: meal.created_at,
                    order_index: meal.order_index, // Captura o índice
                    items: (items || []).map((i: any) => ({
                        id: i.id,
                        name: i.name,
                        quantity: i.quantity,
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                        completed: false, // Ignored in UI now
                        image: i.image, // Contains EMOJI
                        is_extra: i.is_extra || false // Identify if added by student
                    }))
                };
            }));
            
            // SORT MEALS LOGICALLY (Reforço via Javascript caso venha desordenado)
            const sortedMeals = mealsWithItems.sort((a, b) => {
                // Se ambos tiverem índice definido, usa o índice
                if (a.order_index !== null && b.order_index !== null) {
                    return a.order_index - b.order_index;
                }
                // Fallback para data de criação
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            setMeals(sortedMeals);
            setShowEmptyPlanModal(false);
        } else {
            setMeals([]);
            // Don't show blocking modal, let student create meals
            setShowEmptyPlanModal(false); 
        }
    } catch (e) {
        console.error("Erro ao carregar dieta:", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiet();
  }, [user?.id, selectedDay]);

  const handleOpenAddModal = (mealId: string) => {
      setTargetMealId(mealId);
      setNewItem({ name: '', quantity: '', emoji: '🍎' });
      setFoodSearch('');
      setShowFoodSuggestions(false);
      setShowAddModal(true);
  };

  const handleAddItem = async () => {
      if (!targetMealId || !newItem.name) return;
      setIsSaving(true);

      try {
          const { error } = await supabase.from('diet_items').insert({
              meal_id: targetMealId,
              name: newItem.name,
              quantity: newItem.quantity || '1 porção',
              image: newItem.emoji,
              is_extra: true, // Mark as added by student
              calories: 0
          });

          if (error) {
              throw error;
          }

            // NOTIFY TRAINER
          if (user?.trainerId) {
            const notificationData = {
                user_id: user.trainerId,
                student_id: user.id, // O ID do aluno
                title: 'Novo Registo de Dieta',
                message: `${user.name} adicionou "${newItem.name}" ao registo alimentar.`,
                type: 'INFO'
            };
            await supabase.from('notifications').insert(notificationData);
          }

          await fetchDiet(); // Reload to show new item
          setShowAddModal(false);
      } catch (e) {
          console.error(e);
          alert("Erro ao adicionar alimento.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteExtra = (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Stop bubbling to prevent parent clicks
      setItemToDelete(itemId);
  };

  const confirmDeleteExtra = async () => {
      if (!itemToDelete) return;
      
      try {
          await supabase.from('diet_items').delete().eq('id', itemToDelete);
          // Optimistic UI Update
          setMeals(prev => prev.map(m => ({
              ...m,
              items: m.items.filter(i => i.id !== itemToDelete)
          })));
          setItemToDelete(null);
      } catch (e) {
          console.error("Erro ao deletar", e);
      }
  };

  const handleAddMeal = async (presetName?: string) => {
    const finalName = presetName || newMealName;
    if (!user?.id || !finalName.trim()) return;
    setIsSavingMeal(true);
    try {
        const { error } = await supabase.from('diet_meals').insert({
            student_id: user.id,
            name: finalName,
            order_index: meals.length * 1000,
            target_calories: 0,
            day_of_week: selectedDay
        });

        if (error) throw error;

        // NOTIFY TRAINER
        if (user?.trainerId) {
            await supabase.from('notifications').insert({
                user_id: user.trainerId,
                student_id: user.id,
                title: 'Nova Refeição Criada',
                message: `${user.name} criou a refeição "${finalName}".`,
                type: 'INFO'
            });
        }

        await fetchDiet();
        setShowAddMealModal(false);
        setNewMealName('');
    } catch (e) {
        console.error(e);
        alert("Erro ao adicionar refeição.");
    } finally {
        setIsSavingMeal(false);
    }
  };

  const confirmDeleteMeal = async () => {
    if (!mealToDelete) return;
    
    try {
        // Delete all items first (best practice if no cascade)
        await supabase.from('diet_items').delete().eq('meal_id', mealToDelete);
        // Delete the meal
        await supabase.from('diet_meals').delete().eq('id', mealToDelete);
        
        setMeals(prev => prev.filter(m => m.id !== mealToDelete));
        setMealToDelete(null);
    } catch (e) {
        console.error("Erro ao deletar refeição", e);
    }
  };

  const handleCopyDay = async (targetDay: number | 'ALL') => {
    if (!user?.id || meals.length === 0) return;
    setIsCopying(true);

    try {
        const sourceDay = selectedDay;
        const targetDays = targetDay === 'ALL' ? [0, 1, 2, 3, 4, 5, 6].filter(d => d !== sourceDay) : [targetDay];

        for (const tDay of targetDays) {
            // 1. Get existing meals for target day to cleanup
            const { data: existingMeals } = await supabase
                .from('diet_meals')
                .select('id')
                .eq('student_id', user.id)
                .eq('day_of_week', tDay);
            
            if (existingMeals && existingMeals.length > 0) {
                const mealIds = existingMeals.map(m => m.id);
                await supabase.from('diet_items').delete().in('meal_id', mealIds);
                await supabase.from('diet_meals').delete().in('id', mealIds);
            }

            // 2. Clone current meals to target day
            for (const meal of meals) {
                const { data: newMeal, error: mealErr } = await supabase
                    .from('diet_meals')
                    .insert({
                        student_id: user.id,
                        name: meal.name,
                        order_index: meal.order_index,
                        day_of_week: tDay,
                        target_calories: meal.targetCalories || 0
                    })
                    .select()
                    .single();

                if (mealErr) throw mealErr;

                if (newMeal && meal.items.length > 0) {
                    const itemsToInsert = meal.items.map(item => ({
                        meal_id: newMeal.id,
                        name: item.name,
                        quantity: item.quantity,
                        image: item.image,
                        calories: item.calories || 0,
                        protein: item.protein || 0,
                        carbs: item.carbs || 0,
                        fat: item.fat || 0,
                        is_extra: item.is_extra || false
                    }));

                    await supabase.from('diet_items').insert(itemsToInsert);
                }
            }
        }

        setShowCopyModal(false);
        alert(`Plano copiado com sucesso!`);
        if (targetDay !== 'ALL' && typeof targetDay === 'number') {
            setSelectedDay(targetDay);
        }
    } catch (e) {
        console.error("Erro ao copiar plano:", e);
        alert("Erro ao copiar o plano alimentar.");
    } finally {
        setIsCopying(false);
    }
  };

  const calculateAge = (birthdate: string) => {
    if (!birthdate || birthdate.length < 10) return 25;
    try {
        const parts = birthdate.split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - (month - 1);
        if (m < 0 || (m === 0 && today.getDate() < day)) {
            age--;
        }
        return age || 25;
    } catch (e) {
        return 25;
    }
  };

  const bmr = useMemo(() => {
    if (!user || !user.weight || !user.height) return 2000;
    
    // If Body Fat is present, use Katch-McArdle (most accurate for athletes/active people)
    if (user.bodyFat && user.bodyFat > 0) {
        const lbm = user.weight * (1 - user.bodyFat / 100);
        return Math.round(370 + (21.6 * lbm));
    }

    const weight = user.weight;
    const height = user.height < 3 ? user.height * 100 : user.height; 
    const age = calculateAge(user.birthdate || '');
    
    if (user.gender === 'FEMALE') {
        return Math.round(655 + (9.6 * weight) + (1.8 * height) - (4.7 * age));
    } else {
        return Math.round(66 + (13.7 * weight) + (5 * height) - (6.8 * age));
    }
  }, [user]);

  const fa = useMemo(() => {
    if (user?.activityFactor) return user.activityFactor;
    
    const freq = user?.trainingFrequency || 0;
    if (freq === 0) return 1.2;
    if (freq <= 3) return 1.375;
    if (freq <= 5) return 1.55;
    if (freq <= 7) return 1.725;
    return 1.55;
  }, [user?.activityFactor, user?.trainingFrequency]);

  const tdee = Math.round(bmr * fa);

  const lbm = user?.weight && user?.bodyFat ? user.weight * (1 - user.bodyFat / 100) : null;
  const defaultMult = user?.gender === 'FEMALE' ? 1.8 : 2.2;
  const activeMultiplier = user?.proteinMultiplier && user.proteinMultiplier > 0 ? user.proteinMultiplier : defaultMult;
  
  // If BF exists, we use a higher multiplier over LBM (default 2.5) or the custom one
  const proteinTarget = lbm 
    ? Math.round(lbm * (user?.proteinMultiplier && user.proteinMultiplier > 0 ? user.proteinMultiplier : 2.5))
    : Math.round((user?.weight || 0) * activeMultiplier);

  const calculatedProteinTarget = user?.targetProtein || proteinTarget;
  
  // Gordura = 1g por kg de "peso muscular" (LBM se existir, senão peso total)
  const fatTarget = Math.round((lbm || user?.weight || 0) * 1);
  const calculatedFatTarget = user?.targetFat || fatTarget;

  // Hidratos = Resto das calorias
  const calculatedCalories = user?.targetCalories || tdee;
  const remainingCals = calculatedCalories - (calculatedProteinTarget * 4) - (calculatedFatTarget * 9);
  const carbTarget = Math.max(0, Math.round(remainingCals / 4));
  const calculatedCarbTarget = user?.targetCarbs || carbTarget;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <header className="flex-none sticky top-0 z-10 p-4 bg-background/95 backdrop-blur-sm border-b border-main/5 animate-enter">
        <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h1 className="text-lg font-bold text-main">Plano Alimentar</h1>
            <button 
                onClick={() => setShowCopyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 border border-primary/20"
            >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Copiar</span>
            </button>
        </div>

        {/* Day Selector */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 mb-2 no-scrollbar">
            {DAYS_PT.map((day, idx) => (
                <button
                    key={day}
                    onClick={() => setSelectedDay(idx)}
                    className={`flex-1 min-w-[44px] py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedDay === idx 
                        ? 'bg-primary text-background shadow-lg shadow-primary/20 scale-105' 
                        : 'bg-main/5 text-muted hover:bg-main/10'
                    }`}
                >
                    {day}
                </button>
            ))}
        </div>
        <p className="text-[10px] text-muted font-bold uppercase tracking-widest text-center">{DAYS_FULL[selectedDay]}</p>

        {/* Static Goals Card */}
        <div className="bg-surface rounded-xl p-5 border border-main/5 relative overflow-hidden shadow-lg animate-scale">
            <div className="absolute right-0 top-0 p-3 opacity-10">
                <span className="material-symbols-outlined text-6xl">restaurant</span>
            </div>
            
            <div className="relative z-10">
                <p className="text-xs font-bold text-muted uppercase mb-2 text-center">Meta Diária Prescrita</p>
                
                <div className="flex items-center justify-center mb-4">
                    <div className="text-center">
                        <p className="text-3xl font-black text-main">{user?.targetCalories || tdee}</p>
                        <p className="text-xs text-primary font-bold uppercase tracking-wider">
                            Kcal {!user?.targetCalories && (user?.bodyFat ? '(Katch-McArdle x FA)' : '(Manutenção Est.)')}
                        </p>
                        {!user?.targetCalories && (
                            <p className="text-[10px] text-muted-foreground font-bold mt-1">
                                Baseado em {user?.trainingFrequency || 0} treinos/semana (FA: {fa})
                            </p>
                        )}
                    </div>
                </div>
                
                {/* Macros */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-main/5">
                    <div className="text-center">
                        <p className="text-sm font-bold text-main">{calculatedProteinTarget}g</p>
                        <p className="text-[10px] text-blue-400 font-bold uppercase">Proteína</p>
                    </div>
                    <div className="text-center border-l border-main/5">
                        <p className="text-sm font-bold text-main">{calculatedCarbTarget}g</p>
                        <p className="text-[10px] text-orange-400 font-bold uppercase">Carbo</p>
                    </div>
                    <div className="text-center border-l border-main/5">
                        <p className="text-sm font-bold text-main">{calculatedFatTarget}g</p>
                        <p className="text-[10px] text-yellow-400 font-bold uppercase">Gordura</p>
                    </div>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0 pb-24">
        {loading ? (
            <div className="text-center py-10">
                <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block"></span>
                <p className="text-muted text-sm mt-2">A carregar plano...</p>
            </div>
        ) : (
            <>
                {meals.map((meal, index) => (
                    <div key={meal.id} className="bg-surface rounded-xl border border-main/5 overflow-hidden animate-enter" style={{animationDelay: `${index * 100}ms`}}>
                        <div className="p-3 bg-main/5 border-b border-main/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-main text-sm uppercase tracking-wide">{meal.name}</h3>
                                <button 
                                    onClick={() => setMealToDelete(meal.id)}
                                    className="text-muted hover:text-red-500 p-1 flex items-center justify-center transition-colors"
                                    title="Remover refeição"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                            <button 
                                onClick={() => handleOpenAddModal(meal.id)}
                                className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                <span className="text-[10px] font-bold">Add</span>
                            </button>
                        </div>
                        <div className="p-2 space-y-1">
                            {meal.items.map(item => {
                                // Cast is_extra to boolean because it comes from Supabase dynamic
                                const isExtra = (item as any).is_extra;
                                const isImage = item.image && item.image.startsWith('http');

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors border-transparent hover:bg-main/5`}
                                    >
                                        {/* Icon/Emoji/Image */}
                                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-md bg-main/5">
                                            {isImage ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">{item.image || '🥣'}</span>
                                            )}
                                        </div>
                                        
                                        {/* Text Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-main truncate">{item.name}</p>
                                            </div>
                                            <p className="text-xs text-primary font-medium">{item.quantity}</p>
                                        </div>

                                        {/* Delete Button ONLY for Extras */}
                                        {isExtra && (
                                                <button 
                                                    onClick={(e) => handleDeleteExtra(item.id, e)}
                                                    className="text-zinc-800 dark:text-zinc-400 hover:text-red-500 p-2 z-10 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                        )}
                                    </div>
                                );
                            })}
                            {meal.items.length === 0 && (
                                <p className="text-center text-xs text-muted py-4 italic border-2 border-dashed border-main/5 m-2 rounded-lg">
                                    Nenhum alimento nesta refeição.
                                </p>
                            )}
                        </div>
                    </div>
                ))}

                <div className="flex flex-col gap-3 mt-6 mb-10 animate-enter">
                    <p className="text-xs font-bold text-muted uppercase text-center border-t border-main/5 pt-6">Adicionar Refeição</p>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESET_MEALS.filter(pm => !meals.some(m => m.name === pm)).map(pm => (
                            <button 
                                key={pm}
                                onClick={() => handleAddMeal(pm)}
                                disabled={isSavingMeal}
                                className="py-2.5 border border-main/10 rounded-lg text-xs font-bold text-muted hover:text-main hover:bg-main/5 transition-colors disabled:opacity-50"
                            >
                                + {pm}
                            </button>
                        ))}
                        <button 
                            onClick={() => {
                                setNewMealName('');
                                setShowAddMealModal(true);
                            }}
                            className="py-2.5 border border-dashed border-primary/30 text-primary rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors"
                        >
                            + Personalizado
                        </button>
                    </div>
                </div>
            </>
        )}
        
        {!loading && meals.length === 0 && !showEmptyPlanModal && (
            <div className="text-center py-10 text-muted">
                <p>Nenhuma refeição encontrada.</p>
            </div>
        )}
      </main>

      
      {/* ADD ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-main/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-main">Adicionar Alimento Extra</h2>
                    <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* Emoji Grid */}
                    <div>
                        <label className="text-xs font-bold text-muted uppercase mb-2 block">Ícone</label>
                        <div className="grid grid-cols-6 gap-3 bg-main/5 p-4 rounded-xl border border-main/5 max-h-48 overflow-y-auto custom-scrollbar">
                            {FOOD_EMOJIS.map(emoji => (
                                <button 
                                    key={emoji}
                                    onClick={() => setNewItem({...newItem, emoji})}
                                    className={`h-12 w-12 flex items-center justify-center text-2xl rounded-xl transition-all ${newItem.emoji === emoji ? 'bg-primary text-background scale-110 shadow-lg shadow-primary/20' : 'hover:bg-main/5 text-muted hover:text-main'}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 relative">
                        <label className="text-xs font-bold text-muted uppercase ml-1">Alimento</label>
                        <input 
                            type="text" 
                            value={newItem.name}
                            onChange={e => {
                                const val = e.target.value;
                                setNewItem({...newItem, name: val});
                                setFoodSearch(val);
                                setShowFoodSuggestions(val.length > 0);
                            }}
                            onFocus={() => {
                                if (newItem.name.length > 0) setShowFoodSuggestions(true);
                            }}
                            className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all placeholder:text-zinc-600"
                            placeholder="Ex: Maçã, Chocolate..."
                            autoFocus
                        />

                        {/* Food Suggestions */}
                        {showFoodSuggestions && foodBank.filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase())).length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-main/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                {foodBank
                                    .filter(f => f.name.toLowerCase().includes(foodSearch.toLowerCase()))
                                    .slice(0, 5)
                                    .map(food => (
                                        <button
                                            key={food.id}
                                            onClick={() => {
                                                setNewItem({
                                                    ...newItem,
                                                    name: food.name,
                                                    emoji: food.emoji || '🍎'
                                                });
                                                setShowFoodSuggestions(false);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-main/5 text-left border-b border-main/5 last:border-0"
                                        >
                                            <span className="text-xl">{food.emoji || '🍽️'}</span>
                                            <span className="text-sm font-bold text-main">{food.name}</span>
                                            <span className="text-[10px] text-primary ml-auto font-black uppercase">Banco de Alimentos</span>
                                        </button>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-muted uppercase ml-1">Quantidade</label>
                        <input 
                            type="text" 
                            value={newItem.quantity}
                            onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                            className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none"
                            placeholder="Ex: 1 unidade, 50g..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-main/5">
                    <button 
                        onClick={handleAddItem}
                        disabled={!newItem.name || isSaving}
                        className="w-full h-12 rounded-xl bg-primary text-background font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                        {isSaving ? 'A guardar...' : 'Adicionar ao Registro'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ADD MEAL MODAL */}
      {showAddMealModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-main">Adicionar Refeição</h3>
                  <button onClick={() => setShowAddMealModal(false)} className="text-muted hover:text-main">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-muted uppercase mb-2 block">Nome da Refeição</label>
                      <input 
                          type="text" 
                          value={newMealName}
                          onChange={(e) => setNewMealName(e.target.value)}
                          className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all font-bold"
                          placeholder="Ex: Pequeno-almoço"
                          autoFocus
                      />
                  </div>

                  <button 
                      onClick={handleAddMeal}
                      disabled={isSavingMeal || !newMealName.trim()}
                      className="w-full bg-primary text-background font-bold h-12 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      {isSavingMeal ? 'A guardar...' : 'Criar Refeição'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (MEAL) */}
      {mealToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">delete_sweep</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Remover Refeição?</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Desejas remover toda esta refeição e os seus itens? Esta ação não pode ser desfeita.
                 </p>
                 
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setMealToDelete(null)}
                        className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDeleteMeal}
                        className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                    >
                        Remover
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (ITEM) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                 <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                    <span className="material-symbols-outlined text-3xl">delete</span>
                 </div>
                 <h3 className="text-xl font-bold text-main mb-2">Remover Alimento?</h3>
                 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                    Tens a certeza que desejas remover este item extra?
                 </p>
                 
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDeleteExtra}
                        className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                    >
                        Remover
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* COPY DAY MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-main">Copiar {DAYS_FULL[selectedDay]}</h3>
                  <button onClick={() => setShowCopyModal(false)} className="text-muted hover:text-main">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="space-y-3">
                  <p className="text-xs text-muted mb-4">Escolha o destino para este plano alimentar:</p>
                  
                  <button 
                    onClick={() => handleCopyDay('ALL')}
                    disabled={isCopying}
                    className="w-full h-12 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2 mb-4"
                  >
                        {isCopying ? (
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <span className="material-symbols-outlined text-lg">calendar_month</span>
                        )}
                        Copia para Todos os Dias
                  </button>

                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                      {DAYS_FULL.map((label, idx) => (
                          idx !== selectedDay && (
                              <button 
                                key={idx}
                                onClick={() => handleCopyDay(idx)}
                                disabled={isCopying}
                                className="w-full py-3 px-4 rounded-xl bg-main/5 hover:bg-main/10 text-main text-sm font-medium flex items-center justify-between transition-all"
                              >
                                  <span>{label}</span>
                                  <span className="material-symbols-outlined text-primary text-lg">arrow_forward</span>
                              </button>
                          )
                      ))}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* EMPTY PLAN MODAL */}
      {showEmptyPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
           <div className="bg-surface w-full max-w-sm rounded-3xl p-8 border border-primary/20 shadow-2xl relative animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center">
                 <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-lg shadow-primary/10 animate-pulse">
                    <span className="material-symbols-outlined text-4xl">restaurant_menu</span>
                 </div>
                 
                 <h2 className="text-2xl font-bold text-main mb-3">Sem Dieta Definida</h2>
                 <p className="text-muted text-sm mb-8 leading-relaxed">
                    Ainda não possuis um plano alimentar registado. Solicita a criação da tua dieta ao teu PT.
                 </p>
                 
                 <div className="w-full space-y-3">
                    <button 
                        onClick={openTrainerChat}
                        className="w-full h-14 rounded-xl bg-primary text-background font-bold text-lg hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined">chat</span>
                        Falar com o PT
                    </button>
                    
                    <button 
                        onClick={onBack}
                        className="w-full h-12 rounded-xl bg-main/5 text-muted font-bold hover:bg-main/10 hover:text-main transition-colors"
                    >
                        Voltar ao Início
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}