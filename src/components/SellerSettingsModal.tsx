import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Building2, Image as ImageIcon, Check } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
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

interface SellerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function SellerSettingsModal({ isOpen, onClose, onSuccess }: SellerSettingsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    companyName: '',
    paymentMethod: 'moncash',
    photoURL: '',
  });

  useEffect(() => {
    const fetchSellerData = async () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setFormData({
          displayName: data.sellerRealName || data.sellerName || data.displayName || '',
          companyName: data.companyName || '',
          paymentMethod: data.paymentMethod || 'moncash',
          photoURL: data.photoURL || '',
        });
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchSellerData();
      setIsSaved(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Le fichier n'est pas une image.");
      return;
    }
    
    const toastId = toast.loading("Optimisation de l'image de profil...");
    try {
      const compressed = await compressImage(file, 220, 220, 0.7);
      setFormData(prev => ({ ...prev, photoURL: compressed }));
      toast.success("Logo optimisé !", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erreur d'optimisation de l'image.", { id: toastId });
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updateData = {
        sellerRealName: formData.displayName, // Store the actual name in the secure private field
        sellerName: formData.companyName,     // Shield the public name by setting it to the companyName
        companyName: formData.companyName,
        paymentMethod: formData.paymentMethod,
        photoURL: formData.photoURL,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);

      // Securely propagate the updated public storefront companyName and photoURL to their items
      try {
        const q = query(
          collection(db, 'products'),
          where('sellerId', '==', auth.currentUser.uid)
        );
        const productsSnap = await getDocs(q);
        if (!productsSnap.empty) {
          const batch = writeBatch(db);
          productsSnap.docs.forEach((productDoc) => {
            batch.update(productDoc.ref, {
              sellerCompanyName: formData.companyName,
              sellerPhotoURL: formData.photoURL
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.error("Error propagating store details to products:", err);
      }
      
      setIsSubmitting(false);
      setIsSaved(true);
      onSuccess(updateData);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      setIsSubmitting(false);
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
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
          className="relative w-full max-w-xl bg-white/90 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.15)] border border-white my-auto max-h-[95vh] overflow-y-auto scrollbar-hide"
        >
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all z-10"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-8 md:p-14">
            <div className="mb-10">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none">Paramètres Studio</h2>
              <p className="text-gray-400 mt-3 font-medium">Gérez votre identité et vos préférences.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-center mb-8">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-gray-50 border border-gray-100 overflow-hidden shadow-inner">
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <User className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-gray-900 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer">
                    <ImageIcon className="h-4 w-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" /> LOGO DU STUDIO
                </label>
                
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex items-center gap-6 p-6 rounded-[2rem] border-2 transition-all duration-300 ${
                    isDragging 
                      ? 'border-brand bg-brand/5 scale-[1.02] shadow-[0_12px_45px_rgba(235,94,85,0.05)]' 
                      : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="w-20 h-20 rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Logo preview" className="w-full h-full object-cover animate-in fade-in" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Building2 className="h-10 w-10 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow flex flex-col justify-center">
                    <label className="inline-flex items-center self-start px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-900 hover:border-gray-900 hover:scale-105 transition-all cursor-pointer shadow-sm">
                      CHOISIR DEPUIS L'ORDINATEUR
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">
                      {isDragging ? 'Déposez votre image ici!' : 'Glissez-déposez ou cliquez (Max 2MB)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <User className="h-3 w-3" /> VOTRE NOM
                </label>
                <input
                  required
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Building2 className="h-3 w-3" /> NOM DU STUDIO
                </label>
                <input
                  required
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="pt-6">
                <button
                  disabled={isSubmitting || isSaved}
                  type="submit"
                  className={`w-full py-5 rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 ${
                    isSaved 
                    ? 'bg-green-500 text-white shadow-green-500/20' 
                    : 'bg-gray-900 text-white shadow-gray-900/20 hover:bg-black hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : isSaved ? (
                    <>
                      <Check className="h-4 w-4" />
                      ENREGISTRÉ
                    </>
                  ) : (
                    "ENREGISTRER LES MODIFICATIONS"
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
