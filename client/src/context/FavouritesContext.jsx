import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

function isAbortError(e) {
  return e && (e.name === 'AbortError' || e.code === 20);
}

const FavouritesContext = createContext(null);

/**
 * Single source of truth for saved place ids + coordinated refresh/toggle.
 * GET /favourites uses AbortController so only the latest list fetch applies.
 */
export function FavouritesProvider({ children }) {
  const { user } = useAuth();
  const [favouriteIds, setFavouriteIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const fetchAbortRef = useRef(null);
  const refreshSeqRef = useRef(0);
  const busyRef = useRef(new Set());

  const refreshFavourites = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user) {
      fetchAbortRef.current?.abort();
      setFavouriteIds(new Set());
      setLoading(false);
      return;
    }

    const mySeq = ++refreshSeqRef.current;
    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    if (!silent) setLoading(true);
    try {
      const res = await api.user.favourites({ signal: ac.signal });
      if (ac.signal.aborted || mySeq !== refreshSeqRef.current) return;
      const ids = Array.isArray(res?.placeIds) ? res.placeIds.map(String) : [];
      setFavouriteIds(new Set(ids));
    } catch (e) {
      if (isAbortError(e)) return;
      if (mySeq !== refreshSeqRef.current) return;
      setFavouriteIds(new Set());
    } finally {
      if (mySeq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      fetchAbortRef.current?.abort();
      setFavouriteIds(new Set());
      setLoading(false);
      return undefined;
    }
    refreshFavourites();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [user?.id, refreshFavourites]);

  const isFavourite = useCallback(
    (placeId) => (placeId != null ? favouriteIds.has(String(placeId)) : false),
    [favouriteIds]
  );

  const isBusy = useCallback((placeId) => (placeId != null ? busyIds.has(String(placeId)) : false), [busyIds]);

  /**
   * Optimistic toggle + server reconcile. Treats 404 remove / 409 add as success.
   * @returns {Promise<{ ok: boolean, reason?: string, added?: boolean, error?: Error }>}
   */
  const toggleFavourite = useCallback(
    async (placeId) => {
      const id = String(placeId);
      if (!user) return { ok: false, reason: 'auth' };
      if (busyRef.current.has(id)) return { ok: false, reason: 'busy' };

      busyRef.current.add(id);
      setBusyIds((prev) => new Set(prev).add(id));

      let wasFav;
      setFavouriteIds((prev) => {
        wasFav = prev.has(id);
        const next = new Set(prev);
        if (wasFav) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        if (wasFav) {
          try {
            await api.user.removeFavourite(id);
          } catch (err) {
            if (err?.status !== 404) throw err;
          }
        } else {
          try {
            await api.user.addFavourite(id);
          } catch (err) {
            if (err?.status !== 409) throw err;
          }
        }
        await refreshFavourites({ silent: true });
        return { ok: true, added: !wasFav };
      } catch (err) {
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(id);
          else next.delete(id);
          return next;
        });
        return { ok: false, error: err };
      } finally {
        busyRef.current.delete(id);
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [user, refreshFavourites]
  );

  const value = useMemo(
    () => ({
      favouriteIds,
      favouritesLoading: loading,
      isFavourite,
      isBusy,
      refreshFavourites,
      toggleFavourite,
    }),
    [favouriteIds, loading, isFavourite, isBusy, refreshFavourites, toggleFavourite]
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return ctx;
}
