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

/** Avoids `String(undefined)` → `"undefined"` being saved to MongoDB as place_id. */
function normalizePlaceIdForFavourite(raw) {
  if (raw == null) return null;
  const s =
    typeof raw === 'number' && Number.isFinite(raw)
      ? String(Math.trunc(raw))
      : String(raw).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  return s;
}

const FavouritesContext = createContext(null);

/**
 * Single source of truth for saved place ids + coordinated refresh/toggle.
 * GET /favourites uses AbortController so only the latest list fetch applies.
 */
export function FavouritesProvider({ children }) {
  const { user } = useAuth();
  /** Stable id only — `user` object identity changes on profile refresh and must not retrigger effects. */
  const userId = user?.id != null ? user.id : null;
  const [favouriteIds, setFavouriteIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const fetchAbortRef = useRef(null);
  const refreshSeqRef = useRef(0);
  const busyRef = useRef(new Set());

  const refreshFavourites = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (userId == null) {
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
      const ids = Array.isArray(res?.placeIds)
        ? res.placeIds.map(String).filter((x) => x && x !== 'undefined' && x !== 'null')
        : [];
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
  }, [userId]);

  useEffect(() => {
    if (userId == null) {
      fetchAbortRef.current?.abort();
      setFavouriteIds(new Set());
      setLoading(false);
      return undefined;
    }
    refreshFavourites();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [userId, refreshFavourites]);

  const isFavourite = useCallback(
    (placeId) => {
      const id = normalizePlaceIdForFavourite(placeId);
      return id != null && favouriteIds.has(id);
    },
    [favouriteIds]
  );

  const isBusy = useCallback(
    (placeId) => {
      const id = normalizePlaceIdForFavourite(placeId);
      return id != null && busyIds.has(id);
    },
    [busyIds]
  );

  /**
   * Optimistic toggle + server reconcile. Treats 404 remove / 409 add as success.
   * @returns {Promise<{ ok: boolean, reason?: string, added?: boolean, error?: Error }>}
   */
  const toggleFavourite = useCallback(
    async (placeId) => {
      if (userId == null) return { ok: false, reason: 'auth' };
      const id = normalizePlaceIdForFavourite(placeId);
      if (id == null) return { ok: false, reason: 'invalid' };
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
        // Re-fetch list; may race with other refreshes or briefly lag POST — reconcile below.
        await refreshFavourites({ silent: true });
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.delete(id);
          else next.add(id);
          return next;
        });
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
    [userId, refreshFavourites]
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
