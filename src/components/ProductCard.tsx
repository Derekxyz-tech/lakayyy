import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Package, Trash2, Edit3, ShoppingCart, Info, Heart, Sparkles, TrendingUp, BadgeCheck } from 'lucide-react';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import StarRating from './StarRating';
import { useFavorites, toggleFavorite } from '../lib/favorites';
import toast from 'react-hot-toast';

interface ProductCardProps {
  key?: any;
  product: any;
  onEdit?: () => void;
  onBuy?: (product: any) => void;
  onSelect?: (product: any) => void;
  isOwner?: boolean;
  sellerRating?: { averageRating: number; totalRatings: number };
  onPromote?: () => void;
}

export default function ProductCard({ product, onEdit, onBuy, onSelect, isOwner, sellerRating, onPromote }: ProductCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const favorites = useFavorites();
  const isFavorite = favorites.includes(product.id);

  const isAdmin = auth.currentUser?.email === 'ghostytb77777@gmail.com';
  const isOwnerChecked = isOwner || (auth.currentUser && auth.currentUser.uid === product.sellerId);

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isAdded = toggleFavorite(product.id);
    if (isAdded) {
      toast.success(`Ajouté aux favoris : ${product.name}`, {
        icon: '❤️',
        style: {
          borderRadius: '16px',
          background: '#1F2937',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
    } else {
      toast.success(`Retiré des favoris : ${product.name}`, {
        style: {
          borderRadius: '16px',
          background: '#374151',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const toastId = toast.loading("Suppression du produit...");
    try {
      await deleteDoc(doc(db, 'products', product.id));
      toast.success("Produit supprimé avec succès !", { id: toastId });
    } catch (error) {
      toast.error("Erreur lors de la suppression.", { id: toastId });
      handleFirestoreError(error, OperationType.DELETE, `products/${product.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSoldOut = product.stock <= 0;
  const displayImage = product.images?.[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect?.(product)}
      className={`relative group bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-2xl xs:rounded-[2rem] border border-white/80 dark:border-slate-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] overflow-hidden transition-all duration-300 flex flex-col h-full cursor-pointer ${
        product.promoted 
          ? 'hover:scale-[1.03] hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(99,102,241,0.12)] hover:border-indigo-200/60 dark:hover:border-indigo-900/40' 
          : 'hover:shadow-[0_12px_48px_rgba(0,0,0,0.06)] hover:border-white dark:hover:border-slate-705'
      }`}
    >
      {showConfirmDelete && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 shadow-2xl z-30 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200"
        >
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/45 flex items-center justify-center mb-3">
            <Trash2 className="h-6 w-6 text-red-500 animate-pulse" />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">Supprimer l'article ?</h4>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1.5 mb-5 uppercase tracking-wider max-w-[180px]">
            Cette opération est définitive et immédiate.
          </p>
          <div className="flex gap-2.5 w-full max-w-[210px]">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-755 border border-gray-200 dark:border-slate-705 text-gray-700 dark:text-gray-300 active:scale-97 transition-all cursor-pointer"
            >
              Non
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black bg-red-600 hover:bg-red-700 text-white shadow-lg active:scale-97 transition-all cursor-pointer"
            >
              Oui
            </button>
          </div>
        </div>
      )}
      {/* Image Display */}
      <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          />
        ) : (
          <Package className="h-12 w-12 text-gray-200 dark:text-gray-600" />
        )}
        <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
          <div className="px-3 py-1 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white border border-white/80 dark:border-slate-800/85 shadow-sm leading-none">
            {product.category}
          </div>
          {product.promoted && (
            <div className="px-2 py-0.5 bg-indigo-600/90 dark:bg-indigo-500/90 text-white font-black uppercase text-[8px] tracking-[0.14em] rounded-md shadow-md flex items-center gap-1 active:scale-95 transition-all select-none border border-indigo-400">
              <Sparkles className="h-2.5 w-2.5 text-amber-300 fill-amber-300 animate-pulse" />
              <span>À LA UNE</span>
            </div>
          )}
        </div>
        
        <button
          id={`favorite-btn-${product.id}`}
          type="button"
          onClick={handleFavoriteToggle}
          className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-gray-800 dark:text-gray-200 hover:text-red-500 rounded-full backdrop-blur-md border border-white dark:border-slate-800 hover:scale-115 active:scale-95 transition-all shadow-sm cursor-pointer z-10 flex items-center justify-center h-8 w-8"
          title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Heart className={`h-4 w-4 transition-colors duration-200 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-400'}`} />
        </button>

        {isSoldOut && (
          <div className="absolute inset-0 bg-gray-900/60 dark:bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-6 py-2 bg-red-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-full shadow-lg">
              Épuisé
            </span>
          </div>
        )}
      </div>

      <div className="p-4 xs:p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-brand transition-colors font-sans flex items-center gap-1.5 flex-wrap">
            <span>{product.name}</span>
            {product.verified && (
              <BadgeCheck className="h-4.5 w-4.5 text-blue-500 fill-blue-500/10 shrink-0 animate-in zoom-in-50 duration-300" title="Produit Certifié de Qualité Artisanal" />
            )}
          </h3>
          <span className="text-lg font-black text-gray-900 dark:text-white shrink-0">
            {product.price.toLocaleString()} <small className="text-[10px] text-gray-400 dark:text-gray-500">HTG</small>
          </span>
        </div>

        {/* Brand & Store Rating Component */}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest bg-gray-100/70 dark:bg-slate-800/70 border border-gray-100 dark:border-slate-800 px-2 py-0.5 rounded-md">
            <span>{product.sellerCompanyName || 'Studio Créatif'}</span>
            {product.sellerVerified && (
              <BadgeCheck className="h-3 w-3 text-blue-500 fill-blue-500/10 shrink-0" title="Artisan Certifié et Vérifié" />
            )}
          </span>
          {sellerRating && sellerRating.totalRatings > 0 ? (
            <StarRating rating={sellerRating.averageRating} totalRatings={sellerRating.totalRatings} size="xs" showCount />
          ) : (
            <span className="text-[9px] font-bold text-gray-350 dark:text-gray-600 uppercase tracking-wide">Nouveau Studio</span>
          )}
        </div>
        
        <p className="text-sm text-gray-400 dark:text-gray-300 font-medium line-clamp-2 mb-4 leading-relaxed h-10">
          {product.description}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100/30 dark:border-slate-850">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSoldOut ? 'bg-red-400' : 'bg-green-400'}`} />
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {isSoldOut ? 'Rupture' : `${product.stock} en stock`}
            </span>
          </div>

          <div className="flex items-center gap-2">
           {isOwnerChecked || isAdmin ? (
              <>
                {isOwnerChecked && onPromote && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPromote();
                    }}
                    className="p-2.5 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/35 rounded-xl transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 shadow-sm flex items-center justify-center animate-[pulse_2s_infinite]"
                    title="Booster / Promouvoir"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-slate-700 shadow-sm"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirmDelete(true);
                  }}
                  disabled={isDeleting}
                  className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : null}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBuy?.(product);
              }}
              disabled={!isAdmin && isSoldOut}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                !isAdmin && isSoldOut
                ? 'bg-gray-140 dark:bg-slate-800 text-gray-400 dark:text-gray-550 cursor-not-allowed'
                : 'bg-brand text-white hover:bg-brand-dark hover:scale-105 active:scale-95 shadow-lg shadow-brand/10'
              }`}
            >
              Acheter
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                // We'll define onAddToCart in App.tsx and pass it through
                const event = new CustomEvent('addToCart', { detail: product });
                window.dispatchEvent(event);
              }}
              disabled={!isAdmin && isSoldOut}
              className={`flex items-center gap-2 p-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                !isAdmin && isSoldOut
                ? 'bg-gray-140 dark:bg-slate-800 text-gray-400 dark:text-gray-550 cursor-not-allowed'
                : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-100 dark:border-slate-700 hover:border-gray-900 dark:hover:border-white hover:scale-110 active:scale-95'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
