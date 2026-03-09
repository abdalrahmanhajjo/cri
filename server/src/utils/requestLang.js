const ALLOWED_LANGS = ['en', 'ar', 'fr'];

function getRequestLang(req) {
  const q = req.query && req.query.lang;
  if (q && typeof q === 'string') {
    const code = q.trim().toLowerCase().split('-')[0];
    if (code && code.length === 2 && ALLOWED_LANGS.includes(code)) return code;
  }
  const accept = req.get('accept-language');
  if (accept && typeof accept === 'string') {
    const first = accept.split(',')[0].trim().toLowerCase().split('-')[0];
    if (first && first.length === 2 && ALLOWED_LANGS.includes(first)) return first;
  }
  return 'en';
}

module.exports = { getRequestLang, ALLOWED_LANGS };
