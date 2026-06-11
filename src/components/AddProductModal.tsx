import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Package, DollarSign, Tag, Info, Image as ImageIcon, Truck, Clock, ShieldCheck, BadgeCheck, Sparkles } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { getApiUrl } from '../lib/api';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Compress high-megapixel images to keep documents well under the Firestore 1MB limit & upload instantly
function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        resolve(event.target?.result as string); // fallback to raw string
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: any; // Optional product for editing
}

export default function AddProductModal({ isOpen, onClose, onSuccess, product }: AddProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Artisanat',
    stock: '1',
    region: 'ouest',
    deliveryTime: '2-4 jours',
    deliveryPrice: '150',
    verified: false,
    sellerVerified: false,
  });

  const categories = [
    'Artisanat',
    'Mode & Beauté',
    'Épicerie Fine',
    'Maison & Jardin',
    'Art & Collection'
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (product) {
        setFormData({
          name: product.name,
          description: product.description,
          price: product.price.toString(),
          category: product.category,
          stock: product.stock.toString(),
          region: product.region || 'ouest',
          deliveryTime: product.deliveryTime || '2-4 jours',
          deliveryPrice: (product.deliveryPrice !== undefined && product.deliveryPrice !== null) ? product.deliveryPrice.toString() : '150',
          verified: !!product.verified,
          sellerVerified: !!product.sellerVerified,
        });
        setImageFiles(product.images || []);
      } else {
        setFormData({
          name: '',
          description: '',
          price: '',
          category: 'Artisanat',
          stock: '1',
          region: 'ouest',
          deliveryTime: '2-4 jours',
          deliveryPrice: '150',
          verified: false,
          sellerVerified: false,
        });
        setImageFiles([]);
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, product]);

  const handleGenerateDescription = async () => {
    if (!formData.name || !formData.name.trim()) {
      toast.error("Veuillez d'abord saisir le nom du produit.");
      return;
    }

    setIsGenerating(true);
    const apiPromise = fetch(getApiUrl('/api/gemini/generate-description'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productName: formData.name }),
    });

    toast.promise(
      apiPromise
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Erreur de génération.");
          }
          return res.json();
        })
        .then((data) => {
          if (!data.success || !data.description) {
            throw new Error(data.message || "Échec de la génération de la description.");
          }
          setFormData(prev => ({ ...prev, description: data.description }));
        }),
      {
        loading: 'Génération de la description en cours...',
        success: 'Description générée avec succès ! ✨',
        error: (err) => err.message || 'Impossible de générer la description.',
      }
    ).catch((err) => {
      console.error(err);
    }).finally(() => {
      setIsGenerating(false);
    });
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: any) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: any) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    await addImages(files);
  };

  const handleFileChange = async (e: any) => {
    const files = Array.from(e.target.files || []) as File[];
    await addImages(files);
  };

  const addImages = async (files: File[]) => {
    if (files.length + imageFiles.length > 15) {
      toast.error('Vous ne pouvez pas ajouter plus de 15 images.');
      return;
    }

    const toastId = toast.loading("Optimisation des images...");
    const newImages: string[] = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error(`Le fichier ${file.name} n'est pas une image.`);
          continue;
        }
        
        const compressed = await compressImage(file, 640, 640, 0.65);
        if (compressed) {
          newImages.push(compressed);
        }
      }
      setImageFiles(prev => [...prev, ...newImages]);
      toast.success("Images chargées et optimisées !", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erreur d'optimisation.", { id: toastId });
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (imageFiles.length === 0) {
      toast.error('Veuillez ajouter au moins une image.');
      return;
    }

    setIsSubmitting(true);
    const saveToastId = toast.loading(product ? "Mise à jour du produit..." : "Publication du produit...");
    try {
      // Retrieve the current seller's public studio profile
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const sellerCompName = userData?.companyName || userData?.sellerName || userData?.displayName || 'Studio Créatif';
      const sellerPhoto = userData?.photoURL || '';

      const data: any = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        stock: parseInt(formData.stock),
        region: formData.region,
        deliveryTime: formData.deliveryTime || '2-4 jours',
        deliveryPrice: parseFloat(formData.deliveryPrice || '150'),
        images: imageFiles,
        updatedAt: serverTimestamp(),
        sellerCompanyName: sellerCompName,
        sellerPhotoURL: sellerPhoto,
      };

      const isAdmin = auth.currentUser?.email === 'ghostytb77777@gmail.com';
      if (isAdmin) {
        data.verified = formData.verified;
        data.sellerVerified = formData.sellerVerified;
      }

      if (product) {
        await updateDoc(doc(db, 'products', product.id), data);
        if (isAdmin && product.sellerId) {
          try {
            await updateDoc(doc(db, 'users', product.sellerId), {
              verified: formData.sellerVerified,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error("Failed to sync user verification status:", err);
          }
        }
        toast.success("Produit mis à jour avec succès !", { id: saveToastId });
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          sellerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        toast.success("Produit publié !", { id: saveToastId });
      }

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (error) {
      setIsSubmitting(false);
      toast.error("Échec de la validation de l'enregistrement.", { id: saveToastId });
      handleFirestoreError(error, product ? OperationType.UPDATE : OperationType.CREATE, product ? `products/${product.id}` : 'products');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: 40 }}
          className="relative w-full max-w-2xl bg-white/90 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.15)] border border-white my-auto max-h-[95vh] overflow-y-auto scrollbar-hide"
        >
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all z-10"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-8 md:p-14">
            <div className="mb-10">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                <Package className="h-7 w-7 text-gray-900" />
              </div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none">
                {product ? 'Modifier Produit' : 'Nouveau Produit'}
              </h2>
              <p className="text-gray-400 mt-3 font-medium">Partagez votre création avec le monde entier.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Tag className="h-3 w-3" /> NOM DU PRODUIT
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="ex: Sac en paille tressée"
                  className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Info className="h-3 w-3" /> DESCRIPTION
                  </label>
                  <button
                    id="btn-generate-description"
                    type="button"
                    disabled={isGenerating || !formData.name.trim()}
                    onClick={handleGenerateDescription}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Sparkles className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    {isGenerating ? 'Génération...' : 'Générer avec l\'IA'}
                  </button>
                </div>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="L'histoire de votre produit, ses matériaux..."
                  rows={3}
                  className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <DollarSign className="h-3 w-3" /> PRIX (HTG)
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="2500"
                    className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Package className="h-3 w-3" /> STOCK ACTUALISÉ
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    placeholder="10"
                    className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              {/* Delivery fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/40 p-4 rounded-3xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock className="h-3 w-3" /> TEMPS DE LIVRAISON ESTIMÉ
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.deliveryTime}
                    onChange={(e) => setFormData({...formData, deliveryTime: e.target.value})}
                    placeholder="ex: 2-4 jours"
                    className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-2xl focus:border-gray-950 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Truck className="h-3 w-3" /> FRAIS DE LIVRAISON (HTG)
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.deliveryPrice}
                    onChange={(e) => setFormData({...formData, deliveryPrice: e.target.value})}
                    placeholder="150"
                    className="w-full px-5 py-3.5 bg-white border border-gray-100 rounded-2xl focus:border-gray-950 outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">CATÉGORIE</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({...formData, category: cat})}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        formData.category === cat 
                        ? 'bg-gray-900 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">RÉGION DE PROVENANCE</label>
                <div className="flex gap-2">
                  {[
                    { id: 'nord', label: 'Nord (Cap-Haïtien)' },
                    { id: 'ouest', label: 'Ouest (Port-au-Prince)' },
                    { id: 'sud', label: 'Sud (Les Cayes)' }
                  ].map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => setFormData({...formData, region: reg.id})}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        formData.region === reg.id 
                        ? 'bg-gray-900 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {reg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" /> IMAGES ({imageFiles.length}/15)
                </label>
                
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-[2rem] p-4 transition-all duration-300 relative ${
                    isDragging 
                      ? 'border-brand bg-brand/5 scale-[1.01] shadow-[0_12px_40px_rgba(235,94,85,0.05)]' 
                      : 'border-gray-100 bg-gray-50/20'
                  }`}
                >
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {imageFiles.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100 shadow-sm hover:shadow-md transition-all">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => removeImage(i)}
                            className="p-2 bg-red-500 text-white rounded-xl hover:scale-110 active:scale-90 transition-transform"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {imageFiles.length > 0 && imageFiles.length < 15 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-gray-900 hover:bg-gray-50 transition-all cursor-pointer">
                        <ImageIcon className="h-6 w-6 text-gray-300" />
                        <span className="text-[10px] font-bold text-gray-400">AJOUTER</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          className="hidden" 
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>

                  {imageFiles.length === 0 && (
                    <div className="relative py-12 flex flex-col items-center justify-center text-center group transition-all">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-100 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <ImageIcon className="h-8 w-8 text-brand" />
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-wider">Glissez vos images ici</span>
                      <span className="text-xs text-gray-400 mt-1 font-medium max-w-[280px]">ou cliquez pour parcourir vos fichiers (Max 15 images, 2MB max par image)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleFileChange}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Admin-only verification settings */}
              {(() => {
                const isAdmin = auth.currentUser?.email === 'ghostytb77777@gmail.com';
                if (!isAdmin) return null;
                return (
                  <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/60 dark:border-blue-900/50 rounded-[1.8rem] space-y-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
                      <span className="text-[10px] font-black text-blue-950 dark:text-blue-200 uppercase tracking-widest">Options Administrateur</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Product Verification */}
                      <label className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-blue-100/60 dark:border-blue-900/40 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition-all select-none">
                        <input
                          type="checkbox"
                          checked={formData.verified}
                          onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-500 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="text-left leading-tight">
                          <p className="text-[10px] font-black text-gray-950 dark:text-white uppercase tracking-wider">Certifier ce produit</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-medium leading-normal">Badge vérifié sur la carte produit</p>
                        </div>
                      </label>

                      {/* Store Verification */}
                      <label className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-blue-100/60 dark:border-blue-900/40 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition-all select-none">
                        <input
                          type="checkbox"
                          checked={formData.sellerVerified}
                          onChange={(e) => setFormData({ ...formData, sellerVerified: e.target.checked })}
                          className="h-4 w-4 rounded text-blue-500 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="text-left leading-tight">
                          <p className="text-[10px] font-black text-gray-950 dark:text-white uppercase tracking-wider">Certifier la boutique</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-medium leading-normal">Badge vérifié de l'artisan</p>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-6">
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full py-5 bg-gray-900 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-gray-900/20 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    product ? "METTRE À JOUR" : "PUBLIER LE PRODUIT"
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

