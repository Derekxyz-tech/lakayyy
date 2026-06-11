import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, ArrowRight, Smartphone, AlertCircle, Sparkles } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { doc, runTransaction, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { MonCashLogo, NatCashLogo, KashPawLogo } from './BrandLogos';

interface AdminWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemStats: any;
  platformCommissions: number;
  onSuccess: () => void;
}

export default function AdminWithdrawModal({ isOpen, onClose, systemStats, platformCommissions, onSuccess }: AdminWithdrawModalProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'moncash' | 'natcash' | 'kashpaw' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingMsg, setProcessingMsg] = useState('Traitement de votre virement admin...');

  const platformWithdrawn = systemStats?.platformWithdrawn || 0;
  const withdrawableBalance = Math.max(0, platformCommissions - platformWithdrawn);
  const minimumLimit = systemStats?.minimumWithdrawLimit !== undefined ? systemStats.minimumWithdrawLimit : 2500;

  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setWithdrawAmount('');
      setSelectedMethod(null);
      setPhoneNumber('');
      setErrorMessage('');
    }
  }, [isOpen]);

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  
  const isValidPhone = () => {
    if (cleanPhone.length !== 8) return false;
    if (selectedMethod === 'moncash' && !cleanPhone.startsWith('3')) return false;
    if (selectedMethod === 'natcash' && !cleanPhone.startsWith('4')) return false;
    return true;
  };

  const amountNumber = parseFloat(withdrawAmount) || 0;
  const isValidAmount = () => {
    return amountNumber >= minimumLimit && amountNumber <= withdrawableBalance && withdrawableBalance >= minimumLimit;
  };

  const handleWithdraw = async () => {
    if (!auth.currentUser || !selectedMethod || !isValidPhone() || !isValidAmount()) return;

    setStep('processing');
    setErrorMessage('');
    setProcessingMsg('Transfert des profits de la plate-forme en cours...');

    const referenceId = 'WD-ADM-' + Date.now().toString();
    // Normalize to 509XXXXXXXX format as required by PLOP PLOP API
    const recipientFormatted = '509' + cleanPhone;

    try {
      setProcessingMsg('Envoi sécurisé du virement administrateur...');
      const response = await fetch(getApiUrl('/api/withdrawals/request-admin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountNumber,
          method: selectedMethod,
          recipient: recipientFormatted,
          reference: referenceId
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
         throw new Error(resData.message || "Le transfert a été rejeté par l'opérateur local ou le solde de réserve de l'API PLOP PLOP est momentanément insuffisant.");
      }

      // Enregistrement de la transaction sécurisée côté client (car l'admin dispose des permissions d'écriture Firestore)
      const transactionId = resData.data?.transaction_id || resData.transaction_id || "";
      const finalFee = resData.data?.fee || resData.fee || Math.round(amountNumber * 0.04 * 100) / 100;

      const sysStatsRef = doc(db, 'system', 'stats');
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(sysStatsRef);
        if (!snap.exists()) throw new Error("Stats globales de la plateforme inexistantes.");
        
        const currentWithdrawn = snap.data()?.platformWithdrawn || 0;
        transaction.update(sysStatsRef, {
          platformWithdrawn: currentWithdrawn + amountNumber,
          updatedAt: serverTimestamp()
        });
      });

      await addDoc(collection(db, 'withdrawals'), {
        sellerId: 'admin_platform',
        amount: amountNumber,
        method: selectedMethod,
        recipient: recipientFormatted,
        reference: referenceId,
        plopplopTransactionId: transactionId,
        plopplopReference: referenceId,
        fee: finalFee,
        status: 'success',
        createdAt: serverTimestamp()
      });

      setStep('success');
      onSuccess();
    } catch (err: any) {
      console.error("Admin withdrawal error:", err);
      setErrorMessage(err.message || "Une erreur inconnue s'est produite lors de la transaction administrateur.");
      setStep('form');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 my-auto animate-in duration-300"
          >
          {step !== 'processing' && (
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-900 transition-all z-10"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="p-10 md:p-14 text-left">
            {step === 'form' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="mb-8">
                  <span className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 w-fit">
                    <Sparkles className="h-3 w-3" /> Retrait Propriétaire (Admin)
                  </span>
                  <h2 className="text-3xl font-black text-gray-900 mt-4 leading-tight tracking-tight">
                    Encaisser vos commissions
                  </h2>
                  <div className="space-y-1 mt-3">
                    <p className="text-xs font-semibold text-gray-400 leading-normal">
                      Total commissions collectées : <span className="text-gray-700 font-extrabold">{platformCommissions.toLocaleString()} HTG</span>
                    </p>
                    <p className="text-xs font-semibold text-gray-400 leading-normal">
                      Déjà transféré : <span className="text-blue-600 font-extrabold">{platformWithdrawn.toLocaleString()} HTG</span>
                    </p>
                    <p className="text-xs font-semibold text-gray-400 leading-normal">
                      Solde admin disponible : <span className="text-green-600 font-extrabold text-sm">{withdrawableBalance.toLocaleString()} HTG</span>
                    </p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-start gap-3 border border-red-100 animate-in fade-in-10">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Amount Field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Montant à retirer (HTG)</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        placeholder={`Ex: ${minimumLimit}`}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-brand/40 outline-none transition-all text-sm font-black shadow-inner"
                      />
                      <span className="absolute right-5 text-xs text-gray-400 font-bold bg-white border border-gray-150 px-2.5 py-1 rounded-lg">HTG</span>
                    </div>
                    {withdrawableBalance < minimumLimit && (
                      <p className="text-[10px] text-red-500 bg-red-50 p-4 border border-red-100 font-semibold rounded-xl leading-normal">
                        ⚠️ Solde insuffisant : Vos profits retirables cumulés doivent s'élever à au moins {minimumLimit.toLocaleString()} HTG pour ordonner un transfert sur les réseaux de télécoms haïtiens.
                      </p>
                    )}
                    {withdrawableBalance >= minimumLimit && amountNumber > 0 && amountNumber < minimumLimit && (
                      <p className="text-[10px] text-red-500 font-black">Le montant minimum de retrait admin par transaction est de {minimumLimit.toLocaleString()} HTG.</p>
                    )}
                    {amountNumber >= minimumLimit && amountNumber <= withdrawableBalance && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 font-bold leading-normal">
                        ⚠️ Attention : Les opérateurs de réseaux mobiles prélèvent des frais d'encaissement d'environ 4%. Nous ordonnerons le transfert exact de <span className="font-extrabold text-amber-700">{amountNumber.toLocaleString()} HTG</span> à votre numéro.
                      </p>
                    )}
                    {amountNumber > withdrawableBalance && (
                      <p className="text-[10px] text-red-500 font-bold">Le montant exigé dépasse le solde de commission disponible.</p>
                    )}
                  </div>

                  {/* Method select */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Sélectionner le mode d'encaissement</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        type="button"
                        onClick={() => { setSelectedMethod('moncash'); setPhoneNumber(''); }}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          selectedMethod === 'moncash' ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <MonCashLogo size="sm" />
                        <span className="text-[10px] font-black text-gray-950">MonCash</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { setSelectedMethod('natcash'); setPhoneNumber(''); }}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          selectedMethod === 'natcash' ? 'border-[#0091FF] bg-[#0091FF]/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <NatCashLogo size="sm" />
                        <span className="text-[10px] font-black text-gray-950">NatCash</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => { setSelectedMethod('kashpaw'); setPhoneNumber(''); }}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          selectedMethod === 'kashpaw' ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <KashPawLogo size="sm" />
                        <span className="text-[10px] font-black text-gray-950">KashPaw</span>
                      </button>
                    </div>
                  </div>

                  {/* Phone Field */}
                  {selectedMethod && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
                        <span>Numéro de mobile bénéficiaire (Sécurisé)</span>
                        <span className="text-[9px] text-brand uppercase tracking-wider font-extrabold font-mono">8 chiffres</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-5 font-black text-gray-400 text-sm tracking-widest bg-gray-100/60 px-2 py-1 rounded-lg border border-gray-200/50">+509</span>
                        <input
                          type="text"
                          inputMode="tel"
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9 ]/g, '').trimStart();
                            setPhoneNumber(val);
                          }}
                          placeholder={selectedMethod === 'moncash' ? "3XXX XXXX" : selectedMethod === 'natcash' ? "4XXX XXXX" : "3XXX XXXX ou 4XXX XXXX"}
                          className="w-full pl-22 pr-6 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-brand/40 outline-none transition-all text-sm font-black tracking-widest placeholder:text-gray-300 shadow-inner"
                        />
                      </div>
                      
                      {cleanPhone.length > 0 && !isValidPhone() && (
                        <p className="text-[10px] font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100/50">
                          {selectedMethod === 'moncash' 
                            ? "Le numéro doit impérativement commencer par 3 pour MonCash (8 chiffres pour Haïti)." 
                            : selectedMethod === 'natcash'
                            ? "Le numéro doit impérativement commencer par 4 pour NatCash (8 chiffres pour Haïti)."
                            : "Le numéro doit comporter exactement 8 chiffres haïtiens."}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-10">
                  <button
                    disabled={!selectedMethod || !isValidPhone() || !isValidAmount()}
                    onClick={handleWithdraw}
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-25 cursor-pointer"
                  >
                    Valider le virement admin <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-center text-[10px] text-gray-300 font-bold mt-6 uppercase tracking-widest flex items-center justify-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> Signature HMAC Sec-System Active
                  </p>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="py-20 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 border-4 border-gray-100 border-t-brand rounded-full animate-spin mb-8"></div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{processingMsg}</h3>
                <p className="text-gray-400 font-medium mt-2">Nous envoyons les requêtes cryptographiques HMAC signées vers le réseau partenaire PLOP PLOP...</p>
              </div>
            )}

            {step === 'success' && (
              <div className="py-10 text-center animate-in duration-700">
                <div className="w-24 h-24 bg-brand rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <ShieldCheck className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Retrait Admin réussi !</h3>
                <p className="text-gray-400 font-medium mt-4 max-w-sm mx-auto text-sm leading-relaxed">
                  Votre retrait de commissions de <b className="text-gray-800">{amountNumber.toLocaleString()} HTG</b> a été traité avec succès via <b className="uppercase text-gray-800">{selectedMethod}</b> !
                  Le virement a été crédité en direct sur votre numéro de téléphone d'administration.
                </p>
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="mt-10 px-10 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all cursor-pointer"
                >
                  Continuer sur le Dashboard
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
