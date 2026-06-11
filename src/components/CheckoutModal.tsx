import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, ArrowRight, CreditCard, Smartphone, Check, AlertCircle, ExternalLink, Loader2, Star, ShoppingBag } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { doc, runTransaction, serverTimestamp, increment, collection } from 'firebase/firestore';
import { submitReview } from '../lib/reviews';
import toast from 'react-hot-toast';
import { MonCashLogo, NatCashLogo, KashPawLogo } from './BrandLogos';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any; // Single product
  cartItems?: any[]; // Multiple products from cart
  onSuccess: () => void;
  onBackToCatalog?: () => void;
}

export default function CheckoutModal({ isOpen, onClose, product, cartItems, onSuccess, onBackToCatalog }: CheckoutModalProps) {
  const [step, setStep] = useState<'method' | 'processing' | 'redirect' | 'success'>('method');
  const [selectedMethod, setSelectedMethod] = useState<'moncash' | 'natcash' | 'kashpaw' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [paymentRefId, setPaymentRefId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pollingRef = useRef<(() => void) | null>(null);

  const [createdOrders, setCreatedOrders] = useState<any[]>([]);

  // Reviews interactive feedback
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittedRatings, setSubmittedRatings] = useState<Record<string, boolean>>({});

  const handleSendReview = async (item: any) => {
    const rVal = ratings[item.id];
    if (!rVal) return;

    try {
      await submitReview({
        sellerId: item.sellerId,
        buyerId: auth.currentUser?.uid || 'anonymous',
        buyerName: auth.currentUser?.displayName || 'Client Anonyme',
        productId: item.id,
        productName: item.name,
        rating: rVal,
        comment: comments[item.id] || '',
      });
      setSubmittedRatings(prev => ({ ...prev, [item.id]: true }));
      toast.success(`Votre évaluation pour ${item.name} a été enregistrée !`, {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'enregistrement de votre avis.");
    }
  };

  const items = cartItems && cartItems.length > 0 ? cartItems : (product ? [product] : []);
  const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const deliveryTotal = items.reduce((sum, item) => {
    const dPrice = item.deliveryPrice !== undefined && item.deliveryPrice !== null ? parseFloat(item.deliveryPrice.toString()) : 150;
    return sum + dPrice;
  }, 0);
  const total = subtotal + deliveryTotal;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('method');
      setSelectedMethod(null);
      setPhoneNumber('');
      setRedirectUrl('');
      setPaymentRefId('');
      setErrorMessage('');
      setRatings({});
      setComments({});
      setSubmittedRatings({});
      setCreatedOrders([]);
    }
    return () => {
      if (pollingRef.current) {
        pollingRef.current();
      }
    };
  }, [isOpen]);

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const isAmountValid = total >= 20;
  const isValidForMethod = () => {
    if (!isAmountValid) return false;
    if (!selectedMethod) return false;
    if (cleanPhone.length !== 8) return false;
    if (selectedMethod === 'moncash' && !cleanPhone.startsWith('3')) return false;
    if (selectedMethod === 'natcash' && !cleanPhone.startsWith('4')) return false;
    return true;
  };

  const startStatusPolling = (referenceId: string) => {
    if (pollingRef.current) {
      pollingRef.current();
    }

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 120) { // Timeout after 6 minutes
        clearInterval(interval);
        setErrorMessage("Le paiement a expiré ou a mis trop de temps. Veuillez refaire une tentative.");
        setStep('method');
        return;
      }

      try {
        const checkRes = await fetch(getApiUrl('/api/payments/verify-payment'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refference_id: referenceId
          })
        });

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          // checkData.trans_status holds 'ok' (completed) or 'no' (pending)
          if (checkData.trans_status === 'ok') {
            clearInterval(interval);
            await finalizeOrder(checkData, referenceId);
          }
        }
      } catch (err) {
        console.error("Error checking transaction status", err);
      }
    }, 4000); // Check status every 4 seconds

    pollingRef.current = () => {
      clearInterval(interval);
    };
  };

  const finalizeOrder = async (plopplopData: any, referenceId: string) => {
    setStep('processing');
    try {
      const localOrders: any[] = [];
      
      await runTransaction(db, async (transaction) => {
        const isAdmin = auth.currentUser?.email === 'ghostytb77777@gmail.com';

        for (const item of items) {
          const productRef = doc(db, 'products', item.id);
          const productSnap = await transaction.get(productRef);
          
          if (!productSnap.exists()) throw new Error(`Produit ${item.name} inexistant`);
          
          const currentStock = productSnap.data().stock;
          const quantityToBuy = item.quantity || 1;

          if (!isAdmin && currentStock < quantityToBuy) {
            throw new Error(`Rupture de stock pour ${item.name}`);
          }

          // Update product stock
          transaction.update(productRef, {
            stock: Math.max(0, currentStock - quantityToBuy),
            updatedAt: serverTimestamp()
          });

          // Generate a 5-digit verification code string for this product line item
          const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();

          const itemTotal = item.price * quantityToBuy;
          const deliveryPriceItem = item.deliveryPrice !== undefined && item.deliveryPrice !== null ? parseFloat(item.deliveryPrice.toString()) : 150;
          const deliveryTimeItem = item.deliveryTime || '2-4 jours';
          const trackingId = 'LAKAY-TRK-' + Math.floor(100000 + Math.random() * 900000).toString();
          
          const sellerNet = (itemTotal * 0.90) + deliveryPriceItem;
          
          const orderDocRef = doc(collection(db, 'orders'));
          localOrders.push({
            id: orderDocRef.id,
            productName: item.name,
            productImage: item.images?.[0] || item.image || '',
            quantity: quantityToBuy,
            price: item.price,
            totalAmount: itemTotal + deliveryPriceItem,
            verificationCode: verificationCode,
            status: 'pending_delivery',
            deliveryTime: deliveryTimeItem,
            deliveryPrice: deliveryPriceItem,
            deliveryTrackingId: trackingId
          });

          // Create the Order document holding funds pending safe delivery
          transaction.set(orderDocRef, {
            id: orderDocRef.id,
            buyerId: auth.currentUser?.uid || 'anonymous',
            buyerEmail: auth.currentUser?.email || '',
            buyerName: auth.currentUser?.displayName || 'Client Anonyme',
            sellerId: item.sellerId,
            productId: item.id,
            productName: item.name,
            productImage: item.images?.[0] || item.image || '',
            price: item.price,
            quantity: quantityToBuy,
            totalAmount: itemTotal + deliveryPriceItem,
            commissionAmount: itemTotal * 0.07,
            sellerNetAmount: sellerNet,
            status: 'pending_delivery',
            verificationCode: verificationCode,
            deliveryTime: deliveryTimeItem,
            deliveryPrice: deliveryPriceItem,
            deliveryTrackingId: trackingId,
            createdAt: serverTimestamp(),
            unlockedAt: null
          });

          // Update seller stats holding the balance in pending field
          const sellerRef = doc(db, 'users', item.sellerId);
          transaction.set(sellerRef, {
            pendingRevenue: increment(sellerNet),
            totalSales: increment(quantityToBuy),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        // Update platform commission statistics (7% displayed as profits, 3% is the payment service operator fee)
        const systemStatsRef = doc(db, 'system', 'stats');
        transaction.set(systemStatsRef, {
          platformCommission: increment(total * 0.07),
          totalGrossVolume: increment(total),
          totalTransactions: increment(1),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Create transaction logs
        const transactionDocRef = doc(db, 'transactions', referenceId);
        transaction.set(transactionDocRef, {
          buyerId: auth.currentUser?.uid,
          buyerEmail: auth.currentUser?.email || '',
          buyerName: auth.currentUser?.displayName || 'Anonyme',
          phoneNumber: cleanPhone,
          paymentMethod: selectedMethod,
          plopplopTransactionId: plopplopData.id_transaction || '',
          plopplopReferenceId: referenceId,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            sellerId: item.sellerId,
            commissionAmount: item.price * (item.quantity || 1) * 0.07,
            sellerNetAmount: item.price * (item.quantity || 1) * 0.90
          })),
          totalAmount: total,
          commissionAmount: total * 0.07,
          sellerNetAmount: total * 0.90,
          status: 'completed',
          createdAt: serverTimestamp()
        });
      });

      setCreatedOrders(localOrders);
      setStep('success');
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `checkout`);
      setStep('method');
    }
  };

  const handlePayment = async () => {
    if (!auth.currentUser || !selectedMethod || items.length === 0 || !isValidForMethod()) return;

    setStep('processing');
    setErrorMessage('');
    
    // Generate a secure reference
    const referenceId = 'CMD-' + Date.now().toString();
    setPaymentRefId(referenceId);

    try {
      const response = await fetch(getApiUrl('/api/payments/create-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          montant: total,
          payment_method: selectedMethod,
          refference_id: referenceId
        })
      });

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        // Response wasn't valid JSON
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "L'API de facturation a répondu avec une erreur.");
      }

      if (data.status && data.url) {
        // Enregistrer la session de paiement en attente dans le localStorage pour la récupération automatique
        const pendingCheckout = {
          referenceId,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            sellerId: item.sellerId,
            deliveryPrice: item.deliveryPrice !== undefined && item.deliveryPrice !== null ? parseFloat(item.deliveryPrice.toString()) : 150,
            deliveryTime: item.deliveryTime || '2-4 jours',
            images: item.images || [item.image || '']
          })),
          selectedMethod,
          phoneNumber: cleanPhone,
          total,
          timestamp: Date.now()
        };
        localStorage.setItem('lakay_pending_payment', JSON.stringify(pendingCheckout));

        // Met à jour l'URL et passe à l'état de redirection
        setRedirectUrl(data.url);
        setStep('redirect');

        // Démarre la vérification automatique en arrière-plan
        startStatusPolling(referenceId);
      } else {
        throw new Error(data.message || "Impossible d'initialiser la session de facturation.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erreur de communication avec le portail de paiement.");
      setStep('method');
    }
  };

  return (
    <AnimatePresence>
      {(isOpen && (items.length > 0 || step === 'success')) && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: 40 }}
            className="relative w-full max-w-lg bg-white rounded-[1.75rem] xs:rounded-[3rem] shadow-2xl overflow-y-auto max-h-[92vh] scrollbar-hide border border-white/20 my-auto"
          >
          {step !== 'processing' && (
            <button 
              onClick={onClose}
              className="absolute top-4 xs:top-8 right-4 xs:right-8 p-2 xs:p-3 text-gray-400 hover:text-gray-900 transition-all z-10 bg-white/80 rounded-full"
            >
              <X className="h-4 w-4 xs:h-5 xs:w-5" />
            </button>
          )}

          <div className="p-5 xs:p-10 md:p-14">
            {step === 'method' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-8">
                  <span className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-widest rounded-full">Finaliser l'achat</span>
                  <h2 className="text-3xl font-black text-gray-900 mt-4 leading-tight">
                    {items.length === 1 ? items[0].name : `${items.length} Articles`}
                  </h2>
                  <div className="mt-4 p-4 bg-gray-50/65 rounded-[1.25rem] border border-gray-100/50 space-y-1.5 text-xs text-left">
                    <div className="flex justify-between font-bold text-gray-400 uppercase tracking-wider text-[9px]">
                      <span>Détails de facturation</span>
                      <span>HTG (Gourdes)</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-gray-100/50 text-gray-600 font-medium font-mono">
                      <span>Sous-total articles :</span>
                      <span>{subtotal.toLocaleString()} HTG</span>
                    </div>
                    <div className="flex justify-between py-1 text-gray-600 font-medium font-mono">
                      <span>Frais de livraison :</span>
                      <span>{deliveryTotal === 0 ? 'Gratuit' : `${deliveryTotal.toLocaleString()} HTG`}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200/50 font-black text-gray-900 text-sm font-mono">
                      <span>Total général :</span>
                      <span className="text-brand">{total.toLocaleString()} HTG</span>
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start gap-3 border border-red-100">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Choisissez votre moyen de paiement</p>
                  
                  <button 
                    onClick={() => setSelectedMethod('moncash')}
                    className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                      selectedMethod === 'moncash' ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <MonCashLogo />
                      <div className="text-left">
                        <p className="font-black text-gray-900">MonCash</p>
                        <p className="text-xs text-gray-400 font-medium">Paiement instantané via Digicel</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'moncash' ? 'border-brand bg-brand' : 'border-gray-200'}`}>
                      {selectedMethod === 'moncash' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>

                  <button 
                    onClick={() => setSelectedMethod('natcash')}
                    className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                      selectedMethod === 'natcash' ? 'border-[#0091FF] bg-[#0091FF]/5' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <NatCashLogo />
                      <div className="text-left">
                        <p className="font-black text-gray-900">NatCash</p>
                        <p className="text-xs text-gray-400 font-medium">Paiement sécurisé via Natcom</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'natcash' ? 'border-[#0091FF] bg-[#0091FF]' : 'border-gray-200'}`}>
                      {selectedMethod === 'natcash' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>

                  <button 
                    onClick={() => setSelectedMethod('kashpaw')}
                    className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${
                      selectedMethod === 'kashpaw' ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <KashPawLogo />
                      <div className="text-left">
                        <p className="font-black text-gray-900">KashPaw</p>
                        <p className="text-xs text-gray-400 font-medium">Paiement instantané via KashPaw</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === 'kashpaw' ? 'border-[#8B5CF6] bg-[#8B5CF6]' : 'border-gray-200'}`}>
                      {selectedMethod === 'kashpaw' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>

                  {selectedMethod && (
                    <div className="mt-8 space-y-2.5 pt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-3 duration-300">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
                        <span>Numéro de téléphone</span>
                        <span className="text-[9px] text-brand uppercase tracking-wider font-extrabold font-mono">8 chiffres</span>
                      </label>
                      <div id="phone-input-wrapper" className="relative flex items-center group/input">
                        <span className="absolute left-5 font-black text-gray-400 text-sm tracking-widest bg-gray-100/60 px-2 py-1 rounded-lg border border-gray-200/50">+509</span>
                        <input
                          id="phone-number-field"
                          type="text"
                          inputMode="tel"
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9 ]/g, '').trimStart();
                            setPhoneNumber(val);
                          }}
                          placeholder={selectedMethod === 'moncash' ? "3XXX XXXX" : selectedMethod === 'natcash' ? "4XXX XXXX" : "3XXX XXXX ou 4XXX XXXX"}
                          className="w-full pl-22 pr-6 py-4.5 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-brand/40 outline-none transition-all text-sm font-black tracking-widest placeholder:text-gray-300 placeholder:font-mono shadow-inner"
                        />
                      </div>
                      
                      {!isAmountValid && (
                        <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100/50 animate-in shake-in flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <span>Le montant de la transaction doit être d'au moins 20 HTG ({total.toLocaleString()} HTG actuels). Ajoutez des articles à votre panier.</span>
                        </div>
                      )}

                      {isAmountValid && cleanPhone.length > 0 && !isValidForMethod() && (
                        <p className="text-[10px] font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100/50 animate-in shake-in">
                          {selectedMethod === 'moncash' 
                            ? "Pour MonCash, le numéro doit obligatoirement commencer par 3 et contenir 8 chiffres." 
                            : selectedMethod === 'natcash'
                            ? "Pour NatCash, le numéro doit obligatoirement commencer par 4 et contenir 8 chiffres."
                            : "Pour KashPaw, le numéro doit comporter exactement 8 chiffres haïtiens."}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-10">
                  <button
                    disabled={!isValidForMethod()}
                    onClick={handlePayment}
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-20 cursor-pointer"
                  >
                    {!isAmountValid ? "Montant insuffisant (< 20 HTG)" : <>Suivant <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <p className="text-center text-[10px] text-gray-300 font-bold mt-6 uppercase tracking-widest flex items-center justify-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> Services de Paiement Mobile Sécurisés
                  </p>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="py-20 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 border-4 border-gray-100 border-t-brand rounded-full animate-spin mb-8"></div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Traitement de votre commande...</h3>
                <p className="text-gray-400 font-medium mt-2">Génération du lien sécurisé de paiement...</p>
              </div>
            )}

            {step === 'redirect' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 text-center">
                <div className="w-20 h-20 bg-brand/5 border border-brand/20 text-brand rounded-[2.2rem] flex items-center justify-center mx-auto mb-8 shadow-inner animate-pulse">
                  <Smartphone className="h-9 w-9" />
                </div>
                
                <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">Portail de paiement généré</h3>
                <p className="text-gray-400 text-xs font-medium mt-3 max-w-sm mx-auto leading-relaxed">
                  Un lien de paiement officiel et sécurisé a été généré pour finaliser votre transaction en toute sécurité via <b className="text-gray-900 uppercase font-black">{selectedMethod}</b>.
                </p>

                <div className="my-8 py-3 bg-gray-50 rounded-2xl text-[11px] font-mono font-black text-gray-500 border border-gray-100/80 uppercase tracking-widest">
                  Réf: {paymentRefId}
                </div>

                <div className="space-y-4">
                  <a
                    href={redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-brand text-white rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-brand/90 active:scale-97 transition-all shadow-xl shadow-brand/10 cursor-pointer"
                  >
                    Ouvrir le portail sécurisé <ExternalLink className="h-4 w-4" />
                  </a>

                  <div className="p-6 border border-gray-50 rounded-3xl bg-gray-50/20 text-left space-y-4 mt-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4.5 w-4.5 text-brand animate-spin shrink-0" />
                      <p className="text-xs font-black text-gray-700">En attente de votre validation...</p>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                      Effectuez le versement sur le portail sécurisé. Notre système vérifie continuellement l'état de la transaction en arrière-plan. Dès le paiement reçu, cette fenêtre se mettra à jour automatiquement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-10 text-center animate-in scale-in-95 duration-500 overflow-y-auto max-h-[75vh] pr-1.5">
                <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
                  <ShieldCheck className="h-9 w-9 text-white" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none text-center">Achat sécurisé validé !</h3>
                <p className="text-gray-400 text-xs font-medium mt-3 max-w-xs mx-auto leading-relaxed">
                  Votre versement via <span className="font-extrabold uppercase text-gray-800">{selectedMethod}</span> a été reçu et mis en sécurité chez LakayMarket en attente de votre livraison.
                </p>

                {/* Anti-Fraud Delivery Security Codes List */}
                <div className="my-6 p-5 bg-amber-50 border border-amber-100 rounded-3xl text-left space-y-3">
                  <p className="text-[10px] font-black tracking-widest uppercase text-amber-700 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600 animate-pulse" /> CODE DE VÉRIFICATION ANTI-FRAUDE
                  </p>
                  <p className="text-[11px] text-amber-805 font-bold leading-relaxed">
                    Donnez ce code unique à l'artisan en main propre uniquement <b>lors de la livraison physique</b> pour débloquer votre produit et valider la transaction. Ne le partagez pas en ligne !
                  </p>
                  
                  {createdOrders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-2xl border border-amber-100/60 flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {order.productImage ? (
                          <img src={order.productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 flex-shrink-0">
                            <ShoppingBag className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold text-gray-950 truncate leading-tight">{order.productName}</p>
                          <p className="text-[9px] font-bold text-gray-400">Qté: {order.quantity}</p>
                        </div>
                      </div>
                      <div className="bg-amber-500 text-white px-3.5 py-1.5 rounded-xl font-mono font-black text-xs tracking-wider shadow-md select-all">
                        {order.verificationCode}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Star-Rating interactive form */}
                <div className="mt-8 border-t border-gray-100 pt-8 text-left">
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase tracking-widest rounded-md">
                    Laisser un avis
                  </span>
                  <h4 className="text-base font-black text-gray-900 mt-2 mb-1">
                    Évaluez votre expérience
                  </h4>
                  <p className="text-[10px] text-gray-400 font-bold mb-6">
                    Soutenez nos artisans locaux en laissant une note de 1 à 5 étoiles sur vos articles achetés.
                  </p>

                  <div className="space-y-4">
                    {items.map((item) => {
                      const currentRating = ratings[item.id] || 0;
                      const currentComment = comments[item.id] || '';
                      const isSubmitted = submittedRatings[item.id] || false;

                      return (
                        <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                          <div className="flex items-center gap-2.5">
                            {item.images?.[0] ? (
                              <img src={item.images[0]} alt="" className="w-8 h-8 object-cover rounded-lg shrink-0 border border-gray-200" />
                            ) : (
                              <div className="w-8 h-8 bg-white border border-gray-200 flex items-center justify-center text-gray-300 shrink-0 rounded-lg">
                                <Star className="h-3 w-3" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-gray-900 leading-tight truncate">{item.name}</p>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{item.sellerCompanyName || 'Studio Partenaire'}</p>
                            </div>
                          </div>

                          {isSubmitted ? (
                            <div className="flex items-center gap-2 py-1.5 text-green-600 bg-green-50 rounded-xl px-3 border border-green-100/50">
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-[9px] font-black uppercase tracking-wider">Avis enregistré !</span>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Stars list */}
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRatings(prev => ({ ...prev, [item.id]: star }))}
                                    className="p-1 -m-1 transition-transform active:scale-90 cursor-pointer"
                                  >
                                    <Star
                                      className={`h-5 w-5 transition-colors ${
                                        star <= currentRating 
                                          ? 'fill-amber-400 text-amber-400' 
                                          : 'text-gray-200 fill-gray-200 hover:text-amber-200'
                                      }`}
                                    />
                                  </button>
                                ))}
                                {currentRating > 0 && (
                                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest ml-2">
                                    {currentRating === 5 ? 'Excellent !' : currentRating === 4 ? 'Très bon' : currentRating === 3 ? 'Moyen' : currentRating === 2 ? 'Décevant' : 'Très décevant'}
                                  </span>
                                )}
                              </div>

                              {/* Commentary input */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Votre avis (Optionnel)..."
                                  value={currentComment}
                                  onChange={(e) => setComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none text-[11px] font-bold text-gray-800 placeholder:text-gray-300 pointer-events-auto"
                                />
                                <button
                                  type="button"
                                  disabled={currentRating === 0}
                                  onClick={() => handleSendReview(item)}
                                  className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-[9px] font-black tracking-widest uppercase disabled:opacity-25 cursor-pointer flex items-center justify-center shrink-0"
                                >
                                  Envoyer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                    if (onBackToCatalog) {
                      onBackToCatalog();
                    }
                    onClose();
                  }}
                  className="mt-10 w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all cursor-pointer"
                >
                  Continuer mes achats
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
}

