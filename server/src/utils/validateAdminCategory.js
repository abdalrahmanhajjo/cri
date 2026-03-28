'use strict';

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function validateCategoryCreate(body) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  let id = (b.id != null ? String(b.id) : '').trim();
  if (!id && b.name != null) {
    id = String(b.name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }
  if (!id || !ID_RE.test(id)) {
    errors.push('id must be 1–80 chars: letters, numbers, underscore, hyphen');
  }

  const name = b.name != null ? String(b.name).trim() : '';
  if (!name || name.length > 200) {
    errors.push('name is required and must be at most 200 characters');
  }

  const icon = b.icon != null ? String(b.icon).trim() : 'fas fa-folder';
  if (icon.length > 120) {
    errors.push('icon must be at most 120 characters');
  }

  const description = b.description != null ? String(b.description) : '';
  if (description.length > 5000) {
    errors.push('description must be at most 5000 characters');
  }

  let color = (b.color != null ? String(b.color).trim() : '') || '#666666';
  if (!COLOR_RE.test(color)) {
    errors.push('color must be a hex color like #RGB or #RRGGBB');
  }

  let count = 0;
  if (b.count != null) {
    const n = parseInt(b.count, 10);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) {
      errors.push('count must be a non-negative integer');
    } else {
      count = n;
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      icon: icon || 'fas fa-folder',
      description,
      color,
      count,
    },
  };
}

module.exports = { validateCategoryCreate };
