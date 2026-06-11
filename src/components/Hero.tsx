import { motion } from 'motion/react';

export default function Hero() {
  return (
    <section id="hero-section" className="relative h-[420px] sm:h-[500px] md:h-[600px] w-full overflow-hidden rounded-[2rem] xs:rounded-[3rem] mt-2 xs:mt-4">
      {/* Background with abstract overlay */}
      <div 
        id="hero-bg"
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[30s] scale-100 hover:scale-105"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=2070&auto=format&fit=crop")',
        }}
      >
        <div className="absolute inset-0 bg-gray-900/40 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/20 to-gray-900/80"></div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-3 sm:px-5 py-1.5 sm:py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white text-[9px] xs:text-[10px] font-black uppercase tracking-[0.2em] mb-4 sm:mb-8 md:mb-10 shadow-2xl">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            L'excellence de notre territoire
          </div>
          
          <h1 id="hero-title" className="text-3xl xs:text-4xl sm:text-6xl md:text-8xl font-black text-white mb-4 sm:mb-8 tracking-tighter leading-[0.95] md:leading-[0.9]">
            L'art de vivre <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/50">à l'Haïtienne</span>
          </h1>
          
          <p id="hero-subtitle" className="text-xs xs:text-sm sm:text-base md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-medium tracking-tight mb-6 sm:mb-10 md:mb-12">
            Une curation exclusive des artisans les plus talentueux et des produits d'exception, livrés avec passion.
          </p>


        </motion.div>
      </div>
    </section>
  );
}
