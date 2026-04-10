/**
 * Icon semantics for `<Icon name="…" />` (Feather SVGs in `components/Icon.jsx`, `/public/feather`).
 * `flaticonAnimated` is legacy reference text only.
 *
 * @typedef {{ variant: string, description: string, flaticonAnimated: string }} IconDoc
 */

/** @type {Record<string, IconDoc>} */
export const ICON_DOCS = {
  account_balance: {
    variant: 'discover',
    description:
      'Represents heritage, institutions, or civic / landmark-style places in “find your way” and theme rows.',
    flaticonAnimated:
      'Bank, museum facade, or classical-building animated icon from Flaticon (institution/Culture).',
  },
  account_circle: {
    variant: 'brand',
    description: 'Stands for the signed-in user’s account menu or profile identity on auth screens.',
    flaticonAnimated: 'Animated user-in-circle or profile card from Flaticon (account / user).',
  },
  add: {
    variant: 'action',
    description: 'Creates a new item, zooms in, or adds a leg to a map route, depending on context.',
    flaticonAnimated: 'Plus / “new item” animated icon from Flaticon (add, create, zoom in).',
  },
  admin_panel_settings: {
    variant: 'security',
    description: 'Marks business-admin-only areas or elevated permissions on the profile screen.',
    flaticonAnimated: 'Shield, admin panel, or gear-with-badge animated icon from Flaticon (admin).',
  },
  alternate_email: {
    variant: 'communication',
    description: 'Decorates the username or alternate email field on registration forms.',
    flaticonAnimated: 'At-sign / alternate contact animated icon from Flaticon (email, username).',
  },
  android: {
    variant: 'brand',
    description: 'Indicates the Android download / Play-style app badge on the marketing home bento.',
    flaticonAnimated: 'Android robot or Play-style badge animation from Flaticon (Android app).',
  },
  arrow_back: {
    variant: 'nav',
    description: 'Moves backward one step: previous page, planner, chat thread, or modal stack.',
    flaticonAnimated: 'Animated left arrow or “back” chevron from Flaticon (navigation back).',
  },
  arrow_forward: {
    variant: 'nav',
    description: 'Shows “continue”, opens the next screen, or decorates primary/secondary link buttons.',
    flaticonAnimated: 'Animated right arrow or forward chevron from Flaticon (next / CTA).',
  },
  arrow_upward: {
    variant: 'nav',
    description: 'On the home hub, nudges the visitor to scroll up or return toward top content.',
    flaticonAnimated: 'Animated up-arrow from Flaticon (scroll to top / move up).',
  },
  auto_awesome: {
    variant: 'ai',
    description: 'Signals AI-assisted features: trip planner moods, sparkles on a stop, or AI plan CTA.',
    flaticonAnimated: 'Sparkles, magic wand, or “AI” stars animation from Flaticon (smart suggestion).',
  },
  zap: {
    variant: 'nav',
    description: 'Lightning bolt (quick tour, energy, or fast path). Rendered from Feather zap.svg.',
    flaticonAnimated: '',
  },
  accessibility: {
    variant: 'status',
    description: 'Highlights inclusive access or accessibility-related practical tips on the home page.',
    flaticonAnimated: 'Universal access / wheelchair animated symbol from Flaticon (accessibility).',
  },
  bookmark: {
    variant: 'favorite',
    description: 'Saved post or reel state in the feed: tap to store content for later.',
    flaticonAnimated: 'Filled bookmark ribbon animation from Flaticon (saved).',
  },
  bookmark_border: {
    variant: 'favorite',
    description: 'Unsaved bookmark state: same control as bookmark, outline style before save.',
    flaticonAnimated: 'Outline bookmark toggling to filled in animation from Flaticon (save).',
  },
  calendar_month: {
    variant: 'time',
    description: 'Trip dates, schedule overview, or month-span context on trip detail.',
    flaticonAnimated: 'Flip calendar or month grid animation from Flaticon (calendar).',
  },
  calendar_today: {
    variant: 'time',
    description: 'Single-day emphasis on profile or forms tied to “today” / current date.',
    flaticonAnimated: 'Day page / single-day calendar animation from Flaticon (today).',
  },
  celebration: {
    variant: 'nature',
    description: 'Activities hub category tile for parties, festivals, or celebratory experiences.',
    flaticonAnimated: 'Confetti, party popper, or cake animation from Flaticon (celebration).',
  },
  chat: {
    variant: 'communication',
    description: 'Profile shortcut into direct messages between travellers and businesses.',
    flaticonAnimated: 'Speech bubble or chat window animation from Flaticon (messages).',
  },
  chat_bubble_outline: {
    variant: 'communication',
    description: 'Comment count or open-comments affordance on feed posts and reels.',
    flaticonAnimated: 'Outline chat bubble with subtle motion from Flaticon (comments).',
  },
  check: {
    variant: 'status',
    description: 'Confirms an included tour amenity or positive chip on detail pages.',
    flaticonAnimated: 'Checkmark drawing animation from Flaticon (included / yes).',
  },
  check_circle: {
    variant: 'status',
    description: 'Success: password rules met, offer redeemed, forgot-password confirmation, etc.',
    flaticonAnimated: 'Animated check inside circle from Flaticon (success confirm).',
  },
  chevron_left: {
    variant: 'nav',
    description: 'Previous image, previous calendar month, or carousel step to the left.',
    flaticonAnimated: 'Animated small left chevron from Flaticon (carousel back).',
  },
  chevron_right: {
    variant: 'nav',
    description: 'Next item: inbox thread, stop row, modal drill-in, or calendar forward.',
    flaticonAnimated: 'Animated small right chevron from Flaticon (carousel forward).',
  },
  close: {
    variant: 'tool',
    description: 'Dismisses overlays, clears search, stops live nav, or rejects a list row.',
    flaticonAnimated: 'X / close cross with motion from Flaticon (dismiss).',
  },
  confirmation_number: {
    variant: 'security',
    description: 'OTP, ticket code, or verification token fields on auth flows.',
    flaticonAnimated: 'Ticket stub or PIN fields animation from Flaticon (verification code).',
  },
  content_copy: {
    variant: 'tool',
    description: 'Duplicate an existing saved trip as a new draft/plan.',
    flaticonAnimated: 'Two papers or copy clipboard animation from Flaticon (duplicate).',
  },
  delete: {
    variant: 'warning',
    description: 'Removes a trip, stop, slot, or other destructive action (with confirmation where needed).',
    flaticonAnimated: 'Trash bin or delete swipe animation from Flaticon (remove).',
  },
  directions_car: {
    variant: 'transport',
    description: 'Driving travel mode for map directions and live nav.',
    flaticonAnimated: 'Car / automobile animated icon from Flaticon (driving).',
  },
  directions_walk: {
    variant: 'transport',
    description: 'Walking travel mode for map directions and live nav.',
    flaticonAnimated: 'Walking person animation from Flaticon (walking).',
  },
  dynamic_feed: {
    variant: 'discover',
    description: 'Discover tab for the community feed and related “all posts” deep links.',
    flaticonAnimated: 'Social feed stack or cards animation from Flaticon (feed / timeline).',
  },
  edit: {
    variant: 'action',
    description: 'Edits a trip, profile field, or AI plan slot depending on screen.',
    flaticonAnimated: 'Pencil / edit pen animation from Flaticon (edit).',
  },
  error: {
    variant: 'warning',
    description: 'Inline validation failure (e.g. password mismatch, rule not met).',
    flaticonAnimated: 'Error cross or alert pulse from Flaticon (validation error).',
  },
  error_outline: {
    variant: 'warning',
    description: 'Profile or form-level error banner icon (softer than solid error).',
    flaticonAnimated: 'Outlined alert / exclamation animation from Flaticon (warning).',
  },
  event: {
    variant: 'time',
    description: 'Event listings, category chips, or hero placeholder for an event detail page.',
    flaticonAnimated: 'Ticket or calendar-event animation from Flaticon (event).',
  },
  event_note: {
    variant: 'time',
    description: 'Planner/discover cards: notes an event- or itinerary-flavoured row.',
    flaticonAnimated: 'Calendar with note lines animation from Flaticon (itinerary note).',
  },
  explore: {
    variant: 'discover',
    description: 'Generic exploration / compass-style themes in find-your-way and tour fallbacks.',
    flaticonAnimated: 'Compass or map explore animation from Flaticon (explore).',
  },
  expand_less: {
    variant: 'nav',
    description: 'Collapse a section, shrink route details, or hide a peek panel.',
    flaticonAnimated: 'Chevron folding up / collapse animation from Flaticon (collapse).',
  },
  expand_more: {
    variant: 'nav',
    description: 'Expand menus, trip filters, or builder sections that are currently collapsed.',
    flaticonAnimated: 'Chevron folding down / expand animation from Flaticon (expand).',
  },
  family_restroom: {
    variant: 'discover',
    description: 'Family- and kid-friendly thematic row in find-your-way groupings.',
    flaticonAnimated: 'Family or playground animation from Flaticon (family friendly).',
  },
  favorite: {
    variant: 'favorite',
    description: 'Like or favourite a place/post, or open the favourites area from the header.',
    flaticonAnimated: 'Heart fill / pulse animation from Flaticon (liked).',
  },
  favorite_border: {
    variant: 'favorite',
    description: 'Not-yet-favourited: save button outline on cards, plan builder empty state, etc.',
    flaticonAnimated: 'Outline heart morphing to filled from Flaticon (favourite toggle).',
  },
  filter_list: {
    variant: 'tool',
    description: 'Opens or denotes filtering UI (e.g. trip list filters on the plan page).',
    flaticonAnimated: 'Sliders or filter funnel animation from Flaticon (filter).',
  },
  fit_screen: {
    variant: 'location',
    description: 'Map control to fit all markers or the current route in the viewport.',
    flaticonAnimated: 'Frame / fit-to-screen corners animation from Flaticon (fit bounds).',
  },
  grid_view: {
    variant: 'ui',
    description: 'Switch spots/discover layouts to a grid of cards.',
    flaticonAnimated: 'Grid tiles animation from Flaticon (grid view).',
  },
  hiking: {
    variant: 'nature',
    description: 'Activities hub outdoor / hiking category tile.',
    flaticonAnimated: 'Hiker or mountain trail animation from Flaticon (hiking).',
  },
  hotel: {
    variant: 'place',
    description: 'Stay and accommodation theme on home “Find your way” and the hotels guide.',
    flaticonAnimated: 'Door or key motion from Flaticon (hotel / check-in).',
  },
  hourglass_empty: {
    variant: 'time',
    description: 'Username check in progress on the registration form.',
    flaticonAnimated: 'Hourglass sand animation from Flaticon (loading / waiting).',
  },
  key: {
    variant: 'security',
    description: 'Password field adornment on login, register, and reset flows.',
    flaticonAnimated: 'Key turning or lock key animation from Flaticon (password).',
  },
  keyboard_arrow_down: {
    variant: 'nav',
    description: 'Expand live-nav instructions or scroll content downward on the map sheet.',
    flaticonAnimated: 'Down chevron animation from Flaticon (expand down).',
  },
  keyboard_arrow_up: {
    variant: 'nav',
    description: 'Peek handles and “drag up” affordances on the map live navigation UI.',
    flaticonAnimated: 'Up chevron animation from Flaticon (peek / expand up).',
  },
  link: {
    variant: 'communication',
    description: 'Copy or share a directions/deep link from map route details.',
    flaticonAnimated: 'Chain link animation from Flaticon (URL / link).',
  },
  list: {
    variant: 'ui',
    description: 'Toggle map drawer to list mode when the sheet shows place rows.',
    flaticonAnimated: 'Bullet list animation from Flaticon (list view).',
  },
  location_city: {
    variant: 'location',
    description: 'Placeholder when a Discover “proposal” pick has no custom thumbnail.',
    flaticonAnimated: 'Skyline or city silhouette animation from Flaticon (city).',
  },
  location_on: {
    variant: 'location',
    description: 'Address line, map pin on detail cards, or “you are here” semantics.',
    flaticonAnimated: 'Map pin dropping or pulsing from Flaticon (location pin).',
  },
  lock: {
    variant: 'security',
    description: 'Secured screens: login, register, forgot password headers.',
    flaticonAnimated: 'Padlock closing animation from Flaticon (secure).',
  },
  logout: {
    variant: 'security',
    description: 'Sign-out control on the profile screen.',
    flaticonAnimated: 'Door-out or logout arrow animation from Flaticon (sign out).',
  },
  mail: {
    variant: 'communication',
    description: 'Email address inputs across auth screens.',
    flaticonAnimated: 'Envelope flight or open mail animation from Flaticon (email).',
  },
  map: {
    variant: 'location',
    description: 'Opens the map for a place, trip, or global “view map” CTAs.',
    flaticonAnimated: 'Folded map or pin-on-map animation from Flaticon (map).',
  },
  mark_email_read: {
    variant: 'communication',
    description: 'Verify-email success and Discover message proposal CTA.',
    flaticonAnimated: 'Envelope with check animation from Flaticon (email read / verified).',
  },
  movie: {
    variant: 'media',
    description: 'Discover tab icon for short reels/video feed.',
    flaticonAnimated: 'Clapperboard or film strip animation from Flaticon (video / reel).',
  },
  mosque: {
    variant: 'discover',
    description: 'AI planner mood chip for faith / spirituality themed itineraries.',
    flaticonAnimated: 'Mosque or dome animation from Flaticon (faith heritage).',
  },
  more_horiz: {
    variant: 'ui',
    description: 'Overflow menu on feed posts (more options).',
    flaticonAnimated: 'Three dots horizontal bounce from Flaticon (more menu).',
  },
  more_vert: {
    variant: 'ui',
    description: 'Step overflow menu on map route legs.',
    flaticonAnimated: 'Three dots vertical bounce from Flaticon (more menu).',
  },
  museum: {
    variant: 'discover',
    description: 'AI planner mood for culture / museums.',
    flaticonAnimated: 'Museum building or column animation from Flaticon (culture).',
  },
  my_location: {
    variant: 'location',
    description: 'Recenter map on user location; live nav tracking status.',
    flaticonAnimated: 'Target / GPS arrow pulse from Flaticon (my location).',
  },
  navigation: {
    variant: 'transport',
    description: 'Start or headline turn-by-turn / live navigation on the map.',
    flaticonAnimated: 'Navigation arrow or compass needle animation from Flaticon (navigate).',
  },
  open_in_new: {
    variant: 'communication',
    description: 'External event signup or partner link opening in a new tab.',
    flaticonAnimated: 'Window with arrow animation from Flaticon (external link).',
  },
  payments: {
    variant: 'commerce',
    description: 'Price or paid-event metadata on events/activities cards.',
    flaticonAnimated: 'Card or coin payment animation from Flaticon (price / pay).',
  },
  person: {
    variant: 'brand',
    description: 'Generic user: nav avatar slot, reel attribution, comment author, etc.',
    flaticonAnimated: 'Simple person silhouette animation from Flaticon (user).',
  },
  person_add: {
    variant: 'brand',
    description: 'Registration header: create a new account.',
    flaticonAnimated: 'User-plus animation from Flaticon (sign up).',
  },
  phone_iphone: {
    variant: 'brand',
    description: 'iOS / App Store style download badge on marketing blocks.',
    flaticonAnimated: 'Phone outline or App Store style device from Flaticon (iOS app).',
  },
  photo_camera: {
    variant: 'media',
    description: 'Change profile photo; community post thumbnail fallback for photos.',
    flaticonAnimated: 'Camera shutter animation from Flaticon (photo).',
  },
  photo_library: {
    variant: 'media',
    description: 'Place gallery: open full photo library / grid on place detail.',
    flaticonAnimated: 'Stack of photos animation from Flaticon (gallery).',
  },
  pin_drop: {
    variant: 'location',
    description: 'Copy coordinates or emphasize map pin on place detail.',
    flaticonAnimated: 'Pin dropping animation from Flaticon (coordinates).',
  },
  place: {
    variant: 'location',
    description: 'Fallback image for generic place, map leg end, or empty state illustration.',
    flaticonAnimated: 'Map marker or POI building animation from Flaticon (place).',
  },
  play_circle: {
    variant: 'media',
    description: 'Indicates a video post in the community feed preview.',
    flaticonAnimated: 'Play button in circle animation from Flaticon (play video).',
  },
  print: {
    variant: 'tool',
    description: 'Print-friendly view for place or tour detail.',
    flaticonAnimated: 'Printer paper animation from Flaticon (print).',
  },
  psychology: {
    variant: 'ai',
    description: 'Profile link toward AI trip planner.',
    flaticonAnimated: 'Brain / AI head animation from Flaticon (AI planner).',
  },
  radio_button_unchecked: {
    variant: 'ui',
    description: 'Password or username rule not yet satisfied (empty circle).',
    flaticonAnimated: 'Empty radio ring from Flaticon (todo / unchecked).',
  },
  rate_review: {
    variant: 'communication',
    description: 'Reviews section label on place detail.',
    flaticonAnimated: 'Star-and-comment animation from Flaticon (reviews).',
  },
  remove: {
    variant: 'warning',
    description: 'Zoom out or decrease on map zoom controls.',
    flaticonAnimated: 'Minus / zoom-out animation from Flaticon (decrease).',
  },
  remove_circle_outline: {
    variant: 'warning',
    description: 'Remove one favourite from the favourites list.',
    flaticonAnimated: 'Circle minus or trash outline from Flaticon (remove from list).',
  },
  reply: {
    variant: 'communication',
    description: 'Reply-to-comment affordance on feed threads.',
    flaticonAnimated: 'Curved reply arrow animation from Flaticon (reply).',
  },
  restaurant: {
    variant: 'commerce',
    description: 'Food mood chip in AI planner and find-your-way food theme.',
    flaticonAnimated: 'Fork/knife or chef hat animation from Flaticon (food).',
  },
  route: {
    variant: 'transport',
    description: 'Route summary row: distance, path mode, or trip banner on map.',
    flaticonAnimated: 'Path A→B or road animation from Flaticon (route).',
  },
  schedule: {
    variant: 'time',
    description: 'Opening hours, slot time, or itinerary step time.',
    flaticonAnimated: 'Clock with motion from Flaticon (schedule / hours).',
  },
  search: {
    variant: 'tool',
    description: 'Global search, discover search, messages inbox search, spots filter.',
    flaticonAnimated: 'Magnifying glass scan animation from Flaticon (search).',
  },
  sell: {
    variant: 'commerce',
    description: 'Discover tab for offers/promotions.',
    flaticonAnimated: 'Price tag or offer ribbon animation from Flaticon (deals).',
  },
  send: {
    variant: 'communication',
    description: 'Submit AI chat, post a comment, or proposals tab icon.',
    flaticonAnimated: 'Paper plane flying animation from Flaticon (send).',
  },
  share: {
    variant: 'social',
    description: 'Native share sheet / copy share URL for place, trip, event, tour.',
    flaticonAnimated: 'Share nodes or upload arrow animation from Flaticon (share).',
  },
  smartphone: {
    variant: 'brand',
    description: 'Open directions in the phone’s maps app from map route sheet.',
    flaticonAnimated: 'Phone with map arrow animation from Flaticon (open in maps app).',
  },
  star: {
    variant: 'favorite',
    description: 'Numeric rating display on cards, detail, map drawer (not always interactive).',
    flaticonAnimated: 'Star twinkle or fill animation from Flaticon (rating).',
  },
  storefront: {
    variant: 'commerce',
    description: 'Business listings, shop category in discover rows, souk mood in AI planner.',
    flaticonAnimated: 'Shop awning animation from Flaticon (store / souk).',
  },
  touch_app: {
    variant: 'ui',
    description: 'Discover gating: tap to unlock region or interaction.',
    flaticonAnimated: 'Finger tap ripple animation from Flaticon (tap here).',
  },
  travel_explore: {
    variant: 'discover',
    description: 'Exploration / compass flavour for empty slots and discover empties.',
    flaticonAnimated: 'Globe with plane animation from Flaticon (travel explore).',
  },
  trip_origin: {
    variant: 'location',
    description: 'First stop / origin marker in map route step list.',
    flaticonAnimated: 'Start pin or “A” marker animation from Flaticon (origin).',
  },
  tune: {
    variant: 'tool',
    description: 'AI planner preferences and place-discover filter/sort entry.',
    flaticonAnimated: 'Equalizer sliders animation from Flaticon (settings / tune).',
  },
  verified: {
    variant: 'status',
    description: 'Blue-check style badge on verified business posts (visible to assistive tech when needed).',
    flaticonAnimated: 'Check badge animation from Flaticon (verified creator).',
  },
  verified_user: {
    variant: 'security',
    description: 'Footer trust / secure connection badge on auth screens.',
    flaticonAnimated: 'Shield with check animation from Flaticon (secure account).',
  },
  vertical_align_top: {
    variant: 'nav',
    description: 'Scroll-to-top for the AI plan draft when editing long itineraries.',
    flaticonAnimated: 'Up-align / jump to top animation from Flaticon (scroll top).',
  },
  view_list: {
    variant: 'ui',
    description: 'List layout toggle for spots/discover views.',
    flaticonAnimated: 'Stacked rows animation from Flaticon (list view).',
  },
  visibility: {
    variant: 'security',
    description: 'Show plaintext password or sensitive field.',
    flaticonAnimated: 'Eye open animation from Flaticon (show password).',
  },
  visibility_off: {
    variant: 'security',
    description: 'Hide password or obscure sensitive field.',
    flaticonAnimated: 'Eye closed animation from Flaticon (hide password).',
  },
  volume_off: {
    variant: 'media',
    description: 'Reel muted state toggle.',
    flaticonAnimated: 'Speaker with mute slash animation from Flaticon (mute).',
  },
  volume_up: {
    variant: 'media',
    description: 'Reel unmuted / sound on state.',
    flaticonAnimated: 'Speaker waves animation from Flaticon (sound on).',
  },
  waves: {
    variant: 'nature',
    description: 'Seafront / coastal theme in find-your-way groupings.',
    flaticonAnimated: 'Ocean wave animation from Flaticon (waterfront).',
  },
};

