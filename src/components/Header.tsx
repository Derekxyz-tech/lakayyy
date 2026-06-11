import { useState } from 'react';
import { Search, ShoppingCart, LogOut, Store, LogIn, ChevronRight, ShoppingBag, Sun, Moon } from 'lucide-react';
import { auth, signInWithGoogle } from '../lib/firebase';
import { User, signOut } from 'firebase/auth';
import AuthModal from './AuthModal';

interface HeaderProps {
  onBecomeSeller?: () => void;
  isSeller?: boolean;
  isSellerMode?: boolean;
  onToggleMode?: () => void;
  user?: User | null;
  cartCount?: number;
  onOpenCart?: () => void;
  currentView?: 'buyer' | 'seller' | 'maker';
  onViewChange?: (view: 'buyer' | 'seller' | 'maker') => void;
  onOpenPurchases?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export default function Header({ 
  onBecomeSeller, 
  isSeller, 
  isSellerMode, 
  onToggleMode, 
  user, 
  cartCount = 0, 
  onOpenCart,
  currentView = 'buyer',
  onViewChange,
  onOpenPurchases,
  theme = 'light',
  onToggleTheme
}: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const displayName = currentView === 'seller' 
    ? (localStorage.getItem('sellerName') || user?.displayName?.split(' ')[0] || 'Artisan') 
    : (user?.displayName?.split(' ')[0] || 'Utilisateur');

  return (
    <header id="main-header" className="sticky top-0 z-50 w-full bg-white/60 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/20 dark:border-slate-800/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] transition-colors duration-300">
      <div className="container mx-auto px-4 h-20 md:h-24 flex items-center justify-between gap-2 md:gap-8">
        {/* Logo */}
        <div id="logo" className="flex items-center gap-2 xs:gap-3 shrink-0">
          <div className="flex flex-col">
            <span className="text-xl xs:text-2xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
              LakayMarket
            </span>
            {currentView === 'seller' && <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mt-1.5 opacity-60">Creative Studio</span>}
            {currentView === 'maker' && <span className="text-[10px] font-bold text-brand uppercase tracking-[0.2em] mt-1.5">Maker Hub</span>}
          </div>
        </div>

        {/* Search Bar - Hidden in Studio and Maker Mode on desktop */}
        {currentView === 'buyer' && (
          <div id="search-container" className="flex-1 max-w-xl relative hidden md:block">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              id="search-input"
              type="text"
              placeholder="Chercher l'exceptionnel..."
              onChange={(e) => {
                window.dispatchEvent(new CustomEvent('searchChange', { detail: e.target.value }));
              }}
              className="w-full bg-gray-100/40 dark:bg-slate-800/45 border border-white/50 dark:border-slate-750/50 backdrop-blur-sm rounded-2xl py-3.5 pl-12 pr-6 focus:ring-0 focus:bg-white dark:focus:bg-slate-800 focus:border-gray-200 dark:focus:border-slate-700 transition-all outline-none text-sm font-medium text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-550 shadow-inner"
            />
          </div>
        )}

        <div id="header-actions" className="flex items-center gap-1.5 xs:gap-3 md:gap-6">
          {user ? (
            <div className="flex items-center gap-1.5 xs:gap-3 md:gap-6">
              {/* Role Switcher */}
              {user?.email === 'ghostytb77777@gmail.com' ? (
                <div className="flex bg-gray-100/80 dark:bg-slate-850/80 p-0.5 xs:p-1 rounded-xl xs:rounded-2xl border border-gray-100 dark:border-slate-800 select-none">
                  <button
                    onClick={() => onViewChange?.('buyer')}
                    className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg xs:rounded-xl text-[8px] xs:text-[9px] md:text-[10px] uppercase tracking-wider font-black transition-all ${
                      currentView === 'buyer' 
                        ? 'bg-white dark:bg-slate-800 text-gray-950 dark:text-white shadow-sm' 
                        : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Boutique
                  </button>
                  <button
                    onClick={() => onViewChange?.('seller')}
                    className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg xs:rounded-xl text-[8px] xs:text-[9px] md:text-[10px] uppercase tracking-wider font-black transition-all ${
                      currentView === 'seller' 
                        ? 'bg-white dark:bg-slate-800 text-gray-950 dark:text-white shadow-sm' 
                        : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Studio
                  </button>
                  <button
                    onClick={() => onViewChange?.('maker')}
                    className={`px-2 md:px-4 py-1.5 md:py-2 rounded-lg xs:rounded-xl text-[8px] xs:text-[9px] md:text-[10px] uppercase tracking-wider font-black transition-all flex items-center gap-0.5 xs:gap-1 ${
                      currentView === 'maker' 
                        ? 'bg-gray-950 dark:bg-white text-white dark:text-gray-950 shadow-md' 
                        : 'text-brand hover:text-brand-dark'
                    }`}
                  >
                    <span className="h-1 w-1 xs:h-1.5 xs:w-1.5 bg-brand rounded-full animate-pulse" />
                    Maker
                  </button>
                </div>
              ) : isSeller ? (
                <button 
                  onClick={onToggleMode}
                  className={`flex items-center gap-1.5 xs:gap-2.5 px-3 xs:px-5 py-2 xs:py-3 rounded-xl xs:rounded-2xl text-[8px] xs:text-[10px] uppercase tracking-[0.1em] font-black transition-all active:scale-95 border ${
                    isSellerMode 
                    ? 'bg-white/80 dark:bg-slate-800/80 text-gray-900 dark:text-gray-100 border-gray-100 dark:border-slate-700 hover:bg-white shadow-sm' 
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-950 border-gray-900 dark:border-white hover:bg-black dark:hover:bg-gray-100 shadow-lg shadow-gray-900/5'
                  }`}
                >
                  {isSellerMode ? (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Lifestyle</span>
                    </>
                  ) : (
                    <>
                      <Store className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Studio</span>
                    </>
                  )}
                </button>
              ) : (
                <button 
                  onClick={onBecomeSeller}
                  id="become-seller-btn"
                  className="flex items-center gap-1 xs:gap-2 px-2 xs:px-4 md:px-6 py-2 md:py-3 bg-white/50 dark:bg-slate-800/50 border border-white dark:border-slate-700 shadow-sm rounded-xl xs:rounded-2xl text-[9px] xs:text-[10px] md:text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-gray-900 hover:text-white dark:hover:bg-slate-800 transition-all group shrink-0"
                >
                  <Store className="h-3 w-3 xs:h-3.5 xs:w-3.5 md:h-4 md:w-4 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="hidden sm:inline">Devenir vendeur</span>
                  <span className="sm:hidden">Vendre</span>
                </button>
              )}

              <div className="hidden lg:flex flex-col items-end">
                <span className="text-xs font-bold text-gray-900 dark:text-white tracking-tight leading-none font-sans">
                  {displayName}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-550 font-bold uppercase tracking-[0.1em] mt-1 leading-none">
                  {currentView === 'maker' ? 'Webapp Maker' : currentView === 'seller' ? 'Propriétaire' : 'Explorateur'}
                </span>
              </div>

              {currentView === 'buyer' && (
                <div className="flex items-center gap-1 xs:gap-2">
                  <button 
                    onClick={onOpenPurchases}
                    className="flex items-center gap-1 px-2 xs:px-3.5 py-2 xs:py-2.5 bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/15 dark:hover:bg-amber-500/20 border border-amber-200/50 dark:border-amber-700/50 text-amber-800 dark:text-amber-400 rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-500 shrink-0" />
                    <span className="hidden md:inline">Mes Achats</span>
                  </button>

                  <button 
                    onClick={onOpenCart}
                    id="cart-btn" 
                    className="relative p-2 xs:p-2.5 text-gray-400 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all bg-white dark:bg-slate-800 shadow-sm border border-gray-55 dark:border-slate-700 rounded-xl group cursor-pointer"
                  >
                    <ShoppingCart className="h-4 w-4 xs:h-5 xs:w-5 group-hover:scale-110 transition-transform" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-gray-900 dark:bg-amber-500 text-white dark:text-gray-950 text-[8px] xs:text-[9px] font-black w-4.5 h-4.5 xs:w-5 xs:h-5 flex items-center justify-center rounded-full ring-2 xs:ring-4 ring-white/50 dark:ring-slate-900/50 animate-in zoom-in duration-300">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 xs:gap-3">
                <div className="relative group/pfp select-none">
                  <button
                    onClick={onToggleTheme}
                    id="user-profile-btn"
                    className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl xs:rounded-2xl overflow-hidden border-2 border-white dark:border-slate-700 shadow-md relative cursor-pointer transition-all hover:scale-110 active:scale-95 flex items-center justify-center focus:outline-none"
                    title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-300 dark:text-gray-500">
                        <Store className="h-4 w-4 xs:h-5 xs:w-5" />
                      </div>
                    )}
                  </button>

                  {/* Absolute theme badge indicator on bottom right of the PFP */}
                  <button 
                    onClick={onToggleTheme}
                    className="absolute -bottom-1 -right-1 xs:-right-1.5 w-4.5 h-4.5 xs:w-5 xs:h-5 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer scale-90 xs:scale-100 select-none"
                    title={theme === 'dark' ? "Passer en mode clair (PFP)" : "Passer en mode sombre (PFP)"}
                  >
                    {theme === 'dark' ? (
                      <Sun className="h-2.5 w-2.5 xs:h-3 xs:w-3 text-amber-500 fill-amber-500 animate-[spin_10s_linear_infinite]" />
                    ) : (
                      <Moon className="h-2.5 w-2.5 xs:h-3 xs:w-3 text-indigo-500 fill-indigo-500" />
                    )}
                  </button>
                </div>
                
                <button 
                  onClick={() => signOut(auth)}
                  className="p-1 xs:p-2 text-gray-300 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer ml-1 xs:ml-0"
                  title="Déconnexion"
                >
                  <LogOut className="h-4.5 w-4.5 xs:h-4.5 xs:w-4.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                id="login-btn" 
                className="flex items-center gap-1.5 xs:gap-2.5 px-4 xs:px-8 py-2 xs:py-3 rounded-xl xs:rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-[10px] xs:text-xs font-black hover:bg-black dark:hover:bg-gray-100 shadow-xl shadow-gray-900/10 active:scale-95 transition-all cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                DÉMARRER
              </button>
            </div>
          )}

          {/* Elegant Sun / Moon Dark Mode Selector Button - Only visible when logged out to avoid redundancy */}
          {!user && (
            <button 
              type="button"
              onClick={onToggleTheme}
              id="theme-toggle-btn"
              className="p-2 xs:p-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all bg-white/70 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-700 shadow-sm border border-gray-100 dark:border-slate-700 rounded-xl xs:rounded-2xl cursor-pointer flex items-center justify-center"
              title={theme === 'dark' ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500 animate-[spin_8s_linear_infinite]" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar Row - Sticky and elegant only on mobile for buyer view */}
      {currentView === 'buyer' && (
        <div className="px-4 pb-3 md:hidden">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Chercher l'exceptionnel..."
              onChange={(e) => {
                window.dispatchEvent(new CustomEvent('searchChange', { detail: e.target.value }));
              }}
              className="w-full bg-gray-100/40 dark:bg-slate-800/45 border border-white/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl py-2.5 pl-10 pr-4 focus:ring-0 focus:bg-white dark:focus:bg-slate-800 focus:border-gray-200 dark:focus:border-slate-700 transition-all outline-none text-xs font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-550 shadow-inner"
            />
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </header>
  );
}
