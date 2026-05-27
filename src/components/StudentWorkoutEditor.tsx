import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, X, Trash2, Edit, Save } from 'lucide-react';
import { db, APP_ID } from '../lib/firebase';
import { collection, onSnapshot, query, doc, addDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { WorkoutSession, UserProfile, Exercicio } from '../types';

export function StudentWorkoutEditor({ studentId, onBack }: { studentId: string, onBack?: () => void }) {
    const [sessions, setSessions] = useState<WorkoutSession[]>([]);
    const [exercisesLib, setExercisesLib] = useState<Exercicio[]>([]);
    const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);

    useEffect(() => {
        const path = `artifacts/${APP_ID}/public/data/treinos_assigned`;
        const q = query(collection(db, path), where('assignedStudentId', '==', studentId));
        const unsub = onSnapshot(q, (snap) => {
            const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutSession));
            loaded.sort((a,b) => (a.title || '').localeCompare(b.title || ''));
            setSessions(loaded);
        });
        
        const exPath = `artifacts/${APP_ID}/public/data/exercicios`;
        const unsubEx = onSnapshot(collection(db, exPath), (snap) => {
            setExercisesLib(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercicio)));
        });

        return () => { unsub(); unsubEx(); };
    }, [studentId]);

    const addSession = async () => {
        const title = prompt("Nome da Sessão (Ex: Treino A)");
        if (!title) return;
        const path = `artifacts/${APP_ID}/public/data/treinos_assigned`;
        await addDoc(collection(db, path), {
            title,
            description: "Personalizado",
            exercises: [],
            completed: false,
            durationSeconds: 0,
            assignedStudentId: studentId,
            date: new Date().toISOString()
        });
    };

    const deleteSession = async (id: string) => {
        if (!confirm("Apagar sessão de treino?")) return;
        await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/treinos_assigned`, id));
    };

    if (selectedSession) {
        return <SessionEditor session={selectedSession} exercisesLib={exercisesLib} onBack={() => setSelectedSession(null)} />;
    }

    return (
        <div className="space-y-6 animate-in fade-in pb-12">
            <div className="flex justify-between items-center bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
                <div>
                    <h3 className="font-black text-[#004D71] uppercase text-xl">Plano do Aluno</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gerir sessões de treino</p>
                </div>
                <button onClick={addSession} className="bg-[#004D71] text-[#F7B500] p-3 rounded-2xl shadow-lg active:scale-95 transition-all">
                    <Plus size={20}/>
                </button>
            </div>

            <div className="space-y-4">
                {sessions.length === 0 ? (
                    <div className="text-center py-12">
                        <Dumbbell size={40} className="mx-auto text-slate-200 mb-4" />
                        <p className="font-black text-slate-400 uppercase text-xs">Sem treinos atribuídos</p>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div key={session.id} className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5 flex justify-between items-center group">
                            <div>
                                <h4 className="font-black text-[#004D71] uppercase text-lg">{session.title}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    {session.exercises?.length || 0} exercícios
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedSession(session)} className="bg-slate-50 text-[#004D71] p-3 rounded-xl hover:bg-slate-100"><Edit size={16}/></button>
                                <button onClick={() => deleteSession(session.id!)} className="bg-red-50 text-red-400 p-3 rounded-xl hover:bg-red-100"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function SessionEditor({ session, exercisesLib, onBack }: { session: WorkoutSession, exercisesLib: any[], onBack: () => void }) {
    const [exercises, setExercises] = useState<any[]>(session.exercises || []);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/treinos_assigned`, session.id!), {
            exercises
        });
        setSaving(false);
        onBack();
    };

    const addExercise = () => {
        const name = prompt("Nome do exercício:");
        if (!name) return;
        setExercises([...exercises, {
            name,
            sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }]
        }]);
    };

    const removeExercise = (idx: number) => {
        if (!confirm("Remover exercício?")) return;
        setExercises(exercises.filter((_, i) => i !== idx));
    };

    const updateSet = (exIdx: number, setIdx: number, field: string, val: number) => {
        const newExs = [...exercises];
        newExs[exIdx].sets[setIdx][field] = val;
        setExercises(newExs);
    };

    const addSet = (exIdx: number) => {
        const newExs = [...exercises];
        newExs[exIdx].sets.push({ reps: 10, weight: 0 });
        setExercises(newExs);
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        const newExs = [...exercises];
        newExs[exIdx].sets.splice(setIdx, 1);
        setExercises(newExs);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white rounded-[2.5rem] p-6 border-4 border-[#004D71]/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-[#004D71]"><X size={18}/></button>
                    <div>
                        <h3 className="font-black text-[#004D71] uppercase text-xl">{session.title}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Editar Exercícios</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={addExercise} className="bg-[#004D71]/5 text-[#004D71] px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-[#004D71]/10">
                        <Plus size={14}/> Exercício
                    </button>
                    <button onClick={save} disabled={saving} className="bg-[#004D71] text-[#F7B500] px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg disabled:opacity-50">
                        <Save size={14}/> {saving ? 'A Guardar...' : 'Guardar'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="bg-white rounded-[2rem] p-6 border-4 border-[#004D71]/5">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-black text-[#004D71] uppercase text-sm">{eIdx + 1}. {ex.name}</h4>
                            <button onClick={() => removeExercise(eIdx)} className="text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                        
                        <div className="space-y-2">
                            {ex.sets?.map((set: any, sIdx: number) => (
                                <div key={sIdx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border-2 border-slate-100">
                                    <span className="w-5 text-[9px] font-black text-slate-300 text-center">#{sIdx + 1}</span>
                                    <div className="flex-1 flex gap-2">
                                        <div className="flex-1 flex items-center bg-white rounded-lg px-3 border border-slate-100">
                                            <input type="number" value={set.reps || 0} onChange={e => updateSet(eIdx, sIdx, 'reps', parseInt(e.target.value))} className="w-full bg-transparent text-center font-black text-[#004D71] text-xs py-2 outline-none" />
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reps</span>
                                        </div>
                                        <div className="flex-1 flex items-center bg-white rounded-lg px-3 border border-slate-100">
                                            <input type="number" value={set.weight || 0} onChange={e => updateSet(eIdx, sIdx, 'weight', parseInt(e.target.value))} className="w-full bg-transparent text-center font-black text-[#004D71] text-xs py-2 outline-none" />
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kg</span>
                                        </div>
                                    </div>
                                    <button onClick={() => removeSet(eIdx, sIdx)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => addSet(eIdx)} className="w-full mt-3 bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-[#004D71] hover:border-[#004D71]/20 transition-all flex justify-center items-center gap-2">
                            <Plus size={14}/> Adicionar Série
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
