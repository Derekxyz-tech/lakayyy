import { useState, useEffect } from 'react';

const FAVORITES_KEY = 'lakay_market_favorites';

export function getFavorites(): string[] {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to parse favorites from localStorage:", err);
    return [];
  }
}

export function saveFavorites(favorites: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    // Dispatch custom event to coordinate state updates in real-time
    window.dispatchEvent(new CustomEvent('favorites_changed'));
  } catch (err) {
    console.error("Failed to save favorites to localStorage:", err);
  }
}

export function isProductFavorite(productId: string): boolean {
  return getFavorites().includes(productId);
}

export function toggleFavorite(productId: string): boolean {
  const current = getFavorites();
  const index = current.indexOf(productId);
  let updated: string[];
  let isFav = false;
  if (index > -1) {
    updated = current.filter(id => id !== productId);
    isFav = false;
  } else {
    updated = [...current, productId];
    isFav = true;
  }
  saveFavorites(updated);
  return isFav;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());

    const handleUpdate = () => {
      setFavorites(getFavorites());
    };

    window.addEventListener('favorites_changed', handleUpdate);
    return () => {
      window.removeEventListener('favorites_changed', handleUpdate);
    };
  }, []);

  return favorites;
}
