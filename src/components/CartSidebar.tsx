import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  stock: number;
}

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export default function CartSidebar({ 
  isOpen, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onRemove, 
  onCheckout 
}: CartSidebarProps) {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isAdmin = auth.currentUser?.email === 'ghostytb77777@gmail.com';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Votre Panier</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{items.length} articles</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-gray-400 hover:text-gray-900 transition-all hover:bg-gray-50 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              {items.length > 0 ? (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-200">
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-gray-900 tracking-tight truncate pr-2">{item.name}</h4>
                        <button 
                          onClick={() => onRemove(item.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        {item.price.toLocaleString()} HTG
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
                          <button 
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="p-1.5 hover:bg-white hover:text-gray-900 text-gray-400 rounded-lg transition-all"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQuantity(item.id, 1)}
                            disabled={!isAdmin && item.quantity >= item.stock}
                            className="p-1.5 hover:bg-white hover:text-gray-900 text-gray-400 rounded-lg transition-all disabled:opacity-20"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-black text-gray-900">
                          {(item.price * item.quantity).toLocaleString()} <small className="text-[10px]">HTG</small>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                    <ShoppingBag className="h-8 w-8 text-gray-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-gray-900">Panier vide</p>
                    <p className="text-xs font-medium text-gray-400 max-w-[180px]">Votre sélection d'artisanat apparaîtra ici.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Sous-total</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Taxes incluses</p>
                </div>
                <p className="text-3xl font-black text-gray-900 tracking-tighter">
                  {total.toLocaleString()} <small className="text-sm">HTG</small>
                </p>
              </div>

              <button
                disabled={items.length === 0}
                onClick={onCheckout}
                className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-black hover:shadow-xl transition-all disabled:opacity-20 active:scale-95"
              >
                Commander <ArrowRight className="h-4 w-4" />
              </button>
              
              <p className="text-center text-[9px] text-gray-300 font-bold mt-6 uppercase tracking-widest flex items-center justify-center gap-2">
                <ShieldCheck className="h-3 w-3" /> Paiement Sécurisé MonCash / NatCash
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
