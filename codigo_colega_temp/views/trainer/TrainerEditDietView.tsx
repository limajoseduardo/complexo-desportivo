
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { Screen } from '../../types';

interface Props {
  onBack: () => void;
  hideHeader?: boolean;
}

interface DietItem {
  id: string;
  name: string;
  quantity: string;
  image?: string;
  completed?: boolean;
}

interface DietMeal {
  id: string;
  name: string;
  items: DietItem[];
  order_index: number;
}

interface FoodBankItem {
    id: string;
    name: string;
    emoji: string;
}

const MEAL_ORDER = [
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

const PRESET_MEALS = MEAL_ORDER;

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

export default function TrainerEditDietView({ onBack, hideHeader }: Props) {
  const { viewingStudent, user, setScreen, sendPushNotification } = useApp();
  const isDesktopAdmin = typeof window !== 'undefined' && window.location.pathname.includes('/ptadmin');
  const [meals, setMeals] = useState<DietMeal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Day Selector State
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  // DnD State
  const [draggedMealId, setDraggedMealId] = useState<string | null>(null);

  // Food Bank State
  const [foodBank, setFoodBank] = useState<FoodBankItem[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [isBankExpanded, setIsBankExpanded] = useState(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [macroSettings, setMacroSettings] = useState({
      planName: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      bodyFat: 0,
      activityFactor: 0,
      proteinMultiplier: 0
  });
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deleteDietStep, setDeleteDietStep] = useState<'IDLE' | 'CONFIRM'>('IDLE');

  // Add Item State
  const [showItemModal, setShowItemModal] = useState(false);
  const [targetMealId, setTargetMealId] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [saveToBank, setSaveToBank] = useState(false);
  
  const [newItem, setNewItem] = useState({
      name: '',
      quantity: '',
      emoji: '🍗'
  });

  // Custom Meal Modal State
  const [showCustomMealModal, setShowCustomMealModal] = useState(false);
  const [customMealName, setCustomMealName] = useState('');

  // Delete States
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{itemId: string, mealId: string} | null>(null);

  useEffect(() => {
    if (viewingStudent?.id) {
        fetchDiet();
        fetchProfileSettings();
        fetchFoodBank();
    }
  }, [viewingStudent?.id, selectedDay]);

  const fetchProfileSettings = async () => {
      if (!viewingStudent) return;
      try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', viewingStudent.id)
            .single();
          
          if (data) {
              setStudentProfile(data);
              let settings = {
                  planName: data.diet_plan_name || '',
                  calories: data.target_calories || 0,
                  protein: data.target_protein || 0,
                  carbs: data.target_carbs || 0,
                  fat: data.target_fat || 0,
                  bodyFat: data.body_fat || 0,
                  activityFactor: data.activity_factor || 0,
                  proteinMultiplier: data.protein_multiplier || 0
              };
              
              if (settings.calories === 0) {
                  settings = autoCalculateMacros(settings, data);
              }
              
              setMacroSettings(settings);
          }
      } catch (e) {
          console.error("Error fetching macros", e);
      }
  };

  const fetchFoodBank = async () => {
      try {
          const { data, error } = await supabase
            .from('food_bank')
            .select('*')
            .order('name');
          
          if (error) throw error;
          if (data) setFoodBank(data);
      } catch (e) {
          console.error("Error fetching food bank", e);
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

  const autoCalculateMacros = (currentSettings: typeof macroSettings, profileData?: any) => {
    const p = profileData || studentProfile || viewingStudent;
    if (!p || !p.weight || !p.height) return { ...currentSettings, calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Simple BMR + TDEE estimation for fallback
    const weight = parseFloat(p.weight);
    const height = parseFloat(p.height) < 3 ? parseFloat(p.height) * 100 : parseFloat(p.height);
    const age = calculateAge(p.birthdate || '');
    const gender = p.gender || 'MALE';
    
    let bmr = gender === 'FEMALE' 
        ? Math.round(655 + (9.6 * weight) + (1.8 * height) - (4.7 * age))
        : Math.round(66 + (13.7 * weight) + (5 * height) - (6.8 * age));
        
    const tdee = Math.round(bmr * 1.55); // Assumed active
    const protein = Math.round(weight * 2.2);
    const fat = Math.round(weight * 1);
    const carbs = Math.max(0, Math.round((tdee - (protein * 4) - (fat * 9)) / 4));
    
    return { ...currentSettings, calories: tdee, protein, carbs, fat };
  };

  const handleAutoCalculateClick = () => {
      if (!studentProfile) return;
      const newSettings = autoCalculateMacros(macroSettings);
      setMacroSettings(newSettings);
  };

  const fetchDiet = async () => {
      if (!viewingStudent) return;
      setLoading(true);
      try {
          const { data: mealsData, error: mealsError } = await supabase
            .from('diet_meals')
            .select('*')
            .eq('student_id', viewingStudent.id)
            .eq('day_of_week', selectedDay);

          if (mealsError) {
              // Fallback if day_of_week doesn't exist yet (backward compatibility during migration)
              if (mealsError.message.includes('column "day_of_week" does not exist')) {
                  const { data: allMeals, error: allErr } = await supabase
                    .from('diet_meals')
                    .select('*')
                    .eq('student_id', viewingStudent.id);
                  
                  if (allErr) throw allErr;
                  // If we find meals without day_of_week, we'll treat them as day 1 (Segunda) for now
                  // or show them for all days if we want. Let's assume we want to update them.
                  if (allMeals) {
                      const processedMeals = await Promise.all(allMeals.map(async (meal: any) => {
                          const { data: items } = await supabase
                            .from('diet_items')
                            .select('*')
                            .eq('meal_id', meal.id)
                            .order('created_at', { ascending: true });
                          
                          return { ...meal, items: items || [] };
                      }));
                      setMeals(processedMeals.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
                      setLoading(false);
                      return;
                  }
              }
              throw mealsError;
          }

          if (mealsData) {
              const needsOrdering = mealsData.some((m: any) => m.order_index === null || m.order_index === undefined);
              let processedMeals = [...mealsData];

              if (needsOrdering) {
                  const updates = processedMeals.map((m: any) => {
                      let idx = MEAL_ORDER.indexOf(m.name);
                      if (idx === -1) idx = 99;
                      return { ...m, order_index: idx * 10000 };
                  });
                  processedMeals = updates;
                  Promise.all(updates.map((u: any) => 
                      supabase.from('diet_meals').update({ order_index: u.order_index }).eq('id', u.id)
                  ));
              }

              const mealsWithItems = await Promise.all(processedMeals.map(async (meal: any) => {
                  const { data: items } = await supabase
                    .from('diet_items')
                    .select('*')
                    .eq('meal_id', meal.id)
                    .order('created_at', { ascending: true });
                  
                  return { 
                      ...meal, 
                      items: (items || []).map((i: any) => ({
                          ...i,
                          is_extra: i.is_extra || false
                      }))
                  };
              }));

              const sortedMeals = mealsWithItems.sort((a, b) => a.order_index - b.order_index);
              setMeals(sortedMeals);
          }
      } catch (e: any) {
          console.error("Error fetching diet:", e);
      } finally {
          setLoading(false);
      }
  };

  // --- REORDER LOGIC (Arrows) ---
  const moveMeal = async (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === meals.length - 1) return;

      const newMeals = [...meals];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      // Swap array elements
      [newMeals[index], newMeals[targetIndex]] = [newMeals[targetIndex], newMeals[index]];

      // Recalculate Indices (10000, 20000...)
      const updatedMeals = newMeals.map((m, idx) => ({
          ...m,
          order_index: (idx + 1) * 10000
      }));

      setMeals(updatedMeals); // Optimistic Update

      // Persist to DB
      try {
          await Promise.all(updatedMeals.map(m => 
              supabase.from('diet_meals').update({ order_index: m.order_index }).eq('id', m.id)
          ));
      } catch (err) {
          console.error("Failed to reorder", err);
          fetchDiet(); // Revert on error
      }
  };

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, mealId: string) => {
      setDraggedMealId(mealId);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetMealId: string) => {
      e.preventDefault();
      if (!draggedMealId || draggedMealId === targetMealId) return;

      const draggedIndex = meals.findIndex(m => m.id === draggedMealId);
      const targetIndex = meals.findIndex(m => m.id === targetMealId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;

      const newMeals = [...meals];
      const [movedMeal] = newMeals.splice(draggedIndex, 1);
      newMeals.splice(targetIndex, 0, movedMeal);

      const updatedMeals = newMeals.map((m, index) => ({
          ...m,
          order_index: (index + 1) * 10000
      }));

      setMeals(updatedMeals);
      setDraggedMealId(null);

      try {
          await Promise.all(updatedMeals.map(m => 
              supabase.from('diet_meals').update({ order_index: m.order_index }).eq('id', m.id)
          ));
      } catch (err) {
          console.error("Failed to reorder", err);
      }
  };

  const copyCurrentDayToOtherDays = async () => {
      if (!viewingStudent || meals.length === 0) return;
      
      const confirmCopy = window.confirm("Desejas copiar a dieta de " + DAYS_FULL[selectedDay] + " para todos os outros dias da semana?");
      if (!confirmCopy) return;

      setLoading(true);
      try {
          // 1. Delete all other days' meals for this student
          await supabase.from('diet_meals').delete().eq('student_id', viewingStudent.id).neq('day_of_week', selectedDay);

          // 2. For each day except selectedDay
          for (let day = 0; day < 7; day++) {
              if (day === selectedDay) continue;

              // Copy each meal of current day
              for (const meal of meals) {
                  const { data: newMeal, error: mErr } = await supabase.from('diet_meals').insert({
                      student_id: viewingStudent.id,
                      name: meal.name,
                      order_index: meal.order_index,
                      day_of_week: day
                  }).select().single();

                  if (mErr) throw mErr;

                  if (meal.items && meal.items.length > 0) {
                      const newItems = meal.items.map(item => ({
                          meal_id: newMeal.id,
                          name: item.name,
                          quantity: item.quantity,
                          image: item.image,
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fat: 0
                      }));
                      await supabase.from('diet_items').insert(newItems);
                  }
              }
          }
          alert("Dieta copiada para todos os dias com sucesso!");
      } catch (e) {
          console.error("Error copying diet", e);
          alert("Erro ao copiar dieta.");
      } finally {
          setLoading(false);
      }
  };

  const handleSaveSettings = async () => {
      if (!viewingStudent) return;
      setIsSavingSettings(true);
      try {
        let finalSettings = macroSettings;
        // Auto-calcular se os macros principais estiverem zerados
        if (macroSettings.calories === 0 || macroSettings.protein === 0) {
            finalSettings = autoCalculateMacros(macroSettings);
            setMacroSettings(finalSettings);
        }

        const { data, error } = await supabase.from('profiles').update({
            diet_plan_name: finalSettings.planName,
            target_calories: finalSettings.calories,
            target_protein: finalSettings.protein,
            target_carbs: finalSettings.carbs,
            target_fat: finalSettings.fat,
            body_fat: finalSettings.bodyFat,
            activity_factor: finalSettings.activityFactor,
            protein_multiplier: finalSettings.proteinMultiplier
        }).eq('id', viewingStudent.id).select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Permissão negada ou aluno não encontrado. É provável que as políticas de segurança (RLS) da tabela 'profiles' não permitam que o personal trainer atualize o perfil do aluno.");
        }
          
          // Notify Student
          const pushTitle = 'Dieta Atualizada';
          const pushMessage = `O teu personal atualizou as metas da tua dieta.`;

          await supabase.from('notifications').insert({
              user_id: viewingStudent.id,
              title: pushTitle,
              message: pushMessage,
              type: 'INFO'
          });
          
          sendPushNotification(viewingStudent.id, pushTitle, pushMessage);

          setShowSettingsModal(false);
      } catch (e: any) {
          console.error(e);
          alert("Erro ao salvar configurações: " + e.message);
      } finally {
          setIsSavingSettings(false);
      }
  };

  const handleDeleteDiet = async () => {
      if (!viewingStudent) return;
      setIsSavingSettings(true);
      try {
          await supabase.from('diet_meals').delete().eq('student_id', viewingStudent.id);
          await supabase.from('profiles').update({
              diet_plan_name: null,
              target_calories: 0,
              target_protein: 0,
              target_carbs: 0,
              target_fat: 0,
              body_fat: null,
              activity_factor: 0,
              protein_multiplier: 0
          }).eq('id', viewingStudent.id);

          setMeals([]);
          setShowSettingsModal(false);
          setDeleteDietStep('IDLE');
          setScreen(Screen.DIET_CREATOR);

          // NOTIFY STUDENT
          if (viewingStudent?.id) {
              const pushTitle = 'Dieta Removida';
              const pushMessage = `O teu plano alimentar foi zerado pelo treinador para uma nova fase.`;

              await supabase.from('notifications').insert({
                  user_id: viewingStudent.id,
                  title: pushTitle,
                  message: pushMessage,
                  type: 'WARNING'
              });

              sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
          }
      } catch (e) {
          alert("Erro ao excluir dieta.");
      } finally {
          setIsSavingSettings(false);
      }
  };

  const addMeal = async (name: string) => {
      if (!viewingStudent) return;
      try {
          const lastOrder = meals.length > 0 ? meals[meals.length - 1].order_index : 0;
          const newOrder = lastOrder + 10000;

          const { data, error } = await supabase.from('diet_meals').insert({
              student_id: viewingStudent.id,
              name,
              order_index: newOrder,
              day_of_week: selectedDay
          }).select().single();
          
          if (error) throw error;
          if (data) {
              setMeals(prev => [...prev, { ...data, items: [] }]);
              
              // ADDED NOTIFICATION
              const pushTitle = 'Nova Refeição';
              const pushMessage = `O teu personal adicionou "${name}" ao teu plano alimentar.`;

              await supabase.from('notifications').insert({
                  user_id: viewingStudent.id,
                  title: pushTitle,
                  message: pushMessage,
                  type: 'INFO'
              });

              sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
          }
      } catch (e: any) {
          console.error(e);
          alert("Erro ao adicionar refeição: " + e.message);
      }
  };

  const handleAddCustomMeal = () => {
      if (!customMealName.trim()) return;
      addMeal(customMealName);
      setShowCustomMealModal(false);
  };

  const confirmDeleteMeal = async () => {
      if (!mealToDelete) return;
      try {
          await supabase.from('diet_meals').delete().eq('id', mealToDelete);
          const deletedMealName = meals.find(m => m.id === mealToDelete)?.name;

          setMeals(prev => prev.filter(m => m.id !== mealToDelete));
          setMealToDelete(null);

          // NOTIFY STUDENT
          if (viewingStudent?.id) {
              const pushTitle = 'Dieta Atualizada';
              const pushMessage = `A refeição "${deletedMealName || 'uma refeição'}" foi removida do teu plano.`;

              await supabase.from('notifications').insert({
                  user_id: viewingStudent.id,
                  title: pushTitle,
                  message: pushMessage,
                  type: 'INFO'
              });

              sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
          }
      } catch (e) {
          alert("Erro ao remover refeição.");
      }
  };

  const openAddItemModal = (mealId: string) => {
      setTargetMealId(mealId);
      setNewItem({ name: '', quantity: '', emoji: '🍗' });
      setBankSearch('');
      setIsBankExpanded(false);
      setSaveToBank(false);
      setShowItemModal(true);
  };

  const handleAddItem = async () => {
      if (!targetMealId || !newItem.name) return;
      
      setIsSavingItem(true);
      try {
          const { data, error } = await supabase.from('diet_items').insert({
              meal_id: targetMealId,
              name: newItem.name,
              quantity: newItem.quantity || 'À vontade',
              image: newItem.emoji,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0
          }).select().single();

          if (error) throw error;

          if (saveToBank) {
              const { error: bankError } = await supabase.from('food_bank').insert({
                  name: newItem.name,
                  emoji: newItem.emoji
              });
              if (!bankError) fetchFoodBank();
          }

          if (data) {
              setMeals(prev => prev.map(m => 
                  m.id === targetMealId 
                  ? { ...m, items: [...m.items, data] }
                  : m
              ));
              setShowItemModal(false);
              
              // ADDED NOTIFICATION
              const pushTitle = 'Dieta Atualizada';
              const pushMessage = `Novo alimento adicionado: ${newItem.name}`;

              await supabase.from('notifications').insert({
                  user_id: viewingStudent.id,
                  title: pushTitle,
                  message: pushMessage,
                  type: 'INFO'
              });

              sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
          }
      } catch (e: any) {
          console.error(e);
          alert("Erro ao adicionar item.");
      } finally {
          setIsSavingItem(false);
      }
  };

  const confirmRemoveItem = async () => {
      if (!itemToDelete) return;
      const { itemId, mealId } = itemToDelete;
      try {
          const meal = meals.find(m => m.id === mealId);
          const itemName = meal?.items.find(i => i.id === itemId)?.name;

          await supabase.from('diet_items').delete().eq('id', itemId);
          setMeals(prev => prev.map(m => 
              m.id === mealId 
              ? { ...m, items: m.items.filter(i => i.id !== itemId) }
              : m
          ));
          setItemToDelete(null);

          // NOTIFY STUDENT
          if (viewingStudent?.id) {
              const pushTitle = 'Dieta Atualizada';
              const pushMessage = `O item "${itemName || 'um item'}" foi removido da tua dieta.`;

              await supabase.from('notifications').insert({
                  user_id: viewingStudent.id,
                  title: pushTitle,
                  message: pushMessage,
                  type: 'INFO'
              });

              sendPushNotification(viewingStudent.id, pushTitle, pushMessage);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const filteredBank = foodBank.filter(item => 
      item.name.toLowerCase().includes(bankSearch.toLowerCase())
  );
  
  return (
    <div className={`flex flex-col h-full bg-background ${isDesktopAdmin ? '' : 'pb-8'} ${hideHeader ? 'pt-0' : ''}`}>
        {!isDesktopAdmin && !hideHeader && (
          <header className="sticky top-0 z-20 p-4 bg-background/95 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/5 text-main">
                      <span className="material-symbols-outlined font-bold">arrow_back_ios_new</span>
                  </button>
                  <div>
                      <h1 className="text-lg font-bold text-main">Editar Dieta</h1>
                      <p className="text-[10px] text-muted font-medium">{viewingStudent?.name}</p>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button 
                      onClick={() => setShowSettingsModal(true)}
                      className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-main transition-colors shadow-sm"
                      title="Configurações e Macros"
                  >
                      <span className="material-symbols-outlined text-xl">settings</span>
                  </button>
              </div>
          </header>
        )}

        {/* Day Selector */}
        <div className={`bg-background/95 backdrop-blur-sm sticky ${isDesktopAdmin && !hideHeader ? 'top-0 p-6' : (hideHeader ? 'top-0 py-4 px-2' : 'top-[72px] px-4 pb-4 pt-2')} z-[19] border-b border-main/5 transition-all duration-300`}>
            <div className="max-w-7xl mx-auto w-full">
                {isDesktopAdmin && !hideHeader && (
                   <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-4">
                        <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full bg-main/5 hover:bg-main/10 text-main transition-colors">
                            <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold">Editar Dieta de {viewingStudent?.name || "Aluno"}</h2>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                      <button 
                          onClick={() => setShowSettingsModal(true)}
                          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                      >
                          <span className="material-symbols-outlined text-lg">settings</span>
                          Configurar Macros
                      </button>
                   </div>
                   </div>
                )}
                <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                    {DAYS_PT.map((day, idx) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDay(idx)}
                            className={`flex-1 min-w-[46px] py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                                selectedDay === idx 
                                ? 'bg-primary text-background shadow-md shadow-primary/30 scale-105' 
                                : 'bg-main/5 text-muted hover:bg-main/10'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
                <div className="flex justify-between items-center mt-1 px-1">
                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{DAYS_FULL[selectedDay]}</p>
                    <button 
                      onClick={copyCurrentDayToOtherDays}
                      className="text-[10px] text-primary font-bold hover:underline"
                    >
                      Copiar para todos os dias
                    </button>
                </div>
            </div>
        </div>

        <main className="flex-1 p-4 space-y-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full pb-10">
                {/* Student Diary Summary (Items logged by student) */}
                {!loading && meals.some(m => m.items.some(i => i.is_extra)) && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary text-sm">history_edu</span>
                        <h3 className="text-xs font-black text-main uppercase tracking-widest">Registos Recentes do Aluno</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {meals.flatMap(m => m.items.filter(i => i.is_extra)).map(item => (
                            <div key={item.id} className="bg-surface/50 px-2.5 py-1 rounded-lg text-[10px] text-main border border-primary/10 flex items-center gap-1.5 shadow-sm">
                                <span>{item.image && item.image.startsWith('http') ? '📸' : (item.image || '🥣')}</span>
                                <span className="font-bold">{item.name}</span>
                                <span className="text-muted opacity-60">{item.quantity}</span>
                                {item.image && item.image.startsWith('http') && (
                                    <button 
                                        onClick={() => window.open(item.image, '_blank')}
                                        className="text-primary hover:underline ml-1"
                                    >
                                        Ver Foto
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10 text-muted">
                    <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block"></span>
                    <p className="mt-2">A carregar plano...</p>
                </div>
            ) : (
                <>
                    {/* GLOBAL TARGETS CARD */}
                    {!hideHeader ? (
                        <div className="bg-surface rounded-3xl p-6 border border-main/5 shadow-xl shadow-main/5 mb-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-main font-bold text-xl">Metas Diárias</h3>
                                <button onClick={() => setShowSettingsModal(true)} className="text-primary text-sm font-bold hover:underline">Editar</button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="text-left">
                                    <p className="text-4xl font-black text-main leading-tight">{macroSettings.calories}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">CALORIAS</p>
                                </div>
                                <div className="h-12 w-px bg-main/10 mx-4"></div>
                                <div className="flex flex-1 justify-around gap-2">
                                    <div className="text-center">
                                        <p className="text-lg font-black text-blue-500 leading-none tracking-tighter">{macroSettings.protein}g</p>
                                        <p className="text-[8px] text-blue-500/80 font-black uppercase mt-1.5 tracking-widest">PROT</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-black text-orange-500 leading-none tracking-tighter">{macroSettings.carbs}g</p>
                                        <p className="text-[8px] text-orange-500/80 font-black uppercase mt-1.5 tracking-widest">CARB</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-black text-yellow-500 leading-none tracking-tighter">{macroSettings.fat}g</p>
                                        <p className="text-[8px] text-yellow-500/80 font-black uppercase mt-1.5 tracking-widest">GORD</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface rounded-2xl p-6 border border-main/10 shadow-lg mb-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-main font-bold text-xl">Metas Diárias</h3>
                                <button onClick={() => setShowSettingsModal(true)} className="bg-main/5 px-4 py-1.5 rounded-lg text-primary text-xs font-bold hover:bg-main/10 transition-colors">Configurar</button>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-6">
                                <div className="bg-main/5 p-4 rounded-xl text-center flex flex-col items-center justify-center">
                                    <p className="text-3xl font-black text-main">{macroSettings.calories}</p>
                                    <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Calorias (Kcal)</p>
                                </div>
                                <div className="bg-blue-500/5 p-4 rounded-xl text-center flex flex-col items-center justify-center">
                                    <p className="text-2xl font-black text-blue-500">{macroSettings.protein}g</p>
                                    <p className="text-[10px] text-blue-500/70 uppercase font-bold tracking-wider">Proteína</p>
                                </div>
                                <div className="bg-orange-500/5 p-4 rounded-xl text-center flex flex-col items-center justify-center">
                                    <p className="text-2xl font-black text-orange-500">{macroSettings.carbs}g</p>
                                    <p className="text-[10px] text-orange-500/70 uppercase font-bold tracking-wider">Carboidratos</p>
                                </div>
                                <div className="bg-yellow-500/5 p-4 rounded-xl text-center flex flex-col items-center justify-center">
                                    <p className="text-2xl font-black text-yellow-500">{macroSettings.fat}g</p>
                                    <p className="text-[10px] text-yellow-500/70 uppercase font-bold tracking-wider">Gorduras</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {meals.length === 0 && (
                        <div className="text-center py-10 border-2 border-dashed border-zinc-700 rounded-xl bg-main/5">
                            <span className="material-symbols-outlined text-4xl text-muted mb-2">no_meals</span>
                            <p className="text-muted font-bold">Nenhuma refeição</p>
                            <p className="text-xs text-muted mb-4">Adicione refeições para começar.</p>
                        </div>
                    )}

                    {/* DRAG AND DROP LIST */}
                    <div className={hideHeader ? "grid grid-cols-2 lg:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 space-y-4 md:space-y-0"}>
                        {meals.map((meal, index) => {
                            const isPreset = PRESET_MEALS.includes(meal.name);
                            const isDraggable = !isPreset;
                            const isFirst = index === 0;
                            const isLast = index === meals.length - 1;

                            return (
                                <div 
                                    key={meal.id} 
                                    draggable={isDraggable}
                                    onDragStart={(e) => handleDragStart(e, meal.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, meal.id)}
                                    className={`bg-surface rounded-xl border overflow-hidden transition-all duration-300 ${
                                        draggedMealId === meal.id 
                                        ? 'opacity-50 border-primary border-dashed scale-[0.98]' 
                                        : 'border-main/5'
                                    } ${isDraggable ? 'cursor-move' : ''} shadow-lg shadow-main/5 h-fit`}
                                >
                                    <div className={`p-4 flex justify-between items-center bg-gray-50/80`}>
                                        <div className="flex items-center gap-3">
                                            {/* Drag Handle for Custom Meals or Lock for Presets */}
                                            {isDraggable ? (
                                                <span className="material-symbols-outlined text-muted cursor-move">drag_indicator</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-muted/40">lock</span>
                                            )}
                                            
                                            <h3 className={`font-bold text-[15px] ${isDraggable ? 'text-primary' : 'text-main'}`}>{meal.name}</h3>
                                        </div>
                                        
                                        <div className="flex gap-2 items-center">
                                            {/* Reorder Arrows - Only for Custom Meals */}
                                            {isDraggable && (
                                                <div className="flex flex-col -space-y-1 mr-1">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveMeal(index, 'up'); }} 
                                                        disabled={isFirst}
                                                        className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">arrow_drop_up</span>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); moveMeal(index, 'down'); }} 
                                                        disabled={isLast}
                                                        className="text-muted hover:text-primary disabled:opacity-20 disabled:hover:text-muted transition-colors leading-none"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">arrow_drop_down</span>
                                                    </button>
                                                </div>
                                            )}

                                            <button onClick={() => openAddItemModal(meal.id)} className="p-1.5 hover:bg-main/5 rounded text-primary transition-colors">
                                                <span className="material-symbols-outlined text-lg font-bold">add</span>
                                            </button>
                                            <button 
                                                onClick={() => setMealToDelete(meal.id)} 
                                                className="p-1.5 hover:bg-main/5 rounded text-muted hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        {meal.items.length === 0 ? (
                                            <p className="text-xs text-muted/50 text-center py-7 border-2 border-dotted border-gray-100 rounded-xl bg-white font-medium">
                                                Lista vazia
                                            </p>
                                        ) : (
                                            meal.items.map(item => (
                                                <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-main/5 rounded-lg group border border-transparent hover:border-main/5 transition-all">
                                                    <div className="h-10 w-10 rounded-lg bg-main/5 flex items-center justify-center text-2xl overflow-hidden">
                                                        {item.image && item.image.startsWith('http') ? (
                                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(item.image, '_blank')} />
                                                        ) : (
                                                            item.image || '🍽️'
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-main">{item.name}</p>
                                                            {item.is_extra && (
                                                                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black border border-primary/20 uppercase tracking-tighter">
                                                                    Log Aluno
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted font-mono">{item.quantity}</p>
                                                    </div>
                                                    <button onClick={() => setItemToDelete({itemId: item.id, mealId: meal.id})} className="text-muted hover:text-red-400 p-2 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">close</span>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className={hideHeader ? "grid grid-cols-4 lg:grid-cols-5 gap-3 mt-8" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 border-t border-main/5 pt-8 mt-10"}>
                        {PRESET_MEALS.filter(pm => !meals.some(m => m.name === pm)).map(pm => (
                            <button 
                                key={pm}
                                onClick={() => addMeal(pm)}
                                className="py-3 px-4 bg-white border border-main/10 shadow-sm rounded-xl text-[10px] font-bold uppercase tracking-widest text-main hover:text-primary hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95 flex items-center justify-center gap-1"
                            >
                                <span className="text-xs">+</span> {pm}
                            </button>
                        ))}
                        <button 
                            onClick={() => {
                                setCustomMealName('');
                                setShowCustomMealModal(true);
                            }}
                            className="py-3 px-4 border-2 border-dashed border-primary/40 bg-primary/5 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span className="text-xs">+</span>
                            Personalizado
                        </button>
                    </div>
                </>
            )}
            </div>
        </main>

        {/* SETTINGS MODAL */}
        {showSettingsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-main">Configurar Metas</h3>
                        <button onClick={() => { setShowSettingsModal(false); setDeleteDietStep('IDLE'); }} className="text-muted hover:text-main">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted uppercase">Nome do Plano</label>
                            <input 
                                type="text" 
                                value={macroSettings.planName}
                                onChange={(e) => setMacroSettings({...macroSettings, planName: e.target.value})}
                                className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none text-sm"
                                placeholder="Ex: Dieta Cutting"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase">Calorias (Kcal)</label>
                                <input 
                                    type="number" 
                                    value={macroSettings.calories || ''}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const newSettings = {...macroSettings, calories: val};
                                        // Recalcula carbo se as outras metas estiverem definidas
                                        if (macroSettings.protein > 0 && macroSettings.fat > 0) {
                                            const remainingCals = val - (macroSettings.protein * 4) - (macroSettings.fat * 9);
                                            newSettings.carbs = Math.max(0, Math.round(remainingCals / 4));
                                        }
                                        setMacroSettings(newSettings);
                                    }}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-main/5 focus:border-primary outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-blue-400 uppercase">Proteína (g)</label>
                                <input 
                                    type="number" 
                                    value={macroSettings.protein || ''}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const newSettings = {...macroSettings, protein: val};
                                        // Recalcula carbo se as outras metas estiverem definidas
                                        if (macroSettings.calories > 0 && macroSettings.fat > 0) {
                                            const remainingCals = macroSettings.calories - (val * 4) - (macroSettings.fat * 9);
                                            newSettings.carbs = Math.max(0, Math.round(remainingCals / 4));
                                        }
                                        setMacroSettings(newSettings);
                                    }}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-blue-500/20 focus:border-blue-500 outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-primary uppercase">% Gordura (BF)</label>
                                <input 
                                    type="number" 
                                    value={macroSettings.bodyFat || ''}
                                    onChange={(e) => {
                                        const newSettings = {...macroSettings, bodyFat: Number(e.target.value)};
                                        setMacroSettings(autoCalculateMacros(newSettings));
                                    }}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-primary/20 focus:border-primary outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-primary uppercase">Fator de Atividade (FA)</label>
                                <select 
                                    value={macroSettings.activityFactor}
                                    onChange={(e) => {
                                        const newSettings = {...macroSettings, activityFactor: Number(e.target.value)};
                                        setMacroSettings(autoCalculateMacros(newSettings));
                                    }}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-primary/20 focus:border-primary outline-none text-sm font-bold appearance-none"
                                >
                                    <option value={0}>Automático (Auto-Detecção)</option>
                                    <option value={1.2}>Sedentário (1.2)</option>
                                    <option value={1.375}>Levemente Ativo (1.375)</option>
                                    <option value={1.55}>Moderadamente Ativo (1.55)</option>
                                    <option value={1.725}>Muito Ativo (1.725)</option>
                                    <option value={1.9}>Extremamente Ativo (1.9)</option>
                                </select>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <label className="text-[10px] font-bold text-blue-400 uppercase">Mult. Proteína (g/kg)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={macroSettings.proteinMultiplier || ''}
                                        onChange={(e) => {
                                            const newSettings = {...macroSettings, proteinMultiplier: Number(e.target.value)};
                                            setMacroSettings(autoCalculateMacros(newSettings));
                                        }}
                                        placeholder="Ex: 2.2"
                                        className="flex-1 bg-main/5 rounded-lg p-3 text-main border border-blue-500/20 focus:border-blue-500 outline-none text-sm font-bold"
                                    />
                                </div>
                                <p className="text-[8px] text-muted-foreground mt-0.5">Se BF existir, aplica sobre Massa Magra. Se não, sobre Peso Total. Deixa 0 para Automático.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-orange-400 uppercase">Carboidrato (g)</label>
                                <input 
                                    type="number" 
                                    value={macroSettings.carbs || ''}
                                    onChange={(e) => setMacroSettings({...macroSettings, carbs: Number(e.target.value)})}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-orange-500/20 focus:border-orange-500 outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-yellow-400 uppercase">Gordura (g)</label>
                                <input 
                                    type="number" 
                                    value={macroSettings.fat || ''}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const newSettings = {...macroSettings, fat: val};
                                        // Recalcula carbo se as outras metas estiverem definidas
                                        if (macroSettings.calories > 0 && macroSettings.protein > 0) {
                                            const remainingCals = macroSettings.calories - (macroSettings.protein * 4) - (val * 9);
                                            newSettings.carbs = Math.max(0, Math.round(remainingCals / 4));
                                        }
                                        setMacroSettings(newSettings);
                                    }}
                                    className="w-full bg-main/5 rounded-lg p-3 text-main border border-yellow-500/20 focus:border-yellow-500 outline-none text-sm font-bold"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={isSavingSettings}
                            className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:brightness-110 flex items-center justify-center gap-2 mt-2"
                        >
                            {isSavingSettings ? 'A guardar...' : 'Guardar Metas'}
                        </button>

                        <div className="border-t border-main/5 pt-4 mt-2">
                            {deleteDietStep === 'IDLE' ? (
                                <button 
                                    onClick={() => setDeleteDietStep('CONFIRM')}
                                    className="w-full border border-red-500/30 text-red-500 font-bold py-3 rounded-xl hover:bg-red-500/10 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">delete_forever</span>
                                    Apagar Plano
                                </button>
                            ) : (
                                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                                    <p className="text-red-400 font-bold text-center text-xs">Tens a certeza? Isto apagará todas as refeições.</p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setDeleteDietStep('IDLE')}
                                            className="flex-1 bg-main/5 hover:bg-main/10 text-main font-bold py-3 rounded-xl"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={handleDeleteDiet}
                                            className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600"
                                        >
                                            Sim, Apagar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* CUSTOM MEAL NAME MODAL */}
        {showCustomMealModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-surface w-full max-w-xs rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-main">Nome da Refeição</h3>
                        <button onClick={() => setShowCustomMealModal(false)} className="text-muted hover:text-main">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            value={customMealName}
                            onChange={(e) => setCustomMealName(e.target.value)}
                            placeholder="Ex: Refeição Livre"
                            className="w-full bg-main/5 rounded-xl p-3 text-main border border-main/5 focus:border-primary outline-none transition-all"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomMeal()}
                        />
                        <button 
                            onClick={handleAddCustomMeal}
                            className="w-full bg-primary text-background font-bold py-3 rounded-xl hover:brightness-110 flex items-center justify-center"
                        >
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ADD ITEM MODAL */}
        {showItemModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
                <div className="bg-surface w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col">
                    <div className="p-4 border-b border-main/5 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-main">Adicionar Item</h2>
                        <button onClick={() => setShowItemModal(false)} className="text-muted hover:text-main">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div className="p-5 space-y-5 overflow-y-auto">
                        {/* Food Bank Selection */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-muted uppercase">Banco de Alimentos</label>
                                <button 
                                    className="text-[10px] text-primary cursor-pointer hover:underline outline-none focus:text-main" 
                                    onClick={() => {
                                        if (bankSearch) {
                                            setBankSearch('');
                                        } else {
                                            setIsBankExpanded(!isBankExpanded);
                                        }
                                    }}
                                >
                                    {bankSearch ? 'Limpar filtro' : (isBankExpanded ? 'Recolher' : 'Ver todos')}
                                </button>
                            </div>
                            
                            <div className="relative mb-2">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted material-symbols-outlined text-sm">search</span>
                                <input 
                                    type="text" 
                                    placeholder="Filtrar..." 
                                    value={bankSearch}
                                    onChange={(e) => setBankSearch(e.target.value)}
                                    className="w-full bg-main/5 rounded-lg pl-9 pr-3 py-2 text-xs text-main border border-main/5 focus:border-primary outline-none"
                                />
                            </div>

                            <div className={`flex flex-wrap gap-2 overflow-y-auto custom-scrollbar content-start transition-all duration-300 ${isBankExpanded ? 'max-h-60' : 'max-h-32'}`}>
                                {filteredBank.map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => setNewItem({ ...newItem, name: item.name, emoji: item.emoji })}
                                        className="flex items-center gap-2 bg-main/5 hover:bg-main/10 border border-main/5 rounded-lg px-2 py-1.5 transition-colors group"
                                    >
                                        <span className="text-lg">{item.emoji}</span>
                                        <span className="text-xs text-muted-foreground group-hover:text-main">{item.name}</span>
                                    </button>
                                ))}
                                {filteredBank.length === 0 && (
                                    <p className="text-xs text-muted w-full text-center py-2">Nenhum item encontrado no banco.</p>
                                )}
                            </div>
                        </div>

                        <div className="h-px bg-main/5"></div>

                        {/* Manual Entry */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted uppercase ml-1">Alimento</label>
                                <input 
                                    type="text" 
                                    value={newItem.name}
                                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                                    className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none transition-all placeholder:text-zinc-600"
                                    placeholder="Ex: Peito de Frango, Arroz..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted uppercase ml-1">Quantidade / Porção</label>
                                <input 
                                    type="text" 
                                    value={newItem.quantity}
                                    onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                                    className="w-full bg-main/5 rounded-xl p-4 text-main border border-main/5 focus:border-primary outline-none"
                                    placeholder="Ex: 150g, 1 colher, à vontade..."
                                />
                            </div>

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
                        </div>
                    </div>

                    <div className="p-4 border-t border-main/5 bg-surface sm:rounded-b-3xl space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <input 
                                type="checkbox" 
                                id="saveToBank"
                                checked={saveToBank}
                                onChange={(e) => setSaveToBank(e.target.checked)}
                                className="w-4 h-4 rounded border-zinc-400 dark:border-zinc-600 bg-main/5 text-primary focus:ring-primary focus:ring-offset-0"
                            />
                            <label htmlFor="saveToBank" className="text-xs text-muted select-none cursor-pointer">Guardar alimento no banco de dados para usar depois</label>
                        </div>

                        <button 
                            onClick={handleAddItem}
                            disabled={!newItem.name || isSavingItem}
                            className="w-full h-12 rounded-xl bg-primary text-background font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                        >
                            {isSavingItem ? 'A guardar...' : 'Adicionar ao Plano'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* DELETE CONFIRMATION MODAL (ITEM) */}
        {itemToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                     <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                        <span className="material-symbols-outlined text-3xl">delete</span>
                     </div>
                     <h3 className="text-xl font-bold text-main mb-2">Remover Alimento?</h3>
                     <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                        Tens a certeza que desejas remover este item da refeição?
                     </p>
                     
                     <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setItemToDelete(null)}
                            className="flex-1 h-12 rounded-xl bg-main/5 hover:bg-main/10 text-main font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmRemoveItem}
                            className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold transition-all shadow-lg shadow-red-500/20"
                        >
                            Remover
                        </button>
                     </div>
                  </div>
               </div>
            </div>
        )}

        {/* DELETE CONFIRMATION MODAL (MEAL) */}
        {mealToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                     <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500">
                        <span className="material-symbols-outlined text-3xl">delete</span>
                     </div>
                     <h3 className="text-xl font-bold text-main mb-2">Remover Refeição?</h3>
                     <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                        Tens a certeza que desejas remover esta refeição?
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
    </div>
  );
}
