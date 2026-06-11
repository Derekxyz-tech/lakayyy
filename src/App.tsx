import Header from './components/Header';
import Hero from './components/Hero';
import Filters from './components/Filters';
import ProductCatalog from './components/ProductCatalog';
import SellerOnboarding from './components/SellerOnboarding';
import SellerDashboard from './components/SellerDashboard';
import AddProductModal from './components/AddProductModal';
import SellerSettingsModal from './components/SellerSettingsModal';
import CheckoutModal from './components/CheckoutModal';
import CartSidebar from './components/CartSidebar';
import MakerDashboard from './components/MakerDashboard';
import ProductDetailModal from './components/ProductDetailModal';
import PurchasesModal from './components/PurchasesModal';
import ChatOverlay from './components/ChatOverlay';
import PaymentRecoveryChecker from './components/PaymentRecoveryChecker';
import { MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

import toast, { Toaster } from 'react-hot-toast';

export default function App() {
  // Dark mode theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<any>(null);
  const [isCheckoutFromCart, setIsCheckoutFromCart] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [currentView, setCurrentView] = useState<'buyer' | 'seller' | 'maker'>('buyer');
  const isSellerMode = currentView === 'seller';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Purchases and Chat states
  const [isPurchasesOpen, setIsPurchasesOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);
  const [chatTargetUserName, setChatTargetUserName] = useState<string | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setHasUnreadMessages(false);
      return;
    }

    const qUnread = query(
      collection(db, 'chats'),
      where('unreadReceiverId', '==', currentUser.uid)
    );

    const unsubscribeUnread = onSnapshot(qUnread, (snapshot) => {
      setHasUnreadMessages(!snapshot.empty);
    }, (error) => {
      console.error("Error checking unread messages:", error);
    });

    return () => unsubscribeUnread();
  }, [currentUser]);

  const handleOpenChatWithUser = (sellerId: string, sellerName: string) => {
    if (!auth.currentUser) {
      toast.error("Veuillez vous connecter pour envoyer des messages.", {
        style: {
          borderRadius: '12px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px'
        }
      });
      return;
    }
    if (sellerId === auth.currentUser.uid) {
      toast.error("Vous ne pouvez pas chatter avec vous-même.", {
        style: {
          borderRadius: '12px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px'
        }
      });
      return;
    }
    setChatTargetUserId(sellerId);
    setChatTargetUserName(sellerName);
    setIsChatOpen(true);
  };

  useEffect(() => {
    const handleAddToCart = (e: any) => {
      const product = e.detail;
      setCart(prev => {
        const existing = prev.find(item => item.id === product.id);
        if (existing) {
          return prev.map(item => 
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prev, { ...product, quantity: 1, image: product.images?.[0] }];
      });
      toast.success(`${product.name} ajouté au panier`, {
        icon: '🛒',
        style: {
          borderRadius: '20px',
          background: '#000',
          color: '#fff',
          fontWeight: '900',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }
      });
    };

    window.addEventListener('addToCart', handleAddToCart);
    return () => window.removeEventListener('addToCart', handleAddToCart);
  }, []);

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCartCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutFromCart(true);
    setIsCheckoutModalOpen(true);
  };

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (user) {
        // Listen to active user profile document to capture dynamic seller approvals/blocks in real-time!
        unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          const isAdmin = user.email === 'ghostytb77777@gmail.com';
          if (snap.exists()) {
            const data = snap.data();
            const sellerOk = !!data.isSeller || isAdmin;
            setIsSeller(sellerOk);
            setSellerName(data.sellerName || (isAdmin ? 'Admin Studio' : ''));
            
            // If user is currently in seller view but got disapproved/blocked, direct them back to buyer
            if (!sellerOk && currentView === 'seller') {
              setCurrentView('buyer');
              toast("Accès artisan en cours d'examen ou suspendu.", {
                icon: '🔒',
                style: {
                  borderRadius: '16px',
                  background: '#EF4444',
                  color: '#fff',
                  fontWeight: '950',
                  fontSize: '11.5px',
                }
              });
            }
          } else {
            setIsSeller(isAdmin);
            setSellerName(isAdmin ? 'Admin Studio' : '');
          }
          setLoading(false);
        }, (err) => {
          console.error("User doc real-time listener error:", err);
          setLoading(false);
        });
      } else {
        setIsSeller(false);
        setSellerName('');
        setCurrentView('buyer');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, [currentView]);

  const handleBecomeSellerSuccess = (name: string) => {
    setIsSeller(true);
    setSellerName(name);
  };

  const handleSettingsSuccess = (data: any) => {
    if (data.sellerName) setSellerName(data.sellerName);
  };

  const handleBuyProduct = (product: any, quantity?: number) => {
    if (!auth.currentUser) {
      toast.error('Veuillez vous connecter pour acheter.');
      return;
    }
    setCheckoutProduct({ ...product, quantity: quantity || 1 });
    setIsCheckoutModalOpen(true);
  };

  const toggleMode = () => {
    setCurrentView(prev => prev === 'seller' ? 'buyer' : 'seller');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-300">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300 text-gray-900 dark:text-gray-100 overflow-x-hidden w-full max-w-full">
      <Header 
        onBecomeSeller={() => setIsSellerModalOpen(true)} 
        isSeller={isSeller}
        isSellerMode={isSellerMode}
        onToggleMode={toggleMode}
        user={currentUser}
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPurchases={() => setIsPurchasesOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      <main className="flex-grow container mx-auto px-4 pb-20 pt-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'maker' ? (
            <motion.div
              key="maker-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full"
            >
              <MakerDashboard />
            </motion.div>
          ) : currentView === 'seller' ? (
            <motion.div
              key="seller-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full"
            >
              <SellerDashboard 
                name={sellerName} 
                onAddProduct={() => {
                  setEditingProduct(null);
                  setIsAddProductModalOpen(true);
                }}
                onEditProduct={(product) => {
                  setEditingProduct(product);
                  setIsAddProductModalOpen(true);
                }}
                onBuy={handleBuyProduct}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                onStartChat={handleOpenChatWithUser}
              />
            </motion.div>
          ) : (
            <motion.div
              key="customer-catalog"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full"
            >
              <Hero />
              <div className="mt-16 flex flex-col lg:flex-row gap-12 items-start">
                <Filters />
                <ProductCatalog 
                  onBuy={handleBuyProduct} 
                  onSelect={setSelectedProduct} 
                  onEditProduct={(product) => {
                    setEditingProduct(product);
                    setIsAddProductModalOpen(true);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SellerOnboarding 
        isOpen={isSellerModalOpen} 
        onClose={() => setIsSellerModalOpen(false)} 
        onSuccess={handleBecomeSellerSuccess}
      />

      <AddProductModal 
        isOpen={isAddProductModalOpen}
        onClose={() => {
          setIsAddProductModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={() => {
          // You could add a toast here
        }}
      />

      <SellerSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSuccess={handleSettingsSuccess}
      />

      <ProductDetailModal 
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onBuy={handleBuyProduct}
        onStartChat={handleOpenChatWithUser}
      />

      <PurchasesModal
        isOpen={isPurchasesOpen}
        onClose={() => setIsPurchasesOpen(false)}
        onStartChat={handleOpenChatWithUser}
      />

      <ChatOverlay
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatTargetUserId(null);
          setChatTargetUserName(null);
        }}
        targetUserId={chatTargetUserId}
        targetUserName={chatTargetUserName}
      />

      <CheckoutModal 
        isOpen={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setIsCheckoutFromCart(false);
        }}
        product={isCheckoutFromCart ? null : checkoutProduct}
        cartItems={isCheckoutFromCart ? cart : []}
        onSuccess={() => {
          if (isCheckoutFromCart) setCart([]);
        }}
        onBackToCatalog={() => {
          setCurrentView('buyer');
        }}
      />

      <CartSidebar 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveFromCart}
        onCheckout={handleCartCheckout}
      />

      <Toaster position="bottom-right" />

      <PaymentRecoveryChecker />

      {/* Floating Modern Glassmorphic Chat Button */}
      <button 
        id="floating-chat" 
        onClick={() => setIsChatOpen(prev => !prev)}
        className="fixed bottom-6 right-6 h-14 px-5 rounded-full flex items-center gap-3 bg-white/60 hover:bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)] hover:scale-105 active:scale-95 transition-all cursor-pointer z-50 group"
      >
        <div className="relative w-8 h-8 rounded-full flex items-center justify-center bg-gray-900/10 text-gray-900 group-hover:bg-gray-900 group-hover:text-white transition-all shadow-inner">
          <MessageSquare className="h-4 w-4" />
          {hasUnreadMessages && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white animate-pulse"></span>
          )}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 select-none">
          Messagerie
        </span>
      </button>

      {/* Footer info (Mini) */}
      <footer className="py-8 border-t border-gray-100 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} Lakay Market. Tous droits réservés.
      </footer>
    </div>
  );
}
