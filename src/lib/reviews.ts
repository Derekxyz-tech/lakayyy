import { collection, addDoc, getDocs, query, where, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useState, useEffect } from 'react';

export interface Review {
  id?: string;
  sellerId: string;
  buyerId: string;
  buyerName: string;
  productId: string;
  productName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

/**
 * Submits a new review to the Firebase standard store
 */
export async function submitReview(reviewData: Omit<Review, 'id' | 'createdAt'>) {
  try {
    const reviewsRef = collection(db, 'reviews');
    await addDoc(reviewsRef, {
      ...reviewData,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error submitting review to firebase:", error);
    throw error;
  }
}

/**
 * Real-time aggregator of store ratings.
 * Subscribes to the global 'reviews' collection and computes averages.
 * This guarantees real-time visual updates across the entire app for all components.
 */
export function useStoreRatings() {
  const [ratingsMap, setRatingsMap] = useState<Record<string, { averageRating: number; totalRatings: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'reviews');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tempRatings: Record<string, { sum: number; count: number }> = {};
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const sellerId = data.sellerId;
        const rating = data.rating || 0;
        
        if (sellerId && rating > 0) {
          if (!tempRatings[sellerId]) {
            tempRatings[sellerId] = { sum: 0, count: 0 };
          }
          tempRatings[sellerId].sum += rating;
          tempRatings[sellerId].count += 1;
        }
      });

      const finalRatings: Record<string, { averageRating: number; totalRatings: number }> = {};
      Object.keys(tempRatings).forEach((sellerId) => {
        const { sum, count } = tempRatings[sellerId];
        finalRatings[sellerId] = {
          averageRating: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
          totalRatings: count
        };
      });

      setRatingsMap(finalRatings);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to store ratings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { ratingsMap, loading };
}

/**
 * Hook to listen to reviews left specifically for a given seller
 */
export function useSellerReviews(sellerId: string | null | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      setReviews([]);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'reviews'),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Review[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          sellerId: data.sellerId,
          buyerId: data.buyerId,
          buyerName: data.buyerName,
          productId: data.productId,
          productName: data.productName,
          rating: data.rating,
          comment: data.comment,
          createdAt: data.createdAt
        });
      });
      setReviews(loaded);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to seller reviews:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sellerId]);

  return { reviews, loading };
}
