/** Client helpers for `places.dining_profile` (admin + business editors). */

export function emptyDiningForm() {
  return {
    menuIntro: '',
    menuUrl: '',
    menuPdfUrl: '',
    reservationsUrl: '',
    phone: '',
    whatsapp: '',
    dietaryNotes: '',
    cuisineTypesStr: '',
    svcDineIn: false,
    svcTakeaway: false,
    svcDelivery: false,
    svcOutdoor: false,
    svcReservations: false,
    menuSections: [],
  };
}

export function diningFormFromProfile(dp) {
  const d = dp && typeof dp === 'object' ? dp : {};
  const svc = d.service && typeof d.service === 'object' ? d.service : {};
  const sections = Array.isArray(d.menuSections)
    ? d.menuSections.map((sec) => ({
        title: typeof sec?.title === 'string' ? sec.title : '',
        items: Array.isArray(sec?.items)
          ? sec.items.map((it) => ({
              name: typeof it?.name === 'string' ? it.name : '',
              description: typeof it?.description === 'string' ? it.description : '',
              price: typeof it?.price === 'string' ? it.price : '',
            }))
          : [],
      }))
    : [];
  return {
    menuIntro: typeof d.menuIntro === 'string' ? d.menuIntro : '',
    menuUrl: typeof d.menuUrl === 'string' ? d.menuUrl : '',
    menuPdfUrl: typeof d.menuPdfUrl === 'string' ? d.menuPdfUrl : '',
    reservationsUrl: typeof d.reservationsUrl === 'string' ? d.reservationsUrl : '',
    phone: typeof d.phone === 'string' ? d.phone : '',
    whatsapp: typeof d.whatsapp === 'string' ? d.whatsapp : '',
    dietaryNotes: typeof d.dietaryNotes === 'string' ? d.dietaryNotes : '',
    cuisineTypesStr: Array.isArray(d.cuisineTypes) ? d.cuisineTypes.filter(Boolean).join(', ') : '',
    svcDineIn: !!svc.dineIn,
    svcTakeaway: !!svc.takeaway,
    svcDelivery: !!svc.delivery,
    svcOutdoor: !!svc.outdoorSeating,
    svcReservations: !!svc.reservations,
    menuSections: sections.length ? sections : [],
  };
}

export function buildDiningProfilePayload(f) {
  const cuisineTypes = String(f.cuisineTypesStr || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const menuSections = (f.menuSections || [])
    .map((sec) => ({
      title: String(sec.title || '').trim(),
      items: (sec.items || [])
        .map((it) => ({
          name: String(it.name || '').trim(),
          description: String(it.description || '').trim(),
          price: String(it.price || '').trim(),
        }))
        .filter((it) => it.name.length > 0),
    }))
    .filter((sec) => sec.title || sec.items.length > 0);

  return {
    menuIntro: String(f.menuIntro || '').trim(),
    menuUrl: String(f.menuUrl || '').trim(),
    menuPdfUrl: String(f.menuPdfUrl || '').trim(),
    reservationsUrl: String(f.reservationsUrl || '').trim(),
    phone: String(f.phone || '').trim(),
    whatsapp: String(f.whatsapp || '').trim(),
    dietaryNotes: String(f.dietaryNotes || '').trim(),
    cuisineTypes,
    service: {
      dineIn: !!f.svcDineIn,
      takeaway: !!f.svcTakeaway,
      delivery: !!f.svcDelivery,
      outdoorSeating: !!f.svcOutdoor,
      reservations: !!f.svcReservations,
    },
    menuSections,
  };
}
