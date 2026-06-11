import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Package, Plus, ListFilter, DollarSign, Users, TrendingUp, Settings, ShieldCheck, MessageSquare, BadgeCheck } from 'lucide-react';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, getDocs, runTransaction, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import ProductCard from './ProductCard';
import WithdrawModal from './WithdrawModal';
import PromoteProductModal from './PromoteProductModal';
import toast from 'react-hot-toast';

interface SellerDashboardProps {
  name?: string;
  onAddProduct: () => void;
  onEditProduct: (product: any) => void;
  onBuy: (product: any) => void;
  onOpenSettings: () => void;
  onStartChat?: (userId: string, userName: string) => void;
}

export default function SellerDashboard({ name, onAddProduct, onEditProduct, onBuy, onOpenSettings, onStartChat }: SellerDashboardProps) {
  const user = auth.currentUser;
  const [sellerData, setSellerData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [promotingProduct, setPromotingProduct] = useState<any>(null);

  const [incomingOrders, setIncomingOrders] = useState<any[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [editingTracking, setEditingTracking] = useState<Record<string, string>>({});
  const [isUpdatingTracking, setIsUpdatingTracking] = useState<string | null>(null);

  const [testAmountInput, setTestAmountInput] = useState('10000');
  const [isAddingTestBalance, setIsAddingTestBalance] = useState(false);
  const [testThresholdInput, setTestThresholdInput] = useState('2500');
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);
  const [testPlatformThresholdInput, setTestPlatformThresholdInput] = useState('2500');
  const [isUpdatingPlatformThreshold, setIsUpdatingPlatformThreshold] = useState(false);

  const handleAddTestBalance = async (amount: number) => {
    if (!user) {
      toast.error("Veuillez vous connecter pour effectuer cette action.");
      return;
    }
    if (amount <= 0) {
      toast.error("Veuillez saisir un montant supérieur à 0.");
      return;
    }
    setIsAddingTestBalance(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalRevenue: increment(amount),
        updatedAt: new Date()
      });
      toast.success(`${amount.toLocaleString()} HTG ajoutés avec succès pour le test !`, {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur d'ajout de solde: ${err.message || err}`);
    } finally {
      setIsAddingTestBalance(false);
    }
  };

  const handleSetTestBalance = async (amount: number) => {
    if (!user) {
      toast.error("Veuillez vous connecter pour effectuer cette action.");
      return;
    }
    if (amount < 0) {
      toast.error("Le solde ne peut pas être négatif.");
      return;
    }
    setIsAddingTestBalance(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const totalWithdrawn = sellerData?.totalWithdrawn || 0;
      const targetRevenue = amount + totalWithdrawn;
      await updateDoc(userRef, {
        totalRevenue: targetRevenue,
        updatedAt: new Date()
      });
      toast.success(`Solde retirable défini à ${amount.toLocaleString()} HTG avec succès !`, {
        style: {
          borderRadius: '16px',
          background: '#059669',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur de modification du solde: ${err.message || err}`);
    } finally {
      setIsAddingTestBalance(false);
    }
  };

  const handleSetTestThreshold = async (threshold: number) => {
    if (!user) {
      toast.error("Veuillez vous connecter pour effectuer cette action.");
      return;
    }
    if (threshold < 0) {
      toast.error("Le seuil de retrait ne peut pas être négatif.");
      return;
    }
    setIsUpdatingThreshold(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        minimumWithdrawLimit: threshold,
        updatedAt: new Date()
      });
      toast.success(`Seuil minimum de retrait défini à ${threshold.toLocaleString()} HTG avec succès !`, {
        style: {
          borderRadius: '16px',
          background: '#059669',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur de modification du seuil: ${err.message || err}`);
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  const handleSetPlatformThreshold = async (threshold: number) => {
    if (!user) {
      toast.error("Veuillez vous connecter pour effectuer cette action.");
      return;
    }
    if (threshold < 0) {
      toast.error("Le seuil de retrait plateforme ne peut pas être négatif.");
      return;
    }
    setIsUpdatingPlatformThreshold(true);
    try {
      const statsRef = doc(db, 'system', 'stats');
      await updateDoc(statsRef, {
        minimumWithdrawLimit: threshold,
        updatedAt: new Date()
      });
      toast.success(`Seuil plateforme défini à ${threshold.toLocaleString()} HTG avec succès !`, {
        style: {
          borderRadius: '16px',
          background: '#059669',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur de modification du seuil plateforme: ${err.message || err}`);
    } finally {
      setIsUpdatingPlatformThreshold(false);
    }
  };

  const handleUpdateTrackingId = async (orderId: string, currentVal: string) => {
    const val = editingTracking[orderId] !== undefined ? editingTracking[orderId] : currentVal;
    setIsUpdatingTracking(orderId);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { deliveryTrackingId: val });
      toast.success("Code de suivi de livraison actualisé !", {
        style: {
          borderRadius: '16px',
          background: '#059669',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
        }
      });
      // Clear editing state for this item
      setEditingTracking(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de l'actualisation.");
    } finally {
      setIsUpdatingTracking(null);
    }
  };
  
  useEffect(() => {
    if (!user) return;

    // Listen to seller document for real-time stats (revenue, sales)
    const sellerRef = doc(db, 'users', user.uid);
    const unsubscribeSeller = onSnapshot(sellerRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSellerData(data);
        if (data.minimumWithdrawLimit !== undefined) {
          setTestThresholdInput(data.minimumWithdrawLimit.toString());
        }
      }
    });

    // Listen to system stats for admin platform limit setting
    let unsubscribeStats = () => {};
    if (user.email === 'ghostytb77777@gmail.com') {
      const statsRef = doc(db, 'system', 'stats');
      unsubscribeStats = onSnapshot(statsRef, (snap) => {
        if (snap.exists()) {
          const statsData = snap.data();
          if (statsData.minimumWithdrawLimit !== undefined) {
            setTestPlatformThresholdInput(statsData.minimumWithdrawLimit.toString());
          }
        }
      });
    }

    const q = query(
      collection(db, 'products'), 
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    // Subscribing live to incoming orders
    const ordersQ = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setIncomingOrders(ordersData);
    }, (error) => {
      console.error("Error subscribing to incoming orders:", error);
    });

    return () => {
      unsubscribeSeller();
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeStats();
    };
  }, [user, name]);

  const displayName = sellerData?.sellerRealName || name || sellerData?.sellerName || user?.displayName?.split(' ')[0] || 'Artisan';
  const companyName = sellerData?.companyName || 'Studio Créatif';
  const totalRevenue = sellerData?.totalRevenue || 0;
  const totalSalesCount = sellerData?.totalSales || 0;
  const pendingRevenue = sellerData?.pendingRevenue || 0;

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanCode = verificationCode.trim();
    if (cleanCode.length !== 5) {
      toast.error("Le code de livraison doit contenir exactement 5 chiffres.");
      return;
    }

    setVerifying(true);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('sellerId', '==', user.uid),
        where('verificationCode', '==', cleanCode),
        where('status', '==', 'pending_delivery')
      );

      const orderDocs = await getDocs(q);

      if (orderDocs.empty) {
        toast.error("Code de livraison invalide, déjà débloqué, ou ne correspond à aucune de vos commandes en attente.", {
          duration: 4000,
          style: {
            borderRadius: '16px',
            background: '#EF4444',
            color: '#fff',
            fontWeight: '900',
            fontSize: '11px'
          }
        });
        setVerifying(false);
        return;
      }

      const orderDoc = orderDocs.docs[0];
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      const orderAmount = orderData.sellerNetAmount;
      const productName = orderData.productName;

      await runTransaction(db, async (transaction) => {
        const docRefOrder = doc(db, 'orders', orderId);
        const docRefSeller = doc(db, 'users', user.uid);

        const orderSnap = await transaction.get(docRefOrder);
        if (!orderSnap.exists()) throw new Error("La commande n'existe plus.");
        if (orderSnap.data().status !== 'pending_delivery') {
          throw new Error("Cette commande a déjà été débloquée !");
        }

        // 1. Shift the funds: decrement pendingRevenue, increment withdrawable totalRevenue
        transaction.set(docRefSeller, {
          pendingRevenue: increment(-orderAmount),
          totalRevenue: increment(orderAmount),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Mark the order as delivered / finalized
        transaction.update(docRefOrder, {
          status: 'delivered',
          unlockedAt: serverTimestamp()
        });
      });

      toast.success(`Succès ! ${orderAmount.toLocaleString()} HTG débloqués pour "${productName}".`, {
        icon: '🔓',
        duration: 5000,
        style: {
          borderRadius: '20px',
          background: '#10B981',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '11.5px'
        }
      });
      setVerificationCode('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors du déblocage des fonds.");
    } finally {
      setVerifying(false);
    }
  };
  
  const stats = [
    { label: 'Revenu Total', value: `${totalRevenue.toLocaleString()} HTG`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ventes Totales', value: totalSalesCount.toString(), icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Produits Actifs', value: products.length.toString(), icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Fonds Sécurisés', value: `${pendingRevenue.toLocaleString()} HTG`, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div id="seller-dashboard-container" className="relative min-h-screen">
      {/* Background blobs for glassmorphism pop - reduced opacity */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-brand/3 rounded-full blur-[100px] -z-10" />
      <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-brand/2 rounded-full blur-[100px] -z-10" />

      <div id="seller-dashboard" className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10 px-2 lg:px-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl border border-gray-100 flex items-center justify-center overflow-hidden">
               {sellerData?.photoURL ? (
                 <img src={sellerData.photoURL} alt="Logo" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-2xl font-black text-gray-200">{companyName[0]}</span>
               )}
            </div>
            <div className="space-y-1">
              <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-none">
                Salut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500">{displayName}</span>
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1">
                  <span>{companyName}</span>
                  {sellerData?.verified && (
                    <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10 shrink-0" title="Votre boutique est certifiée et vérifiée !" />
                  )}
                </p>
                <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
                <p className="text-gray-400 font-medium tracking-tight">Vue d'ensemble de votre activité.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenSettings}
              className="p-4 bg-white border border-gray-100 text-gray-400 rounded-2xl hover:text-gray-900 hover:border-gray-200 transition-all shadow-sm"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button 
              onClick={onAddProduct}
              className="flex items-center justify-center gap-2.5 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg shadow-gray-900/10 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <Plus className="h-4.5 w-4.5" />
              Ajouter un produit
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white/40 backdrop-blur-2xl p-7 rounded-[2rem] border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.04)] hover:border-white transition-all group"
            >
              <div className={`w-11 h-11 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-5 border border-white/20 group-hover:bg-white group-hover:scale-105 transition-all`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="text-3xl font-black text-gray-900 mb-0.5 tracking-tight">{stat.value}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Merchant Wallet Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 text-gray-900 dark:text-white rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden flex flex-col gap-8 border border-gray-150 dark:border-white/10"
        >
          {/* Ambient light overlay inside card */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full blur-[80px] -z-0 pointer-events-none" />
          
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 sm:gap-8 relative z-10">
            <div className="space-y-4 max-w-xl text-center xl:text-left flex flex-col justify-center">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center xl:justify-start">
                <span className="px-3.5 py-1.5 bg-gray-900/10 dark:bg-white/10 text-gray-950 dark:text-white text-[9px] font-black uppercase tracking-widest rounded-full w-fit mx-auto sm:mx-0">
                  Portefeuille Marchand Sécurisé
                </span>
                <span className="text-[9px] text-green-600 dark:text-green-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="h-1.5 w-1.5 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" /> Système de Paiement Actif
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">Votre solde disponible</h2>
              <p className="text-xs text-gray-505 dark:text-gray-400 leading-relaxed max-w-md mx-auto xl:mx-0">
                Encaissez vos bénéfices de vente instantanément vers votre compte MonCash ou NatCash. Les fonds sont débloqués et prêts à être retirés dès la validation de livraison.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full xl:w-auto shrink-0 justify-center">
              {/* Balance split metrics */}
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left py-5 px-6 bg-gray-100/50 dark:bg-white/5 rounded-3xl border border-gray-200/60 dark:border-white/5">
                <div className="space-y-1 shrink-0">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">Solde retirable</span>
                  <p className="text-2xl sm:text-3xl font-black text-green-600 dark:text-green-400 leading-none">
                    {(totalRevenue - (sellerData?.totalWithdrawn || 0)).toLocaleString()} <span className="text-xs sm:text-sm">HTG</span>
                  </p>
                </div>
                
                <div className="h-px w-full sm:h-10 sm:w-px bg-gray-205 dark:bg-white/10" />
                
                <div className="flex flex-row sm:flex-col gap-x-6 gap-y-1.5 w-full sm:w-auto justify-between sm:justify-start text-left shrink-0">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block">En Attente</span>
                    <span className="font-mono text-sm font-black text-gray-900 dark:text-gray-200 block whitespace-nowrap">{pendingRevenue.toLocaleString()} HTG</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block font-sans">Déjà retiré</span>
                    <span className="font-mono text-sm font-black text-gray-800 dark:text-gray-300 block whitespace-nowrap">{(sellerData?.totalWithdrawn || 0).toLocaleString()} HTG</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(true)}
                className="px-8 py-5 bg-gray-950 dark:bg-white text-white dark:text-gray-950 font-black rounded-2xl shadow-xl shadow-gray-950/10 dark:shadow-black/20 hover:bg-black dark:hover:bg-gray-100 active:scale-97 transition-all text-xs uppercase tracking-widest w-full sm:w-auto cursor-pointer text-center"
              >
                Demander un retrait
              </button>
            </div>
          </div>

          {/* Admin / Developer Test Box */}
          {user?.email === 'ghostytb77777@gmail.com' && (
            <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl relative z-10 w-full text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Mode Développeur & Administrateur
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Modifiez ou créditez instantanément votre portefeuille marchand pour tester le circuit complet de retrait (MonCash / NatCash / PlopPlop).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                  <input
                    type="number"
                    value={testAmountInput}
                    onChange={(e) => setTestAmountInput(e.target.value)}
                    placeholder="Montant HTG"
                    className="w-32 px-3 h-9 text-xs font-black bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={isAddingTestBalance}
                    onClick={() => handleAddTestBalance(parseFloat(testAmountInput) || 0)}
                    className="px-3.5 h-9 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95"
                    title="Ajoute ce montant au solde actuel"
                  >
                    + Créditer
                  </button>
                  <button
                    type="button"
                    disabled={isAddingTestBalance}
                    onClick={() => handleSetTestBalance(parseFloat(testAmountInput) || 0)}
                    className="px-3.5 h-9 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 border border-gray-300 dark:border-none"
                    title="Définit le solde exact à cette valeur"
                  >
                    Multiplier / Définir
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {[2500, 5000, 10000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTestAmountInput(val.toString())}
                    className="px-2.5 py-1.5 bg-white hover:bg-gray-50 dark:bg-slate-900 border border-gray-205 dark:border-slate-800 rounded-lg text-[10px] font-bold text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
                  >
                    {val.toLocaleString()} HTG
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-6 border-t border-amber-500/10">
                <div>
                  <h5 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    Seuil de Retrait Minimal Personnel
                  </h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Définissez le seuil de retrait minimal requis pour votre compte marchand (2 500 HTG par défaut).
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <input
                    type="number"
                    value={testThresholdInput}
                    onChange={(e) => setTestThresholdInput(e.target.value)}
                    placeholder="Seuil HTG"
                    className="w-32 px-3 h-9 text-xs font-black bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingThreshold}
                    onClick={() => handleSetTestThreshold(parseFloat(testThresholdInput) || 0)}
                    className="px-3.5 h-9 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 border border-gray-300 dark:border-none"
                  >
                    {isUpdatingThreshold ? 'Mise à jour...' : 'Modifier Seuil'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-amber-500/10">
                <div>
                  <h5 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    Seuil de Retrait de la Plateforme (Admin Commissions)
                  </h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Définissez la limite de retrait globale de la plateforme pour les commissions admin (2 500 HTG par défaut).
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <input
                    type="number"
                    value={testPlatformThresholdInput}
                    onChange={(e) => setTestPlatformThresholdInput(e.target.value)}
                    placeholder="Seuil Plateforme HTG"
                    className="w-32 px-3 h-9 text-xs font-black bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingPlatformThreshold}
                    onClick={() => handleSetPlatformThreshold(parseFloat(testPlatformThresholdInput) || 0)}
                    className="px-3.5 h-9 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 disabled:opacity-50 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 border border-gray-300 dark:border-none"
                  >
                    {isUpdatingPlatformThreshold ? 'Mise à jour...' : 'Modifier Stats Seuil'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Verification and Secured Payment Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Verification Code input card */}
          <div className="lg:col-span-5 bg-white rounded-[2.5rem] border border-gray-100 p-8 text-left shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-gray-900 tracking-tight leading-none text-left">Débloquer un paiement</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-left">Saisie du code de livraison à 5 chiffres</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                Lorsque vous livrez l'article physique à votre acheteur en personne, demandez-lui son <b>code de livraison à 5 chiffres LakayMarket</b> pour débloquer de manière sécurisée votre paiement.
              </p>
              
              <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={5}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Ex: 58249"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-sans font-black text-sm text-center tracking-[0.4em] placeholder:tracking-normal placeholder:font-bold placeholder:text-gray-300 focus:bg-white focus:border-brand/40 shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 5}
                  className="w-full py-4 bg-gray-950 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-20 cursor-pointer shadow-lg shadow-black/10"
                >
                  {verifying ? 'Vérification...' : 'Valider et débloquer'}
                </button>
              </form>
            </div>
            
            <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 uppercase tracking-wider leading-none pt-4 border-t border-gray-105">
              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" /> Protection anti-fraude et livraison sécurisée
            </p>
          </div>

          {/* Deliveries live list */}
          <div className="lg:col-span-7 bg-white rounded-[2.5rem] border border-gray-100 p-8 text-left shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-black text-gray-900 tracking-tight leading-none text-left">Suivi de vos ventes sécurisées</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-left">Commandes en attente de validation</p>
              </div>
              <span className="bg-amber-500/10 text-amber-700 border border-amber-100 px-3 py-1 text-[10px] font-black rounded-lg">
                {incomingOrders.filter(o => o.status === 'pending_delivery').length} en attente
              </span>
            </div>

            <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
              {incomingOrders.length > 0 ? (
                (() => {
                  const seenIds = new Set();
                  return incomingOrders
                    .filter((order) => {
                      if (!order.id) return false;
                      if (seenIds.has(order.id)) return false;
                      seenIds.add(order.id);
                      return true;
                    })
                    .map((order) => {
                      const isPending = order.status === 'pending_delivery';
                      return (
                        <div key={order.id} className="p-4 bg-gray-50/50 rounded-2.5xl border border-gray-100/85 flex flex-col gap-3.5 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md ${
                              isPending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {isPending ? 'Paiement garanti' : 'Fonds Libérés'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">{order.buyerName || 'Client'}</span>
                          </div>
                          <p className="text-xs font-black text-gray-950 truncate mt-1 leading-tight">{order.productName} (x{order.quantity})</p>
                          <p className="text-[10px] font-bold text-gray-400 font-mono mt-0.5">Valeur nette : {order.sellerNetAmount?.toLocaleString()} HTG</p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {onStartChat && (
                            <button
                              type="button"
                              onClick={() => onStartChat(order.buyerId, order.buyerName || 'Client')}
                              className="p-2.5 bg-white border border-gray-150 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-all cursor-pointer"
                              title="Discuter avec l'acheteur"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}
                          <span className={`text-xs font-black font-mono px-3 py-1.5 rounded-xl ${
                            isPending ? 'bg-amber-500/10 text-amber-700' : 'bg-green-500/15 text-green-700'
                          }`}>
                            {isPending ? 'En attente' : 'Validé'}
                          </span>
                        </div>
                      </div>

                      {/* Editable Tracking & Stats footer row */}
                      <div className="pt-3 border-t border-gray-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-1.5 w-full sm:max-w-[240px]">
                          <span className="text-[8px] text-gray-400 font-black shrink-0">ID SUIVI :</span>
                          <input
                            type="text"
                            placeholder="Saisir ID de livraison..."
                            value={editingTracking[order.id] !== undefined ? editingTracking[order.id] : (order.deliveryTrackingId || '')}
                            onChange={(e) => setEditingTracking(prev => ({ ...prev, [order.id]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 font-mono text-[10px] font-bold focus:border-gray-900 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateTrackingId(order.id, order.deliveryTrackingId || '')}
                            disabled={isUpdatingTracking === order.id}
                            className="bg-gray-950 hover:bg-black disabled:opacity-30 text-white rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                          >
                            {isUpdatingTracking === order.id ? '...' : 'Ok'}
                          </button>
                        </div>
                        <div className="flex gap-3 text-[9px] text-gray-400 font-extrabold uppercase shrink-0">
                          <span>Temps: <b className="text-gray-700 font-bold">{order.deliveryTime || '2-4 jours'}</b></span>
                          <span>Port: <b className="text-gray-700 font-bold">{order.deliveryPrice ? `${order.deliveryPrice.toLocaleString()} HTG` : 'Gratuit'}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
                <div className="py-12 text-center text-gray-400 border border-dashed border-gray-150 rounded-2xl">
                  <Package className="h-8 w-8 text-gray-200 mx-auto" />
                  <p className="text-xs font-bold text-gray-400 mt-2">Aucune commande reçue pour le moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Management Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Votre Inventaire</h3>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <ListFilter className="h-4 w-4" />
              Filtres
            </div>
          </div>

          {loading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8 opacity-50">
               {[1, 2, 3].map(i => (
                 <div key={i} className="h-96 bg-gray-100 rounded-[2rem] animate-pulse" />
               ))}
             </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {(() => {
                const seenIds = new Set();
                return products
                  .filter((product) => {
                    if (!product.id) return false;
                    if (seenIds.has(product.id)) return false;
                    seenIds.add(product.id);
                    return true;
                  })
                  .map((product) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      isOwner={true}
                      onEdit={() => onEditProduct(product)}
                      onBuy={onBuy}
                      onPromote={() => {
                        setPromotingProduct(product);
                        setIsPromoteModalOpen(true);
                      }}
                    />
                  ));
              })()}
            </div>
          ) : (
            <div className="bg-white/40 backdrop-blur-2xl rounded-[2rem] border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto border border-white shadow-sm">
                <Package className="h-9 w-9 text-gray-200" />
              </div>
              <div className="space-y-1.5 max-w-xs mx-auto">
                <p className="font-bold text-gray-900 text-lg">Inventaire vide</p>
                <p className="text-sm text-gray-400 leading-relaxed">Commencez par ajouter des produits pour suivre votre stock en temps réel.</p>
              </div>
              <button 
                onClick={onAddProduct}
                className="px-8 py-3 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                Premier produit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      <WithdrawModal 
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        sellerData={sellerData}
        onSuccess={() => setIsWithdrawModalOpen(false)}
      />

      {/* Promote Product Modal */}
      <PromoteProductModal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        product={promotingProduct}
        sellerData={sellerData}
        onSuccess={() => {
          setIsPromoteModalOpen(false);
        }}
      />
    </div>
  );
}
