/**
 * Icon semantics for `<Icon name="…" />` (SVG via Bootstrap Icons in `components/Icon.jsx`).
 * See `bootstrapIconMap.js` for Material-name → Bootstrap SVG mapping.
 *
 * @typedef {{ variant: string, description: string }} IconDoc
 */

/** @type {Record<string, IconDoc>} */
export const ICON_DOCS = {
  account_balance: {
    variant: "discover",
    description:
      "Represents heritage, institutions, or civic / landmark-style places in “find your way” and theme rows.",
  },
  account_circle: {
    variant: "brand",
    description:
      "Stands for the signed-in user’s account menu or profile identity on auth screens.",
  },
  add: {
    variant: "action",
    description:
      "Creates a new item, zooms in, or adds a leg to a map route, depending on context.",
  },
  admin_panel_settings: {
    variant: "security",
    description:
      "Marks business-admin-only areas or elevated permissions on the profile screen.",
  },
  alternate_email: {
    variant: "communication",
    description:
      "Decorates the username or alternate email field on registration forms.",
  },
  android: {
    variant: "brand",
    description:
      "Indicates the Android download / Play-style app badge on the marketing home bento.",
  },
  arrow_back: {
    variant: "nav",
    description:
      "Moves backward one step: previous page, planner, chat thread, or modal stack.",
  },
  arrow_forward: {
    variant: "nav",
    description:
      "Shows “continue”, opens the next screen, or decorates primary/secondary link buttons.",
  },
  arrow_upward: {
    variant: "nav",
    description:
      "On the home hub, nudges the visitor to scroll up or return toward top content.",
  },
  auto_awesome: {
    variant: "ai",
    description:
      "Signals AI-assisted features: trip planner moods, sparkles on a stop, or AI plan CTA.",
  },
  accessibility: {
    variant: "status",
    description:
      "Highlights inclusive access or accessibility-related practical tips on the home page.",
  },
  bookmark: {
    variant: "favorite",
    description:
      "Saved post or reel state in the feed: tap to store content for later.",
  },
  bookmark_border: {
    variant: "favorite",
    description:
      "Unsaved bookmark state: same control as bookmark, outline style before save.",
  },
  calendar_month: {
    variant: "time",
    description:
      "Trip dates, schedule overview, or month-span context on trip detail.",
  },
  calendar_today: {
    variant: "time",
    description:
      "Single-day emphasis on profile or forms tied to “today” / current date.",
  },
  celebration: {
    variant: "nature",
    description:
      "Activities hub category tile for parties, festivals, or celebratory experiences.",
  },
  chat: {
    variant: "communication",
    description:
      "Profile shortcut into direct messages between travellers and businesses.",
  },
  chat_bubble_outline: {
    variant: "communication",
    description:
      "Comment count or open-comments affordance on feed posts and reels.",
  },
  check: {
    variant: "status",
    description:
      "Confirms an included tour amenity or positive chip on detail pages.",
  },
  check_circle: {
    variant: "status",
    description:
      "Success: password rules met, offer redeemed, forgot-password confirmation, etc.",
  },
  chevron_left: {
    variant: "nav",
    description:
      "Previous image, previous calendar month, or carousel step to the left.",
  },
  chevron_right: {
    variant: "nav",
    description:
      "Next item: inbox thread, stop row, modal drill-in, or calendar forward.",
  },
  close: {
    variant: "tool",
    description:
      "Dismisses overlays, clears search, stops live nav, or rejects a list row.",
  },
  confirmation_number: {
    variant: "security",
    description:
      "OTP, ticket code, or verification token fields on auth flows.",
  },
  content_copy: {
    variant: "tool",
    description: "Duplicate an existing saved trip as a new draft/plan.",
  },
  delete: {
    variant: "warning",
    description:
      "Removes a trip, stop, slot, or other destructive action (with confirmation where needed).",
  },
  directions_car: {
    variant: "transport",
    description: "Driving travel mode for map directions and live nav.",
  },
  directions_walk: {
    variant: "transport",
    description: "Walking travel mode for map directions and live nav.",
  },
  dynamic_feed: {
    variant: "discover",
    description:
      "Discover tab for the community feed and related “all posts” deep links.",
  },
  edit: {
    variant: "action",
    description:
      "Edits a trip, profile field, or AI plan slot depending on screen.",
  },
  error: {
    variant: "warning",
    description:
      "Inline validation failure (e.g. password mismatch, rule not met).",
  },
  error_outline: {
    variant: "warning",
    description:
      "Profile or form-level error banner icon (softer than solid error).",
  },
  event: {
    variant: "time",
    description:
      "Event listings, category chips, or hero placeholder for an event detail page.",
  },
  event_note: {
    variant: "time",
    description:
      "Planner/discover cards: notes an event- or itinerary-flavoured row.",
  },
  explore: {
    variant: "discover",
    description:
      "Generic exploration / compass-style themes in find-your-way and tour fallbacks.",
  },
  expand_less: {
    variant: "nav",
    description:
      "Collapse a section, shrink route details, or hide a peek panel.",
  },
  expand_more: {
    variant: "nav",
    description:
      "Expand menus, trip filters, or builder sections that are currently collapsed.",
  },
  family_restroom: {
    variant: "discover",
    description:
      "Family- and kid-friendly thematic row in find-your-way groupings.",
  },
  favorite: {
    variant: "favorite",
    description:
      "Like or favourite a place/post, or open the favourites area from the header.",
  },
  favorite_border: {
    variant: "favorite",
    description:
      "Not-yet-favourited: save button outline on cards, plan builder empty state, etc.",
  },
  filter_list: {
    variant: "tool",
    description:
      "Opens or denotes filtering UI (e.g. trip list filters on the plan page).",
  },
  fit_screen: {
    variant: "location",
    description:
      "Map control to fit all markers or the current route in the viewport.",
  },
  grid_view: {
    variant: "ui",
    description: "Switch spots/discover layouts to a grid of cards.",
  },
  hiking: {
    variant: "nature",
    description: "Activities hub outdoor / hiking category tile.",
  },
  hourglass_empty: {
    variant: "time",
    description: "Username check in progress on the registration form.",
  },
  key: {
    variant: "security",
    description:
      "Password field adornment on login, register, and reset flows.",
  },
  keyboard_arrow_down: {
    variant: "nav",
    description:
      "Expand live-nav instructions or scroll content downward on the map sheet.",
  },
  keyboard_arrow_up: {
    variant: "nav",
    description:
      "Peek handles and “drag up” affordances on the map live navigation UI.",
  },
  link: {
    variant: "communication",
    description: "Copy or share a directions/deep link from map route details.",
  },
  list: {
    variant: "ui",
    description:
      "Toggle map drawer to list mode when the sheet shows place rows.",
  },
  location_city: {
    variant: "location",
    description:
      "Placeholder when a Discover “proposal” pick has no custom thumbnail.",
  },
  location_on: {
    variant: "location",
    description:
      "Address line, map pin on detail cards, or “you are here” semantics.",
  },
  lock: {
    variant: "security",
    description: "Secured screens: login, register, forgot password headers.",
  },
  logout: {
    variant: "security",
    description: "Sign-out control on the profile screen.",
  },
  mail: {
    variant: "communication",
    description: "Email address inputs across auth screens.",
  },
  map: {
    variant: "location",
    description: "Opens the map for a place, trip, or global “view map” CTAs.",
  },
  mark_email_read: {
    variant: "communication",
    description: "Verify-email success and Discover message proposal CTA.",
  },
  movie: {
    variant: "media",
    description: "Discover tab icon for short reels/video feed.",
  },
  mosque: {
    variant: "discover",
    description:
      "AI planner mood chip for faith / spirituality themed itineraries.",
  },
  more_horiz: {
    variant: "ui",
    description: "Overflow menu on feed posts (more options).",
  },
  more_vert: {
    variant: "ui",
    description: "Step overflow menu on map route legs.",
  },
  museum: {
    variant: "discover",
    description: "AI planner mood for culture / museums.",
  },
  my_location: {
    variant: "location",
    description: "Recenter map on user location; live nav tracking status.",
  },
  navigation: {
    variant: "transport",
    description: "Start or headline turn-by-turn / live navigation on the map.",
  },
  open_in_new: {
    variant: "communication",
    description: "External event signup or partner link opening in a new tab.",
  },
  payments: {
    variant: "commerce",
    description: "Price or paid-event metadata on events/activities cards.",
  },
  person: {
    variant: "brand",
    description:
      "Generic user: nav avatar slot, reel attribution, comment author, etc.",
  },
  person_add: {
    variant: "brand",
    description: "Registration header: create a new account.",
  },
  phone_iphone: {
    variant: "brand",
    description: "iOS / App Store style download badge on marketing blocks.",
  },
  photo_camera: {
    variant: "media",
    description:
      "Change profile photo; community post thumbnail fallback for photos.",
  },
  photo_library: {
    variant: "media",
    description:
      "Place gallery: open full photo library / grid on place detail.",
  },
  pin_drop: {
    variant: "location",
    description: "Copy coordinates or emphasize map pin on place detail.",
  },
  place: {
    variant: "location",
    description:
      "Fallback image for generic place, map leg end, or empty state illustration.",
  },
  play_circle: {
    variant: "media",
    description: "Indicates a video post in the community feed preview.",
  },
  print: {
    variant: "tool",
    description: "Print-friendly view for place or tour detail.",
  },
  psychology: {
    variant: "ai",
    description: "Profile link toward AI trip planner.",
  },
  radio_button_unchecked: {
    variant: "ui",
    description: "Password or username rule not yet satisfied (empty circle).",
  },
  rate_review: {
    variant: "communication",
    description: "Reviews section label on place detail.",
  },
  remove: {
    variant: "warning",
    description: "Zoom out or decrease on map zoom controls.",
  },
  remove_circle_outline: {
    variant: "warning",
    description: "Remove one favourite from the favourites list.",
  },
  reply: {
    variant: "communication",
    description: "Reply-to-comment affordance on feed threads.",
  },
  restaurant: {
    variant: "commerce",
    description: "Food mood chip in AI planner and find-your-way food theme.",
  },
  route: {
    variant: "transport",
    description:
      "Route summary row: distance, path mode, or trip banner on map.",
  },
  schedule: {
    variant: "time",
    description: "Opening hours, slot time, or itinerary step time.",
  },
  search: {
    variant: "tool",
    description:
      "Global search, discover search, messages inbox search, spots filter.",
  },
  sell: {
    variant: "commerce",
    description: "Discover tab for offers/promotions.",
  },
  send: {
    variant: "communication",
    description: "Submit AI chat, post a comment, or proposals tab icon.",
  },
  share: {
    variant: "social",
    description:
      "Native share sheet / copy share URL for place, trip, event, tour.",
  },
  smartphone: {
    variant: "brand",
    description:
      "Open directions in the phone’s maps app from map route sheet.",
  },
  star: {
    variant: "favorite",
    description:
      "Numeric rating display on cards, detail, map drawer (not always interactive).",
  },
  storefront: {
    variant: "commerce",
    description:
      "Business listings, shop category in discover rows, souk mood in AI planner.",
  },
  touch_app: {
    variant: "ui",
    description: "Discover gating: tap to unlock region or interaction.",
  },
  travel_explore: {
    variant: "discover",
    description:
      "Exploration / compass flavour for empty slots and discover empties.",
  },
  trip_origin: {
    variant: "location",
    description: "First stop / origin marker in map route step list.",
  },
  tune: {
    variant: "tool",
    description: "AI planner preferences and place-discover filter/sort entry.",
  },
  verified: {
    variant: "status",
    description:
      "Blue-check style badge on verified business posts (visible to assistive tech when needed).",
  },
  verified_user: {
    variant: "security",
    description: "Footer trust / secure connection badge on auth screens.",
  },
  vertical_align_top: {
    variant: "nav",
    description:
      "Scroll-to-top for the AI plan draft when editing long itineraries.",
  },
  view_list: {
    variant: "ui",
    description: "List layout toggle for spots/discover views.",
  },
  visibility: {
    variant: "security",
    description: "Show plaintext password or sensitive field.",
  },
  visibility_off: {
    variant: "security",
    description: "Hide password or obscure sensitive field.",
  },
  volume_off: {
    variant: "media",
    description: "Reel muted state toggle.",
  },
  volume_up: {
    variant: "media",
    description: "Reel unmuted / sound on state.",
  },
  waves: {
    variant: "nature",
    description: "Seafront / coastal theme in find-your-way groupings.",
  },
};

