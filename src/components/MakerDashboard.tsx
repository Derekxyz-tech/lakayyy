import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  FileText, 
  ArrowUpRight, 
  Smartphone, 
  Activity, 
  User, 
  Clock, 
  X,
  ArrowRightLeft,
  ShieldCheck,
  BadgeCheck
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import AdminWithdrawModal from './AdminWithdrawModal';

export default function MakerDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'sellers' | 'withdrawals' | 'approvals'>('overview');
  const [systemStats, setSystemStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWiping, setIsWiping] = useState(false);
  const [confirmWipeState, setConfirmWipeState] = useState<'idle' | 'confirm'>('idle');
  const [isAdminWithdrawOpen, setIsAdminWithdrawOpen] = useState(false);

  // Custom evaluation & blocking state
  const [disapprovingSellerId, setDisapprovingSellerId] = useState<string | null>(null);
  const [disapprovalComment, setDisapprovalComment] = useState('');
  const [previewImage, setPreviewImage] = useState<{ src: string, title: string } | null>(null);

  // Editing state for admin/platform balance
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [adminBalanceInput, setAdminBalanceInput] = useState('');
  const [adminConfirmState, setAdminConfirmState] = useState(false);

  // Editing state for sellers balance
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [sellerBalanceInput, setSellerBalanceInput] = useState('');
  const [sellerConfirmId, setSellerConfirmId] = useState<string | null>(null);

  // Editing state for minimum withdraw limit/threshold
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdConfirmId, setThresholdConfirmId] = useState<string | null>(null);

  const handleWipeAllData = async () => {
    if (confirmWipeState === 'idle') {
      setConfirmWipeState('confirm');
      toast("Cliquez à nouveau pour confirmer la suppression définitive !", {
        icon: '⚠️',
        style: {
          borderRadius: '16px',
          background: '#F59E0B',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
      return;
    }

    setIsWiping(true);
    const toastId = toast.loading("Nettoyage global de la base de données...", {
      style: {
        borderRadius: '16px',
        background: '#1F2937',
        color: '#fff',
        fontWeight: '900',
        fontSize: '11px',
        letterSpacing: '0.05em'
      }
    });

    try {
      // 1. Wipe Products
      const productsSnap = await getDocs(collection(db, 'products'));
      for (const d of productsSnap.docs) {
        await deleteDoc(doc(db, 'products', d.id));
      }

      // 2. Wipe Reviews
      const reviewsSnap = await getDocs(collection(db, 'reviews'));
      for (const d of reviewsSnap.docs) {
        await deleteDoc(doc(db, 'reviews', d.id));
      }

      // 3. Wipe Transactions
      const transSnap = await getDocs(collection(db, 'transactions'));
      for (const d of transSnap.docs) {
        await deleteDoc(doc(db, 'transactions', d.id));
      }

      // 4. Wipe Withdrawals
      const withSnap = await getDocs(collection(db, 'withdrawals'));
      for (const d of withSnap.docs) {
        await deleteDoc(doc(db, 'withdrawals', d.id));
      }

      // 5. Wipe Follows
      const followsSnap = await getDocs(collection(db, 'follows'));
      for (const d of followsSnap.docs) {
        await deleteDoc(doc(db, 'follows', d.id));
      }

      // 6. Wipe Users (retaining or clean resetting our own admin account)
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        if (d.id === auth.currentUser?.uid) {
          await setDoc(doc(db, 'users', d.id), {
            email: auth.currentUser?.email || '',
            displayName: auth.currentUser?.displayName || '',
            photoURL: auth.currentUser?.photoURL || '',
            isSeller: false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }

      // 7. Reset System Stats doc
      await setDoc(doc(db, 'system', 'stats'), {
        totalGrossVolume: 0,
        platformCommission: 0,
        totalTransactions: 0,
        updatedAt: new Date()
      });

      // Clear local storage for favorites
      localStorage.removeItem('lakay_market_favorites');
      window.dispatchEvent(new CustomEvent('favorites_changed'));

      toast.success("Toutes les données ont été nettoyées avec succès ! Prêt pour le réel.", {
        id: toastId,
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
      setConfirmWipeState('idle');
    } catch (error: any) {
      console.error("Wipe failed:", error);
      toast.error(`Erreur de nettoyage: ${error.message || error}`, {
        id: toastId,
        style: {
          borderRadius: '16px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
      setConfirmWipeState('idle');
    } finally {
      setIsWiping(false);
    }
  };

  useEffect(() => {
    // 1. Listen to system stats
    const unsubStats = onSnapshot(doc(db, 'system', 'stats'), (snap) => {
      if (snap.exists()) {
        setSystemStats(snap.data());
      }
    });

    // 2. Listen to all transactions
    const transQuery = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsubTrans = onSnapshot(transQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setLoading(false);
    });

    // 3. Listen to all users to determine candidacy
    const sellersQuery = query(collection(db, 'users'));
    const unsubSellers = onSnapshot(sellersQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(list);
    });

    // 4. Listen to all withdrawals
    const withdrawalsQuery = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawals(list);
    });

    return () => {
      unsubStats();
      unsubTrans();
      unsubSellers();
      unsubWithdrawals();
    };
  }, []);

  // Compute stats in case system stats doc doesn't exist yet
  const totalGross = systemStats?.totalGrossVolume || transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const platformCommissions = systemStats?.platformCommission || transactions.reduce((sum, t) => sum + (t.commissionAmount || (t.totalAmount * 0.07)), 0);
  const platformWithdrawn = systemStats?.platformWithdrawn || 0;
  const withdrawableAdminBalance = Math.max(0, platformCommissions - platformWithdrawn);
  const totalSalesCount = systemStats?.totalTransactions || transactions.length;

  // Filter candidates who onboarded as seller or have sellerStatus
  const candidateSellers = sellers.filter(s => s.isSeller === true || s.sellerStatus !== undefined || s.sellerName);
  const pendingApprovalsCount = candidateSellers.filter(s => s.sellerStatus === 'pending').length;

  // Status updates helpers
  const handleApproveSeller = async (sellerId: string) => {
    try {
      const userRef = doc(db, 'users', sellerId);
      await updateDoc(userRef, {
        sellerStatus: 'approved',
        isSeller: true,
        sellerDisapprovalComment: null,
        updatedAt: new Date()
      });
      toast.success("Artisan approuvé avec succès !", {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (error: any) {
      toast.error(`Erreur d'approbation: ${error.message || error}`);
    }
  };

  const handleDisapproveSeller = async (sellerId: string, comment: string) => {
    if (!comment.trim()) {
      toast.error("Veuillez saisir un motif de désapprobation.");
      return;
    }
    try {
      const userRef = doc(db, 'users', sellerId);
      await updateDoc(userRef, {
        sellerStatus: 'disapproved',
        isSeller: false,
        sellerDisapprovalComment: comment,
        updatedAt: new Date()
      });
      toast.success("Artisan désapprouvé ou bloqué.", {
        style: {
          borderRadius: '16px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
      setDisapprovingSellerId(null);
      setDisapprovalComment('');
    } catch (error: any) {
      toast.error(`Erreur: ${error.message || error}`);
    }
  };

  const handleUpdateAdminBalance = async (newBalance: number) => {
    try {
      const statsRef = doc(db, 'system', 'stats');
      const targetCommission = newBalance + platformWithdrawn;
      await setDoc(statsRef, {
        platformCommission: targetCommission,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Solde de la plate-forme mis à jour avec succès !", {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      toast.error(`Erreur lors de la mise à jour : ${err.message}`);
    }
  };

  const handleUpdateSellerBalance = async (sellerId: string, totalWithdrawnCount: number, newBalance: number) => {
    try {
      const userRef = doc(db, 'users', sellerId);
      const targetRevenue = newBalance + totalWithdrawnCount;
      await updateDoc(userRef, {
        totalRevenue: targetRevenue,
        updatedAt: new Date()
      });
      toast.success("Solde de l'artisan mis à jour avec succès !", {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      toast.error(`Erreur lors de la mise à jour : ${err.message}`);
    }
  };

  const handleUpdateSellerThreshold = async (sellerId: string, newThreshold: number) => {
    try {
      const userRef = doc(db, 'users', sellerId);
      await updateDoc(userRef, {
        minimumWithdrawLimit: newThreshold,
        updatedAt: new Date()
      });
      toast.success("Seuil de retrait du studio mis à jour avec succès !", {
        style: {
          borderRadius: '16px',
          background: '#10B981',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } catch (err: any) {
      toast.error(`Erreur lors de la mise à jour : ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-4">Calcul des commissions en cours...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="px-3 py-1 bg-brand/10 text-brand text-[10px] font-black uppercase tracking-widest rounded-full">
            Espace Propriétaire
          </span>
          <h1 className="text-4xl font-black text-gray-900 mt-3 tracking-tight leading-none">
            Maker Dashboard
          </h1>
          <p className="text-xs font-semibold text-gray-400 mt-2 leading-relaxed">
            Consultez les indicateurs financiers globaux de votre marketplace et la commission automatique prélevée.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 self-start">
          {/* Live Indicator */}
          <div className="flex items-center gap-4 bg-white px-6 py-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Statut Système</p>
              <p className="text-xs font-black text-gray-800">Prélèvement de 10% (Profits 7% NET) ACTIF</p>
            </div>
          </div>

          {/* Secure Wipe Button */}
          <button
            id="admin-wipe-data-btn"
            type="button"
            disabled={isWiping}
            onClick={handleWipeAllData}
            onMouseLeave={() => setConfirmWipeState('idle')}
            className={`flex items-center gap-2 px-6 py-4 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer h-14 ${
              isWiping 
                ? 'bg-gray-100 text-gray-400 border-gray-200'
                : confirmWipeState === 'confirm'
                  ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-red-50/80 text-red-600 border-red-150 hover:bg-red-100/80 hover:text-red-700'
            }`}
          >
            {isWiping ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                <span>Wiping database...</span>
              </>
            ) : confirmWipeState === 'confirm' ? (
              <span>⚠️ Confirmer la suppression ?</span>
            ) : (
              <span>Wipe All Data (Database Reset)</span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-brand/10 to-transparent p-6 rounded-[2rem] border border-brand/20 shadow-sm relative overflow-hidden group flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="absolute right-6 top-6 text-brand/30 group-hover:scale-110 transition-transform">
              <DollarSign className="h-8 w-8" />
            </div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Vos Profits (7% Net Plate-forme)</p>
            {isAdminEditing ? (
              <div className="mt-3 space-y-2">
                <label className="text-[9px] font-black text-brand uppercase tracking-widest block">Nouveau Solde Disponible (HTG)</label>
                <input
                  type="number"
                  value={adminBalanceInput}
                  onChange={(e) => {
                    setAdminBalanceInput(e.target.value);
                    setAdminConfirmState(false);
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-brand/30 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-gray-900 dark:text-white"
                  placeholder="Nouveau solde (HTG)"
                />
                <div className="flex gap-2">
                  {adminConfirmState ? (
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseFloat(adminBalanceInput) || 0;
                        handleUpdateAdminBalance(val);
                        setIsAdminEditing(false);
                        setAdminConfirmState(false);
                      }}
                      className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                    >
                      Confirmer ⚠️
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!adminBalanceInput.trim() || isNaN(parseFloat(adminBalanceInput))) {
                          toast.error("Veuillez entrer un montant correct.");
                          return;
                        }
                        setAdminConfirmState(true);
                      }}
                      className="flex-1 py-1 px-2 bg-gray-950 hover:bg-black text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                    >
                      Valider
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminEditing(false);
                      setAdminConfirmState(false);
                    }}
                    className="py-1 px-2 bg-gray-100 hover:bg-gray-250 text-gray-700 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center animate-pulse"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-4xl font-black text-brand tracking-tighter mt-3">
                  {platformCommissions.toLocaleString()} HTG
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  Disponible (Solde) : <span className="text-emerald-600 font-extrabold">{withdrawableAdminBalance.toLocaleString()} HTG</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminEditing(true);
                      setAdminBalanceInput(withdrawableAdminBalance.toString());
                      setAdminConfirmState(false);
                    }}
                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 rounded text-[9px] font-black tracking-wide cursor-pointer uppercase transition-all"
                    title="Modifier mon solde de profits"
                  >
                    Modifier
                  </button>
                </p>
              </>
            )}
            {platformWithdrawn > 0 && (
              <p className="text-[10px] font-semibold text-gray-400">
                Déjà retiré : <span className="text-blue-500 font-bold">{platformWithdrawn.toLocaleString()} HTG</span>
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-brand/5">
            <button
              type="button"
              onClick={() => setIsAdminWithdrawOpen(true)}
              className="w-full py-2.5 px-4 bg-gray-950 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95 text-center cursor-pointer"
            >
              Encaisser mes profits
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-6 top-6 text-gray-300 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-8 w-8" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Volume d'affaires global</p>
          <p className="text-4xl font-black text-gray-950 tracking-tighter mt-4">
            {totalGross.toLocaleString()} HTG
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">
            Tous les modes de paiements confondus
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-6 top-6 text-gray-300 group-hover:scale-110 transition-transform">
            <ArrowRightLeft className="h-8 w-8" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Ventes marketplace</p>
          <p className="text-4xl font-black text-gray-950 tracking-tighter mt-4">
            {totalSalesCount}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">
            Commandes traitées avec succès
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute right-6 top-6 text-gray-300 group-hover:scale-110 transition-transform">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Artisans inscrits</p>
          <p className="text-4xl font-black text-gray-950 tracking-tighter mt-4">
            {candidateSellers.length}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">
            Vendeurs produisant des revenus
          </p>
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="flex border-b border-gray-100 pb-px overflow-x-auto whitespace-nowrap scrollbar-none gap-8">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] relative transition-colors ${
            activeTab === 'overview' ? 'text-gray-950' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeTab === 'overview' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-950" />
          )}
          Identifiants & Passerelle
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] relative transition-colors ${
            activeTab === 'transactions' ? 'text-gray-950' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeTab === 'transactions' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-950" />
          )}
          Transactions ({transactions.length})
        </button>

        <button
          onClick={() => setActiveTab('sellers')}
          className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] relative transition-colors ${
            activeTab === 'sellers' ? 'text-gray-950' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeTab === 'sellers' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-950" />
          )}
          Revenus Artisans ({candidateSellers.filter(s => s.isSeller === true).length})
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] relative transition-colors ${
            activeTab === 'approvals' ? 'text-gray-950' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeTab === 'approvals' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-950" />
          )}
          Approbations ({pendingApprovalsCount} en attente)
        </button>

        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] relative transition-colors ${
            activeTab === 'withdrawals' ? 'text-gray-950 px-1' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {activeTab === 'withdrawals' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-950" />
          )}
          Flux des Retraits ({withdrawals.length})
        </button>
      </div>

      {/* Tabs contents */}
      <div className="mt-8 animate-in fade-in duration-300">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <h3 className="text-xl font-black text-gray-950 tracking-tight">Configuration Marchand de la Plateforme</h3>
                <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                  Votre application utilise la passerelle de facturation sécurisée <b>PLOP PLOP API (v1.3)</b> pour traiter les paiements mobiles sur le réseau haïtien (MonCash, NatCash).
                </p>

                <div className="space-y-4 pt-4 border-t border-gray-50 text-xs">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 font-medium">
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black block mb-2">CLIENT ID</span>
                    <span className="font-mono text-gray-700 select-all font-bold">pp_ae2a6beaf6c8bdb82aed6060088f</span>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 font-medium">
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-black block mb-2">HACHRÉ DE CLÉ PRIVÉE (HMAC-SHA256 Secret)</span>
                    <span className="font-mono text-gray-500 select-all tracking-wider text-[11px] block break-all font-bold">b8472b1a35ca...1822a</span>
                  </div>

                  <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100/50 flex items-start gap-3">
                    <ShieldCheck className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-[11px] uppercase tracking-wide">Signature Cryptographique Active</p>
                      <p className="text-[10px] font-semibold mt-1 leading-relaxed text-green-600">
                        Chaque appel pour les retraits d'argent (Withdrawals) passe par une signature HMAC-SHA256 unifiée avec horodatage strict et expiration de sécurité à 2 minutes. Vos clés secrètes serveur ne transitent jamais côté client.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-950 text-white p-8 md:p-10 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-[60px]" />
                <h3 className="text-lg font-black tracking-tight relative z-10">Calcul des Profits</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed relative z-10 font-semibold">
                  Comment est structurée la facturation ?
                </p>

                <div className="space-y-4 mt-6 pt-6 border-t border-white/10 relative z-10 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-bold">Frais acheteurs</span>
                    <span className="font-black">0% (Gratuit)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-bold">Taxe globale marchand</span>
                    <span className="font-black text-brand">10.0%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-bold">Frais opérateur mobile</span>
                    <span className="font-black text-orange-400">3.0%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-bold">Bénéfice net plateforme (Admin)</span>
                    <span className="font-black text-green-400">7.0%</span>
                  </div>

                  <p className="text-[10px] leading-relaxed text-gray-400 italic pt-4">
                    Exemple : Pour un article vendu 500 HTG. Le client paie 500 HTG. L'artisan est prélevé de 10% (50 HTG) et reçoit 450 HTG nets, le service de paiement prélève 3% (15 HTG) de frais de passerelle, et vous encaissez 7% (35 HTG) de bénéfice net.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Registre des Ventes</h3>
              <span className="text-xs text-gray-400 font-bold">{transactions.length} transactions</span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <FileText className="h-10 w-10 mx-auto opacity-30 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Aucune transaction enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-4 px-6">ID & Date</th>
                      <th className="py-4 px-6">Acheteur / Contact</th>
                      <th className="py-4 px-6">Méthode</th>
                      <th className="py-4 px-6">Montant Brut</th>
                      <th className="py-4 px-6 text-green-650 font-black">Gains Artisan (La personne - 90%)</th>
                      <th className="py-4 px-6 text-indigo-600 font-black">Notre Commission (Intérêt - 7%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const seenIds = new Set();
                      return transactions
                        .filter(t => {
                          if (!t.id) return false;
                          if (seenIds.has(t.id)) return false;
                          seenIds.add(t.id);
                          return true;
                        })
                        .map(t => {
                          const dateStr = t.createdAt?.seconds 
                            ? new Date(t.createdAt.seconds * 1000).toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit' })
                            : 'En cours';

                          return (
                            <tr key={t.id} className="hover:bg-gray-50/50 transition-colors font-semibold text-gray-700">
                              <td className="py-4 px-6">
                                <div className="font-black text-gray-900">{t.plopplopReferenceId || t.id.substring(0, 8)}</div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{dateStr}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="text-gray-900 font-bold">{t.buyerName}</div>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{t.buyerEmail} ({t.phoneNumber || 'N/A'})</div>
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-2 py-1 bg-gray-100 rounded-lg text-[9px] uppercase font-black text-gray-600 block w-fit">
                                  {t.paymentMethod}
                                </span>
                              </td>
                              <td className="py-4 px-6 font-bold text-gray-900">
                                {(t.totalAmount || 0).toLocaleString()} HTG
                              </td>
                              <td className="py-4 px-6 font-extrabold text-green-600">
                                {((t.sellerNetAmount) || (t.totalAmount * 0.90)).toLocaleString()} HTG
                              </td>
                              <td className="py-4 px-6 font-black text-indigo-650">
                                {((t.commissionAmount) || (t.totalAmount * 0.07)).toLocaleString()} HTG
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sellers' && (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden border-box">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Chiffre d'Affaires Artisans</h3>
              <span className="text-xs text-gray-400 font-bold">{candidateSellers.filter(s => s.isSeller === true).length} artisans validés</span>
            </div>

            {candidateSellers.filter(s => s.isSeller === true).length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <Users className="h-10 w-10 mx-auto opacity-30 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Aucun artisan n'est encore validé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-4 px-6">Artisan / Commerce</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Revenu Net (Retirable)</th>
                      <th className="py-4 px-6">Seuil de Retrait Min</th>
                      <th className="py-4 px-6">Déjà Retiré</th>
                      <th className="py-4 px-6">Nombre de ventes</th>
                      <th className="py-4 px-6 text-center">Badge Artisan Vérifié</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const seenIds = new Set();
                      return candidateSellers
                        .filter(s => s.isSeller === true)
                        .filter(s => {
                          if (!s.id) return false;
                          if (seenIds.has(s.id)) return false;
                          seenIds.add(s.id);
                          return true;
                        })
                        .map(s => {
                          const netWithdr = s.totalWithdrawn || 0;
                          const netRev = s.totalRevenue || 0;
                          const currentBal = Math.max(0, netRev - netWithdr);

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/50 transition-colors font-semibold text-gray-700">
                              <td className="py-4 px-6">
                                <div className="font-black text-gray-900 flex items-center gap-1.5">
                                  <span>{s.sellerName || s.displayName}</span>
                              {s.verified && (
                                <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-500/10 shrink-0" title="Artisan vérifié et certifié" />
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {s.id.substring(0,6)}</div>
                            {s.sellerRealName && s.sellerRealName !== s.sellerName && (
                              <div className="text-[10px] text-gray-400 font-medium italic mt-0.5">Vrai nom: {s.sellerRealName}</div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-mono text-gray-500">
                            {s.email}
                          </td>
                          <td className="py-4 px-6">
                            {editingSellerId === s.id ? (
                              <div className="flex flex-col gap-1.5 w-40">
                                <span className="text-[9px] font-black text-brand uppercase tracking-wider block">Nouveau Solde</span>
                                <input
                                  type="number"
                                  value={sellerBalanceInput}
                                  onChange={(e) => {
                                    setSellerBalanceInput(e.target.value);
                                    setSellerConfirmId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-brand/35 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-brand"
                                  placeholder="0"
                                />
                                <div className="flex gap-1.5 font-sans">
                                  {sellerConfirmId === s.id ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = parseFloat(sellerBalanceInput) || 0;
                                        handleUpdateSellerBalance(s.id, netWithdr, val);
                                        setEditingSellerId(null);
                                        setSellerConfirmId(null);
                                      }}
                                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                    >
                                      Confirmer ⚠️
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!sellerBalanceInput.trim() || isNaN(parseFloat(sellerBalanceInput))) {
                                          toast.error("Valeur incorrecte.");
                                          return;
                                        }
                                        setSellerConfirmId(s.id);
                                      }}
                                      className="flex-1 py-1.5 px-2 bg-gray-900 hover:bg-black text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                    >
                                      Valider
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSellerId(null);
                                      setSellerConfirmId(null);
                                    }}
                                    className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/bal">
                                <div>
                                  <div className="font-extrabold text-green-600">{currentBal.toLocaleString()} HTG</div>
                                  <div className="text-[10px] text-gray-400">Sur un total de {netRev.toLocaleString()} HTG</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSellerId(s.id);
                                    setSellerBalanceInput(currentBal.toString());
                                    setSellerConfirmId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-gray-50 hover:bg-gray-150 text-gray-600 rounded text-[9px] font-black tracking-wide uppercase transition-all ml-1 cursor-pointer"
                                  title="Modifier le solde retirable"
                                >
                                  Modifier
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {editingThresholdId === s.id ? (
                              <div className="flex flex-col gap-1.5 w-36">
                                <span className="text-[9px] font-black text-brand uppercase tracking-wider block">Nouveau Seuil Min</span>
                                <input
                                  type="number"
                                  value={thresholdInput}
                                  onChange={(e) => {
                                    setThresholdInput(e.target.value);
                                    setThresholdConfirmId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-brand/35 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-brand"
                                  placeholder="2500"
                                />
                                <div className="flex gap-1.5 font-sans">
                                  {thresholdConfirmId === s.id ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = parseFloat(thresholdInput);
                                        if (isNaN(val) || val < 0) {
                                          toast.error("Veuillez entrer un montant valide (> 0).");
                                          return;
                                        }
                                        handleUpdateSellerThreshold(s.id, val);
                                        setEditingThresholdId(null);
                                        setThresholdConfirmId(null);
                                      }}
                                      className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center animate-pulse"
                                    >
                                      Confirmer ⚠️
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!thresholdInput.trim() || isNaN(parseFloat(thresholdInput))) {
                                          toast.error("Valeur incorrecte.");
                                          return;
                                        }
                                        setThresholdConfirmId(s.id);
                                      }}
                                      className="flex-1 py-1.5 px-2 bg-gray-900 hover:bg-black text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                    >
                                      Valider
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingThresholdId(null);
                                      setThresholdConfirmId(null);
                                    }}
                                    className="py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/threshold">
                                <div>
                                  <div className="font-extrabold text-amber-650">{(s.minimumWithdrawLimit !== undefined ? s.minimumWithdrawLimit : 2500).toLocaleString()} HTG</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingThresholdId(s.id);
                                    setThresholdInput((s.minimumWithdrawLimit !== undefined ? s.minimumWithdrawLimit : 2500).toString());
                                    setThresholdConfirmId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-gray-50 hover:bg-gray-150 text-gray-600 rounded text-[9px] font-black tracking-wide uppercase transition-all ml-1 cursor-pointer"
                                  title="Modifier le seuil de retrait minimal de ce studio"
                                >
                                  Modifier
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-semibold text-blue-600 font-mono">
                            {netWithdr.toLocaleString()} HTG
                          </td>
                          <td className="py-4 px-6 text-gray-900 font-extrabold font-mono">
                            {s.totalSales || 0}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const newVerified = !s.verified;
                                  
                                  // 1. Update user collection
                                  await updateDoc(doc(db, 'users', s.id), {
                                    verified: newVerified,
                                    updatedAt: new Date()
                                  });

                                  // 2. Propagate to products collection
                                  const prodsSnap = await getDocs(
                                    query(collection(db, 'products'), where('sellerId', '==', s.id))
                                  );
                                  for (const p of prodsSnap.docs) {
                                    await updateDoc(doc(db, 'products', p.id), {
                                      sellerVerified: newVerified,
                                      updatedAt: new Date()
                                    });
                                  }

                                  toast.success(newVerified ? "Boutique certifiée et badges produits synchronisés !" : "Certification boutique retirée.");
                                } catch (err: any) {
                                  toast.error("Erreur de modification: " + err.message);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                s.verified 
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                  : 'bg-gray-50 text-gray-450 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <BadgeCheck className="h-3.5 w-3.5" />
                              {s.verified ? "Vérifié" : "Non Vérifié"}
                            </button>
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden border-box">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Candidatures & Dossiers d'Artisans</h3>
              <span className="text-xs text-gray-400 font-bold">{candidateSellers.length} profils d'artisans</span>
            </div>

            {candidateSellers.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <Users className="h-10 w-10 mx-auto opacity-30 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Aucun dossier d'artisan disponible</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-4 px-6">Artisan / Commerce</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Dossier / Pièces</th>
                      <th className="py-4 px-6 text-center">Statut</th>
                      <th className="py-4 px-6 text-center">Actions d'Administration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const seenIds = new Set();
                      return candidateSellers
                        .filter(s => {
                          if (!s.id) return false;
                          if (seenIds.has(s.id)) return false;
                          seenIds.add(s.id);
                          return true;
                        })
                        .map(s => {
                          // Compute actual approval status
                          const currentStatus: 'approved' | 'pending' | 'disapproved' = 
                            s.sellerStatus === 'approved' || (s.isSeller === true && !s.sellerStatus)
                              ? 'approved'
                              : s.sellerStatus === 'disapproved'
                                ? 'disapproved'
                                : 'pending';

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/50 transition-colors font-semibold text-gray-700">
                              <td className="py-4 px-6">
                                <div className="font-black text-gray-900">{s.sellerName || s.displayName}</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {s.id.substring(0,6)}</div>
                            {s.sellerRealName && (
                              <div className="text-[10px] text-gray-950 font-black mt-0.5">Nom réel : {s.sellerRealName}</div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-mono text-gray-500">
                            {s.email}
                          </td>
                          <td className="py-4 px-6">
                            {s.identityFileName || s.selfieFileName ? (
                              <div className="flex flex-col gap-1 text-[10px] leading-tight flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold uppercase text-[8px] bg-gray-950 text-white px-1.5 py-0.5 rounded tracking-wider leading-none shrink-0">
                                    {s.identityType === 'id' ? 'CIN' : s.identityType === 'passport' ? 'Passeport' : 'Permis'}
                                  </span>
                                  <span className="text-gray-500 font-mono text-[9px] truncate max-w-[120px]" title={s.identityFileName}>
                                    {s.identityFileName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {s.identityImage && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage({ src: s.identityImage, title: `${s.sellerName || s.displayName} - Document d'identité (${s.identityType === 'id' ? 'CIN' : s.identityType === 'passport' ? 'Passeport' : 'Permis'})` })}
                                      className="relative group/thumb cursor-pointer hover:scale-105 active:scale-95 transition-all outline-none"
                                    >
                                      <img
                                        src={s.identityImage}
                                        alt="Doc ID"
                                        className="w-10 h-7 rounded object-cover border border-gray-200 group-hover/thumb:border-gray-950 shadow-sm"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 text-[8px] font-black rounded transition-opacity">VOIR</span>
                                    </button>
                                  )}
                                  {s.selfieImage && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage({ src: s.selfieImage, title: `${s.sellerName || s.displayName} - Portrait de face` })}
                                      className="relative group/thumb cursor-pointer hover:scale-105 active:scale-95 transition-all outline-none"
                                    >
                                      <img
                                        src={s.selfieImage}
                                        alt="Face Headshot"
                                        className="w-10 h-7 rounded object-cover border border-gray-200 group-hover/thumb:border-gray-950 shadow-sm"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 text-[8px] font-black rounded transition-opacity">VOIR</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-medium italic">Aucun document fourni</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {currentStatus === 'approved' ? (
                              <span className="inline-flex px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-black uppercase tracking-widest leading-none">
                                Approuvé
                              </span>
                            ) : currentStatus === 'disapproved' ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-[9px] font-black uppercase tracking-widest leading-none">
                                  Bloqué / Refusé
                                </span>
                                {s.sellerDisapprovalComment && (
                                  <span className="text-[9px] text-red-400 max-w-[150px] truncate block text-center" title={s.sellerDisapprovalComment}>
                                    Motif: {s.sellerDisapprovalComment}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-black uppercase tracking-widest leading-none animate-pulse">
                                En attente
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-2 items-center justify-center">
                              {disapprovingSellerId === s.id ? (
                                <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-3 w-64 text-left animate-in fade-in duration-200">
                                  <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest block leading-none">Spécifier le motif</span>
                                  <textarea
                                    value={disapprovalComment}
                                    onChange={(e) => setDisapprovalComment(e.target.value)}
                                    placeholder="Indiquez à l'artisan pourquoi sa boutique est refusée..."
                                    className="w-full p-3 bg-white border border-gray-250 rounded-xl text-xs outline-none focus:border-red-400 transition-all font-medium min-h-[55px] resize-none leading-relaxed"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDisapproveSeller(s.id, disapprovalComment)}
                                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                    >
                                      Refuser
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDisapprovingSellerId(null);
                                        setDisapprovalComment('');
                                      }}
                                      className="py-2 px-3 bg-gray-250 hover:bg-gray-400 text-gray-700 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {currentStatus !== 'approved' && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveSeller(s.id)}
                                      className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm hover:shadow active:scale-95 transition-all text-center cursor-pointer"
                                    >
                                      Approuver
                                    </button>
                                  )}
                                  {currentStatus !== 'disapproved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDisapprovingSellerId(s.id);
                                        setDisapprovalComment('');
                                      }}
                                      className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all text-center cursor-pointer"
                                    >
                                      Refuser / Bloquer
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50">
              <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Journal des virements</h3>
            </div>

            {withdrawals.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <Clock className="h-10 w-10 mx-auto opacity-30 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Aucune demande de retrait effectuée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-4 px-6">Référence</th>
                      <th className="py-4 px-6">Moyen de Retrait</th>
                      <th className="py-4 px-6">Destinataire (Mobile)</th>
                      <th className="py-4 px-6">Montant Brut</th>
                      <th className="py-4 px-6">Frais de l'Opérateur</th>
                      <th className="py-4 px-6">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const seenIds = new Set();
                      return withdrawals
                        .filter(w => {
                          if (!w.id) return false;
                          if (seenIds.has(w.id)) return false;
                          seenIds.add(w.id);
                          return true;
                        })
                        .map(w => {
                          const dateStr = w.createdAt?.seconds 
                            ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit' })
                            : 'Traité';

                          return (
                            <tr key={w.id} className="hover:bg-gray-50/50 transition-colors font-semibold text-gray-700">
                              <td className="py-4 px-6">
                                <div className="font-black text-gray-900">{w.reference}</div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{dateStr}</div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-[9px] uppercase font-black text-gray-700 block w-fit">
                              {w.method}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-gray-900">
                            {w.recipient}
                          </td>
                          <td className="py-4 px-6 font-extrabold text-gray-900">
                            {(w.amount || 0).toLocaleString()} HTG
                          </td>
                          <td className="py-4 px-6 font-mono text-gray-400 font-extrabold">
                            {(w.fee || 0).toLocaleString()} HTG
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-3 py-1 bg-green-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit">
                              <ShieldCheck className="h-3 w-3" /> SUCCESS
                            </span>
                          </td>
                        </tr>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Lightbox / Zoom Image modal */}
        {previewImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {previewImage.title || "Visualisation du document"}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
                >
                  <X className="h-2 w-5" style={{ height: '20px', width: '20px' }} />
                </button>
              </div>
              <div className="flex-1 flex justify-center items-center bg-gray-50 rounded-2xl overflow-hidden min-h-[300px] p-2">
                <img
                  src={previewImage.src}
                  alt="Zoom preview"
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="mt-4 w-full py-3.5 bg-gray-900 text-white rounded-xl text-[10px] uppercase tracking-wider font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Fermer l'aperçu
              </button>
            </div>
          </div>
        )}

        <AdminWithdrawModal
          isOpen={isAdminWithdrawOpen}
          onClose={() => setIsAdminWithdrawOpen(false)}
          systemStats={systemStats}
          platformCommissions={platformCommissions}
          onSuccess={() => {
            setIsAdminWithdrawOpen(false);
          }}
        />
      </div>
    </div>
  );
}
