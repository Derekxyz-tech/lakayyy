import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User as UserIcon, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create basic user profile
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: name,
          photoURL: null,
          isSeller: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isLocal) {
          toast.success("Compte créé et connecté avec succès (Bypass email en local) !");
          onClose();
        } else {
          // Send Email Verification (link, Firebase default)
          await sendEmailVerification(user);
          await signOut(auth); // Log out immediately so they must verify
          setVerificationSent(true);
          toast.success("Compte créé ! Un lien a été envoyé. Pensez à vérifier vos Spams !", { duration: 6000 });
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!isLocal && !userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user);
          await signOut(auth); // Log out because they are not verified
          toast.error("Veuillez vérifier votre email avant de vous connecter. Un nouveau lien a été envoyé. Pensez à vérifier vos Courriers Indésirables (Spam) !", { duration: 8000 });
          setIsLoading(false);
          return;
        }
        toast.success("Connexion réussie !");
        onClose();
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let message = "Une erreur est survenue.";
      if (error.code === 'auth/email-already-in-use') message = "Cet email est déjà utilisé.";
      if (error.code === 'auth/invalid-credential') message = "Identifiants invalides.";
      if (error.code === 'auth/weak-password') message = "Le mot de passe doit contenir au moins 6 caractères.";
      if (error.code === 'auth/operation-not-allowed') message = "L'authentification par email n'est pas activée. Veuillez l'activer dans la console Firebase (Authentication > Sign-in method).";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isSeller: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          displayName: user.displayName,
          photoURL: user.photoURL,
          updatedAt: serverTimestamp(),
        });
      }
      toast.success("Connexion Google réussie !");
      onClose();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error("Ce domaine n'est pas autorisé pour l'authentification Google dans Firebase. Veuillez utiliser l'inscription par Email en dessous.", { duration: 8000 });
      } else {
        toast.error("Échec de la connexion Google.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-gray-950/60 backdrop-blur-sm">
      <div className="min-h-full flex p-4 pb-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative m-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {verificationSent ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Vérifiez votre Email</h3>
              <p className="text-sm text-gray-500 font-medium">
                Nous avons envoyé un lien de confirmation sécurisé à <br />
                <strong className="text-gray-900">{email}</strong>
                <br /><br />
                <span className="text-red-500 font-bold">⚠️ Pensez à vérifier vos courriers indésirables (Spam) !</span>
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                Note: Ne pouvant pas envoyer de code OTP par défaut dans Firebase, veuillez utiliser le lien envoyé.
              </p>
              <button 
                onClick={onClose}
                className="mt-4 w-full py-3.5 bg-gray-950 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
              >
                Fermer
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-black tracking-tight text-gray-950">
                  {mode === 'login' ? 'Bon retour !' : 'Créer un compte'}
                </h2>
                <p className="text-xs text-gray-500 font-semibold mt-1">
                  {mode === 'login' ? 'Sécurité et chiffrement par défaut 🔥' : 'Rejoignez la plus grande marketplace'}
                </p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nom complet</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jean Dupont"
                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Adresse Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jean@example.com"
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="password" 
                      required
                      minLength={6}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20"
                >
                  {isLoading ? "Traitement..." : (mode === 'login' ? 'Connexion Sécurisée' : 'S\'inscrire par Email')}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-4 text-gray-400">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-[10px] font-black uppercase tracking-widest">OU</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>

              <button 
                onClick={handleGoogleAuth}
                disabled={isLoading}
                type="button"
                className="mt-6 w-full py-3.5 bg-white border-2 border-gray-200 hover:border-gray-950 text-gray-950 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-3"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuer avec Google
              </button>

              <p className="mt-8 text-center text-xs text-gray-500 font-medium">
                {mode === 'login' ? 'Nouveau sur Lakay Market ?' : 'Vous avez déjà un compte ?'}{' '}
                <button 
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-gray-950 font-black hover:underline"
                >
                  {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                </button>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
