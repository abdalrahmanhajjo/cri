import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import './Admin.css';

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s) {
  if (!s || !String(s).trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function defaultCouponValidUntil() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toDatetimeLocalValue(d.toISOString());
}

function PromotionModal({ promotion, places, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [form, setForm] = useState({
    placeId: '',
    title: '',
    subtitle: '',
    code: '',
    discountLabel: '',
    terms: '',
    startsAt: '',
    endsAt: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (promotion) {
      setForm({
        placeId: promotion.placeId || '',
        title: promotion.title || '',
        subtitle: promotion.subtitle || '',
        code: promotion.code || '',
        discountLabel: promotion.discountLabel || '',
        terms: promotion.terms || '',
        startsAt: toDatetimeLocalValue(promotion.startsAt),
        endsAt: toDatetimeLocalValue(promotion.endsAt),
        active: promotion.active !== false,
      });
    } else {
      setForm({
        placeId: places[0]?.id || '',
        title: '',
        subtitle: '',
        code: '',
        discountLabel: '',
        terms: '',
        startsAt: '',
        endsAt: '',
        active: true,
      });
    }
  }, [promotion, places]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const base = {
        placeId: form.placeId,
        title: form.title.trim(),
        startsAt: fromDatetimeLocal(form.startsAt),
        endsAt: fromDatetimeLocal(form.endsAt),
        active: form.active,
      };
      const payload = promotion
        ? {
            ...base,
            subtitle: form.subtitle.trim(),
            code: form.code.trim(),
            discountLabel: form.discountLabel.trim(),
            terms: form.terms.trim(),
          }
        : {
            ...base,
            subtitle: form.subtitle.trim() || null,
            code: form.code.trim() || null,
            discountLabel: form.discountLabel.trim() || null,
            terms: form.terms.trim() || null,
          };
      if (promotion) {
        await api.admin.placePromotions.update(promotion.id, payload);
      } else {
        await api.admin.placePromotions.create(payload);
      }
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="admin-modal-header">
          <h2>{promotion ? 'Edit place offer' : 'Add place offer'}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}
            <div className="admin-form-group">
              <label>Place *</label>
              <select
                value={form.placeId}
                onChange={(e) => setForm((f) => ({ ...f, placeId: e.target.value }))}
                required
              >
                <option value="">Select place…</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={200}
              />
            </div>
            <div className="admin-form-group">
              <label>Subtitle</label>
              <input
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                maxLength={500}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Code (optional — enables in-app redeem)</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  maxLength={64}
                />
              </div>
              <div className="admin-form-group">
                <label>Discount label</label>
                <input
                  value={form.discountLabel}
                  onChange={(e) => setForm((f) => ({ ...f, discountLabel: e.target.value }))}
                  maxLength={120}
                  placeholder="e.g. 20% off"
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Terms</label>
              <textarea
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Starts (optional)</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label>Ends (optional)</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />{' '}
                Active
              </label>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CouponModal({ coupon, places, onClose, onSaved }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [form, setForm] = useState({
    code: '',
    discountType: 'percent',
    discountValue: '10',
    minPurchase: '0',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    placeId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code || '',
        discountType: coupon.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: String(coupon.discountValue ?? ''),
        minPurchase: String(coupon.minPurchase ?? 0),
        validFrom: toDatetimeLocalValue(coupon.validFrom),
        validUntil: toDatetimeLocalValue(coupon.validUntil) || defaultCouponValidUntil(),
        usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
        placeId: coupon.placeId || '',
      });
    } else {
      setForm({
        code: '',
        discountType: 'percent',
        discountValue: '10',
        minPurchase: '0',
        validFrom: '',
        validUntil: defaultCouponValidUntil(),
        usageLimit: '',
        placeId: '',
      });
    }
  }, [coupon]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchase: Number(form.minPurchase) || 0,
        validFrom: fromDatetimeLocal(form.validFrom),
        validUntil: fromDatetimeLocal(form.validUntil),
        usageLimit: form.usageLimit.trim() ? parseInt(form.usageLimit, 10) : null,
        placeId: form.placeId || null,
      };
      if (payload.validUntil == null) {
        setErr('Valid until is required');
        setSaving(false);
        return;
      }
      if (coupon) {
        await api.admin.managedCoupons.update(coupon.id, payload);
      } else {
        await api.admin.managedCoupons.create(payload);
      }
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="admin-modal-header">
          <h2>{coupon ? 'Edit coupon' : 'Add coupon'}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="admin-modal-body">
            {err && <div className="admin-error">{err}</div>}
            <div className="admin-form-group">
              <label>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
                maxLength={32}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Type *</label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label>Value *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Min. purchase</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.minPurchase}
                onChange={(e) => setForm((f) => ({ ...f, minPurchase: e.target.value }))}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Valid from</label>
                <input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div className="admin-form-group">
                <label>Valid until *</label>
                <input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Usage limit (empty = unlimited)</label>
              <input
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                placeholder="e.g. 100"
              />
            </div>
            <div className="admin-form-group">
              <label>Place (empty = app-wide)</label>
              <select value={form.placeId} onChange={(e) => setForm((f) => ({ ...f, placeId: e.target.value }))}>
                <option value="">All / global</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-modal-footer">
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminOffers() {
  const [tab, setTab] = useState('promotions');
  const [places, setPlaces] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [promoModal, setPromoModal] = useState(null);
  const [couponModal, setCouponModal] = useState(null);

  const sortedPlaces = useMemo(
    () => [...places].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [places]
  );

  const loadPlaces = useCallback(async () => {
    const r = await api.admin.places.list({ limit: 500 });
    const list = Array.isArray(r.places) ? r.places : [];
    setPlaces(list);
  }, []);

  const loadPromotions = useCallback(async () => {
    const r = await api.admin.placePromotions.list();
    setPromotions(Array.isArray(r.promotions) ? r.promotions : []);
  }, []);

  const loadCoupons = useCallback(async () => {
    const r = await api.admin.managedCoupons.list();
    setCoupons(Array.isArray(r.coupons) ? r.coupons : []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPlaces(), loadPromotions(), loadCoupons()]);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [loadPlaces, loadPromotions, loadCoupons]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deletePromotion = async (p) => {
    if (!window.confirm(`Delete offer “${p.title}” (id ${p.id})?`)) return;
    try {
      await api.admin.placePromotions.delete(p.id);
      await loadPromotions();
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  const deleteCoupon = async (c) => {
    if (!window.confirm(`Delete coupon “${c.code}”?`)) return;
    try {
      await api.admin.managedCoupons.delete(c.id);
      await loadCoupons();
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="admin-main">
        <div className="admin-page-header">
          <h1>Offers & coupons</h1>
        </div>
        <div className="admin-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="admin-main">
      <div className="admin-page-header">
        <div className="admin-page-title-wrap">
          <p className="admin-subtitle">Place offers and app coupons (Discover + redeem)</p>
          <h1>Offers & coupons</h1>
        </div>
        <div className="admin-page-header-actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={refresh}>
            Refresh
          </button>
          {tab === 'promotions' ? (
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => setPromoModal('new')}>
              Add place offer
            </button>
          ) : (
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => setCouponModal('new')}>
              Add coupon
            </button>
          )}
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-toolbar" style={{ marginBottom: '1rem' }}>
        <div className="admin-segmented">
          <button type="button" className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}>
            Place offers ({promotions.length})
          </button>
          <button type="button" className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>
            Coupons ({coupons.length})
          </button>
        </div>
      </div>

      {tab === 'promotions' && (
        <div className="admin-card">
          <div className="admin-card-body" style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Place</th>
                  <th>Title</th>
                  <th>Code</th>
                  <th>Active</th>
                  <th>Ends</th>
                  <th className="admin-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <Link to={`/admin/places`}>{p.placeName || p.placeId}</Link>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.placeId}</div>
                    </td>
                    <td>{p.title}</td>
                    <td>
                      <code>{p.code || '—'}</code>
                    </td>
                    <td>{p.active ? 'Yes' : 'No'}</td>
                    <td>{fmt(p.endsAt)}</td>
                    <td className="admin-table-actions">
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setPromoModal(p)}>
                        Edit
                      </button>{' '}
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => deletePromotion(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {promotions.length === 0 && <div className="admin-empty" style={{ padding: '1.5rem' }}>No place offers yet.</div>}
          </div>
        </div>
      )}

      {tab === 'coupons' && (
        <div className="admin-card">
          <div className="admin-card-body" style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Place</th>
                  <th>Valid until</th>
                  <th>Limit</th>
                  <th className="admin-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>{c.discountType}</td>
                    <td>{c.discountValue}</td>
                    <td>{c.placeId ? c.placeName || c.placeId : 'Global'}</td>
                    <td>{fmt(c.validUntil)}</td>
                    <td>{c.usageLimit ?? '—'}</td>
                    <td className="admin-table-actions">
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--secondary" onClick={() => setCouponModal(c)}>
                        Edit
                      </button>{' '}
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => deleteCoupon(c)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {coupons.length === 0 && <div className="admin-empty" style={{ padding: '1.5rem' }}>No coupons yet.</div>}
          </div>
        </div>
      )}

      {promoModal === 'new' && (
        <PromotionModal places={sortedPlaces} promotion={null} onClose={() => setPromoModal(null)} onSaved={loadPromotions} />
      )}
      {promoModal && promoModal !== 'new' && (
        <PromotionModal
          places={sortedPlaces}
          promotion={promoModal}
          onClose={() => setPromoModal(null)}
          onSaved={loadPromotions}
        />
      )}

      {couponModal === 'new' && (
        <CouponModal places={sortedPlaces} coupon={null} onClose={() => setCouponModal(null)} onSaved={loadCoupons} />
      )}
      {couponModal && couponModal !== 'new' && (
        <CouponModal places={sortedPlaces} coupon={couponModal} onClose={() => setCouponModal(null)} onSaved={loadCoupons} />
      )}
    </div>
  );
}
