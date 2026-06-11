import { Filter, MapPin, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Filters() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const categories = [
    { id: 'artisanat', label: 'Artisanat' },
    { id: 'mode', label: 'Mode & Beauté' },
    { id: 'epicerie', label: 'Épicerie Fine' },
    { id: 'maison', label: 'Maison & Jardin' },
    { id: 'art', label: 'Art & Collection' }
  ];

  const handleCategoryChange = (label: string) => {
    setSelectedCategories(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const handleApply = () => {
    const filterEvent = new CustomEvent('catalogFilterChange', {
      detail: {
        categories: selectedCategories,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        region: region || null
      }
    });
    window.dispatchEvent(filterEvent);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleReset = () => {
    setSelectedCategories([]);
    setMinPrice('');
    setMaxPrice('');
    setRegion('');
    const filterEvent = new CustomEvent('catalogFilterChange', {
      detail: {
        categories: [],
        minPrice: null,
        maxPrice: null,
        region: null
      }
    });
    window.dispatchEvent(filterEvent);
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const activeFiltersCount = 
    selectedCategories.length + 
    (minPrice ? 1 : 0) + 
    (maxPrice ? 1 : 0) + 
    (region ? 1 : 0);

  const renderFilterFields = () => (
    <>
      {/* Categories */}
      <div id="filter-categories" className="space-y-4">
        <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-[0.15em]">Catégories</h3>
        <div className="space-y-3">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center group cursor-pointer">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.label)}
                  onChange={() => handleCategoryChange(cat.label)}
                  className="peer w-5 h-5 rounded-lg border-gray-200 dark:border-slate-705 text-gray-900 dark:text-white focus:ring-0 transition-all cursor-pointer appearance-none bg-white/50 dark:bg-slate-800 border"
                />
                <div className="absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-1 top-1 w-3 h-3 bg-gray-900 dark:bg-white rounded-[3px]"></div>
              </div>
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors font-medium">
                {cat.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div id="filter-price" className="space-y-5">
        <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-[0.15em]">Prix (HTG)</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand/30 transition-all font-medium"
            />
          </div>
          <span className="text-gray-300 dark:text-gray-600 font-bold">-</span>
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand/30 transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div id="filter-location" className="space-y-4">
        <h3 className="font-bold text-[10px] text-gray-400 dark:text-gray-550 uppercase tracking-[0.15em]">Localisation</h3>
        <div className="relative group">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 dark:text-gray-500 pointer-events-none transition-colors group-focus-within:text-brand" />
          <select 
            id="region-select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl text-sm text-gray-650 dark:text-gray-300 appearance-none outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand/30 transition-all cursor-pointer font-medium"
          >
            <option value="" className="dark:bg-slate-900">Toutes les régions</option>
            <optgroup label="Nord" className="dark:bg-slate-900 font-black">
              <option value="nord" className="dark:bg-slate-900">Nord (Cap-Haïtien)</option>
            </optgroup>
            <optgroup label="Ouest" className="dark:bg-slate-900 font-black">
              <option value="ouest" className="dark:bg-slate-900">Ouest (Port-au-Prince)</option>
            </optgroup>
            <optgroup label="Sud" className="dark:bg-slate-900 font-black">
              <option value="sud" className="dark:bg-slate-900">Sud (Les Cayes)</option>
            </optgroup>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 dark:text-gray-500 pointer-events-none group-hover:text-gray-600 dark:group-hover:text-gray-350 transition-colors" />
        </div>
      </div>

      <button 
        id="apply-filters" 
        onClick={handleApply}
        className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-100 active:scale-95 transition-all shadow-xl shadow-gray-900/5 cursor-pointer border border-transparent dark:border-slate-700 font-sans"
      >
        Filtrer
      </button>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div className="lg:hidden w-full flex items-center justify-between bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl px-6 py-4 rounded-[1.75rem] border border-white/80 dark:border-slate-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mb-1">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Catalog Filter</span>
          {activeFiltersCount > 0 && (
            <span className="bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center justify-center leading-none">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-black dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow-md select-none border border-transparent dark:border-slate-700"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtrer
        </button>
      </div>

      {/* Desktop Inline Sidebar Content */}
      <aside id="sidebar-filters" className="hidden lg:block w-full lg:w-72 space-y-6 shrink-0 relative group">
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-7 rounded-[2rem] border border-white/80 dark:border-slate-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.02)] space-y-8">
          <div className="flex items-center justify-between border-b border-gray-100/30 dark:border-slate-800/30 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-55 dark:border-slate-700 font-black">
                <Filter className="h-4 w-4 text-gray-400 dark:text-gray-550" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Filtres
              </h2>
            </div>
            {activeFiltersCount > 0 && (
              <button 
                onClick={handleReset}
                className="text-[10px] font-black text-brand dark:text-blue-400 uppercase tracking-wider hover:opacity-80 cursor-pointer"
              >
                Réinitialiser
              </button>
            )}
          </div>
          {renderFilterFields()}
        </div>
      </aside>

      {/* Mobile Sidebar Sliding Drawer Panel with AnimatePresence */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-[110] lg:hidden">
            {/* Dark glassmorphic backdrop with smooth fade-in */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-gray-950/40 backdrop-blur-md"
            />

            {/* Premium drawer sliding gracefully from the left */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 210 }}
              className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-[340px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl p-6 border-r border-white/40 dark:border-slate-850 shadow-[24px_0_80px_rgba(0,0,0,0.15)] flex flex-col justify-between overflow-y-auto scrollbar-hide"
            >
              <div className="space-y-8">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-5 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-slate-855 rounded-xl border border-gray-100 dark:border-slate-750 leading-none">
                      <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-widest">Filtres</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {activeFiltersCount > 0 && (
                      <button 
                        onClick={handleReset}
                        className="text-[10px] font-black text-brand dark:text-blue-400 uppercase tracking-wider cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                    <button 
                      onClick={() => setIsMobileOpen(false)}
                      className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 border border-transparent transition-all cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Form fields */}
                <div className="space-y-8 pb-10">
                  {renderFilterFields()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
