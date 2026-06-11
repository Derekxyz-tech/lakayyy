import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, ShieldAlert, Store, User, Loader2, MessageCircle } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  serverTimestamp, 
  orderBy,
  limit,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string | null;  // If set, opens that specific chat immediately
  targetUserName?: string | null;
  currentUserId?: string | null;
}

export default function ChatOverlay({ isOpen, onClose, targetUserId, targetUserName }: ChatOverlayProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentUser = auth.currentUser;

  // Sync active chat if targetUserId changes from external selectors (like clicking product page / purchase item)
  useEffect(() => {
    if (isOpen && currentUser && targetUserId && targetUserId !== currentUser.uid) {
      const chatRoomId = [currentUser.uid, targetUserId].sort().join('_');
      setActiveChat({
        id: chatRoomId,
        buyerId: currentUser.uid === chatRoomId.split('_')[0] ? currentUser.uid : targetUserId,
        sellerId: currentUser.uid === chatRoomId.split('_')[1] ? currentUser.uid : targetUserId,
        buyerName: currentUser.uid === chatRoomId.split('_')[0] ? (currentUser.displayName || 'Acheteur') : (targetUserName || 'Artisan'),
        sellerName: currentUser.uid === chatRoomId.split('_')[1] ? (currentUser.displayName || 'Artisan') : (targetUserName || 'Artisan'),
        otherPartyName: targetUserName || 'Artisan local'
      });
    }
  }, [isOpen, targetUserId, targetUserName, currentUser]);

  // Fetch list of active conversations
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setLoadingConversations(true);
    
    // Listen to conversations where current user is the buyer
    const qBuyer = query(
      collection(db, 'chats'),
      where('buyerId', '==', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    // Listen to conversations where current user is the seller
    const qSeller = query(
      collection(db, 'chats'),
      where('sellerId', '==', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribers: (() => void)[] = [];

    const handleSnapshot = (snapshot: any, isBuyerQuery: boolean) => {
      const convData = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        const otherPartyName = isBuyerQuery ? (data.sellerName || 'Artisan') : (data.buyerName || 'Client');
        const otherPartyId = isBuyerQuery ? data.sellerId : data.buyerId;
        return {
          id: doc.id,
          otherPartyName,
          otherPartyId,
          ...data
        };
      });

      setConversations(prev => {
        // Merge list preventing duplicates
        const merged = [...prev];
        convData.forEach((item: any) => {
          const idx = merged.findIndex(v => v.id === item.id);
          if (idx >= 0) {
            merged[idx] = item;
          } else {
            merged.push(item);
          }
        });
        // Sort by updatedAt descending
        return merged.sort((a, b) => {
          const tA = a.updatedAt?.seconds || 0;
          const tB = b.updatedAt?.seconds || 0;
          return tB - tA;
        });
      });
    };

    const unsubBuyer = onSnapshot(qBuyer, (snap) => {
      handleSnapshot(snap, true);
      setLoadingConversations(false);
    }, (err) => {
      console.error(err);
      setLoadingConversations(false);
    });

    const unsubSeller = onSnapshot(qSeller, (snap) => {
      handleSnapshot(snap, false);
      setLoadingConversations(false);
    }, (err) => {
      console.error(err);
      setLoadingConversations(false);
    });

    unsubscribers.push(unsubBuyer, unsubSeller);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      setConversations([]);
    };
  }, [isOpen, currentUser]);

  // Fetch real-time messages for the active conversation
  useEffect(() => {
    if (!activeChat || !currentUser) {
      setMessages([]);
      return;
    }

    const messagesQ = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribeMessages = onSnapshot(messagesQ, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgsData);
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error("Error subscribring to messages:", error);
    });

    return () => unsubscribeMessages();
  }, [activeChat, currentUser]);

  // Mark chat as read when activeChat changes or new messages arrive
  useEffect(() => {
    if (!activeChat || !currentUser) return;
    
    const markAsRead = async () => {
      try {
        const chatRoomId = activeChat.id;
        const chatDocRef = doc(db, 'chats', chatRoomId);
        
        // Fetch to see if we are indeed the unread receiver
        const docSnap = await getDoc(chatDocRef);
        if (docSnap.exists() && docSnap.data().unreadReceiverId === currentUser.uid) {
          await updateDoc(chatDocRef, {
            unreadReceiverId: ''
          });
        }
      } catch (err) {
        console.error("Error marking chat as read:", err);
      }
    };

    markAsRead();
  }, [activeChat, messages, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeChat || !newMessage.trim()) return;

    setSending(true);
    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      // 1. Initialise chat room document at top-level if it doesn't exist
      const chatRoomId = activeChat.id;
      const chatDocRef = doc(db, 'chats', chatRoomId);
      
      const buyerId = activeChat.buyerId || (currentUser.uid === chatRoomId.split('_')[0] ? currentUser.uid : activeChat.otherPartyId);
      const sellerId = activeChat.sellerId || (currentUser.uid === chatRoomId.split('_')[1] ? currentUser.uid : activeChat.otherPartyId);

      const isBuyer = currentUser.uid === buyerId;
      const receiverId = isBuyer ? sellerId : buyerId;

      await setDoc(chatDocRef, {
        buyerId,
        sellerId,
        buyerName: isBuyer ? (currentUser.displayName || 'Client') : activeChat.otherPartyName,
        sellerName: !isBuyer ? (currentUser.displayName || 'Artisan local') : activeChat.otherPartyName,
        lastMessage: msgText,
        lastSenderId: currentUser.uid,
        lastSenderName: currentUser.displayName || 'Inconnu',
        unreadReceiverId: receiverId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Add message to the nested collection
      const msgColRef = collection(db, 'chats', chatRoomId, 'messages');
      await addDoc(msgColRef, {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Inconnu',
        text: msgText,
        createdAt: serverTimestamp()
      });

      setSending(false);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Erreur lors du versement du message.');
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="chats-docking-portal" className="fixed inset-y-0 right-0 z-[150] w-full max-w-md bg-white shadow-[0_0_80px_rgba(0,0,0,0.12)] border-l border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-right duration-350">
      {/* Top Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
        <div className="flex items-center gap-3">
          {activeChat ? (
            <button 
              onClick={() => setActiveChat(null)}
              className="text-xs font-black uppercase text-gray-400 hover:text-white transition-colors cursor-pointer select-none"
            >
              &larr; Convs
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <MessageSquare className="h-4.5 w-4.5" />
            </div>
          )}
          <div className="text-left">
            <h3 className="font-black text-sm tracking-tight leading-none">
              {activeChat ? activeChat.otherPartyName : 'Messagerie'}
            </h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              {activeChat ? 'Artisan Connecté' : 'Vos discussions avec vos artisans'}
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Panel */}
      <div className="flex-grow flex flex-col bg-gray-50/50 relative overflow-hidden">
        {activeChat ? (
          // Active Chat Room View
          <>
            <div className="flex-grow p-4 md:p-5 overflow-y-auto space-y-3.5 flex flex-col max-h-[80vh]">
              {messages.length > 0 ? (
                (() => {
                  const seenIds = new Set();
                  return messages
                    .filter((msg) => {
                      if (!msg.id) return false;
                      if (seenIds.has(msg.id)) return false;
                      seenIds.add(msg.id);
                      return true;
                    })
                    .map((msg) => {
                      const isMine = msg.senderId === currentUser?.uid;
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex flex-col max-w-[82%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}
                        >
                          <div className={`px-4 py-3 rounded-2.5xl text-xs font-medium leading-relaxed shadow-sm ${
                            isMine 
                              ? 'bg-gray-900 text-white rounded-tr-none' 
                              : 'bg-white text-gray-800 border border-gray-150/70 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                          <span className="text-[8px] font-mono font-bold text-gray-405 mt-1">
                            {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : ''}
                          </span>
                        </div>
                      );
                    });
                })()
              ) : (
                <div className="my-auto py-12 text-center text-gray-400 max-w-xs mx-auto space-y-4">
                  <MessageCircle className="h-10 w-10 text-gray-300 mx-auto animate-bounce" />
                  <div>
                    <p className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Aucun message pour l'instant</p>
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed font-semibold">
                      Commentez pour planifier un rendez-vous ou convenir d'un lieu de livraison sécurisé.
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex items-center gap-2">
              <input 
                type="text"
                placeholder="Rédigez votre message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-200 outline-none rounded-xl text-xs font-semibold focus:border-brand/40 bg-gray-50/20"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-black disabled:opacity-20 transition-all cursor-pointer shadow-md shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </>
        ) : (
          // Conversations List View
          <div className="flex-grow p-4 overflow-y-auto space-y-3.5">
            {loadingConversations ? (
              <div className="space-y-2 py-8">
                <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
              </div>
            ) : conversations.length > 0 ? (
              (() => {
                const seenIds = new Set();
                return conversations
                  .filter((conv) => {
                    if (!conv.id) return false;
                    if (seenIds.has(conv.id)) return false;
                    seenIds.add(conv.id);
                    return true;
                  })
                  .map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveChat(conv)}
                      className="w-full text-left p-4.5 bg-white border border-gray-150/80 hover:border-brand/30 rounded-2.5xl flex items-center justify-between gap-3 shadow-sm hover:shadow active:scale-99 transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-gray-900 truncate tracking-tight">{conv.otherPartyName}</h4>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate leading-tight">
                          {conv.lastMessage || 'Aucune conversation récente.'}
                        </p>
                      </div>
                      <span className="text-[8px] font-mono text-gray-400 uppercase font-black tracking-wider shrink-0 bg-gray-50 px-2 py-1 rounded border">
                        {conv.updatedAt?.seconds ? new Date(conv.updatedAt.seconds * 1000).toLocaleDateString('fr-FR') : ''}
                      </span>
                    </button>
                  ));
              })()
            ) : (
              <div className="my-auto py-24 text-center max-w-xs mx-auto space-y-4">
                <MessageSquare className="h-10 w-10 text-gray-300 mx-auto" />
                <div>
                  <p className="font-black text-gray-800 text-xs uppercase tracking-wider">Aucun échange actif</p>
                  <p className="text-[10px] text-gray-400 mt-2 max-w-xs leading-relaxed font-semibold">
                    Vos conversations apparaîtront ici dès que vous initierez un clavardage avec un artisan partenaire.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
