/**
 * Media and URL resolution utilities for the API layer.
 */
import { getBaseUrl } from './http';

export function fixImageUrlExtension(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([a-f0-9]{32})(jpe?g|png|gif|webp)$/i, '$1.$2');
}

export function getImageUrlAlternate(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/\.(jpe?g|png|gif|webp)$/i, '$1');
}

export function getImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = fixImageUrlExtension(url);
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const path = url.startsWith('/') ? url : '/' + url;
  if (typeof window !== 'undefined' && import.meta.env.DEV) return path;
  return getBaseUrl() + path;
}

export function getPlaceImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u = fixImageUrlExtension(url.trim());
  if (/^\s*(javascript|data|vbscript|file):/i.test(u)) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return getImageUrl(u);
  if (u && !u.startsWith('//')) return getImageUrl('/' + u);
  return null;
}

export function generateSessionCode() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
