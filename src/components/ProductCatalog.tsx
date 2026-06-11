import { PackageOpen, ChevronLeft, ChevronRight, LayoutGrid, Heart, Sparkles, UserCheck } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import ProductCard from './ProductCard';
import { useStoreRatings } from '../lib/reviews';
import { useFollowingSellers } from '../lib/follows';
import { useFavorites } from '../lib/favorites';

interface ProductCatalogProps {
  onBuy?: (product: any) => void;
  onSelect?: (product: any) => void;
  onEditProduct?: (product: any) => void;
}

export default function ProductCatalog({ onBuy, onSelect, onEditProduct }: ProductCatalogProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'favorites'>('all');
  const { followedSellers } = useFollowingSellers();
  const favorites = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    categories: string[];
    minPrice: number | null;
    maxPrice: number | null;
    region: string | null;
    sellerId?: string | null;
  }>({
    categories: [],
    minPrice: null,
    maxPrice: null,
    region: null,
    sellerId: null,
  });
  const [sortBy, setSortBy] = useState<string>('Plus récents');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
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

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleSearch = (e: any) => {
      setSearchQuery(e.detail || '');
    };
    const handleFilter = (e: any) => {
      setFilters(e.detail);
    };

    window.addEventListener('searchChange', handleSearch);
    window.addEventListener('catalogFilterChange', handleFilter);

    return () => {
      window.removeEventListener('searchChange', handleSearch);
      window.removeEventListener('catalogFilterChange', handleFilter);
    };
  }, []);

  const { ratingsMap } = useStoreRatings();

  const filteredProducts = products.filter(product => {
    // Following Tab filter
    if (activeTab === 'following') {
      if (!product.sellerId || !followedSellers.includes(product.sellerId)) {
        return false;
      }
    }

    // Favorites Tab filter
    if (activeTab === 'favorites') {
      if (!favorites.includes(product.id)) {
        return false;
      }
    }

    // Search filter
    if (searchQuery) {
      const queryStr = searchQuery.toLowerCase();
      const nameMatch = product.name?.toLowerCase().includes(queryStr);
      const descMatch = product.description?.toLowerCase().includes(queryStr);
      const catMatch = product.category?.toLowerCase().includes(queryStr);
      if (!nameMatch && !descMatch && !catMatch) return false;
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      const normProductCat = product.category?.toLowerCase().trim();
      const matches = filters.categories.some(selectedCat => {
        const normSelected = selectedCat.toLowerCase().trim();
        return normProductCat === normSelected || 
          normProductCat?.includes(normSelected) || 
          normSelected?.includes(normProductCat || '');
      });
      if (!matches) return false;
    }

    // Price filters
    if (filters.minPrice !== null && product.price < filters.minPrice) return false;
    if (filters.maxPrice !== null && product.price > filters.maxPrice) return false;

    // Region filter
    if (filters.region && product.region && product.region !== filters.region) return false;

    // Seller filter
    if (filters.sellerId && product.sellerId && product.sellerId !== filters.sellerId) return false;

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'Prix croissant') {
      return a.price - b.price;
    }
    if (sortBy === 'Prix décroissant') {
      return b.price - a.price;
    }
    // "Plus récents" stays in default Firestore order
    return 0;
  });

  const promotedProducts = products
    .filter(p => !!p.promoted && p.stock > 0)
    .sort((a, b) => {
      const bBid = b.promotionAmount || 0;
      const aBid = a.promotionAmount || 0;
      if (bBid !== aBid) return bBid - aBid;
      const bTime = b.promotedAt?.seconds || 0;
      const aTime = a.promotedAt?.seconds || 0;
      return bTime - aTime;
    });

  const handleScrollShowcase = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollDistance = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth'
      });
    }
  };

  const handleSkipShowcase = () => {
    const target = document.getElementById('catalog-header');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="product-catalog-container" className="flex-1 space-y-8">
      {/* Promoted Showcase at the top of Front Page */}
      {promotedProducts.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50/45 to-white/45 dark:from-indigo-950/20 dark:to-slate-900/20 p-5 xs:p-8 rounded-[2rem] border border-indigo-100/40 dark:border-indigo-950/45 shadow-sm relative space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                <Sparkles className="h-5 w-5 text-indigo-650 dark:text-indigo-350 animate-[spin_8s_linear_infinite]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight leading-none">Vitrine À La Une</h3>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest leading-none mt-1.5">Sponsorisé par nos artisans partenaires</p>
              </div>
            </div>

            {/* Showcase action button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkipShowcase}
                className="flex items-center gap-1 px-3.5 py-2 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 backdrop-blur-md rounded-xl text-[10px] font-black text-indigo-600 dark:text-indigo-300 border border-indigo-100/30 dark:border-indigo-900/40 transition-all shadow-sm cursor-pointer select-none tracking-wider hover:scale-103 active:scale-97"
              >
                PASSER LA VITRINE
                <ChevronRight className="h-3 w-3" />
              </button>

              <div className="hidden sm:flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleScrollShowcase('left')}
                  className="p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-650 dark:text-gray-350 border border-gray-150/30 dark:border-slate-800 cursor-pointer shadow-sm hover:scale-105"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleScrollShowcase('right')}
                  className="p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-650 dark:text-gray-350 border border-gray-150/30 dark:border-slate-800 cursor-pointer shadow-sm hover:scale-105"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal slider viewport */}
          <div className="relative">
            <div 
              ref={scrollRef}
              className="flex gap-4 xs:gap-6 overflow-x-auto pb-4 pt-1 snap-x scroll-smooth w-full scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(() => {
                const seenIds = new Set();
                return promotedProducts
                  .filter((prod) => {
                    if (!prod.id) return false;
                    if (seenIds.has(prod.id)) return false;
                    seenIds.add(prod.id);
                    return true;
                  })
                  .map((prod) => {
                    const sellerRatingInfo = ratingsMap[prod.sellerId] || { averageRating: 0, totalRatings: 0 };
                    return (
                      <div key={prod.id} className="w-[285px] xs:w-[325px] shrink-0 snap-start text-left">
                        <ProductCard 
                          product={prod} 
                          onBuy={onBuy}
                          onSelect={onSelect}
                          sellerRating={sellerRatingInfo}
                          onEdit={() => onEditProduct?.(prod)}
                        />
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Catalog Header */}
      <div id="catalog-header" className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/80 dark:border-slate-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 flex-1 w-full">
          <div className="space-y-1 block shrink-0">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none font-sans">Catalogue</h2>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
              {loading ? 'Chargement...' : `${sortedProducts.length} articles disponibles`}
            </p>
          </div>

          {/* Elegant Segmented Tab controls */}
          <div className="inline-flex p-1 bg-gray-50/80 dark:bg-slate-950/80 border border-gray-100/60 dark:border-slate-800 rounded-2xl select-none shrink-0 w-full sm:w-auto gap-1 overflow-x-auto scrollbar-hide max-w-full">
            <button
              id="tab-all-products"
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2 rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer focus:outline-none whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-800 text-gray-950 dark:text-white shadow-sm border border-gray-150 dark:border-slate-700'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Tous ({loading ? '...' : products.length})</span>
            </button>
            <button
              id="tab-followed-stores"
              type="button"
              onClick={() => setActiveTab('following')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2 rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer focus:outline-none whitespace-nowrap ${
                activeTab === 'following'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100/30 dark:border-emerald-900/30'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-650 dark:hover:text-white'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Suivis ({followedSellers.length})</span>
            </button>
            <button
              id="tab-favorite-products"
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2 rounded-xl text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all duration-250 cursor-pointer focus:outline-none whitespace-nowrap ${
                activeTab === 'favorites'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-100/30 dark:border-rose-900/30'
                  : 'text-gray-400 dark:text-gray-550 hover:text-gray-650 dark:hover:text-white'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'favorites' ? 'fill-rose-550 text-rose-550 dark:fill-rose-450 dark:text-rose-450' : ''}`} />
              <span>Favoris ({favorites.length})</span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-750 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 appearance-none outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand/30 transition-all cursor-pointer"
            >
              <option className="dark:bg-slate-900">Plus récents</option>
              <option className="dark:bg-slate-900">Prix croissant</option>
              <option className="dark:bg-slate-900">Prix décroissant</option>
            </select>
            <LayoutGrid className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-550 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Catalog Grid / Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8 opacity-50">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-96 bg-gray-100 dark:bg-slate-900 rounded-[2rem] animate-pulse" />
          ))}
        </div>
      ) : sortedProducts.length > 0 ? (
        <div id="catalog-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xs:gap-6 md:gap-8">
          {(() => {
            const seenIds = new Set();
            return sortedProducts
              .filter((product) => {
                if (!product.id) return false;
                if (seenIds.has(product.id)) return false;
                seenIds.add(product.id);
                return true;
              })
              .map((product) => {
                const sellerRatingInfo = ratingsMap[product.sellerId] || { averageRating: 0, totalRatings: 0 };
                return (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onBuy={onBuy}
                    onSelect={onSelect}
                    sellerRating={sellerRatingInfo}
                    onEdit={() => onEditProduct?.(product)}
                  />
                );
              });
          })()}
        </div>
      ) : (
        <div id="catalog-grid" className="min-h-[500px] bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/80 dark:border-slate-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-12 text-center">
          <div className="w-24 h-24 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full flex items-center justify-center mb-8 border border-white dark:border-slate-700 shadow-sm">
            <PackageOpen className="h-10 w-10 text-gray-200 dark:text-gray-600" />
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {activeTab === 'favorites' 
                ? "Aucun favori" 
                : activeTab === 'following' 
                  ? "Aucun abonnement actif" 
                  : "Aucun résultat trouvé"}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium leading-relaxed">
              {activeTab === 'favorites'
                ? "Vous n'avez pas encore d'articles favoris. Cliquez sur le cœur d'un produit pour le sauvegarder ici !"
                : activeTab === 'following' 
                  ? "Vous ne suivez aucun studio partenaire pour l'instant ou ils n'ont pas encore publié d'articles. Visitez les fiches produits pour vous abonner à leurs créations !"
                  : "Nous n'avons pas trouvé d'articles correspondant à votre recherche ou vos filtres. Essayez de réinitialiser certains critères."
              }
            </p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {sortedProducts.length > 0 && (
        <div id="pagination" className="flex items-center justify-between pt-10 px-4">
          <button className="group flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer select-none">
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            PRÉCÉDENT
          </button>
          
          <div className="flex items-center gap-1">
            <button 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-950 shadow-lg shadow-gray-900/10 dark:shadow-none transition-all cursor-pointer"
            >
              1
            </button>
          </div>

          <button className="group flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer select-none">
            SUIVANT
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}

