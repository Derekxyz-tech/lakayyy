import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MonCashLogo({ size = 'md', className = '' }: LogoProps) {
  const containerClasses = size === 'sm' 
    ? 'w-8 h-8 rounded-xl' 
    : size === 'lg'
    ? 'w-16 h-16 rounded-[1.75rem]'
    : 'w-12 h-12 rounded-2xl';

  return (
    <div className={`shrink-0 bg-white flex items-center justify-center overflow-hidden shadow-sm border border-gray-100 ${containerClasses} ${className}`} id="logo-moncash">
      <img 
        src="https://play-lh.googleusercontent.com/r8EXOMrhQMyifOyrLs6OFtFPWaLmknqVowbz69oJz9ohacCUG8YIlHkTqEGScMVCwfRK" 
        alt="MonCash Logo" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export function NatCashLogo({ size = 'md', className = '' }: LogoProps) {
  const containerClasses = size === 'sm' 
    ? 'w-8 h-8 rounded-xl' 
    : size === 'lg'
    ? 'w-16 h-16 rounded-[1.75rem]'
    : 'w-12 h-12 rounded-2xl';

  return (
    <div className={`shrink-0 bg-white flex items-center justify-center overflow-hidden shadow-md border border-gray-100 ${containerClasses} ${className}`} id="logo-natcash">
      <img 
        src="https://tse3.mm.bing.net/th/id/OIP.IXZ-O8KhtaJUvKhIBcxiOAHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3" 
        alt="NatCash Logo" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export function KashPawLogo({ size = 'md', className = '' }: LogoProps) {
  const containerClasses = size === 'sm' 
    ? 'w-8 h-8 rounded-xl' 
    : size === 'lg'
    ? 'w-16 h-16 rounded-[1.75rem]'
    : 'w-12 h-12 rounded-2xl';

  return (
    <div className={`shrink-0 bg-white flex items-center justify-center overflow-hidden shadow-md border border-gray-100 ${containerClasses} ${className}`} id="logo-kashpaw">
      <img 
        src="https://tse3.mm.bing.net/th/id/OIP.lqYTLOgDR2OcGHYndq5IxAHaDG?r=0&rs=1&pid=ImgDetMain&o=7&rm=3" 
        alt="KashPaw Logo" 
        className="w-full h-full object-contain p-1"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