function inferVariant(name) {
  if (name === 'list') return 'nav';
  if (/arrow|chevron|keyboard_arrow|expand_|vertical_align|trip_origin/u.test(name)) return 'nav';
  if (/favorite|bookmark|^star$|verified(?!_user)/u.test(name)) return 'favorite';
  if (/location|map|place|pin|fit_screen|my_location/u.test(name)) return 'location';
  if (/time|calendar|schedule|hourglass|event/u.test(name)) return 'time';
  if (/error|delete|remove|warning/u.test(name)) return 'warning';
  if (/photo|image|volume|play|movie|camera|library/u.test(name)) return 'media';
  if (/share|reply|chat|mail|send|mark_email|link|open_in_new/u.test(name)) return 'social';
  if (/car|walk|route|navigation/u.test(name)) return 'transport';
  if (/lock|key|shield|verified_user|confirmation|visibility|logout|admin/u.test(name)) return 'security';
  if (/person|account|android|phone_iphone|smartphone/u.test(name)) return 'brand';
  if (/sell|payments|restaurant|storefront/u.test(name)) return 'commerce';
  if (/search|filter|tune|print|grid_view|view_list|more_|content_copy|check(?!_)|radio/u.test(name))
    return 'tool';
  if (/hiking|celebration|waves|family_restroom|explore|museum|mosque|travel|feed|dynamic|touch_app|account_balance/u.test(name))
    return 'discover';
  if (/auto_awesome|psychology/u.test(name)) return 'ai';
  return 'ui';
}

/**
 * @param {string} name Material Symbols icon name (Icon `name` prop)
 * @returns {IconDoc}
 */
export function getIconDoc(name) {
  const hit = ICON_DOCS[name];
  if (hit) return hit;
  const variant = inferVariant(name);
  return {
    variant,
    description: `Dynamic or catalog icon “${name}” rendered from data (category, tabs, or API). Typically paired with a nearby text label.`,
    flaticonAnimated: '',
  };
}
