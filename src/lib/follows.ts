import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useState, useEffect } from 'react';

/**
 * Follow helper: stores follow document in Firestore.
 * Document ID is always deterministic: followerId_sellerId (so it is easy to set and delete cleanly)
 */
export async function followSeller(sellerId: string) {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) throw new Error("Vous devez être connecté pour suivre ce studio.");
  if (currentUserId === sellerId) throw new Error("Vous ne pouvez pas vous suivre vous-même.");

  const followId = `${currentUserId}_${sellerId}`;
  const followRef = doc(db, 'follows', followId);
  await setDoc(followRef, {
    followerId: currentUserId,
    sellerId: sellerId,
    createdAt: serverTimestamp()
  });
}

/**
 * Unfollow helper: deletes follow document in Firestore.
 */
export async function unfollowSeller(sellerId: string) {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) throw new Error("Vous devez être connecté");

  const followId = `${currentUserId}_${sellerId}`;
  const followRef = doc(db, 'follows', followId);
  await deleteDoc(followRef);
}

/**
 * Read follows for the current user in real-time.
 */
export function useIsFollowing(sellerId: string | null | undefined) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId || !sellerId) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }

    const followId = `${currentUserId}_${sellerId}`;
    const followRef = doc(db, 'follows', followId);

    const unsubscribe = onSnapshot(followRef, (docSnap) => {
      setIsFollowing(docSnap.exists());
      setLoading(false);
    }, (error) => {
      console.error("Error loading follow state:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sellerId]);

  return { isFollowing, loading };
}

/**
 * Returns list of seller IDs that current user is following
 */
export function useFollowingSellers() {
  const [followedSellers, setFollowedSellers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      setFollowedSellers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sellers: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.sellerId) {
          sellers.push(data.sellerId);
        }
      });
      setFollowedSellers(sellers);
      setLoading(false);
    }, (error) => {
      console.error("Error loading followed sellers:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { followedSellers, loading };
}
