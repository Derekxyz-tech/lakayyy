import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  totalRatings?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

export default function StarRating({ 
  rating = 0, 
  totalRatings = 0, 
  size = 'sm', 
  showCount = false,
  className = ''
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.35 && rating % 1 < 0.85;
  const finalFullStars = rating % 1 >= 0.85 ? fullStars + 1 : fullStars;
  const starCount = 5;
  
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-4.5 w-4.5',
    lg: 'h-5.5 w-5.5',
  };

  return (
    <div id="star-rating" className={`flex items-center gap-1.5 select-none ${className}`}>
      <div className="flex items-center gap-0.5">
        {[...Array(starCount)].map((_, index) => {
          const starVal = index + 1;
          if (starVal <= finalFullStars) {
            return (
              <Star
                key={index}
                id={`star-full-${index}`}
                className={`${sizeClasses[size]} fill-amber-400 text-amber-400`}
              />
            );
          } else if (starVal === finalFullStars + 1 && hasHalfStar) {
            return (
              <div key={index} id="half-star-container" className="relative leading-none">
                <Star className={`${sizeClasses[size]} text-gray-200 fill-gray-200`} />
                <div className="absolute top-0 left-0 w-[50%] overflow-hidden h-full">
                  <Star className={`${sizeClasses[size]} text-amber-400 fill-amber-400`} />
                </div>
              </div>
            );
          } else {
            return (
              <Star
                key={index}
                id={`star-empty-${index}`}
                className={`${sizeClasses[size]} text-gray-200 fill-gray-200`}
              />
            );
          }
        })}
      </div>
      {showCount && (
        <span id="star-rating-text" className="text-[10px] font-black tracking-tight text-gray-400 select-none">
          {totalRatings > 0 ? `${rating.toFixed(1)} (${totalRatings} ${totalRatings > 1 ? 'avis' : 'avis'})` : 'Aucun avis'}
        </span>
      )}
    </div>
  );
}
