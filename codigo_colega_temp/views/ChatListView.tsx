import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../contexts/AppContext';
import { Screen, UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Check, CheckCheck } from 'lucide-react';

interface ChatListViewProps {
  onBack: () => void;
  onSelectChat: (chatId: string) => void;
}

export default function ChatListView({ onBack, onSelectChat }: ChatListViewProps) {
  const { chats, setScreen, user, startChat, reloadData, activeRole, deleteChat } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Chat Modal State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Delete Chat State
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  // Clear context menu when clicking anywhere
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleCloseMenu);
      return () => window.removeEventListener('click', handleCloseMenu);
    }
  }, [contextMenu]);

  const triggerMenu = (chatId: string, x: number, y: number) => {
    setContextMenu({ chatId, x, y });
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const startPress = (e: React.MouseEvent | React.TouchEvent, chatId: string) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    longPressTimer.current = setTimeout(() => {
        triggerMenu(chatId, clientX, clientY);
    }, 600); // 600ms long press
  };

  const clearPress = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  // Load chats on mount to ensure list is populated
  useEffect(() => {
      reloadData();
  }, []);

  const handleAddChat = async () => {
    setShowNewChatModal(true);
    setIsLoadingContacts(true);
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, avatar, role')
            .neq('id', user?.id)
            .order('name');

        if (error) throw error;
        setContacts(data || []);
    } catch (e) {
        console.error("Error fetching contacts", e);
    } finally {
        setIsLoadingContacts(false);
    }
  };

  const handleStartNewChat = (contact: any) => {
      startChat(contact.id, contact.name, contact.avatar);
      setShowNewChatModal(false);
  };

  const handleDeleteChat = async () => {
      if (!chatToDelete) return;
      setIsDeleting(true);
      try {
          await deleteChat(chatToDelete);
          setChatToDelete(null);
      } catch (e) {
          alert("Erro ao excluir conversa.");
      } finally {
          setIsDeleting(false);
      }
  };

  // Sort chats by lastMessageTs (descending) to ensure new messages pop to top
  const sortedChats = [...chats].sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0));

  const filteredChats = sortedChats.filter(chat => 
    chat.participantName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const isDesktopAdmin = window.location.pathname.includes('/ptadmin');

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="w-full max-w-xl mx-auto flex flex-col flex-1 border-x border-main/5">
        {!isDesktopAdmin && (
          <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background/95 backdrop-blur-sm border-b border-main/5">
            <div className="w-10">
              <button onClick={onBack} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main">
                <span className="material-symbols-outlined">arrow_back_ios_new</span>
              </button>
            </div>
            <h1 className="text-lg font-bold text-main">Conversas</h1>
            <button 
              onClick={handleAddChat}
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-main/10 text-main"
            >
              <span className="material-symbols-outlined">add_comment</span>
            </button>
          </header>
        )}

      {/* Search */}
      <div className={`px-6 py-4 sticky ${isDesktopAdmin ? 'top-0 pt-8' : 'top-[72px]'} bg-background/95 backdrop-blur-md z-10 space-y-4 border-b border-main/5`}>
        {isDesktopAdmin && (
           <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-black text-main">Mensagens</h2>
              <button 
                  onClick={handleAddChat}
                  className="bg-primary text-background px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Nova Conversa
              </button>
           </div>
        )}
        <div className={`bg-surface/50 rounded-2xl flex items-center pr-2 border-2 border-main/5 focus-within:border-primary/50 transition-colors shadow-inner overflow-hidden ${isDesktopAdmin ? 'h-14' : 'h-12'}`}>
          <span className="material-symbols-outlined text-muted ml-5 mr-3">search</span>
          <input 
            type="text" 
            placeholder="Pesquisar conversa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-main w-full py-4 outline-none placeholder:text-zinc-500 text-sm font-bold"
          />
        </div>
      </div>

      <main className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar pb-24">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">forum</span>
            <p className="font-bold">{searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa iniciada'}</p>
            <button 
                onClick={handleAddChat}
                className="mt-4 text-primary text-sm font-bold hover:underline"
            >
                Iniciar nova conversa
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const lastMsgObj = chat.messages[chat.messages.length - 1];
            
            return (
              <div 
                key={chat.id} 
                className={`flex items-center gap-4 ${isDesktopAdmin ? 'p-4 rounded-3xl' : 'p-3 rounded-xl'} transition-all duration-300 cursor-pointer relative group select-none ${contextMenu?.chatId === chat.id ? 'bg-main/10' : 'hover:bg-main/5 border border-transparent hover:border-main/10 shadow-sm hover:shadow-md bg-surface/50'}`}
                onClick={(e) => {
                    if (contextMenu) {
                        setContextMenu(null);
                        e.stopPropagation();
                    } else {
                        onSelectChat(chat.id);
                    }
                }}
                onMouseDown={(e) => startPress(e, chat.id)}
                onMouseUp={clearPress}
                onMouseLeave={clearPress}
                onTouchStart={(e) => startPress(e, chat.id)}
                onTouchEnd={clearPress}
                onContextMenu={(e) => {
                    e.preventDefault();
                    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
                    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
                    triggerMenu(chat.id, clientX, clientY);
                }}
              >
                <div className="relative pointer-events-none">
                  <div className={`rounded-full bg-cover bg-center border-2 border-main/10 ${isDesktopAdmin ? 'h-14 w-14' : 'h-12 w-12'}`} style={{ backgroundImage: `url('${chat.participantAvatar}')` }}></div>
                  {chat.unreadCount > 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 animate-in zoom-in duration-200">
                      <div className={`bg-primary text-background font-bold flex items-center justify-center rounded-full shadow-lg ${isDesktopAdmin ? 'text-xs h-5 w-5' : 'text-[10px] h-4 w-4'}`}>
                        {chat.unreadCount}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 pointer-events-none">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-main font-bold truncate ${isDesktopAdmin ? 'text-base' : 'text-sm'}`}>{chat.participantName}</h3>
                    <span className={`text-[10px] ${chat.unreadCount > 0 ? 'text-primary font-bold' : 'text-muted font-bold'}`}>{chat.lastMessageTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={`text-sm truncate flex items-center gap-1 ${chat.unreadCount > 0 ? 'text-main font-bold' : 'text-muted font-medium'}`}>
                      {(() => {
                        const lastMsgObj = chat.messages && chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
                        const isMe = lastMsgObj && user && lastMsgObj.senderId === user.id;
                        if (isMe) {
                          return lastMsgObj.readAt ? (
                            <CheckCheck className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : (
                            <Check className="w-4 h-4 text-muted shrink-0" />
                          );
                        }
                        return null;
                      })()}
                      <span className="truncate">{chat.lastMessage}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
      </div>

      {/* Action Pop-up / Context Menu */}
      <AnimatePresence>
          {contextMenu && (
              <>
                  <div 
                      className="fixed inset-0 z-40 bg-main/5" 
                      onClick={() => setContextMenu(null)}
                  />
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      style={{ 
                          position: 'fixed',
                          left: Math.min(contextMenu.x, window.innerWidth - 180),
                          top: Math.min(contextMenu.y, window.innerHeight - 80),
                      }}
                      className="z-50 bg-[#1a1a1a] border border-main/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
                  >
                      <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(contextMenu.chatId);
                              setContextMenu(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 transition-colors text-sm font-bold"
                      >
                          <span className="material-symbols-outlined text-lg">delete</span>
                          Remover Conversa
                      </button>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      
      {/* CONFIRM DELETE MODAL */}
      {chatToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-main/10 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-surface border border-main/10 rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                    <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 font-bold">
                        <span className="material-symbols-outlined">delete_forever</span>
                    </div>
                    <h3 className="text-main font-bold text-lg mb-2">Excluir conversa?</h3>
                    <p className="text-muted text-sm mb-6 leading-relaxed">
                        Esta ação removerá todas as mensagens e dados desta conversa permanentemente.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setChatToDelete(null)}
                            disabled={isDeleting}
                            className="flex-1 h-12 rounded-xl bg-main/5 text-muted font-bold hover:bg-main/10 transition-colors disabled:opacity-50"
                        >
                            Voltar
                        </button>
                        <button 
                            onClick={handleDeleteChat}
                            disabled={isDeleting}
                            className="flex-1 h-12 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center"
                        >
                            {isDeleting ? <span className="w-5 h-5 border-2 border-main/30 border-t-white rounded-full animate-spin"></span> : 'Excluir'}
                        </button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {/* NEW CHAT MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl border border-main/10 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300 flex flex-col">
              <div className="p-4 border-b border-main/5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-main">Nova Conversa</h2>
                  <button onClick={() => setShowNewChatModal(false)} className="text-muted hover:text-main">
                      <span className="material-symbols-outlined">close</span>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                  {isLoadingContacts ? (
                      <div className="flex justify-center py-10">
                          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      </div>
                  ) : contacts.length === 0 ? (
                      <div className="text-center py-10 text-muted">
                          <p>Nenhum contato encontrado.</p>
                      </div>
                  ) : (
                      contacts.map(contact => (
                          <button 
                              key={contact.id}
                              onClick={() => handleStartNewChat(contact)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-main/5 rounded-xl transition-colors text-left"
                          >
                              <div className="h-10 w-10 rounded-full bg-cover bg-center border border-main/5" style={{ backgroundImage: `url('${contact.avatar}')` }}></div>
                              <div>
                                  <h3 className="font-bold text-main text-sm">{contact.name}</h3>
                                  <span className="text-[10px] bg-main/5 text-muted px-2 py-0.5 rounded border border-main/5">
                                      {contact.role === 'TRAINER' ? 'Personal Trainer' : 'Aluno'}
                                  </span>
                              </div>
                          </button>
                      ))
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}