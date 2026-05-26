import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Screen, UserRole, Chat } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Check, CheckCheck } from 'lucide-react';

interface ChatDetailViewProps {
  onBack: () => void;
  chatId: string | null;
}

const COMMON_EMOJIS = [
  '👍', '💪', '🔥', '🏋️‍♂️', '🏃‍♂️', '🥗', '🍗', '💧', '👏', '👊',
  '😀', '😂', '😅', '😎', '🤔', '😭', '😤', '😴', '👋', '🙏'
];

// Helper to format "Last Seen" string
const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'Offline';
    
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Visto agora';
    if (minutes < 60) return `Visto há ${minutes} min`;
    if (hours < 24) return `Visto há ${hours} h`;
    if (days < 7) return `Visto há ${days} d`;
    
    return `Visto em ${new Date(timestamp).toLocaleDateString()}`;
};

export default function ChatDetailView({ onBack, chatId }: ChatDetailViewProps) {
  const { chats, user, sendMessage, setScreen, selectStudentForProgress, refreshChat, markChatAsRead, activeRole, deleteChat } = useApp();
  const [inputText, setInputText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // New interaction states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  
  // Find chat in global state
  const contextChat = chats.find(c => c.id === chatId);
  
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  // Local state for when context doesn't have it yet (or anymore) - Ghost Chat
  const [ghostChat, setGhostChat] = useState<Chat | null>(null);
  const [loadingGhost, setLoadingGhost] = useState(false);

  // Refs for scrolling and focus
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // File Inputs Refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Determine Active Chat Object (Context or Ghost)
  const activeChat = contextChat || ghostChat;

  // Sync Ghost Chat if needed
  useEffect(() => {
     if (contextChat) {
         setGhostChat(null); // Clear ghost if we have real data
         return;
     }
     
     // If we have a chatId but no chat in context, fetch user details to make a ghost chat
     if (chatId && !contextChat) {
         const fetchGhost = async () => {
             setLoadingGhost(true);
             try {
                 const { data } = await supabase.from('profiles').select('name, avatar, last_seen').eq('id', chatId).single();
                 if (data) {
                     setGhostChat({
                         id: chatId,
                         participantId: chatId,
                         participantName: data.name,
                         participantAvatar: data.avatar,
                         lastMessage: '',
                         lastMessageTime: '',
                         unreadCount: 0,
                         messages: [],
                         online: false, // Calc based on last_seen
                         lastSeen: data.last_seen
                     });
                 }
             } catch (e) {
                 console.error("Failed to load user for chat", e);
             } finally {
                 setLoadingGhost(false);
             }
         };
         fetchGhost();
     }
  }, [chatId, contextChat]);

  // REMOVED: Auto-scroll effect no longer needed with flex-col-reverse
  
  // Combined Effect: Mark as read AND Refresh chat immediately on entry
  useEffect(() => {
      if (!chatId) return;
      
      // 1. Mark incoming messages as read
      markChatAsRead(chatId);
      
      // 2. Fetch latest status (in case user B read messages while user A was on list view)
      refreshChat(chatId);

      // 3. Set interval for ongoing updates
      const interval = setInterval(() => {
          refreshChat(chatId);
      }, 5000); 
      
      return () => clearInterval(interval);
  }, [chatId]);

  if (!activeChat) {
      return (
        <div className="flex flex-col h-full bg-background items-center justify-center">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
            <p className="text-muted text-sm mt-4">Carregando conversa...</p>
            <button onClick={onBack} className="mt-4 text-xs font-bold text-main underline">Voltar</button>
        </div>
      );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(activeChat.id, inputText);
      setInputText('');
      setShowEmojiPicker(false);
      setShowMediaMenu(false);
      
      // Force instant refresh for local UI feedback
      setTimeout(() => refreshChat(activeChat.id), 300);
      
      // Force focus back
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleViewProfile = () => {
      setShowMenu(false);
      // Se sou Personal e clico no perfil, vou para os detalhes do aluno
      if (activeRole === UserRole.TRAINER) {
          selectStudentForProgress(activeChat.participantId, activeChat.participantName, activeChat.participantAvatar);
          setScreen(Screen.TRAINER_STUDENT_DETAIL);
      } else {
          // Se sou Aluno, mostro um modal simples com o perfil do contato (ex: Personal)
          setShowProfileModal(true);
      }
  };

  // File Handlers
  const handleFileAction = (type: 'camera' | 'gallery' | 'document') => {
      setShowMediaMenu(false);
      
      setTimeout(() => {
          if (type === 'camera') {
              if (cameraInputRef.current) {
                  cameraInputRef.current.click();
              }
          }
          if (type === 'gallery') {
              if (galleryInputRef.current) {
                  galleryInputRef.current.click();
              }
          }
          if (type === 'document') {
              if (docInputRef.current) {
                  docInputRef.current.click();
              }
          }
      }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'doc') => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (type === 'image') {
          // Convert to Base64 for persistence (Using Base64 to bypass Storage requirement in MVP)
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              // Pass Base64 string as mediaUrl
              sendMessage(activeChat.id, '', 'image', base64);
              setTimeout(() => refreshChat(activeChat.id), 500);
          };
          reader.readAsDataURL(file);
      } else {
          sendMessage(activeChat.id, `📄 Arquivo: ${file.name}`, 'text');
          setTimeout(() => refreshChat(activeChat.id), 500);
      }
      
      // Reset input to allow selecting same file again if needed
      e.target.value = '';
  };

  const renderMessageContent = (text: string) => {
      // Simple regex to find image URLs (ends with common extensions or looks like a URL)
      // We allow standard image extensions.
      const imageRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|svg))/i;
      const match = text.match(imageRegex);
      
      if (match) {
          const url = match[0];
          const textPart = text.replace(url, '').trim();
          return (
              <>
                  {textPart && <p className="mb-2">{textPart}</p>}
                  <img src={url} alt="Link" className="rounded-lg max-h-48 w-full object-cover" />
              </>
          );
      }
      return <p className="text-sm font-medium break-words whitespace-pre-wrap">{text}</p>;
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className={`w-full max-w-xl mx-auto flex flex-col flex-1 relative bg-background overflow-hidden ${isDesktopAdmin ? '' : 'border-x border-main/5 shadow-2xl'}`}>
        {/* Hidden File Inputs - IMPORTANT: capture="environment" for rear camera */}
      <input 
        type="file" 
        ref={cameraInputRef} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={(e) => handleFileChange(e, 'image')} 
      />
      <input 
        type="file" 
        ref={galleryInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={(e) => handleFileChange(e, 'image')} 
      />
      <input 
        type="file" 
        ref={docInputRef} 
        accept=".pdf,.doc,.docx,.txt" 
        className="hidden" 
        onChange={(e) => handleFileChange(e, 'doc')} 
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-main/5 relative ${isDesktopAdmin ? 'p-6' : 'p-4'}`}>
        <div className="flex items-center gap-3">
          {!isDesktopAdmin && (
              <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
                <span className="material-symbols-outlined">arrow_back_ios_new</span>
              </button>
          )}
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleViewProfile}>
            <div className={`rounded-full bg-cover bg-center border border-main/10 ${isDesktopAdmin ? 'h-12 w-12' : 'h-10 w-10'}`} style={{ backgroundImage: `url('${activeChat.participantAvatar}')` }}></div>
            <div>
              <h1 className={`${isDesktopAdmin ? 'text-lg font-black' : 'text-base font-bold'} text-main leading-tight`}>{activeChat.participantName}</h1>
              <p className="text-xs text-muted flex items-center gap-1 font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${activeChat.online ? 'bg-primary' : 'bg-zinc-500'}`}></span> 
                {activeChat.online ? 'Online' : formatLastSeen(activeChat.lastSeen)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
             {/* Context Menu for 3 dots */}
            <div className="relative">
                <button 
                    onClick={() => setShowMenu(!showMenu)}
                    className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main transition-colors"
                >
                    <span className="material-symbols-outlined">more_vert</span>
                </button>

                {showMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                        <div className="absolute right-0 top-12 w-48 bg-surface border border-main/10 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={handleViewProfile}
                                className="w-full px-4 py-3 hover:bg-main/5 text-left text-sm font-medium text-main flex items-center gap-3 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg text-muted">person</span>
                                Ver Perfil
                            </button>
                            <button 
                                onClick={() => {
                                    setShowMenu(false);
                                    setShowDeleteConfirm(true);
                                }}
                                className="w-full px-4 py-3 hover:bg-main/5 text-left text-sm font-medium text-red-400 flex items-center gap-3 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg text-red-400/70">delete</span>
                                Limpar Conversa
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      </header>

       {/* Messages */}
      <main 
        ref={scrollRef}
        className="flex-1 flex flex-col-reverse p-4 space-y-4 space-y-reverse overflow-y-auto bg-background min-h-0 select-none pb-4"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
      >
        <div className="flex flex-col items-center gap-2 mb-4">
          <span className="text-[10px] text-muted flex items-center gap-1 opacity-70">
             <span className="material-symbols-outlined text-[12px]">history</span>
             Histórico mantido por 30 dias
          </span>
          <span className="bg-surface text-muted text-xs px-3 py-1 rounded-full border border-main/5">Hoje</span>
        </div>

        {activeChat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">forum</span>
                <p className="font-bold text-main">Nenhuma mensagem.</p>
                <p className="text-sm">Inicie a conversa!</p>
            </div>
        )}

        {[...activeChat.messages].reverse().map(msg => {
          const isMe = msg.senderId === user?.id;
          return (
            <div 
              key={msg.id} 
              className={`flex flex-col gap-1 max-w-[85%] ${isMe ? 'items-end ml-auto' : 'items-start'}`}
            >
              {msg.type === 'image' && msg.mediaUrl ? (
                  <div className={`rounded-3xl overflow-hidden shadow-md border-2 border-main/10 ${isMe ? 'rounded-tr-none border-primary/20' : 'rounded-tl-none'}`}>
                      <img 
                        src={msg.mediaUrl} 
                        alt="Imagem enviada" 
                        className="max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                            // Simple view full screen attempt
                            const w = window.open('about:blank');
                            if(w) {
                                w.document.write(`<img src="${msg.mediaUrl}" style="width:100%;" />`);
                            }
                        }}
                      />
                  </div>
              ) : (
                  <div 
                    className={`py-3 px-5 rounded-3xl shadow-sm ${
                      isMe 
                        ? 'bg-primary text-background rounded-tr-sm border border-primary font-medium' 
                        : 'bg-surface text-main rounded-tl-sm border-2 border-main/5 font-medium'
                    }`}
                  >
                    {renderMessageContent(msg.text)}
                  </div>
              )}
              
              <span className={`text-[10px] text-muted flex items-center justify-end gap-0.5 ${isMe ? 'mr-0' : 'ml-2'}`}>
                <span>{msg.timestamp}</span>
                {isMe && (
                  msg.readAt ? <CheckCheck className="w-[14px] h-[14px] text-blue-500" /> : <Check className="w-[14px] h-[14px] text-muted/70" />
                )}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-0" />
      </main>

      {/* Input Area */}
      <footer className={`${isDesktopAdmin ? 'p-6 bg-surface/50 backdrop-blur-md border-t-2 border-main/5' : 'p-3 bg-background border-t border-main/10'} relative`}>
        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
            <div className={`absolute right-4 bg-surface border border-main/10 rounded-xl p-3 shadow-2xl z-50 animate-in slide-in-from-bottom-2 w-64 ${isDesktopAdmin ? 'bottom-24' : 'bottom-20'}`}>
                <div className="grid grid-cols-5 gap-2">
                    {COMMON_EMOJIS.map(emoji => (
                        <button 
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji)}
                            className="text-2xl hover:bg-main/10 p-2 rounded transition-colors flex items-center justify-center h-10 w-10"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Media Menu Popover */}
        {showMediaMenu && (
            <div className={`absolute left-4 bg-surface border border-main/10 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-2 overflow-hidden flex flex-col w-48 ${isDesktopAdmin ? 'bottom-24' : 'bottom-20'}`}>
                <button className="flex items-center gap-3 px-4 py-3 hover:bg-main/5 text-main text-sm font-bold transition-colors text-left" onClick={() => handleFileAction('camera')}>
                    <span className="material-symbols-outlined text-primary">photo_camera</span>
                    Tirar Foto
                </button>
                <button className="flex items-center gap-3 px-4 py-3 hover:bg-main/5 text-main text-sm font-bold transition-colors text-left" onClick={() => handleFileAction('gallery')}>
                    <span className="material-symbols-outlined text-purple-400">image</span>
                    Galeria
                </button>
                <button className="flex items-center gap-3 px-4 py-3 hover:bg-main/5 text-main text-sm font-bold transition-colors text-left" onClick={() => handleFileAction('document')}>
                    <span className="material-symbols-outlined text-blue-400">description</span>
                    Documento
                </button>
            </div>
        )}

        <form 
          onSubmit={handleSend}
          className="flex items-center gap-3"
        >
          <button 
            type="button" 
            onClick={() => {
                setShowMediaMenu(!showMediaMenu);
                setShowEmojiPicker(false);
            }}
            className={`${isDesktopAdmin ? 'h-14 w-14' : 'h-10 w-10'} flex items-center justify-center rounded-full transition-colors ${showMediaMenu ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-main/5 hover:bg-main/10 text-muted hover:text-main'}`}
          >
            <span className="material-symbols-outlined">{showMediaMenu ? 'close' : 'add'}</span>
          </button>
          
          <div className={`flex-1 bg-surface rounded-full flex items-center px-5 border-2 border-main/5 focus-within:border-primary/50 transition-colors shadow-inner overflow-hidden ${isDesktopAdmin ? 'h-14' : 'h-12'}`}>
            <input 
              ref={inputRef}
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escreva a sua mensagem..." 
              className="bg-transparent w-full py-4 text-main font-bold placeholder:text-zinc-500 focus:outline-none text-sm"
              onFocus={() => {
                  setShowEmojiPicker(false);
                  setShowMediaMenu(false);
              }}
            />
            <button 
                type="button" 
                onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowMediaMenu(false);
                }}
                className={`ml-2 transition-colors ${showEmojiPicker ? 'text-primary' : 'text-muted hover:text-main'}`}
            >
              <span className="material-symbols-outlined">sentiment_satisfied</span>
            </button>
          </div>
          
          <button 
            type="submit"
            className="h-12 w-12 flex items-center justify-center rounded-full bg-primary text-background shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </footer>
      </div>

      {/* PROFILE INFO MODAL (For non-trainer view) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-muted hover:text-main"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <div className="flex flex-col items-center text-center pt-2">
                 <div 
                    className="h-24 w-24 rounded-full bg-cover bg-center border-4 border-primary/20 mb-4 shadow-lg" 
                    style={{ backgroundImage: `url('${activeChat.participantAvatar}')` }}
                 ></div>
                 
                 <h2 className="text-xl font-bold text-main mb-1">{activeChat.participantName}</h2>
                 <p className="text-sm text-primary font-bold mb-4">Contato</p>
                 
                 <div className="w-full bg-main/5 rounded-xl p-4 mb-4 border border-main/5">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-muted">mail</span>
                        <span className="text-sm text-muted-foreground">Email privado</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-muted">schedule</span>
                        <span className="text-sm text-muted-foreground">{activeChat.online ? 'Online agora' : formatLastSeen(activeChat.lastSeen)}</span>
                    </div>
                 </div>

                 <button 
                   onClick={() => setShowProfileModal(false)}
                   className="w-full bg-main/10 hover:bg-main/20 text-main font-bold py-3 rounded-xl transition-colors"
                 >
                   Fechar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-xs rounded-2xl p-6 border border-main/10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 animate-pulse">
                    <span className="material-symbols-outlined text-3xl">delete_forever</span>
                </div>
                <h3 className="text-main font-bold text-lg mb-2">Excluir tudo?</h3>
                <p className="text-muted text-sm mb-6 leading-relaxed">
                    Você tem certeza que deseja apagar todo o histórico desta conversa? Esta ação não pode ser desfeita.
                </p>
                <div className="flex flex-col gap-2 w-full">
                    <button 
                        onClick={async () => {
                            if (!chatId) return;
                            setIsDeleting(true);
                            try {
                                await deleteChat(chatId);
                                onBack();
                            } catch (e) {
                                alert("Erro ao excluir conversa.");
                            } finally {
                                setIsDeleting(false);
                                setShowDeleteConfirm(false);
                            }
                        }}
                        disabled={isDeleting}
                        className="w-full h-12 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center"
                    >
                        {isDeleting ? <span className="w-5 h-5 border-2 border-main/30 border-t-white rounded-full animate-spin"></span> : 'Sim, Excluir Tudo'}
                    </button>
                    <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="w-full h-12 rounded-xl bg-main/5 text-muted font-bold hover:bg-main/10 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}