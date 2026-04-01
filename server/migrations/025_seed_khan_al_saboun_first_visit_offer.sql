-- Khan al-Saboun: 20% off first visit (heritage place id from 020_tripoli_heritage_places_reset).
-- Idempotent: skips if promo with code FIRSTVISIT20 already exists for this place.

INSERT INTO place_promotions (place_id, title, subtitle, code, discount_label, terms, active, updated_at)
SELECT
  'khan_al_saboun',
  '20% off first visit',
  'Welcome offer for new visitors at Khan al-Saboun.',
  'FIRSTVISIT20',
  '20% off',
  'First-time visitors only. Show or mention this offer at checkout. Cannot be combined with other discounts.',
  true,
  NOW()
WHERE EXISTS (SELECT 1 FROM places WHERE id = 'khan_al_saboun')
  AND NOT EXISTS (
    SELECT 1 FROM place_promotions p WHERE p.place_id = 'khan_al_saboun' AND p.code = 'FIRSTVISIT20'
  );

INSERT INTO place_promotion_translations (promotion_id, lang, title, subtitle, discount_label, terms)
SELECT p.id, 'ar',
  'خصم 20% لأول زيارة',
  'عرض ترحيب في خان الصابون لزيارتك الأولى.',
  'خصم 20%',
  'للزوار لأول مرة فقط. اذكر هذا العرض عند الدفع. لا يُجمع مع خصومات أخرى.'
FROM place_promotions p
WHERE p.place_id = 'khan_al_saboun' AND p.code = 'FIRSTVISIT20'
ON CONFLICT (promotion_id, lang) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  discount_label = EXCLUDED.discount_label,
  terms = EXCLUDED.terms;

INSERT INTO place_promotion_translations (promotion_id, lang, title, subtitle, discount_label, terms)
SELECT p.id, 'fr',
  '20 % de réduction pour la première visite',
  'Offre de bienvenue pour votre première visite au Khan al-Saboun.',
  '20 % de réduction',
  'Réservé aux visiteurs pour la première visite uniquement. Présentez cette offre à la caisse. Non cumulable.'
FROM place_promotions p
WHERE p.place_id = 'khan_al_saboun' AND p.code = 'FIRSTVISIT20'
ON CONFLICT (promotion_id, lang) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  discount_label = EXCLUDED.discount_label,
  terms = EXCLUDED.terms;
