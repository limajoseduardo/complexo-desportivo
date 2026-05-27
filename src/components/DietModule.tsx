import React, { useState, useEffect } from 'react';
import { Apple, Plus, Search, Trash2, Edit, X, Save, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc, where, orderBy, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';

interface FoodItem {
    id?: string;
    name: string;
    emoji: string;
}

export function DietModule({ user, utentes }: { user: UserProfile, utentes: UserProfile[] }) {
    const [activeTab, setActiveTab] = useState<'bank' | 'editor'>('bank');

    return (
        <div className="space-y-6 animate-in fade-in pb-24 text-left font-sans">
            {['admin', 'staff', 'professor'].includes(user.role) && (
                <div className="bg-white rounded-[2.5rem] p-4 flex gap-2 border-4 border-[#004D71]/5 sticky top-0 z-10">
                    <button 
                    onClick={() => setActiveTab('bank')}
                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'bank' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                    <Apple size={18}/> Banco Alimentos
                    </button>
                    <button 
                    onClick={() => setActiveTab('editor')}
                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'editor' ? 'bg-[#004D71] text-[#F7B500] shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                    <Edit size={18}/> Dietas Alunos
                    </button>
                </div>
            )}

            {['admin', 'staff', 'professor'].includes(user.role) ? (
                <>
                    {activeTab === 'bank' && <FoodBankTab user={user} />}
                    {activeTab === 'editor' && <DietEditorTab user={user} utentes={utentes} />}
                </>
            ) : (
                <StudentDietTab user={user} />
            )}
        </div>
    );
}

const FOOD_EMOJIS = ['🍗', '🥩', '🥚', '🐟', '🥗', '🥦', '🥕', '🍎', '🍌', '🥛', '🍚', '🍝', '🥪', '🥣', '🥜', '🥑', '🧀'];

function FoodBankTab({ user }: { user: UserProfile }) {
    const [foods, setFoods] = useState<FoodItem[]>([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', emoji: '🍎' });

    useEffect(() => {
        const path = `artifacts/${APP_ID}/public/data/food_library`;
        const unsub = onSnapshot(collection(db, path), (snap) => {
            setFoods(snap.docs.map(d => ({ id: d.id, ...d.data() } as FoodItem)));
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!formData.name) return;
        const path = `artifacts/${APP_ID}/public/data/food_library`;
        if (editingId) {
            await updateDoc(doc(db, path, editingId), formData);
        } else {
            await addDoc(collection(db, path), formData);
        }
        setShowModal(false);
        setEditingId(null);
        setFormData({ name: '', emoji: '🍎' });
    };

    const handleDelete = async (id: string) => {
        if (confirm("Remover alimento?")) {
            await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/food_library`, id));
        }
    };

    const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            {['admin', 'staff', 'professor'].includes(user.role) && (
                <div className="flex justify-between items-center px-2">
                    <div>
                        <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter">Banco de Alimentos</h2>
                    </div>
                    <button onClick={() => {setEditingId(null); setFormData({name:'', emoji:'🍎'}); setShowModal(true);}} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
                        <Plus size={20}/>
                    </button>
                </div>
            )}

            <div className="bg-white rounded-3xl p-2 border-4 border-[#004D71]/5 flex items-center pr-4 shadow-sm focus-within:border-[#F7B500]/50 transition-colors">
                <div className="w-12 h-12 flex items-center justify-center text-slate-300"><Search size={20}/></div>
                <input 
                    type="text" 
                    placeholder="Procurar alimento..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none font-black text-[#004D71] uppercase text-xs placeholder:text-slate-300"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filtered.map(food => (
                    <div key={food.id} className="bg-white rounded-[2rem] p-4 border-4 border-[#004D71]/5 flex flex-col items-center justify-center text-center relative group hover:border-[#004D71]/20 transition-all">
                        {['admin', 'staff', 'professor'].includes(user.role) && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => {setEditingId(food.id!); setFormData(food); setShowModal(true);}} className="p-2 text-slate-400 hover:text-[#004D71]"><Edit size={14}/></button>
                                <button onClick={() => handleDelete(food.id!)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        )}
                        <span className="text-4xl mb-2">{food.emoji}</span>
                        <h4 className="font-black text-[#004D71] uppercase text-xs leading-tight">{food.name}</h4>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
                        <button onClick={() => setShowModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
                        <h3 className="font-black text-[#004D71] uppercase text-xl mb-6">{editingId ? 'Editar Alimento' : 'Novo Alimento'}</h3>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Nome</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none focus:border-[#F7B500]/50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-1">Ícone (Emoji)</label>
                                <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2 rounded-2xl max-h-40 overflow-y-auto">
                                    {FOOD_EMOJIS.map(e => (
                                        <button key={e} onClick={() => setFormData({...formData, emoji: e})} className={`text-2xl p-2 rounded-xl transition-all ${formData.emoji === e ? 'bg-[#004D71] shadow-md scale-110' : 'hover:bg-slate-200'}`}>{e}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSave} className="w-full bg-[#004D71] text-[#F7B500] p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex justify-center">
                            Gravar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function DietEditorTab({ user, utentes }: { user: UserProfile, utentes: UserProfile[] }) {
    const [selectedUtente, setSelectedUtente] = useState<string>('');
    const [meals, setMeals] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // States for Adding meals and items
    const [showMealModal, setShowMealModal] = useState(false);
    const [mealName, setMealName] = useState('');
    const [showItemModal, setShowItemModal] = useState(false);
    const [targetMeal, setTargetMeal] = useState<string | null>(null);
    const [itemData, setItemData] = useState({ name: '', quantity: '', emoji: '🍎' });
    const [bankFoods, setBankFoods] = useState<FoodItem[]>([]);

    useEffect(() => {
        const path = `artifacts/${APP_ID}/public/data/food_library`;
        const unsub = onSnapshot(collection(db, path), (snap) => {
            setBankFoods(snap.docs.map(d => ({ id: d.id, ...d.data() } as FoodItem)));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!selectedUtente) {
            setMeals([]);
            return;
        }
        const path = `artifacts/${APP_ID}/public/data/diet_meals`;
        const q = query(collection(db, path), where('student_id', '==', selectedUtente), where('day_of_week', '==', selectedDay));
        const unsub = onSnapshot(q, async (snap) => {
            const loadedMeals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Load items for each meal
            const mealsWithItems = await Promise.all(loadedMeals.map(async (m: any) => {
                const itemsSnap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public/data', 'diet_items'), where('meal_id', '==', m.id)));
                return { ...m, items: itemsSnap.docs.map(i => ({ id: i.id, ...i.data() })) };
            }));
            
            setMeals(mealsWithItems.sort((a,b) => (a.order_index || 0) - (b.order_index || 0)));
        });
        return () => unsub();
    }, [selectedUtente, selectedDay]);

    const handleAddMeal = async () => {
        if (!mealName || !selectedUtente) return;
        const newOrder = meals.length > 0 ? meals[meals.length - 1].order_index + 10 : 10;
        await addDoc(collection(db, `artifacts/${APP_ID}/public/data/diet_meals`), {
            student_id: selectedUtente,
            name: mealName,
            day_of_week: selectedDay,
            order_index: newOrder
        });
        setShowMealModal(false);
        setMealName('');
    };

    const handleDeleteMeal = async (id: string) => {
        if (confirm("Apagar refeição?")) {
            await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/diet_meals`, id));
        }
    };

    const handleAddItem = async () => {
        if (!targetMeal || !itemData.name) return;
        await addDoc(collection(db, `artifacts/${APP_ID}/public/data/diet_items`), {
            meal_id: targetMeal,
            name: itemData.name,
            quantity: itemData.quantity,
            emoji: itemData.emoji
        });
        setShowItemModal(false);
        setItemData({ name: '', quantity: '', emoji: '🍎' });
        
        // Force refresh by toggling day slightly hacky but works for now
        setSelectedDay(selectedDay); 
    };

    const handleDeleteItem = async (id: string) => {
        await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/diet_items`, id));
    };

    const copyToAllDays = async () => {
        if (!selectedUtente || meals.length === 0) return;
        if (!confirm("Copiar dieta de " + DAYS[selectedDay] + " para todos os outros dias?")) return;
        
        try {
            // Delete existing meals for other days
            const allMealsSnap = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/diet_meals`), where('student_id', '==', selectedUtente)));
            const batchDeletes = allMealsSnap.docs.filter(d => d.data().day_of_week !== selectedDay).map(d => deleteDoc(d.ref));
            await Promise.all(batchDeletes);

            // Copy meals
            for (let d = 0; d < 7; d++) {
                if (d === selectedDay) continue;
                for (const meal of meals) {
                    const newMealRef = await addDoc(collection(db, `artifacts/${APP_ID}/public/data/diet_meals`), {
                        student_id: selectedUtente,
                        name: meal.name,
                        day_of_week: d,
                        order_index: meal.order_index
                    });
                    
                    for (const item of meal.items) {
                        await addDoc(collection(db, `artifacts/${APP_ID}/public/data/diet_items`), {
                            meal_id: newMealRef.id,
                            name: item.name,
                            quantity: item.quantity,
                            emoji: item.emoji
                        });
                    }
                }
            }
            alert("Dieta copiada para todos os dias!");
        } catch (e) {
            console.error(e);
            alert("Erro ao copiar.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-2">Selecionar Aluno</label>
                <select value={selectedUtente} onChange={e => setSelectedUtente(e.target.value)} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-sm uppercase text-[#004D71] outline-none appearance-none">
                    <option value="">-- Escolha um Aluno --</option>
                    {utentes.map(u => <option key={u.id} value={u.id}>{u.nome || u.n}</option>)}
                </select>
            </div>

            {selectedUtente && (
                <>
                    <div className="bg-white rounded-3xl p-2 border-4 border-[#004D71]/5 flex gap-1 overflow-x-auto no-scrollbar">
                        {DAYS.map((day, idx) => (
                            <button key={day} onClick={() => setSelectedDay(idx)} className={`flex-1 min-w-[48px] py-3 rounded-2xl font-black text-xs uppercase transition-all ${selectedDay === idx ? 'bg-[#004D71] text-[#F7B500] shadow-md scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
                                {day}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-between items-center px-2">
                        <button onClick={copyToAllDays} className="text-[10px] font-black uppercase text-[#004D71] flex items-center gap-1 opacity-60 hover:opacity-100">
                            <Copy size={12}/> Copiar para a semana toda
                        </button>
                        <button onClick={() => setShowMealModal(true)} className="bg-blue-50 text-[#004D71] px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1 hover:bg-blue-100">
                            <Plus size={14}/> Nova Refeição
                        </button>
                    </div>

                    <div className="space-y-4">
                        {meals.map(meal => (
                            <div key={meal.id} className="bg-white rounded-[2rem] p-5 border-4 border-[#004D71]/5">
                                <div className="flex justify-between items-center mb-4 border-b-2 border-slate-50 pb-3">
                                    <h3 className="font-black text-[#004D71] uppercase text-sm">{meal.name}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setTargetMeal(meal.id); setShowItemModal(true);}} className="text-[#004D71] bg-slate-50 p-2 rounded-lg hover:bg-slate-100"><Plus size={16}/></button>
                                        <button onClick={() => handleDeleteMeal(meal.id)} className="text-red-400 bg-red-50 p-2 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {meal.items?.length === 0 ? (
                                        <p className="text-[10px] font-black text-slate-300 uppercase text-center py-2">Sem alimentos nesta refeição</p>
                                    ) : (
                                        meal.items?.map((item: any) => (
                                            <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border-2 border-slate-100 group">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{item.emoji || '🍽️'}</span>
                                                    <div>
                                                        <h4 className="font-black text-[#004D71] uppercase text-[11px]">{item.name}</h4>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase">{item.quantity || 'À vontade'}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                        {meals.length === 0 && (
                            <div className="text-center py-12 border-4 border-dashed border-[#004D71]/10 rounded-[2.5rem]">
                                <Apple size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Ainda não existem refeições criadas.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Modals */}
            {showMealModal && (
                <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
                        <button onClick={() => setShowMealModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
                        <h3 className="font-black text-[#004D71] uppercase text-xl mb-4">Nova Refeição</h3>
                        <input type="text" placeholder="Ex: Pequeno-Almoço" value={mealName} onChange={e => setMealName(e.target.value)} className="w-full bg-slate-50 border-4 border-[#004D71]/5 rounded-2xl p-4 font-black text-xs uppercase text-[#004D71] outline-none mb-6" />
                        <button onClick={handleAddMeal} className="w-full bg-[#004D71] text-[#F7B500] p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg">Adicionar Refeição</button>
                    </div>
                </div>
            )}

            {showItemModal && (
                <div className="fixed inset-0 z-[10000] bg-[#004D71]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl h-[80vh] flex flex-col">
                        <button onClick={() => setShowItemModal(false)} className="absolute -top-4 -right-4 p-4 bg-white text-slate-400 rounded-2xl shadow-xl"><X size={20}/></button>
                        <h3 className="font-black text-[#004D71] uppercase text-xl mb-4 shrink-0">Adicionar Alimento</h3>
                        
                        <div className="overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar flex-1">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nome</label>
                                <input type="text" value={itemData.name} onChange={e => setItemData({...itemData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-[#004D71]/5 rounded-xl p-3 font-black text-[11px] uppercase" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Quantidade</label>
                                <input type="text" placeholder="Ex: 100g, 2 colheres" value={itemData.quantity} onChange={e => setItemData({...itemData, quantity: e.target.value})} className="w-full bg-slate-50 border-2 border-[#004D71]/5 rounded-xl p-3 font-black text-[11px] uppercase" />
                            </div>
                            
                            <div className="border-t-2 border-slate-50 pt-4 mt-4">
                                <label className="text-[10px] font-black text-[#004D71] uppercase block mb-2">Ou escolha do Banco:</label>
                                <div className="space-y-2">
                                    {bankFoods.map(bf => (
                                        <button key={bf.id} onClick={() => setItemData({ name: bf.name, quantity: itemData.quantity, emoji: bf.emoji })} className="w-full bg-slate-50 p-3 rounded-xl border-2 border-transparent hover:border-[#004D71]/20 flex items-center gap-2 text-left transition-all">
                                            <span className="text-xl">{bf.emoji}</span>
                                            <span className="font-black text-[#004D71] uppercase text-[10px]">{bf.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleAddItem} className="w-full bg-[#F7B500] text-[#004D71] p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shrink-0">Adicionar</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StudentDietTab({ user }: { user: UserProfile }) {
    const [meals, setMeals] = useState<any[]>([]);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        setLoading(true);
        const path = `artifacts/${APP_ID}/public/data/diet_meals`;
        const q = query(collection(db, path), where('student_id', '==', user.id), where('day_of_week', '==', selectedDay));
        const unsub = onSnapshot(q, async (snap) => {
            const loadedMeals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Load items for each meal
            const mealsWithItems = await Promise.all(loadedMeals.map(async (m: any) => {
                const itemsSnap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public/data', 'diet_items'), where('meal_id', '==', m.id)));
                return { ...m, items: itemsSnap.docs.map(i => ({ id: i.id, ...i.data() })) };
            }));
            
            setMeals(mealsWithItems.sort((a,b) => (a.order_index || 0) - (b.order_index || 0)));
            setLoading(false);
        });
        return () => unsub();
    }, [user.id, selectedDay]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm text-center">
                <div className="w-16 h-16 bg-[#004D71]/5 text-[#004D71] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Apple size={32} />
                </div>
                <h3 className="font-black text-[#004D71] uppercase text-2xl">O Teu Plano Alimentar</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Consulta as tuas refeições diárias prescritas pelo PT</p>
            </div>

            <div className="bg-white rounded-3xl p-2 border-4 border-[#004D71]/5 flex gap-1 overflow-x-auto no-scrollbar">
                {DAYS.map((day, idx) => (
                    <button key={day} onClick={() => setSelectedDay(idx)} className={`flex-1 min-w-[48px] py-3 rounded-2xl font-black text-xs uppercase transition-all ${selectedDay === idx ? 'bg-[#004D71] text-[#F7B500] shadow-md scale-105' : 'text-slate-400 hover:bg-slate-50'}`}>
                        {day}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Metas Diárias Calculadas</p>
                <div className="flex justify-center gap-8 w-full">
                    <div className="text-center">
                        <p className="text-xl font-black text-[#004D71]">{Math.round((user.weight || 70) * 2.2)}g</p>
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Proteína</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-black text-[#004D71]">{Math.round((user.weight || 70) * 1)}g</p>
                        <p className="text-[8px] font-black text-yellow-400 uppercase tracking-widest">Gordura</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-black text-[#004D71]">{Math.round((user.weight || 70) * 4)}g</p>
                        <p className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Carbo</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-[#004D71] font-black text-xs uppercase animate-pulse">A carregar plano...</div>
                ) : meals.length === 0 ? (
                    <div className="text-center py-12 border-4 border-dashed border-[#004D71]/10 rounded-[2.5rem]">
                        <Apple size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Ainda não tens refeições para hoje.</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-2">Pede ao teu PT para criar a tua dieta.</p>
                    </div>
                ) : (
                    meals.map(meal => (
                        <div key={meal.id} className="bg-white rounded-[2rem] p-5 border-4 border-[#004D71]/5">
                            <div className="flex justify-between items-center mb-4 border-b-2 border-slate-50 pb-3">
                                <h3 className="font-black text-[#004D71] uppercase text-sm">{meal.name}</h3>
                            </div>
                            <div className="space-y-2">
                                {meal.items?.length === 0 ? (
                                    <p className="text-[10px] font-black text-slate-300 uppercase text-center py-2">Sem alimentos nesta refeição</p>
                                ) : (
                                    meal.items?.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border-2 border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{item.emoji || '🍽️'}</span>
                                                <div>
                                                    <h4 className="font-black text-[#004D71] uppercase text-[11px]">{item.name}</h4>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{item.quantity || 'À vontade'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
