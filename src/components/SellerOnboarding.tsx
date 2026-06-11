import { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Home, CreditCard, Building2, User, CheckCircle2, Store, Clock } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

interface SellerOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

export default function SellerOnboarding({ isOpen, onClose, onSuccess }: SellerOnboardingProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('service_paym');
  
  // Identity Proof States (required to prove age & identity)
  const [identityType, setIdentityType] = useState<'id' | 'passport' | 'driving_permit'>('id');
  const [identityFileName, setIdentityFileName] = useState('');
  const [selfieFileName, setSelfieFileName] = useState('');
  const [identityImage, setIdentityImage] = useState(''); // base64 preview
  const [selfieImage, setSelfieImage] = useState(''); // base64 preview

  // Status tracking states
  const [sellerStatus, setSellerStatus] = useState<'pending' | 'approved' | 'disapproved' | null>(null);
  const [disapprovalComment, setDisapprovalComment] = useState('');
  const [loadingUserData, setLoadingUserData] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Load current user's evaluation status
      if (auth.currentUser) {
        setLoadingUserData(true);
        const userRef = doc(db, 'users', auth.currentUser.uid);
        getDoc(userRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setSellerStatus(data.sellerStatus || null);
            setDisapprovalComment(data.sellerDisapprovalComment || '');
            if (data.sellerRealName) setFullName(data.sellerRealName);
            if (data.sellerName) setShopName(data.sellerName);
            if (data.address) setAddress(data.address);
            if (data.identityType) setIdentityType(data.identityType);
            if (data.identityFileName) setIdentityFileName(data.identityFileName);
            if (data.selfieFileName) setSelfieFileName(data.selfieFileName);
            if (data.identityImage) setIdentityImage(data.identityImage);
            if (data.selfieImage) setSelfieImage(data.selfieImage);
          }
          setLoadingUserData(false);
        }).catch((err) => {
          console.error("Error fetching vendor evaluation profile:", err);
          setLoadingUserData(false);
        });
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, type: 'identity' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // PATH TRAVERSAL AND FILENAME SANITIZATION
    const safeName = file.name.replace(/[\/\\]/g, '_'); // Replace any path separators with underscores
    
    // FILE TYPE VALIDATION (MIME TYPES & EXTENSIONS)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/jpg'];
    const blockedExtensions = ['.exe', '.php', '.js', '.bat', '.sh', '.svg', '.html', '.htm'];
    
    const fileMime = file.type.toLowerCase();
    const fileNameLower = file.name.toLowerCase();
    
    // Check blocked extensions
    const isBlockedExt = blockedExtensions.some(ext => fileNameLower.endsWith(ext));
    const isSymmetricSvgBlock = fileMime.includes('svg') || fileNameLower.endsWith('.svg');

    if (isBlockedExt || isSymmetricSvgBlock) {
      toast.error(`Sécurité : Le format du fichier ${safeName} est strictement bloqué par la politique WAF de la plateforme.`);
      return;
    }

    const isAllowedMime = allowedMimeTypes.includes(fileMime);
    const hasAllowedExt = fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') || fileNameLower.endsWith('.png') || fileNameLower.endsWith('.pdf');

    if (!isAllowedMime && !hasAllowedExt) {
      toast.error("Format refusé. Les seuls formats autorisés sont JPG, PNG et PDF.");
      return;
    }

    // Restrict file size to 2.5MB max before optimization
    if (file.size > 2.5 * 1024 * 1024) {
      toast.error("Fichier trop lourd (maximum 2.5 Mo avant compression).");
      return;
    }

    if (type === 'identity') {
      setIdentityFileName(safeName);
    } else {
      setSelfieFileName(safeName);
    }

    const toastId = toast.loading("Nettoyage EXIF, dé-identification & optimisation AES-256...");
    try {
      // PDF documents don't need image compression
      if (fileMime === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (type === 'identity') {
            setIdentityImage(base64);
          } else {
            setSelfieImage(base64);
          }
          toast.success("Document PDF chargé et préparé pour l'envoi chiffré !", { id: toastId });
        };
        reader.readAsDataURL(file);
        return;
      }

      const compressed = await compressImage(file);
      if (type === 'identity') {
        setIdentityImage(compressed);
      } else {
        setSelfieImage(compressed);
      }
      toast.success("Image optimisée et nettoyée de ses métadonnées EXIF !", { id: toastId });
    } catch (err) {
      console.error("Image compression error:", err);
      // Fallback
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (type === 'identity') {
          setIdentityImage(result);
        } else {
          setSelfieImage(result);
        }
        toast.dismiss(toastId);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    // Ensure files are selected
    if (!identityFileName) {
      toast.error("Veuillez sélectionner votre pièce d'identité (CIN, Passeport ou Permis).");
      return;
    }
    if (!selfieFileName) {
      toast.error("Veuillez importer une photo portrait de vous-même.");
      return;
    }

    setIsSubmitting(true);
    const progressToast = toast.loading("Soumission de votre dossier d'artisan...");
    
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      // Set options with merge ensures it works flawlessly even if user doc does not yet exist!
      await setDoc(userRef, {
        sellerStatus: 'pending', // Awaiting admin approval
        isSeller: false,       // Cannot sell/dashboard yet
        sellerRealName: fullName, // Keep physical/legal name 100% private
        sellerName: shopName,      // Public identity is the studio name
        companyName: shopName,     // Public identity is the studio name
        address: address,
        paymentMethod: paymentMethod,
        identityType: identityType,
        identityFileName: identityFileName,
        selfieFileName: selfieFileName,
        identityImage: identityImage || 'https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=120',
        selfieImage: selfieImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setIsSubmitting(false);
      setIsSuccess(true);
      setSellerStatus('pending'); // Lock state in pending
      toast.success("Candidature soumise avec succès !", { id: progressToast });
    } catch (error) {
      setIsSubmitting(false);
      toast.error("Erreur de connexion. Veuillez réessayer ou vérifier la taille des images.", { id: progressToast });
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
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          className="relative w-full max-w-xl bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.15)] border border-white my-auto max-h-[95vh] overflow-y-auto scrollbar-hide"
        >
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {loadingUserData ? (
            <div className="p-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-gray-100 border-t-gray-900 rounded-full animate-spin"></div>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mt-6">Vérification de votre dossier...</p>
            </div>
          ) : isSuccess ? (
            <div className="p-16 text-center">
              <div className="w-24 h-24 bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                <CheckCircle2 className="h-10 w-10 text-white animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter">Dossier Déposé !</h2>
              <p className="text-gray-400 mb-10 max-w-xs mx-auto font-medium text-sm leading-relaxed">
                Votre candidature d'artisan a été transférée aux administrateurs. Vous serez en mesure de proposer vos créations dès approbation.
              </p>
              <button 
                type="button"
                onClick={onClose}
                className="w-full py-5 bg-gray-900 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-2xl shadow-gray-900/20"
              >
                Compris, Fermer
              </button>
            </div>
          ) : sellerStatus === 'pending' ? (
            <div className="p-10 md:p-14 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-amber-100 animate-pulse">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Candidature en cours d'examen</h3>
              <p className="text-sm text-gray-400 mt-4 leading-relaxed font-semibold">
                Votre demande d'ouverture de studio est en cours d'analyse par l'équipe d'administration de Lakay Market.
              </p>
              <div className="mt-8 p-6 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs text-amber-800 text-left font-bold leading-relaxed space-y-2">
                <p>💡 <b>Pourquoi cette étape ?</b></p>
                <p className="font-semibold text-amber-700">Nous validons chaque profil manuellement afin de garantir l'authenticité de nos artisans et la fiabilité des créations proposées à notre communauté de collectionneurs de prestige.</p>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="mt-10 w-full py-5 bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-gray-900/10"
              >
                Fermer la fenêtre
              </button>
            </div>
          ) : sellerStatus === 'disapproved' ? (
            <div className="p-10 md:p-14 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Demande refusée ou bloquée</h3>
              <p className="text-sm text-gray-400 mt-4 leading-relaxed font-semibold">
                Votre demande de statut de vendeur a été désapprouvée avec les remarques suivantes :
              </p>
              
              <div className="mt-6 p-5 bg-red-50/70 text-red-800 rounded-2xl border border-red-100 text-xs font-bold text-left leading-relaxed shadow-inner">
                <span className="text-[9px] uppercase tracking-wider opacity-60 block mb-1.5 font-black">Commentaire de l'administrateur :</span>
                "{disapprovalComment || "Aucune explication additionnelle n'a été spécifiée."}"
              </div>

              <p className="text-xs text-gray-400 mt-8 font-semibold">
                Vous pouvez modifier les informations de votre studio pour corriger ces points et soumettre à nouveau votre dossier.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    // Reset status locally to show form & edit
                    setSellerStatus(null);
                  }}
                  className="py-4 bg-gray-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Modifier mon dossier
                </button>
                <button 
                  type="button"
                  onClick={onClose}
                  className="py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 md:p-14">
              <div className="mb-10">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                  <Store className="h-7 w-7 text-gray-900" />
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none">Creative Studio</h2>
                <p className="text-gray-400 mt-3 font-medium">Bâtissez votre univers et touchez une clientèle d'exception.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full/Legal Name and Shop Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <User className="h-3 w-3" /> IDENTITÉ RÉELLE
                    </label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jean Dupont"
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
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Atelier d'Art"
                      className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                {/* 18+ Identity Verification (Mandatory) */}
                <div className="p-5 bg-gray-50/50 rounded-3xl border border-gray-100 space-y-4">
                  <div>
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] block mb-1">PROUVER VOTRE MAJORITÉ (18+)</span>
                    <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">Veuillez sélectionner et importer une pièce d’identité valide ainsi qu'une photo de votre visage.</p>
                  </div>

                  {/* Document Type buttons */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">TYPE DE DOCUMENT</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['id', 'passport', 'driving_permit'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setIdentityType(t)}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${
                            identityType === t
                              ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                              : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-600'
                          }`}
                        >
                          {t === 'id' ? 'CIN / ID' : t === 'passport' ? 'Passeport' : 'Permis'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Identity Document upload + Selfie upload grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Identity Document file picker */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Upload className="h-2.5 w-2.5" /> RECTO DU DOCUMENT
                      </label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleFileChange(e, 'identity')}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className={`w-full p-4 rounded-xl text-xs flex flex-col items-center justify-center gap-2 border border-dashed transition-all ${
                          identityFileName 
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-900/30'
                        }`}>
                          {identityImage ? (
                            <img src={identityImage} alt="Document ID" className="w-12 h-12 rounded-lg object-cover border border-emerald-100 mb-1" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100/50 flex items-center justify-center text-gray-500">
                              <Upload className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-bold text-[9px] max-w-[120px] truncate block text-center">
                            {identityFileName ? identityFileName : 'Importer le document'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Selfie photo upload */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> PHOTO PORTRAIT (VISAGE)
                      </label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'selfie')}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className={`w-full p-4 rounded-xl text-xs flex flex-col items-center justify-center gap-2 border border-dashed transition-all ${
                          selfieFileName 
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-900/30'
                        }`}>
                          {selfieImage ? (
                            <img src={selfieImage} alt="Selfie" className="w-12 h-12 rounded-full object-cover border border-emerald-100 mb-1" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100/50 flex items-center justify-center text-gray-500">
                              <Upload className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-bold text-[9px] max-w-[120px] truncate block text-center">
                            {selfieFileName ? selfieFileName : 'Prendre ou choisir photo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Localisation / Address */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                    <Home className="h-3 w-3" /> LOCALISATION
                  </label>
                  <input
                    required
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ville, Pays"
                    className="w-full px-5 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:bg-white focus:border-gray-900 outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div className="pt-6">
                  <button
                    disabled={isSubmitting || !fullName || !shopName || !identityFileName || !selfieFileName}
                    type="submit"
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-gray-900/20 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-30 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      "SOUMETTRE MA DEMANDE"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
