import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Trash2, X, Save, Clock, Check, FileText, Search, UserMinus, UserPlus, Award, GraduationCap, Edit } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { APP_ID } from '../App';
import { AvatarImage } from './Common';
import { jsPDF } from 'jspdf';
import { 
  collection, onSnapshot, query, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, Timestamp, writeBatch 
} from 'firebase/firestore';
import { UserProfile } from '../types';

interface Evento {
  id: string;
  titulo: string;
  data: string;
  hora: string;
  local: string;
  descricao: string;
  maxParticipantes?: number;
  inscritos: { id: string; nome: string; email: string; dataInscricao: string; provas: string[] }[];
  professoresAcompanhantes?: string[]; // Up to 5 teachers
  criadoPor: string;
  criadoEm: any;
  regulamentoUrl?: string;
  tempos?: Record<string, Record<string, string>>; // utenteId -> estilo -> tempo
  heats?: Record<string, Record<string, { serie: number; pista: number }>>; // utenteId -> estilo -> { serie, pista }
}

interface EventsModuleProps {
  user: UserProfile;
  utentes: UserProfile[];
}

export function EventsModule({ user, utentes }: EventsModuleProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingInscritos, setViewingInscritos] = useState<Evento | null>(null);
  
  // Search for adding participants manually
  const [searchUtente, setSearchUtente] = useState('');

  // Leaderboard/Times editor state
  const [editingTempos, setEditingTempos] = useState<Evento | null>(null);
  const [temposForm, setTemposForm] = useState<Record<string, Record<string, string>>>({});

  // Heats (Séries) state
  const [viewingHeats, setViewingHeats] = useState<Evento | null>(null);
  const [activeHeatsStyle, setActiveHeatsStyle] = useState<string>('Crawl');

  const openTemposEditor = (evento: Evento) => {
    setEditingTempos(evento);
    setTemposForm(evento.tempos || {});
  };

  const handleSaveTempos = async () => {
    if (!editingTempos) return;
    const path = `artifacts/${APP_ID}/public/data/eventos`;
    try {
      await updateDoc(doc(db, path, editingTempos.id), { tempos: temposForm });
      alert("Tempos e resultados guardados com sucesso!");
      setEditingTempos(null);
    } catch (error) {
      console.error("Erro ao guardar tempos:", error);
      alert("Erro ao guardar os tempos.");
    }
  };

  // Heats (Séries) state & custom editing
  const [isEditingHeats, setIsEditingHeats] = useState(false);
  const [heatsForm, setHeatsForm] = useState<Record<string, Record<string, { serie: number; pista: number }>>>({});

  const openHeatsViewer = (evento: Evento) => {
    setViewingHeats(evento);
    setActiveHeatsStyle('Crawl');
    setIsEditingHeats(false);
    
    const initialHeats: Record<string, Record<string, { serie: number; pista: number }>> = JSON.parse(JSON.stringify(evento.heats || {}));
    
    ESTILOS.forEach(style => {
      const styleAthletes = evento.inscritos.filter(i => i.provas.includes(style));
      styleAthletes.forEach((atleta, index) => {
        if (!initialHeats[atleta.id]) {
          initialHeats[atleta.id] = {};
        }
        if (!initialHeats[atleta.id][style]) {
          initialHeats[atleta.id][style] = {
            serie: Math.floor(index / 6) + 1,
            pista: (index % 6) + 1
          };
        }
      });
    });
    
    setHeatsForm(initialHeats);
  };

  const handleSaveHeats = async () => {
    if (!viewingHeats) return;
    const path = `artifacts/${APP_ID}/public/data/eventos`;
    try {
      await updateDoc(doc(db, path, viewingHeats.id), { heats: heatsForm });
      alert("Séries de partida guardadas com sucesso!");
      setIsEditingHeats(false);
      setViewingHeats(prev => prev ? { ...prev, heats: heatsForm } : null);
    } catch (error) {
      console.error("Erro ao guardar séries:", error);
      alert("Erro ao guardar as séries de partida.");
    }
  };

  const handleResetHeats = async () => {
    if (!viewingHeats) return;
    if (!window.confirm("Deseja restaurar a distribuição automática original para todas as provas? Todas as alterações manuais serão perdidas.")) return;
    const path = `artifacts/${APP_ID}/public/data/eventos`;
    try {
      await updateDoc(doc(db, path, viewingHeats.id), { heats: null });
      alert("Distribuição automática restaurada!");
      setIsEditingHeats(false);
      setHeatsForm({});
      setViewingHeats(prev => prev ? { ...prev, heats: undefined } : null);
    } catch (error) {
      console.error("Erro ao restaurar séries:", error);
      alert("Erro ao restaurar a distribuição automática.");
    }
  };

  const handlePrintHeats = (evento: Evento) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let pageY = 20;
    const marginX = 15;

    const checkPageBreak = (needed: number) => {
      if (pageY + needed > 280) {
        doc.addPage();
        pageY = 20;
        renderHeader();
      }
    };

    const renderHeader = () => {
      doc.setTextColor(0, 77, 113);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text("COMPLEXO DESPORTIVO DE VILA DE REI", marginX, pageY);
      pageY += 6;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`SERIES DE PARTIDA - LISTA DE SAIDA | PROVA: ${evento.titulo.toUpperCase()}`, marginX, pageY);
      pageY += 4;
      doc.text(`Data: ${evento.data}  |  Local: ${evento.local}`, marginX, pageY);
      pageY += 6;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginX, pageY, 210 - marginX, pageY);
      pageY += 10;
    };

    renderHeader();

    ESTILOS.forEach(style => {
      const styleAthletes = evento.inscritos.filter(i => i.provas.includes(style));
      if (styleAthletes.length === 0) return;

      checkPageBreak(25);
      
      doc.setFillColor(0, 77, 113);
      doc.rect(marginX, pageY, 210 - (marginX * 2), 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(style.toUpperCase() + ` (${styleAthletes.length} atletas)`, marginX + 3, pageY + 5.5);
      pageY += 12;

      const heatsMap: Record<number, { pista: number; atleta: any; idade?: string }[]> = {};
      styleAthletes.forEach((atleta, index) => {
        const ut = utentes.find(u => u.id === atleta.id);
        let serie = Math.floor(index / 6) + 1;
        let pista = (index % 6) + 1;
        
        if (evento.heats && evento.heats[atleta.id] && evento.heats[atleta.id][style]) {
          serie = evento.heats[atleta.id][style].serie;
          pista = evento.heats[atleta.id][style].pista;
        }
        
        if (!heatsMap[serie]) {
          heatsMap[serie] = [];
        }
        heatsMap[serie].push({ pista, atleta, idade: ut?.idade });
      });

      const heats = Object.keys(heatsMap).map(k => {
        const id = parseInt(k, 10);
        const lanes = heatsMap[id].sort((a, b) => a.pista - b.pista);
        return { id, lanes };
      }).sort((a, b) => a.id - b.id);

      heats.forEach(heat => {
        checkPageBreak(15 + (heat.lanes.length * 8));

        doc.setTextColor(0, 77, 113);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Serie ${heat.id}`, marginX, pageY);
        pageY += 4;

        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, pageY, 210 - (marginX * 2), 6, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text("Pista", marginX + 3, pageY + 4.5);
        doc.text("Nome do Atleta", marginX + 15, pageY + 4.5);
        doc.text("Idade", marginX + 100, pageY + 4.5);
        doc.text("Email", marginX + 115, pageY + 4.5);
        doc.text("Tempo / Obs", marginX + 160, pageY + 4.5);
        
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageY + 6, 210 - marginX, pageY + 6);
        pageY += 6;

        heat.lanes.forEach(lane => {
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(`P${lane.pista}`, marginX + 3, pageY + 5);
          
          doc.setFont('helvetica', 'normal');
          doc.text(lane.atleta.nome.toUpperCase(), marginX + 15, pageY + 5);
          
          doc.text(lane.idade ? `${lane.idade} a` : "-", marginX + 100, pageY + 5);
          
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(lane.atleta.email, marginX + 115, pageY + 5);
          
          doc.setDrawColor(203, 213, 225);
          doc.line(marginX + 160, pageY + 6, marginX + 178, pageY + 6);

          doc.setDrawColor(241, 245, 249);
          doc.line(marginX, pageY + 7, 210 - marginX, pageY + 7);
          pageY += 7.5;
        });

        pageY += 4;
      });

      pageY += 6;
    });

    doc.save(`series_de_partida_${evento.titulo.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadDiploma = (inscrito: { id: string; nome: string; email: string; provas: string[] }, evento: Evento) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Background color
    doc.setFillColor(253, 251, 247);
    doc.rect(0, 0, 297, 210, 'F');
    
    // Elegant border
    doc.setDrawColor(0, 77, 113);
    doc.setLineWidth(1.5);
    doc.rect(10, 10, 277, 190);
    
    doc.setDrawColor(247, 181, 0);
    doc.setLineWidth(0.5);
    doc.rect(12, 12, 273, 186);

    // Title
    doc.setTextColor(0, 77, 113);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text("COMPLEXO DESPORTIVO DE VILA DE REI", 148, 45, { align: 'center' });
    
    doc.setTextColor(247, 181, 0);
    doc.setFontSize(16);
    doc.text("DIPLOMA DE PARTICIPAÇÃO", 148, 57, { align: 'center' });
    
    doc.setDrawColor(247, 181, 0);
    doc.setLineWidth(1);
    doc.line(110, 65, 187, 65);
    
    // Body
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text("Certificamos com orgulho que o(a) atleta", 148, 85, { align: 'center' });
    
    doc.setTextColor(0, 77, 113);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(inscrito.nome.toUpperCase(), 148, 102, { align: 'center' });
    
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.text(`participou com distinção no "${evento.titulo.toUpperCase()}"`, 148, 118, { align: 'center' });
    
    const provasStr = inscrito.provas.join(', ');
    doc.text(`competindo com dedicação e espírito desportivo nos estilos de: ${provasStr}`, 148, 128, { align: 'center' });
    doc.text(`realizado na Piscina Municipal de Vila de Rei em ${evento.data}.`, 148, 138, { align: 'center' });
    
    // Gold Rosette
    doc.setFillColor(247, 181, 0);
    doc.circle(60, 168, 12, 'F');
    doc.setDrawColor(247, 181, 0);
    doc.setLineWidth(3);
    doc.line(55, 178, 50, 192);
    doc.line(65, 178, 70, 192);
    
    doc.setTextColor(0, 77, 113);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("OFICIAL", 60, 169, { align: 'center' });
    doc.text("VR", 60, 173, { align: 'center' });
    
    // Signature
    doc.setTextColor(0, 77, 113);
    doc.setFontSize(11);
    doc.text("DIREÇÃO TÉCNICA", 220, 165, { align: 'center' });
    doc.setDrawColor(0, 77, 113);
    doc.setLineWidth(0.5);
    doc.line(185, 172, 255, 172);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text("Assinatura Autorizada", 220, 178, { align: 'center' });

    doc.save(`diploma_${inscrito.nome.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  // Styles selection state modal
  const [selectingStyles, setSelectingStyles] = useState<{
    evento: Evento;
    utenteId: string;
    utenteNome: string;
    utenteEmail: string;
    isStaffAction: boolean;
  } | null>(null);

  const [selectedProvas, setSelectedProvas] = useState<Record<string, boolean>>({
    Crawl: false,
    Costas: false,
    Bruços: false,
    Mariposa: false
  });
  
  const [formData, setFormData] = useState({
    titulo: '',
    data: '',
    hora: '',
    local: 'Piscina Municipal de Vila de Rei',
    descricao: '',
    maxParticipantes: '',
    regulamentoUrl: ''
  });

  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  const isStaff = ['admin', 'staff', 'chefia', 'professor'].includes(user.role);

  const ESTILOS = ['Crawl', 'Costas', 'Bruços', 'Mariposa'];

  // Normalized color classes - Using custom CSS classes defined in index.css to ensure perfect rendering
  const STYLE_COLORS: Record<string, string> = {
    crawl: 'badge-crawl',
    costas: 'badge-costas',
    brucos: 'badge-brucos',
    mariposa: 'badge-mariposa'
  };

  const professorsList = React.useMemo(() => {
    return utentes.filter(u => u.role === 'professor');
  }, [utentes]);

  useEffect(() => {
    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const q = query(collection(db, path), orderBy('data', 'asc'));
    
    return onSnapshot(q, (snap) => {
      const list: Evento[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Evento);
      });
      setEventos(list);
      
      // Update viewingInscritos if it's currently open
      if (viewingInscritos) {
        const updated = list.find(e => e.id === viewingInscritos.id);
        if (updated) {
          setViewingInscritos(updated);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Erro ao sincronizar eventos:", error);
      setLoading(false);
    });
  }, [viewingInscritos?.id]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data || !formData.hora || !formData.local) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const path = `artifacts/${APP_ID}/public/data/eventos`;
      const newEvent = {
        titulo: formData.titulo,
        data: formData.data,
        hora: formData.hora,
        local: formData.local,
        descricao: formData.descricao,
        maxParticipantes: formData.maxParticipantes ? Number(formData.maxParticipantes) : undefined,
        inscritos: [],
        professoresAcompanhantes: selectedTeachers,
        criadoPor: user.nome || user.n || 'Staff',
        criadoEm: Timestamp.now(),
        regulamentoUrl: formData.regulamentoUrl || undefined,
        tempos: {}
      };

      await addDoc(collection(db, path), newEvent);
      alert("Evento/Prova criada com sucesso!");
      setShowAddModal(false);
      setFormData({
        titulo: '',
        data: '',
        hora: '',
        local: 'Piscina Municipal de Vila de Rei',
        descricao: '',
        maxParticipantes: '',
        regulamentoUrl: ''
      });
      setSelectedTeachers([]);
    } catch (error) {
      console.error("Erro ao criar evento:", error);
      alert("Erro ao criar o evento. Tente novamente.");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Tem a certeza que deseja eliminar esta prova/evento permanente?")) return;
    try {
      const path = `artifacts/${APP_ID}/public/data/eventos`;
      await deleteDoc(doc(db, path, eventId));
      alert("Evento eliminado.");
    } catch (error) {
      console.error("Erro ao apagar evento:", error);
    }
  };

  // Triggers the styles selection overlay (can be used for new registrations or edits)
  const initiateRegistration = (evento: Evento, isStaffAction: boolean, targetUtente?: UserProfile | { id: string; nome: string; email: string; provas?: string[] }) => {
    const participantId = targetUtente ? targetUtente.id : user.id;
    const participantNome = targetUtente ? (targetUtente.nome || (targetUtente as any).n || 'Utente') : (user.nome || user.n || 'Utente');
    const participantEmail = targetUtente ? targetUtente.email : user.email;
    
    const existingEnrollment = evento.inscritos.find(i => i.id === participantId);

    // Set styling target
    setSelectingStyles({
      evento,
      utenteId: participantId,
      utenteNome: participantNome,
      utenteEmail: participantEmail || '',
      isStaffAction
    });

    // Preset selections if they already have styles chosen
    setSelectedProvas({
      Crawl: existingEnrollment?.provas?.includes('Crawl') || false,
      Costas: existingEnrollment?.provas?.includes('Costas') || false,
      Bruços: existingEnrollment?.provas?.includes('Bruços') || false,
      Mariposa: existingEnrollment?.provas?.includes('Mariposa') || false
    });
  };

  const handleToggleUnsubscribe = async (evento: Evento, participantId: string, participantNome: string) => {
    if (!window.confirm(`Tem a certeza que deseja cancelar a inscrição de ${participantNome.toUpperCase()} nesta prova?`)) return;

    const path = `artifacts/${APP_ID}/public/data/eventos`;
    const newInscritos = evento.inscritos.filter(i => i.id !== participantId);

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      alert("Inscrição cancelada.");
    } catch (error) {
      console.error("Erro ao remover participante:", error);
    }
  };

  // Submit Styles selection to Firestore
  const handleConfirmStyles = async () => {
    if (!selectingStyles) return;

    const chosenStyles = Object.keys(selectedProvas).filter(key => selectedProvas[key]);
    if (chosenStyles.length === 0) {
      alert("Por favor, selecione pelo menos 1 estilo de natação em que o atleta irá participar.");
      return;
    }

    const { evento, utenteId, utenteNome, utenteEmail } = selectingStyles;
    const path = `artifacts/${APP_ID}/public/data/eventos`;

    const wasAlreadyInscrito = evento.inscritos.some(i => i.id === utenteId);

    const newInscritos = [
      ...evento.inscritos.filter(i => i.id !== utenteId),
      {
        id: utenteId,
        nome: utenteNome,
        email: utenteEmail,
        dataInscricao: new Date().toISOString(),
        provas: chosenStyles
      }
    ];

    try {
      await updateDoc(doc(db, path, evento.id), { inscritos: newInscritos });
      alert(`Inscrição de "${utenteNome.toUpperCase()}" guardada com sucesso.`);
      
      // Notify swimming class users
      if (!wasAlreadyInscrito) {
        try {
          const swimmingUtentes = utentes.filter(u => {
            const mod = (u.modalidade || '').toLowerCase();
            return mod.includes('nata') || mod.includes('swimming');
          });

          // Determine notification sender
          const sender = utentes.find(u => ['admin', 'staff', 'chefia', 'professor'].includes(u.role)) || user;
          const estilosStr = chosenStyles.join(', ');
          
          const smsText = `✨ PARABÉNS AO NOSSO ATLETA! ✨\n\nParabéns a ${utenteNome.toUpperCase()} que vai participar na prova "${evento.titulo}" no dia ${evento.data} no local "${evento.local}" onde vai competir nos estilos: ${estilosStr}.\n\nVamos todos apoiar os nossos atletas! 🏊‍♂️👏💪`;

          const batch = writeBatch(db);
          const conversasPath = `artifacts/${APP_ID}/public/data/conversas`;

          swimmingUtentes.forEach(targetUtente => {
            const participants = [sender.id, targetUtente.id].sort();
            const chatId = participants.join('_');
            const msgDocRef = doc(collection(db, conversasPath, chatId, 'messages'));

            batch.set(msgDocRef, {
              senderId: sender.id,
              senderEmail: sender.email || '',
              receiverId: targetUtente.id,
              receiverEmail: targetUtente.email || '',
              participants,
              participantEmails: [sender.email || '', targetUtente.email || ''],
              text: smsText,
              createdAt: Timestamp.now(),
              read: false
            });
          });

          await batch.commit();
        } catch (msgError) {
          console.error("Erro ao enviar mensagens de notificação:", msgError);
        }
      }

      setSelectingStyles(null);
      setSearchUtente('');
    } catch (error) {
      console.error("Erro ao guardar inscrição com provas:", error);
      alert("Ocorreu um erro ao guardar a inscrição.");
    }
  };

  const handleTeacherCheckboxChange = (teacherName: string) => {
    setSelectedTeachers(prev => {
      if (prev.includes(teacherName)) {
        return prev.filter(t => t !== teacherName);
      }
      if (prev.length >= 5) {
        alert("Pode selecionar no máximo 5 professores acompanhantes!");
        return prev;
      }
      return [...prev, teacherName];
    });
  };

  // Filter utentes who are NOT enrolled and match search query
  const searchableUtentes = React.useMemo(() => {
    if (!viewingInscritos || !searchUtente.trim()) return [];
    
    return utentes
      .filter(u => {
        const r = (u.role || '').toLowerCase();
        return !['admin', 'staff', 'chefia', 'professor'].includes(r);
      })
      .filter(u => !viewingInscritos.inscritos.some(i => i.id === u.id))
      .filter(u => (u.nome || u.n || '').toLowerCase().includes(searchUtente.toLowerCase()))
      .slice(0, 5);
  }, [utentes, viewingInscritos, searchUtente]);

  return (
    <div className="space-y-6 animate-in fade-in pb-32 text-left font-sans max-w-full overflow-hidden px-1">
      
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-[#004D71] uppercase tracking-tighter flex items-center gap-3">
            <Trophy size={28} className="text-[#F7B500]"/> Provas e Eventos
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão de Provas de Natação e Atividades CD</p>
        </div>
        {['admin', 'staff', 'chefia'].includes(user.role) && (
          <button 
            onClick={() => { setShowAddModal(true); setSelectedTeachers([]); }}
            className="bg-[#004D71] text-[#F7B500] p-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={20}/>
            <span className="text-[10px] font-black uppercase hidden sm:inline">Criar Prova</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#004D71] font-black text-xs uppercase animate-pulse">A carregar eventos...</div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border-4 border-[#004D71]/5 text-center py-20 text-slate-200">
          <Trophy size={64} className="mx-auto mb-4 opacity-10" />
          <p className="uppercase font-black text-xs tracking-widest text-slate-400">Sem eventos ou provas planeadas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
          {eventos.map(evento => {
            const isRegistered = evento.inscritos.some(i => i.id === user.id);
            const isFull = evento.maxParticipantes ? evento.inscritos.length >= evento.maxParticipantes : false;
            const percent = evento.maxParticipantes ? Math.min(100, (evento.inscritos.length / evento.maxParticipantes) * 100) : 0;

            // Calculate top times per style for podium display
            const styleWinners: { estilo: string; nome: string; tempo: string }[] = [];
            if (evento.tempos) {
              const estilos = ['Crawl', 'Costas', 'Bruços', 'Mariposa'];
              estilos.forEach(estilo => {
                let bestTime: string | null = null;
                let winnerName = '';
                
                evento.inscritos.forEach(i => {
                  const time = evento.tempos?.[i.id]?.[estilo];
                  if (time && time.trim()) {
                    if (bestTime === null || time < bestTime) {
                      bestTime = time;
                      winnerName = i.nome;
                    }
                  }
                });
                
                if (bestTime) {
                  const parts = winnerName.trim().split(/\s+/);
                  const displayName = parts.length <= 2 ? winnerName : `${parts[0]} ${parts[parts.length - 1]}`;
                  styleWinners.push({ estilo, nome: displayName, tempo: bestTime });
                }
              });
            }

            return (
              <div 
                key={evento.id} 
                className="bg-white rounded-[2.5rem] border-4 border-slate-100 shadow-md relative overflow-hidden group hover:border-[#004D71]/20 hover:shadow-xl transition-all flex flex-col justify-between min-h-[460px]"
              >
                {/* Event Hero Header Banner */}
                <div className="bg-gradient-to-br from-[#004D71] to-[#002f47] text-white p-6 relative rounded-t-[2.2rem] shrink-0">
                  {/* Decorative backdrop glow */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,181,0,0.15),transparent_60%)] pointer-events-none" />
                  
                  {/* Date & Time Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-[#F7B500] backdrop-blur-sm rounded-full text-[9px] font-black uppercase tracking-wider mb-4 border border-white/5">
                    <Calendar size={10}/> {evento.data} às {evento.hora}
                  </div>

                  {/* Delete button */}
                  {['admin', 'staff'].includes(user.role) && (
                    <button 
                      onClick={() => handleDeleteEvent(evento.id)}
                      className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-red-500 hover:text-white text-white/60 rounded-xl active:scale-95 transition-all border border-white/5 cursor-pointer z-10"
                      title="Eliminar Evento"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}

                  <h3 className="text-lg font-black text-white uppercase leading-tight tracking-tight mt-1 pr-6 drop-shadow-sm">
                    {evento.titulo}
                  </h3>
                </div>

                {/* Event Content Body */}
                <div className="p-6 flex-1 flex flex-col justify-between gap-6">
                  <div>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed mb-4">
                      {evento.descricao || 'Sem descrição detalhada.'}
                    </p>

                    {/* Metadata fields */}
                    <div className="space-y-2.5 text-xs font-black text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 text-[#F7B500] flex items-center justify-center shrink-0">
                          <MapPin size={12}/>
                        </div>
                        <span className="text-[10px] text-slate-600 font-bold truncate">{evento.local}</span>
                      </div>

                      {evento.professoresAcompanhantes && evento.professoresAcompanhantes.length > 0 && (
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#004D71] flex items-center justify-center shrink-0 mt-0.5">
                            <GraduationCap size={12}/>
                          </div>
                          <div className="text-[10px] text-slate-600 font-bold leading-tight">
                            Acompanhantes: <span className="text-[#004D71] font-black">{evento.professoresAcompanhantes.join(', ')}</span>
                          </div>
                        </div>
                      )}

                      {evento.regulamentoUrl && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                            <FileText size={12}/>
                          </div>
                          <a 
                            href={evento.regulamentoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-red-600 font-black hover:underline cursor-pointer normal-case tracking-normal"
                          >
                            Regulamento Oficial
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Beautiful winners podium */}
                    {styleWinners.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                        <h4 className="text-[9px] font-black text-[#004D71] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Award size={12} className="text-[#F7B500]"/> Melhores Tempos do Torneio
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {styleWinners.map(w => {
                            const normalizedKey = w.estilo.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const colorClass = STYLE_COLORS[normalizedKey] || 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <div key={w.estilo} className="bg-slate-50 border border-slate-100/80 rounded-2xl p-2.5 flex flex-col justify-between">
                                <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider mb-1.5 ${colorClass}`}>{w.estilo}</span>
                                <span className="text-[10px] font-black text-[#004D71] uppercase truncate leading-tight">{w.nome}</span>
                                <span className="text-[9px] font-black text-amber-600 mt-1">{w.tempo}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Registrations Progress Bar & Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span className="flex items-center gap-1.5"><Users size={12} className="text-slate-400"/> Vagas</span>
                      <span className="text-[#004D71] font-black">{evento.inscritos.length} {evento.maxParticipantes ? `/ ${evento.maxParticipantes} Max.` : 'Atletas'}</span>
                    </div>
                    {evento.maxParticipantes && (
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-[#F7B500] to-[#e0a400] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 pb-6 pt-2 shrink-0 flex flex-col gap-2">
                  <div className="flex gap-2">
                    {user.role === 'utente' && (
                      <button
                        onClick={() => initiateRegistration(evento, false)}
                        className={`flex-1 py-3.5 px-4 rounded-2xl font-black uppercase text-[10px] tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                          isRegistered 
                            ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100 shadow-green-100' 
                            : isFull 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border-none'
                            : 'bg-[#004D71] text-[#F7B500] hover:bg-[#003853] hover:shadow-lg shadow-[#004D71]/20 text-white cursor-pointer'
                        }`}
                        disabled={!isRegistered && isFull}
                      >
                        {isRegistered ? (
                          <>
                            <Check size={12}/> Inscrito
                          </>
                        ) : isFull ? (
                          'Esgotado'
                        ) : (
                          'Inscrever-me'
                        )}
                      </button>
                    )}

                    {isStaff && (
                      <button
                        onClick={() => { setViewingInscritos(evento); setSearchUtente(''); }}
                        className="flex-1 py-3.5 px-4 bg-slate-50 border border-slate-200/60 text-[#004D71] rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Users size={12}/> Inscritos ({evento.inscritos.length})
                      </button>
                    )}

                    {isStaff && (
                      <button
                        onClick={() => openTemposEditor(evento)}
                        className="flex-1 py-3.5 px-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-[10px] tracking-wider hover:bg-[#003853] active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Award size={12}/> Tempos
                      </button>
                    )}
                  </div>
                  
                  {evento.inscritos.length > 0 && (
                    <button
                      onClick={() => openHeatsViewer(evento)}
                      className="w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded-2xl font-black uppercase text-[10px] tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Clock size={12}/> Ver Séries de Partida
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR EVENTO */}
      {showAddModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="mb-6 text-left">
              <h3 className="text-xl font-black text-[#004D71] uppercase flex items-center gap-2">
                <Trophy className="text-[#F7B500]"/> Criar Novo Evento / Prova
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Publique uma prova para receber inscrições</p>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Título do Evento / Prova</label>
                <input 
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={e => setFormData({...formData, titulo: e.target.value})}
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none focus:border-[#F7B500]/20 transition-all"
                  placeholder="Ex: Torneio de Natação Vila de Rei"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Data</label>
                  <input 
                    type="date"
                    required
                    value={formData.data}
                    onChange={e => setFormData({...formData, data: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Hora de Início</label>
                  <input 
                    type="time"
                    required
                    value={formData.hora}
                    onChange={e => setFormData({...formData, hora: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Local</label>
                  <input 
                    type="text"
                    required
                    value={formData.local}
                    onChange={e => setFormData({...formData, local: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                    placeholder="Ex: Piscina Municipal de Vila de Rei"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Limite de Participantes (Opcional)</label>
                  <input 
                    type="number"
                    value={formData.maxParticipantes}
                    onChange={e => setFormData({...formData, maxParticipantes: e.target.value})}
                    className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                    placeholder="Ex: 50"
                  />
                </div>
              </div>

              {/* Accompanying teachers selector (Up to 5) */}
              {professorsList.length > 0 && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block">Professores / Treinadores Acompanhantes (Máx. 5)</label>
                  <p className="text-[7px] font-bold text-slate-400 uppercase ml-1 tracking-wider mb-2">Quem irá acompanhar os atletas na prova</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {professorsList.map(prof => {
                      const name = prof.nome || prof.n || '';
                      const isChecked = selectedTeachers.includes(name);
                      return (
                        <label 
                          key={prof.id}
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-black uppercase text-[#004D71] hover:border-[#004D71]/20 select-none"
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTeacherCheckboxChange(name)}
                            className="w-4 h-4 accent-[#004D71] rounded"
                          />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Link do Regulamento (Opcional)</label>
                <input 
                  type="url"
                  value={formData.regulamentoUrl}
                  onChange={e => setFormData({...formData, regulamentoUrl: e.target.value})}
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none"
                  placeholder="https://exemplo.com/regulamento.pdf"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Descrição / Regulamento</label>
                <textarea 
                  value={formData.descricao}
                  onChange={e => setFormData({...formData, descricao: e.target.value})}
                  rows={4}
                  className="w-full bg-slate-50 border-4 border-slate-50 rounded-2xl px-6 py-4 font-black text-[#004D71] outline-none min-h-[100px]"
                  placeholder="Informações adicionais sobre as distâncias, escalões ou prémios..."
                />
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="w-full bg-[#004D71] text-[#F7B500] py-5 rounded-[2rem] font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Save size={18}/> Publicar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER/GERIR INSCRITOS */}
      {viewingInscritos && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] flex flex-col justify-between">
            <button 
              onClick={() => setViewingInscritos(null)}
              className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="mb-4 text-left border-b pb-4 shrink-0">
              <h3 className="text-lg font-black text-[#004D71] uppercase leading-tight">
                Gerir Inscritos na Prova
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {viewingInscritos.titulo}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[9px] font-black uppercase tracking-wider">
                Total: {viewingInscritos.inscritos.length} Participantes
              </div>
            </div>

            {/* Staff-only section: Dynamic search to add participant */}
            {isStaff && (
              <div className="mb-4 space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 relative shrink-0">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Inscrever Utente Manualmente</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={searchUtente}
                    onChange={e => setSearchUtente(e.target.value)}
                    placeholder="PROCURAR UTENTE PELO NOME..."
                    className="w-full bg-white border border-slate-200 p-3 pl-10 rounded-xl font-black text-[9px] uppercase tracking-wider outline-none focus:border-[#004D71]/40"
                  />
                </div>

                {/* Dropdown Search Results */}
                {searchableUtentes.length > 0 && (
                  <div className="absolute left-4 right-4 bg-white border border-slate-200 rounded-2xl shadow-xl z-[10001] max-h-[200px] overflow-y-auto mt-1 overflow-hidden divide-y">
                    {searchableUtentes.map(u => (
                      <button
                        key={u.id}
                        onClick={() => initiateRegistration(viewingInscritos, true, u)}
                        className="w-full p-3 text-left hover:bg-slate-50 active:bg-blue-50 transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-black text-[10px] text-[#004D71] uppercase leading-none">{u.nome || u.n}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5">{u.email}</p>
                        </div>
                        <UserPlus size={14} className="text-[#004D71]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Enrolled Participants List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar my-2">
              {viewingInscritos.inscritos.length === 0 ? (
                <div className="text-center py-12 text-slate-300 font-black uppercase text-[10px] tracking-widest">
                  Nenhuma inscrição realizada até ao momento.
                </div>
              ) : (
                viewingInscritos.inscritos.map((inscrito, idx) => {
                  const utenteProfile = utentes.find(u => u.id === inscrito.id);
                  const img = utenteProfile?.img || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(inscrito.nome)}`;
                  const idade = utenteProfile?.idade;
                  
                  const getFirstAndLastName = (fullName: string) => {
                    const parts = fullName.trim().split(/\s+/);
                    if (parts.length <= 2) return fullName;
                    return `${parts[0]} ${parts[parts.length - 1]}`;
                  };

                  const displayName = getFirstAndLastName(inscrito.nome);

                  return (
                    <div 
                      key={inscrito.id} 
                      className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col justify-between text-left gap-3 shadow-sm"
                    >
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-xl bg-[#004D71] text-[#F7B500] font-black text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="relative shrink-0">
                            <AvatarImage src={img} alt={displayName} className="w-10 h-10 rounded-xl border-2 border-white shadow-sm" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-[#004D71] uppercase leading-none">{displayName}</h4>
                              {idade && (
                                <span className="text-[10px] font-bold text-slate-500">
                                  ({idade} anos)
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest line-clamp-1">{inscrito.email}</p>
                          </div>
                        </div>

                        {/* Controls for editing styles / removing */}
                        {isStaff && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleDownloadDiploma(inscrito, viewingInscritos)}
                              className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 active:scale-95 transition-all border border-amber-100 flex items-center justify-center cursor-pointer"
                              title="Descarregar Diploma"
                            >
                              <Trophy size={14} className="text-amber-600"/>
                            </button>
                            <button
                              onClick={() => initiateRegistration(viewingInscritos, true, inscrito)}
                              className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-95 transition-all border border-blue-100 flex items-center justify-center cursor-pointer"
                              title="Editar Estilos"
                            >
                              <Edit size={14}/>
                            </button>
                            <button
                              onClick={() => handleToggleUnsubscribe(viewingInscritos, inscrito.id, inscrito.nome)}
                              className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 active:scale-95 transition-all border border-red-100 flex items-center justify-center cursor-pointer"
                              title="Remover Participante"
                            >
                              <UserMinus size={14}/>
                            </button>
                          </div>
                        )}
                      </div>
                      {/* LARGER, COLOR-CODED SWIMMING STYLES BADGES - FIXING COLOR INCONSISTENCY */}
                      {inscrito.provas && inscrito.provas.length > 0 && (
                        <div className="flex flex-wrap gap-2 ml-8 border-t border-slate-200/40 pt-3">
                          {inscrito.provas.map(p => {
                            const normalizedKey = p.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const colorClass = STYLE_COLORS[normalizedKey] || 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <span 
                                key={p} 
                                className={`badge-style ${colorClass}`}
                              >
                                <Award size={10} className="shrink-0"/> {p}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => setViewingInscritos(null)}
                className="w-full bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY MODAL: SELECIONAR ESTILOS (CRAWL, COSTAS, BRUÇOS, MARIPOSA) */}
      {selectingStyles && (
        <div className="fixed inset-0 z-[20002] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative text-left">
            <button 
              onClick={() => setSelectingStyles(null)}
              className="absolute top-4 right-4 p-2.5 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={16}/>
            </button>

            <div className="mb-6">
              <h3 className="text-base font-black text-[#004D71] uppercase leading-tight">
                Selecionar Estilos
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Atleta: {selectingStyles.utenteNome}
              </p>
            </div>

            <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Selecione uma ou mais modalidades:</p>
              {ESTILOS.map(estilo => (
                <label 
                  key={estilo} 
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#004D71]/20 active:scale-[0.99] transition-all select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedProvas[estilo]}
                    onChange={() => setSelectedProvas(prev => ({ ...prev, [estilo]: !prev[estilo] }))}
                    className="w-4.5 h-4.5 accent-[#004D71] rounded-md cursor-pointer"
                  />
                  <span className="text-xs font-black text-[#004D71] uppercase tracking-wider">{estilo}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectingStyles(null)}
                className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-colors border"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStyles}
                className="flex-1 py-4 bg-[#004D71] text-[#F7B500] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#004D71]/90 shadow-md transition-colors animate-pulse"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: EDITAR TEMPOS / RESULTADOS */}
      {editingTempos && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] flex flex-col justify-between">
            <button 
              onClick={() => setEditingTempos(null)}
              className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="mb-4 text-left border-b pb-4 shrink-0">
              <h3 className="text-lg font-black text-[#004D71] uppercase leading-tight">
                Lançar Tempos e Resultados
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                {editingTempos.titulo}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 my-2 custom-scrollbar">
              {editingTempos.inscritos.length === 0 ? (
                <p className="text-center py-12 text-slate-400 font-black uppercase text-xs">Sem atletas inscritos nesta prova.</p>
              ) : (
                editingTempos.inscritos.map(inscrito => (
                  <div key={inscrito.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F7B500]"/>
                      <h4 className="font-black text-xs text-[#004D71] uppercase">{inscrito.nome}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {inscrito.provas.map(estilo => {
                        const currentVal = temposForm[inscrito.id]?.[estilo] || '';
                        return (
                          <div key={estilo} className="space-y-1 text-left">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider ml-1">{estilo}</label>
                            <input 
                              type="text"
                              placeholder="Min:Seg.Cen (ex: 00:34.50)"
                              value={currentVal}
                              onChange={e => {
                                const val = e.target.value;
                                setTemposForm(prev => ({
                                  ...prev,
                                  [inscrito.id]: {
                                    ...(prev[inscrito.id] || {}),
                                    [estilo]: val
                                  }
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#004D71] outline-none focus:border-[#004D71]/40 uppercase"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 shrink-0 flex gap-2">
              <button 
                onClick={() => setEditingTempos(null)}
                className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveTempos}
                className="flex-1 bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Guardar Resultados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER SÉRIES DE PARTIDA / HEATS */}
      {viewingHeats && (() => {
        const styleAthletes = viewingHeats.inscritos.filter(i => i.provas.includes(activeHeatsStyle));
        const heatsMap: Record<number, { pista: number; atleta: any; idade?: string }[]> = {};
        
        styleAthletes.forEach((atleta) => {
          const ut = utentes.find(u => u.id === atleta.id);
          const custom = isEditingHeats 
            ? heatsForm[atleta.id]?.[activeHeatsStyle]
            : viewingHeats.heats?.[atleta.id]?.[activeHeatsStyle];
            
          const index = styleAthletes.indexOf(atleta);
          const defaultSerie = Math.floor(index / 6) + 1;
          const defaultPista = (index % 6) + 1;
          
          const serie = custom ? custom.serie : defaultSerie;
          const pista = custom ? custom.pista : defaultPista;
          
          if (!heatsMap[serie]) {
            heatsMap[serie] = [];
          }
          heatsMap[serie].push({ pista, atleta, idade: ut?.idade, img: ut?.img });
        });

        const heats = Object.keys(heatsMap).map(k => {
          const id = parseInt(k, 10);
          const lanes = heatsMap[id].sort((a, b) => a.pista - b.pista);
          return { id, lanes };
        }).sort((a, b) => a.id - b.id);

        return (
          <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl relative animate-in zoom-in max-h-[90vh] flex flex-col justify-between">
              <button 
                onClick={() => setViewingHeats(null)}
                className="absolute top-6 right-6 p-3 bg-slate-50 rounded-full active:scale-90 border border-slate-100 cursor-pointer"
              >
                <X size={20}/>
              </button>

              <div className="mb-4 text-left border-b pb-4 shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-[#004D71] uppercase leading-tight">
                      Séries de Partida (Heats)
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {isEditingHeats ? 'Modo de Edição Manual' : 'Distribuição de pistas (Máx. 6 pistas por série)'}
                    </p>
                  </div>
                  {isStaff && !isEditingHeats && (
                    <button
                      onClick={() => handlePrintHeats(viewingHeats)}
                      className="px-3 py-1.5 bg-[#004D71] hover:bg-[#003853] text-[#F7B500] rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      <FileText size={12}/> PDF / Imprimir
                    </button>
                  )}
                </div>

                <div className="flex bg-[#004D71]/5 p-1 rounded-xl w-full border border-slate-100 mt-4">
                  {ESTILOS.map(est => {
                    const count = viewingHeats.inscritos.filter(i => i.provas.includes(est)).length;
                    return (
                      <button
                        key={est}
                        onClick={() => setActiveHeatsStyle(est)}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          activeHeatsStyle === est 
                            ? 'bg-[#004D71] text-[#F7B500] shadow-sm' 
                            : 'text-[#004D71]/60 hover:text-[#004D71]'
                        }`}
                      >
                        {est} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 my-2 custom-scrollbar">
                {heats.length === 0 ? (
                  <p className="text-center py-16 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                    Sem atletas inscritos em {activeHeatsStyle.toUpperCase()}.
                  </p>
                ) : (
                  heats.map(heat => (
                    <div key={heat.id} className="space-y-3">
                      <div className="flex items-center justify-between bg-[#004D71]/5 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-black text-[#004D71] uppercase tracking-wider">Série {heat.id}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{heat.lanes.length} Pistas Ocupadas</span>
                      </div>
                      
                      <div className="divide-y border border-slate-100 rounded-3xl overflow-hidden bg-slate-50/50">
                        {heat.lanes.map(lane => (
                          <div key={lane.atleta.id} className="flex items-center justify-between p-3.5 text-left bg-white hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-3 flex-1">
                              {isEditingHeats ? (
                                <div className="flex items-center gap-2">
                                  {/* Serie selection */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Série</label>
                                    <select
                                      value={heatsForm[lane.atleta.id]?.[activeHeatsStyle]?.serie ?? 1}
                                      onChange={(e) => {
                                        const newSerie = parseInt(e.target.value, 10);
                                        setHeatsForm(prev => ({
                                          ...prev,
                                          [lane.atleta.id]: {
                                            ...(prev[lane.atleta.id] || {}),
                                            [activeHeatsStyle]: {
                                              pista: prev[lane.atleta.id]?.[activeHeatsStyle]?.pista ?? 1,
                                              serie: newSerie
                                            }
                                          }
                                        }));
                                      }}
                                      className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-black text-[#004D71] outline-none"
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                        <option key={s} value={s}>S{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Pista selection */}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Pista</label>
                                    <select
                                      value={heatsForm[lane.atleta.id]?.[activeHeatsStyle]?.pista ?? 1}
                                      onChange={(e) => {
                                        const newPista = parseInt(e.target.value, 10);
                                        setHeatsForm(prev => ({
                                          ...prev,
                                          [lane.atleta.id]: {
                                            ...(prev[lane.atleta.id] || {}),
                                            [activeHeatsStyle]: {
                                              serie: prev[lane.atleta.id]?.[activeHeatsStyle]?.serie ?? 1,
                                              pista: newPista
                                            }
                                          }
                                        }));
                                      }}
                                      className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-black text-[#004D71] outline-none"
                                    >
                                      {[1, 2, 3, 4, 5, 6].map(p => (
                                        <option key={p} value={p}>P{p}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-slate-100 text-[#004D71] font-black text-xs flex items-center justify-center shrink-0 border border-slate-200">
                                  P{lane.pista}
                                </span>
                              )}
                              <AvatarImage src={lane.img} alt={lane.atleta.nome} className="w-8 h-8 rounded-xl border-2 border-white shadow-sm shrink-0" />
                              <div className="ml-1">
                                <h5 className="font-black text-xs text-[#004D71] uppercase leading-tight">
                                  {(() => { const p = (lane.atleta.nome || '').trim().split(/\s+/); return p.length <= 2 ? lane.atleta.nome : `${p[0]} ${p[p.length - 1]}`; })()}
                                </h5>
                              </div>
                            </div>
                            {lane.idade && (
                              <span className="px-2.5 py-1 bg-blue-50 text-[#004D71] rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">
                                {lane.idade} Anos
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 shrink-0 flex gap-2">
                {isEditingHeats ? (
                  <>
                    <button 
                      onClick={() => setIsEditingHeats(false)}
                      className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                    <button 
                      onClick={handleSaveHeats}
                      className="flex-1 bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer"
                    >
                      Guardar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    {isStaff && (
                      <>
                        <button 
                          onClick={() => setIsEditingHeats(true)}
                          className="flex-1 bg-slate-50 border border-slate-200 text-[#004D71] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer"
                        >
                          Editar Distribuição
                        </button>
                        <button 
                          onClick={handleResetHeats}
                          className="px-4 bg-red-50 text-red-600 border border-red-100 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer"
                          title="Restaurar Distribuição Automática"
                        >
                          Restaurar
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => setViewingHeats(null)}
                      className={`${isStaff ? 'flex-1' : 'w-full'} bg-[#004D71] text-[#F7B500] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all cursor-pointer`}
                    >
                      Fechar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
