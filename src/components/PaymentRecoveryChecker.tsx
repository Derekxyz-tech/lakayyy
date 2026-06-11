import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { doc, runTransaction, serverTimestamp, increment, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentRecoveryChecker() {
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showUI, setShowUI] = useState(false);
  const [pendingRef, setPendingRef] = useState('');

  useEffect(() => {
    let active = true;
    let timerId: any = null;

    // Listen to authentication changes so we have the user context
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setChecking(false);
        setShowUI(false);
        return;
      }

      // Check if there's a pending payment session in localStorage
      const stored = localStorage.getItem('lakay_pending_payment');
      if (!stored) return;

      try {
        const pending = JSON.parse(stored);
        if (!pending || !pending.referenceId) {
          localStorage.removeItem('lakay_pending_payment');
          return;
        }

        // Ignore sessions older than 4 hours to avoid stale popups
        const age = Date.now() - (pending.timestamp || 0);
        if (age > 4 * 60 * 60 * 1000) {
          localStorage.removeItem('lakay_pending_payment');
          return;
        }

        setPendingRef(pending.referenceId);
        // Start verification
        verifyAndFinalize(pending, user);
      } catch (e) {
        console.error("Error parsing pending payment:", e);
        localStorage.removeItem('lakay_pending_payment');
      }
    });

    const verifyAndFinalize = async (pending: any, user: any) => {
      if (!active) return;
      setChecking(true);
      setShowUI(true);

      // We poll/verify the gateway up to 3 times to accommodate delays in the background
      let verified = false;
      let checkData: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Recovery] Verifying reference: ${pending.referenceId}, attempt ${attempt}/3`);
          const res = await fetch(getApiUrl('/api/payments/verify-payment'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refference_id: pending.referenceId })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.trans_status === 'ok') {
              verified = true;
              checkData = data;
              break;
            }
          } else {
            // Check if the transaction does not exist on the PlopPlop gateway (e.g. stale sandbox/simulated checkout)
            let errorData: any = {};
            try {
              errorData = await res.json();
            } catch (e) {}

            if (res.status === 404 || errorData.message?.includes('not found') || errorData.message?.includes('introuvable')) {
              console.log(`[Recovery] Transaction reference ${pending.referenceId} not found on gateway. Clearing local storage tracker.`);
              localStorage.removeItem('lakay_pending_payment');
              setChecking(false);
              setShowUI(false);
              return;
            }
          }
        } catch (err: any) {
          // Log network or offline state gracefully as warning rather than severe console.error
          console.warn(`[Recovery] Attempt ${attempt} was unable to reach verify-payment endpoint (initializing or offline). Error: ${err?.message || err}`);
        }

        // Wait 3 seconds before next verification attempt
        if (attempt < 3 && !verified) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      if (!verified) {
        // Payment is not completed yet, or still pending on the gateway.
        // We do not erase it in case they close and finish, but we hide our checking loader after a few seconds.
        setChecking(false);
        setErrorMsg("Le paiement n'a pas encore été finalisé ou validé par l'opérateur.");
        
        timerId = setTimeout(() => {
          setShowUI(false);
        }, 6000);
        return;
      }

      // Finalize the orders inside the database safely
      try {
        console.log(`[Recovery] Payment validated! Writing order to Firestore: ${pending.referenceId}`);
        
        await runTransaction(db, async (transaction) => {
          // 1. First check if this transaction reference ID already exists in Firestore to avoid duplicate creation
          const transactionDocRef = doc(db, 'transactions', pending.referenceId);
          const txnSnap = await transaction.get(transactionDocRef);

          if (txnSnap.exists()) {
            console.log(`[Recovery] Transaction ${pending.referenceId} already exists in Firestore. Clearing localStorage tracker.`);
            return; // Already processed! Safe exit
          }

          // 2. We proceed with generating orders
          const isAdmin = user.email === 'ghostytb77777@gmail.com';

          for (const item of pending.items) {
            const productRef = doc(db, 'products', item.id);
            const productSnap = await transaction.get(productRef);
            
            if (!productSnap.exists()) {
              console.warn(`[Recovery] Product ${item.name} not found`);
              continue;
            }

            const currentStock = productSnap.data().stock || 0;
            const quantityToBuy = item.quantity || 1;

            if (!isAdmin && currentStock < quantityToBuy) {
              console.warn(`[Recovery] Low stock for ${item.name}: available ${currentStock}`);
            }

            // Update product stock
            transaction.update(productRef, {
              stock: Math.max(0, currentStock - quantityToBuy),
              updatedAt: serverTimestamp()
            });

            // Generate Verification code
            const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
            const itemTotal = item.price * quantityToBuy;
            const deliveryPriceItem = item.deliveryPrice !== undefined && item.deliveryPrice !== null ? parseFloat(item.deliveryPrice.toString()) : 150;
            const deliveryTimeItem = item.deliveryTime || '2-4 jours';
            const trackingId = 'LAKAY-TRK-' + Math.floor(100000 + Math.random() * 900000).toString();
            const sellerNet = (itemTotal * 0.90) + deliveryPriceItem;

            const orderDocRef = doc(collection(db, 'orders'));
            
            // Create target Order document
            transaction.set(orderDocRef, {
              id: orderDocRef.id,
              buyerId: user.uid,
              buyerEmail: user.email || '',
              buyerName: user.displayName || 'Client Anonyme',
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

            // Update seller wallet
            const sellerRef = doc(db, 'users', item.sellerId);
            transaction.set(sellerRef, {
              pendingRevenue: increment(sellerNet),
              totalSales: increment(quantityToBuy),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }

          // Update general platform commission statistics
          const systemStatsRef = doc(db, 'system', 'stats');
          transaction.set(systemStatsRef, {
            platformCommission: increment(pending.total * 0.07),
            totalGrossVolume: increment(pending.total),
            totalTransactions: increment(1),
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Log transaction
          transaction.set(transactionDocRef, {
            buyerId: user.uid,
            buyerEmail: user.email || '',
            buyerName: user.displayName || 'Anonyme',
            phoneNumber: pending.phoneNumber || '',
            paymentMethod: pending.selectedMethod || 'moncash',
            plopplopTransactionId: checkData.id_transaction || '',
            plopplopReferenceId: pending.referenceId,
            items: pending.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1,
              sellerId: item.sellerId,
              commissionAmount: item.price * (item.quantity || 1) * 0.07,
              sellerNetAmount: item.price * (item.quantity || 1) * 0.90
            })),
            totalAmount: pending.total,
            commissionAmount: pending.total * 0.07,
            sellerNetAmount: pending.total * 0.90,
            status: 'completed',
            createdAt: serverTimestamp()
          });
        });

        // Clear localStorage upon successful finalization
        localStorage.removeItem('lakay_pending_payment');
        setChecking(false);
        setSuccess(true);
        setErrorMsg('');

        toast.success("Félicitations ! Votre paiement a été détecté et votre commande est maintenant confirmée !", {
          duration: 8000,
          style: {
            borderRadius: '20px',
            background: '#0F172A',
            color: '#34D399',
            fontWeight: '900',
            fontSize: '12px',
            letterSpacing: '0.02em',
            border: '2px solid #10B981'
          }
        });

        timerId = setTimeout(() => {
          setShowUI(false);
        }, 12000);

      } catch (err: any) {
        console.error("[Recovery] Error saving retrieved order:", err);
        setChecking(false);
        setErrorMsg(`Erreur lors de l'enregistrement de votre commande en base de données.`);
      }
    };

    return () => {
      active = false;
      unsubscribeAuth();
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleManualDismiss = () => {
    setShowUI(false);
  };

  const handleManualClear = () => {
    localStorage.removeItem('lakay_pending_payment');
    setShowUI(false);
  };

  return null;
}
