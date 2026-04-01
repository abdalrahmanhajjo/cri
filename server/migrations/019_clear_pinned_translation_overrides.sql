-- Drop CMS override entries for strings that the web client now always takes from i18n bundles.
-- Safe if paths are missing (#- is a no-op for missing keys in recent Postgres).

UPDATE translation_overrides
SET data = data
  #- '{en,home,heroTagline}'
  #- '{ar,home,heroTagline}'
  #- '{fr,home,heroTagline}'
  #- '{en,nav,navBrandTagline}'
  #- '{ar,nav,navBrandTagline}'
  #- '{fr,nav,navBrandTagline}'
WHERE id = 'default';
