const fs = require('fs');
const p = 'client/src/i18n/translations.js';
let c = fs.readFileSync(p, 'utf8');
const arOld =
  "      sponsoredSectionLead: 'أماكن تدعم الدليل — موضحة بشفافية. استكشف كأي قائمة أخرى.',\r\n    },\r\n    hotelGuide: {";
const arNew =
  "      sponsoredSectionLead: 'أماكن تدعم الدليل — موضحة بشفافية. استكشف كأي قائمة أخرى.',\r\n      flowSectionLabel: 'مسارات المطاعم',\r\n      flowTitle: 'احجز، اطلب، أو تصفّح',\r\n      flowLead:\r\n        'اختر خطوة لتصفية القائمة. افتح أي بطاقة للهاتف والقائمة والعروض في صفحة المكان وإجراءات الرحلة.',\r\n      flowLabel_all: 'كل المطاعم',\r\n      flowHint_all: 'القائمة الكاملة مع بحثك وعوامل التصفية',\r\n      flowLabel_reserve: 'احجز طاولة',\r\n      flowHint_reserve: 'أماكن تقبل الحجوزات',\r\n      flowLabel_order: 'اطلب مسبقاً',\r\n      flowHint_order: 'توصيل أو سفري حيث هو مذكور',\r\n      flowLabel_menu: 'قوائم ووجبات',\r\n      flowHint_menu: 'قائمة منشورة أو ملاحظة وجبة',\r\n      flowLabel_offers: 'عروض وتخفيضات',\r\n      flowHint_offers: 'كلمات مثل عرض أو خاص أو ترويج في القائمة',\r\n      flowEmpty:\r\n        'لا توجد أماكن لهذه الخطوة مع بحثك الحالي. امسح البحث أو جرّب خطوة أخرى.',\r\n    },\r\n    hotelGuide: {";
if (!c.includes(arOld)) {
  console.error('ar block missing');
  process.exit(1);
}
c = c.replace(arOld, arNew);
const frOld =
  "      sponsoredSectionLead: 'Adresses qui soutiennent le guide — signalées clairement. Parcourez-les comme le reste.',\r\n    },\r\n    hotelGuide: {";
const frNew =
  "      sponsoredSectionLead: 'Adresses qui soutiennent le guide — signalées clairement. Parcourez-les comme le reste.',\r\n      flowSectionLabel: 'Parcours restauration',\r\n      flowTitle: 'Réserver, commander ou parcourir',\r\n      flowLead:\r\n        'Choisissez une étape pour filtrer la liste. Ouvrez une fiche pour téléphone, menu, offres et actions voyage.',\r\n      flowLabel_all: 'Toute la restauration',\r\n      flowHint_all: 'Liste complète avec recherche et filtres',\r\n      flowLabel_reserve: 'Réserver une table',\r\n      flowHint_reserve: 'Établissements qui prennent les réservations',\r\n      flowLabel_order: 'Commander',\r\n      flowHint_order: 'Livraison ou à emporter quand indiqué',\r\n      flowLabel_menu: 'Menus & formules',\r\n      flowHint_menu: 'Fiches avec menu publié ou note de formule',\r\n      flowLabel_offers: 'Offres & soirées',\r\n      flowHint_offers: 'Mots-clés offre, spécial ou promo dans la fiche',\r\n      flowEmpty:\r\n        'Aucun lieu ne correspond à cette étape avec votre recherche. Effacez la recherche ou essayez une autre étape.',\r\n    },\r\n    hotelGuide: {";
if (!c.includes(frOld)) {
  console.error('fr block missing');
  process.exit(1);
}
c = c.replace(frOld, frNew);
fs.writeFileSync(p, c);
console.log('ar/fr flow ok');