function inferVariant(name) {
  if (name === "list") return "nav";
  if (
    /arrow|chevron|keyboard_arrow|expand_|vertical_align|trip_origin/u.test(
      name,
    )
  )
    return "nav";
  if (/favorite|bookmark|^star$|verified(?!_user)/u.test(name))
    return "favorite";
  if (/location|map|place|pin|fit_screen|my_location/u.test(name))
    return "location";
  if (/time|calendar|schedule|hourglass|event/u.test(name)) return "time";
  if (/error|delete|remove|warning/u.test(name)) return "warning";
  if (/photo|image|volume|play|movie|camera|library/u.test(name))
    return "media";
  if (/share|reply|chat|mail|send|mark_email|link|open_in_new/u.test(name))
    return "social";
  if (/car|walk|route|navigation/u.test(name)) return "transport";
  if (
    /lock|key|shield|verified_user|confirmation|visibility|logout|admin/u.test(
      name,
    )
  )
    return "security";
  if (/person|account|android|phone_iphone|smartphone/u.test(name))
    return "brand";
  if (/sell|payments|restaurant|storefront/u.test(name)) return "commerce";
  if (
    /search|filter|tune|print|grid_view|view_list|more_|content_copy|check(?!_)|radio/u.test(
      name,
    )
  )
    return "tool";
  if (
    /hiking|celebration|waves|family_restroom|explore|museum|mosque|travel|feed|dynamic|touch_app|account_balance/u.test(
      name,
    )
  )
    return "discover";
  if (/auto_awesome|psychology/u.test(name)) return "ai";
  return "ui";
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
  };
}
