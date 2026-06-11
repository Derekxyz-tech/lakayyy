import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, ShoppingCart, User, MapPin, Tag, Box, ArrowRight, Store, ChevronLeft, ChevronRight, UserPlus, UserCheck, Bell, MessageSquare, Truck, Clock, BadgeCheck } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import StarRating from './StarRating';
import { useStoreRatings, useSellerReviews } from '../lib/reviews';
import { useIsFollowing, followSeller, unfollowSeller } from '../lib/follows';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onBuy: (product: any, quantity?: number) => void;
  onStartChat?: (sellerId: string, sellerName: string) => void;
}

export default function ProductDetailModal({ isOpen, onClose, product, onBuy, onStartChat }: ProductDetailModalProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [seller, setSeller] = useState<any>(null);
  const [loadingSeller, setLoadingSeller] = useState(false);

  const { ratingsMap } = useStoreRatings();
  const { reviews, loading: loadingReviews } = useSellerReviews(product?.sellerId);

  const { isFollowing } = useIsFollowing(product?.sellerId);
  const [toggleLoading, setToggleLoading] = useState(false);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      toast.error("Veuillez vous connecter pour suivre cette boutique.", {
        id: 'auth-err-follow',
        style: {
          borderRadius: '16px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
      return;
    }

    if (auth.currentUser.uid === product?.sellerId) {
      toast.error("Vous ne pouvez pas vous suivre vous-même.", {
        id: 'self-err-follow',
        style: {
          borderRadius: '16px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '900',
          fontSize: '11px',
          letterSpacing: '0.05em'
        }
      });
      return;
    }

    setToggleLoading(true);
    try {
      if (isFollowing) {
        await unfollowSeller(product.sellerId);
        toast.success(`Vous ne suivez plus ${seller?.companyName || 'ce studio'}.`, {
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
        await followSeller(product.sellerId);
        toast.success(`Vous suivez désormais ${seller?.companyName || 'ce studio'} !`, {
          style: {
            borderRadius: '16px',
            background: '#10B981',
            color: '#fff',
            fontWeight: '900',
            fontSize: '11px',
            letterSpacing: '0.05em'
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur de suivi.", {
        style: {
          borderRadius: '16px',
          background: '#EF4444',
          color: '#fff',
          fontWeight: '950',
          fontSize: '11px'
        }
      });
    } finally {
      setToggleLoading(false);
    }
  };

  const sellerRatingInfo = product?.sellerId && ratingsMap[product.sellerId]
    ? ratingsMap[product.sellerId]
    : { averageRating: 0, totalRatings: 0 };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveImageIdx(0);
      setQuantity(1);

      if (product) {
        // Initialize with cached info immediately for native responsive feel
        setSeller({
          companyName: product.sellerCompanyName || 'Studio Créatif',
          photoURL: product.sellerPhotoURL || '',
          verified: !!product.sellerVerified,
        });

        if (product.sellerId) {
          setLoadingSeller(true);
          const fetchSellerDetails = async () => {
            try {
              const docRef = doc(db, 'users', product.sellerId);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                // Prioritize companyName, fallback to public sellerName
                const liveCompanyName = data.companyName || data.sellerName || product.sellerCompanyName || 'Studio Créatif';
                const livePhotoURL = data.photoURL || product.sellerPhotoURL || '';
                setSeller({
                  companyName: liveCompanyName,
                  photoURL: livePhotoURL,
                  verified: !!data.verified,
                });
              }
            } catch (err) {
              console.error('Error fetching latest seller context:', err);
            } finally {
              setLoadingSeller(false);
            }
          };
          fetchSellerDetails();
        }
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const images = product.images && product.images.length > 0 ? product.images : [null];
  const activeImage = images[activeImageIdx];
  const isSoldOut = product.stock <= 0;
  const isLowStock = !isSoldOut && product.stock <= 3;

  const handleAddToCart = () => {
    if (isSoldOut) return;
    
    // Add multiple quantities to cart
    for (let i = 0; i < quantity; i++) {
      const event = new CustomEvent('addToCart', { detail: product });
      window.dispatchEvent(event);
    }
    onClose();
  };

  const handleFilterBySeller = () => {
    if (seller) {
      // Dispatch an event to filter products in catalog by this seller
      const filterEvent = new CustomEvent('catalogFilterChange', {
        detail: {
          categories: [],
          minPrice: null,
          maxPrice: null,
          region: product.region || null,
          sellerId: product.sellerId
        }
      });
      window.dispatchEvent(filterEvent);
      
      toast.success(`Filtré par boutique: ${seller.companyName || 'Artisan local'}`, {
        icon: '🏪',
        style: {
          borderRadius: '20px',
          background: '#111827',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold',
        }
      });
      onClose();
    }
  };

  const nextImage = () => {
    setActiveImageIdx((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const htgPriceStr = product.price.toLocaleString();

  return (
    <div id="product-detail-portal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <AnimatePresence>
        {/* Backdrop overlay */}
        <motion.div
          key="detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-950/70 backdrop-blur-xl"
        />

        {/* Modal Sheet body */}
        <motion.div
          key="detail-sheet"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: 45 }}
          className="relative w-full max-w-5xl bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.18)] border border-white my-auto max-h-[92vh] overflow-y-auto scrollbar-hide flex flex-col md:flex-row"
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all z-25 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Left: Product Images Gallery */}
          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col gap-4 border-r border-gray-100/35">
            <div className="relative aspect-square rounded-[1.75rem] bg-gray-50 border border-gray-100/50 flex items-center justify-center overflow-hidden group/gallery">
              {activeImage ? (
                <img 
                  src={activeImage} 
                  alt={product.name} 
                  className="w-full h-full object-cover animate-fade-in duration-300" 
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-300">
                  <Box className="h-16 w-16" />
                  <span className="text-xs font-bold uppercase tracking-widest">Image indisponible</span>
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center text-gray-800 shadow-md hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/gallery:opacity-100 cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center text-gray-800 shadow-md hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/gallery:opacity-100 cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <div className="absolute top-4 left-4 px-3.5 py-1.5 bg-gray-900/95 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-md">
                {product.category}
              </div>

              {isSoldOut && (
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center animate-fade-in">
                  <span className="px-6 py-2 bg-red-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-full shadow-lg">
                    Rupture Stock
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail navigation */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-20 aspect-square rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      activeImageIdx === idx ? 'border-gray-900 scale-95 shadow-md' : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details Information */}
          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Seller profile / Store Name info */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {loadingSeller ? (
                  <div className="h-10 bg-gray-50 rounded-xl animate-pulse w-48"></div>
                ) : seller ? (
                  <>
                    <div 
                      onClick={handleFilterBySeller}
                      className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 cursor-pointer group active:scale-98 transition-all"
                    >
                      <div className="h-7 w-7 rounded-full bg-white border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {seller.photoURL ? (
                          <img src={seller.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Store className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </div>
                      <div className="text-left select-none">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">STUDIO PARTENAIRE</p>
                        <p className="text-xs font-black text-gray-850 tracking-tight group-hover:text-brand transition-colors leading-tight mb-1 flex items-center gap-1">
                          <span>{seller.companyName || 'Artisan local'}</span>
                          {seller.verified && (
                            <BadgeCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10 shrink-0" title="Artisan Certifié et Vérifié" />
                          )}
                        </p>
                        <StarRating rating={sellerRatingInfo.averageRating} totalRatings={sellerRatingInfo.totalRatings} size="xs" showCount />
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:translate-x-1 transition-transform ml-1 shrink-0" />
                    </div>

                    <button
                      id="follow-button"
                      type="button"
                      disabled={toggleLoading}
                      onClick={handleFollowToggle}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 h-[38px] rounded-full text-[10px] font-black tracking-wider uppercase transition-all duration-300 pointer-events-auto cursor-pointer focus:outline-none ${
                        isFollowing 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100/70' 
                        : 'bg-gray-900 text-white hover:bg-black border border-gray-900'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Suivi</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Suivre</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 rounded-full border border-gray-100 uppercase tracking-wider">
                    <User className="h-3 w-3" /> Artisan Indépendant
                  </div>
                )}
              </div>

              {/* Title & Price */}
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight flex items-center gap-2 flex-wrap animate-in fade-in duration-300">
                  <span>{product.name}</span>
                  {product.verified && (
                    <BadgeCheck className="h-6 w-6 text-blue-500 fill-blue-500/10 shrink-0" title="Produit Certifié de Qualité" />
                  )}
                </h1>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-950">
                    {htgPriceStr}
                  </span>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">HTG</span>
                </div>
              </div>

              <hr className="border-gray-100/50" />

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Détails & Histoire</h4>
                <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-lg">
                  {product.description || "Aucune description détaillée n'a été rédigée pour cet article unique d'artisanat d'art."}
                </p>
              </div>

              {/* Regional Origin / Stock context info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50/50 rounded-2xl p-4 border border-gray-100/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-gray-500 shadow-sm">
                    <MapPin className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">ORIGINE</p>
                    <p className="text-xs font-bold text-gray-700 capitalize">
                      {product.region || 'Haïti'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-gray-500 shadow-sm">
                    <Box className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-mono">STOCK</p>
                    <p className="text-xs font-bold text-gray-700">
                      {isSoldOut ? (
                        <span className="text-red-500">INDISPONIBLE</span>
                      ) : (
                        `${product.stock} pièces`
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="grid grid-cols-2 gap-4 bg-indigo-50/20 rounded-2xl p-4 border border-indigo-100/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 shadow-sm">
                    <Clock className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">LIVRAISON ESTIMÉE</p>
                    <p className="text-xs font-black text-indigo-950">
                      {product.deliveryTime || '2-4 jours'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 shadow-sm">
                    <Truck className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">FRAIS DE LIVRAISON</p>
                    <p className="text-xs font-black text-indigo-950">
                      {(product.deliveryPrice !== undefined && product.deliveryPrice !== null) ? (product.deliveryPrice === 0 ? 'Gratuit' : `${product.deliveryPrice.toLocaleString()} HTG`) : '150 HTG'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock status slider */}
              {!isSoldOut && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black tracking-wider text-gray-400 uppercase">
                    <span>Disponibilité</span>
                    <span>{isLowStock ? '🔥 Stock très limité' : 'Disponible'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isLowStock ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, (product.stock / 15) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Core Action Footer: Quantity & Purchase triggers */}
            <div className="space-y-4 pt-6 mt-8 border-t border-gray-100/50">
              {/* Quantity selector */}
              {!isSoldOut && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QUANTITÉ</span>
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl p-1">
                    <button 
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-150 transition-all font-black text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-black text-gray-900">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(prev => Math.min(product.stock, prev + 1))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-150 transition-all font-black text-sm cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Checkout / Bag controls */}
              <div className="flex gap-3">
                <button
                  onClick={() => onBuy(product, quantity)}
                  disabled={isSoldOut}
                  className={`flex-1 py-4.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl cursor-pointer ${
                    isSoldOut 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-transparent' 
                      : 'bg-gray-900 text-white hover:bg-black hover:scale-102 active:scale-98 shadow-gray-950/15'
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  ACHETER MAINTENANT
                </button>

                <button
                  onClick={handleAddToCart}
                  disabled={isSoldOut}
                  className={`py-4.5 px-6 rounded-2xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isSoldOut
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-gray-900 hover:scale-105 active:scale-95 shadow-lg shadow-gray-100/50'
                  }`}
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                </button>
              </div>

              {onStartChat && (
                <button
                  type="button"
                  onClick={() => onStartChat(product.sellerId, seller?.companyName || 'Artisan local')}
                  className="w-full py-4 bg-gray-100 text-gray-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 active:scale-97 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-gray-150"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  Discuter avec l'artisan
                </button>
              )}

              {/* Seller Reviews Feed Section */}
              <div id="seller-reviews" className="mt-8 pt-8 border-t border-gray-100/80 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                  <span>Avis clients</span>
                  {sellerRatingInfo.totalRatings > 0 && (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      ★ {sellerRatingInfo.averageRating.toFixed(1)} / 5 ({sellerRatingInfo.totalRatings})
                    </span>
                  )}
                </h4>
                
                {loadingReviews ? (
                  <div className="space-y-2">
                    <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                    <div className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="p-4 bg-gray-50/60 border border-gray-100/40 rounded-2xl text-left shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-extrabold text-gray-700 capitalize">
                            {rev.buyerName || 'Client de LakayMarket'}
                          </span>
                          <StarRating rating={rev.rating} size="xs" />
                        </div>
                        <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                          {rev.comment || "L'acheteur a laissé une note de 5 étoiles sans ajouter de commentaire écrit."}
                        </p>
                        {rev.productName && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[8px] bg-white border border-gray-105 text-gray-405 font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                              Produit: {rev.productName}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50/40 rounded-2xl border border-dashed border-gray-200 text-center">
                    <p className="text-[11px] text-gray-400 font-bold">
                      Ce studio partenaire n'a pas encore reçu d'évaluation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
