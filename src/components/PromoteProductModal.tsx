import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, TrendingUp, Check, AlertCircle, Wallet, CreditCard } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface PromoteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSuccess: () => void;
  sellerData?: any;
}

export default function PromoteProductModal({ isOpen, onClose, product, onSuccess, sellerData }: PromoteProductModalProps) {
  const [amount, setAmount] = useState('500');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'external'>('external');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successStep, setSuccessStep] = useState(false);

  const withdrawableBalance = sellerData 
    ? (sellerData.totalRevenue || 0) - (sellerData.totalWithdrawn || 0)
    : 0;

  useEffect(() => {
    if (isOpen) {
      setAmount('500');
      setPaymentMethod('external');
      setSuccessStep(false);
      setIsSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handlePromoteSubmit = async (e: any) => {
    e.preventDefault();
    if (!auth.currentUser || !product) return;

    const bidValue = parseFloat(amount);
    if (isNaN(bidValue) || bidValue < 100) {
      toast.error("Le montant minimum de promotion est de 100 HTG.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (paymentMethod === 'balance') {
        if (withdrawableBalance < bidValue) {
          toast.error("Solde du portefeuille insuffisant pour effectuer cette promotion.");
          setIsSubmitting(false);
          return;
        }

        // Deduct from seller's wallet balance using a Firestore transaction
        await runTransaction(db, async (transaction) => {
          const sellerRef = doc(db, 'users', auth.currentUser!.uid);
          const productRef = doc(db, 'products', product.id);

          const sellerSnap = await transaction.get(sellerRef);
          if (!sellerSnap.exists()) throw new Error("Compte de l'artisan introuvable.");

          const data = sellerSnap.data();
          const currentWithdrawn = data.totalWithdrawn || 0;
          // Shift the amount as "withdrawn" or deduct balance by adjusting totalWithdrawn
          transaction.update(sellerRef, {
            totalWithdrawn: currentWithdrawn + bidValue,
            updatedAt: serverTimestamp()
          });

          // Update product promotion indicators
          transaction.update(productRef, {
            promoted: true,
            promotionAmount: bidValue,
            promotedAt: serverTimestamp()
          });
        });
      } else {
        // Direct simulation of External payment (MonCash/NatCash)
        const productRef = doc(db, 'products', product.id);
        await updateDoc(productRef, {
          promoted: true,
          promotionAmount: bidValue,
          promotedAt: serverTimestamp()
        });
      }

      setSuccessStep(true);
      onSuccess();
    } catch (err: any) {
      console.error("Promotion Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `products/${product?.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 overflow-y-auto">
      <AnimatePresence>
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-950/60 backdrop-blur-xl"
        />

        {/* Modal body */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: 40 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] xs:rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-slate-800 my-auto p-6 xs:p-8 md:p-10 overflow-hidden"
        >
          {/* Close Button */}
          {!successStep && (
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 xs:top-8 xs:right-8 p-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-all z-10"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <AnimatePresence mode="wait">
            {!successStep ? (
              <motion.div
                key="form-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-6"
              >
                {/* Header indicators */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-sm">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                      Mise en avant
                    </span>
                    <h2 className="text-xl xs:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight mt-1">
                      Booster votre création
                    </h2>
                  </div>
                </div>

                {/* Sub info about promotion bidding */}
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed text-left">
                  Mettez en avant <b>{product.name}</b> dans la vitrine à la une du catalogue. Plus votre investissement est grand, plus votre produit sera affiché parmi les tout premiers.
                </p>

                <form onSubmit={handlePromoteSubmit} className="space-y-6 text-left">
                  {/* Select bid presets */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                      INVESTISSEMENT DE PROMOTION (HTG)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['150', '500', '1000', '2500'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          className={`py-3 rounded-xl text-xs font-black transition-all ${
                            amount === preset 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                              : 'bg-gray-50 dark:bg-slate-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-755'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom manual bid field */}
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min={100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Saisir un montant personnalisé (min 100)"
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-850 border border-gray-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-sm font-black text-indigo-600 dark:text-indigo-400 font-sans"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      HTG
                    </span>
                  </div>

                  {/* Payment method selection */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                      SOURCE DU PAIEMENT
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Store balance payment */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('balance')}
                        className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                          paymentMethod === 'balance'
                            ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10'
                            : 'border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <Wallet className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">Solde Marchand</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Solde: {withdrawableBalance.toLocaleString()} HTG</p>
                        </div>
                      </button>

                      {/* External MonCash payment */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('external')}
                        className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                          paymentMethod === 'external'
                            ? 'border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10'
                            : 'border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <CreditCard className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">MonCash / NatCash</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Paiement Mobile Sécurisé</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic warning banner if payment is balance but balance is small */}
                  {paymentMethod === 'balance' && withdrawableBalance < parseFloat(amount) && (
                    <div className="bg-rose-50/80 border border-rose-100/60 p-4 rounded-2xl flex items-start gap-2.5 text-rose-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold leading-normal">
                        Votre solde marchand ({withdrawableBalance.toLocaleString()} HTG) est inférieur au montant choisi ({parseFloat(amount).toLocaleString()} HTG). Veuillez sélectionner un paiement par MonCash / NatCash.
                      </p>
                    </div>
                  )}

                  {/* Submission and Action Buttons */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting || (paymentMethod === 'balance' && withdrawableBalance < parseFloat(amount))}
                      className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 active:scale-98 transition-all shadow-xl shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-20 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        `Booster pour ${parseFloat(amount || '0').toLocaleString()} HTG`
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 text-center space-y-6"
              >
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-50 shadow-sm animate-bounce">
                  <Check className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Boost Activé !</h3>
                  <p className="text-sm font-medium text-gray-400 max-w-sm mx-auto leading-relaxed">
                    Félicitations, votre produit <b>{product.name}</b> a été propulsé au sommet de la page d'accueil !
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs select-none">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Nouveau Bid : {parseFloat(amount).toLocaleString()} HTG</span>
                </div>

                <div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    FERMER
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
