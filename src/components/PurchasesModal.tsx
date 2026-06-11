import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Clock, CheckCircle2, Ticket, MessageSquare, AlertCircle, ShoppingBag } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

interface PurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartChat: (sellerId: string, sellerName: string) => void;
}

export default function PurchasesModal({ isOpen, onClose, onStartChat }: PurchasesModalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;

    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('buyerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error reading buyer orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div id="purchases-portal" className="fixed inset-0 z-[120] flex items-center justify-center p-2 xs:p-4 overflow-y-auto">
      <AnimatePresence>
        {/* Backdrop overlay */}
        <motion.div
          key="purchases-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-950/60 backdrop-blur-md"
        />

        {/* Modal Sheet body */}
        <motion.div
          key="purchases-sheet"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: 40 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl xs:rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.15)] border border-gray-100 my-auto max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 xs:p-6 md:p-8 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h2 className="text-lg xs:text-xl font-black text-gray-900 tracking-tight">Mes Achats Sécurisés</h2>
                <p className="text-[9px] xs:text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Codes de livraison sécurisés</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50/60 border-y border-amber-100/60 p-4 xs:p-5 flex items-start gap-2.5 xs:gap-3 text-left">
            <AlertCircle className="h-4.5 w-4.5 xs:h-5 xs:w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[10px] xs:text-[11px] font-black uppercase text-amber-800 tracking-wider">Comment récupérer vos articles ?</p>
              <p className="text-[10px] xs:text-xs text-amber-700/90 font-medium leading-relaxed">
                Discutez avec l'artisan pour convenir d'un lieu et de l'heure de livraison. Une fois l'article en main propre, donnez-lui son <b>code de livraison à 5 chiffres</b> pour valider et débloquer la réception de votre produit !
              </p>
            </div>
          </div>

          {/* Orders Scroll Feed */}
          <div className="flex-1 p-4 xs:p-6 md:p-8 overflow-y-auto space-y-4 max-h-[45vh] xs:max-h-[50vh] sm:max-h-[55vh]">
            {loading ? (
              <div className="space-y-3 py-10">
                <div className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                <div className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
              </div>
            ) : orders.length > 0 ? (
              (() => {
                const seenIds = new Set();
                return orders
                  .filter((order) => {
                    if (!order.id) return false;
                    if (seenIds.has(order.id)) return false;
                    seenIds.add(order.id);
                    return true;
                  })
                  .map((order) => {
                    const isPending = order.status === 'pending_delivery';
                    return (
                      <div 
                        key={order.id} 
                        className={`p-5 rounded-3xl border transition-all text-left flex flex-col gap-4.5 ${
                          isPending 
                            ? 'border-amber-100 bg-amber-50/5 hover:border-amber-200' 
                            : 'border-gray-100 bg-white opacity-80'
                        }`}
                      >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {order.productImage ? (
                            <img src={order.productImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-5 w-5 text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md ${
                              isPending 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isPending ? 'En attente' : 'Livré et débloqué'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold font-mono">
                              {new Date(order.createdAt?.seconds * 1000).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-gray-900 truncate mt-1 leading-tight">{order.productName}</h4>
                          <div className="flex items-center gap-3 text-xs text-gray-400 font-bold mt-1.5 font-mono">
                            <span>{order.totalAmount?.toLocaleString()} HTG</span>
                            <span className="h-1 w-1 bg-gray-300 rounded-full" />
                            <span>Qté: {order.quantity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0 sm:self-center">
                        <button
                          type="button"
                          onClick={() => onStartChat(order.sellerId, order.sellerCompanyName || 'Artisan')}
                          className="h-11 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Artisan
                        </button>

                        {isPending ? (
                          <div className="flex flex-col items-end gap-1 px-4 py-2 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/15">
                            <span className="text-[8px] font-extrabold uppercase tracking-widest leading-none opacity-80">CODE DE LIVRAISON</span>
                            <span className="font-mono font-black text-sm tracking-wider leading-none mt-1 select-all">{order.verificationCode}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-4 py-3 bg-green-50 text-green-700 border border-green-100 rounded-xl font-black text-xs uppercase tracking-widest">
                            <CheckCircle2 className="h-4 w-4" />
                            Validé !
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delivery & Tracking card row */}
                    <div className="pt-3.5 border-t border-gray-100/60 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="text-gray-400 font-black">ID LIVRAISON :</span>
                        <span className="font-mono text-gray-800 font-black tracking-normal select-all">{order.deliveryTrackingId || 'Génération...'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="text-gray-400 font-black">ESTIMATION :</span>
                        <span className="text-gray-800 font-black">{order.deliveryTime || '2-4 jours'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="text-gray-400 font-black">FRAIS PORT :</span>
                        <span className="text-emerald-600 font-black">
                          {order.deliveryPrice !== undefined ? (order.deliveryPrice === 0 ? 'Gratuit' : `${order.deliveryPrice.toLocaleString()} HTG`) : '150 HTG'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          ) : (
              <div className="py-12 text-center space-y-4 border border-dashed border-gray-100 rounded-3xl bg-gray-50/20">
                <Ticket className="h-10 w-10 text-gray-300 mx-auto" />
                <div className="space-y-1">
                  <p className="font-black text-gray-850">Aucun achat sécurisé</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                    Vos codes de livraison anti-fraudes apparaîtront ici dès que vous validerez de nouveaux achats sur la plateforme.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
