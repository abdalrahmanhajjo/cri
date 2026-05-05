# Client Discovery, Community, Map, and Profile Module Report

This document describes the client-side Discovery, Community, Map, and Profile parts of the Visit Tripoli web application. It explains the purpose of each module, the main files, and the important functions used in the frontend.

## Module Overview

These client modules allow users to:

- browse and search Tripoli places
- filter places by category and sort mode
- save favourite places
- add places to trip plans
- view community posts, reels, offers, and proposals
- create community posts or reels
- interact with posts through likes, saves, comments, and shares
- use the interactive map with place markers, route directions, nearby sorting, and live navigation
- manage profile information, avatar, preferences, and password

The frontend is built with React and uses shared API helpers to communicate with the backend.

## Main Client Files

`client/src/pages/PlaceDiscover.jsx`

Handles the public places discovery page at `/discover`. It loads places and categories, supports search and filtering, displays place cards, handles favourites, opens places on the map, and allows logged-in users to add places to a trip.

`client/src/pages/Discover.jsx`

Handles the community hub at `/community` and venue-specific community feeds at `/community/place/:placeId`. It manages feed posts, reels, offers, and proposals.

`client/src/pages/CommunityCreate.jsx`

Handles the protected page where logged-in users create community posts or reels.

`client/src/components/FeedPostCard.jsx`

Displays one community post or reel and manages post interactions such as likes, saves, comments, owner edits, and delete actions.

`client/src/components/OfferCard.jsx`

Displays public offers and redeemable coupons.

`client/src/pages/Map.jsx`

Handles the protected interactive map at `/map`. It loads Google Maps, displays place markers, supports trip routes, directions, nearby sorting, and live navigation.

`client/src/pages/Profile.jsx`

Handles the protected profile page at `/profile`. It allows users to update personal information, upload an avatar, change password, set preferences, and sign out.

`client/src/api/content.js`

Contains API functions for places, categories, tours, events, promotions, reviews, check-ins, and inquiries.

`client/src/api/social.js`

Contains API functions for community feed posts, comments, likes, and saves.

`client/src/api/user.js`

Contains authenticated user API functions for profile, avatar upload, password change, feed creation, trips, inquiries, and favourites.

`client/src/context/FavouritesContext.jsx`

Stores saved place IDs and provides favourite toggle logic across the app.

`client/src/components/GlobalSearchBar.jsx`

Provides a reusable place search box used by discovery and map flows.

## Routing

The relevant routes are defined in `client/src/App.jsx`.

### `/discover`

This route opens `PlaceDiscover.jsx`. It is public, so users can browse places without signing in.

### `/community`

This route opens `Discover.jsx`. It is public and shows the full community hub.

### `/community/place/:placeId`

This route also opens `Discover.jsx`, but scoped to one place. It shows posts, reels, offers, and proposals connected to a specific venue.

### `/community/create`

This route opens `CommunityCreate.jsx`. It is protected, so users must be logged in before creating community content.

### `/map`

This route opens `Map.jsx`. It is protected because it supports personalized map and trip features.

### `/profile`

This route opens `Profile.jsx`. It is protected because it displays and updates account data.

## Discovery API Functions

### `places.list(params)`

This function loads the list of public places. The discovery page uses it to display place cards, while the map page uses it to create map markers.

The function accepts parameters such as language and converts them into a query string before sending a request to `/api/places`.

### `places.get(id, opts)`

This function loads one place by ID. It is used by the map when a trip contains only specific place IDs and by the community page when it displays a venue-scoped feed.

### `categories.list(params)`

This function loads place categories. The discovery page uses categories for filtering, and the map uses them to remove dedicated guide listings from the general map list.

### `publicPromotions(params)`

This function loads public offers and promotions shown in the community offers tab.

## Place Discovery Page

The Place Discovery page is the main directory for browsing public places in Tripoli. It combines search, filters, sorting, favourites, map links, and trip planning actions.

### `formatTripRange(trip, locale)`

Formats a trip start and end date into a readable range. It is used in the add-to-trip modal so the user can understand which trip they are selecting.

### `normalizeHm(value)`

Normalizes time input into `HH:mm` format. It validates hours and minutes before a place is added to a trip schedule.

### `resolveDiscoverPlaceId(place)`

Returns a stable place ID from different possible fields such as `id`, `place_id`, or `placeId`. This protects favourites, trips, map actions, and detail links from missing or inconsistent API field names.

### `DiscoverCard`

Displays a single place in the discovery list. It shows the image, name, location, rating, details link, favourite button, add-to-trip button, and map button.

The card supports both grid and list display modes.

### `getDefaultDiscoverViewMode()`

Chooses the default layout for discovery cards. Desktop starts in grid mode, while smaller screens start in list mode.

### `PlaceDiscover`

This is the main discovery page component. It manages all state and behavior for loading places, filtering results, switching view modes, and handling user actions.

### `showToast(message, kind)`

Displays a short local message on the discovery page. It is used after actions such as adding or removing favourites and adding a place to a trip.

### Search Query Sync

The page keeps the search input synchronized with the URL query parameter `q`. This means a search can be shared as a link, for example `/discover?q=souk`.

The search is debounced before changing the URL so it does not update on every keystroke immediately.

### Places and Categories Loading

The page loads places and categories together. Places are displayed as discovery cards, and categories are used for category filtering and guide exclusions.

### `filteredPlaces`

This computed value prepares the final list shown to the user. It:

- removes hidden or guide-specific listings
- applies category filters
- applies search filtering
- applies sorting by recommended, rating, or name

### `setParam(key, value)`

Updates a filter or sort value in the URL. This keeps the discovery page state shareable and browser-friendly.

### `handleViewOnMap(place)`

Opens the selected place on the map. If the user is not logged in, it redirects to login and remembers the current discovery page.

When the user is logged in, it navigates to `/map` and passes the selected place ID through route state.

### `openAddToTrip(place)`

Opens the add-to-trip modal for a selected place. If the user is not logged in, it redirects to login first.

### `toggleFavourite(place)`

Adds or removes a place from the user's favourites. It uses `FavouritesContext` for optimistic updates and shows feedback messages after success or failure.

### `closeTripModal()`

Closes the add-to-trip modal and resets the modal state.

### `selectedTrip`

Finds the currently selected trip in the modal based on the selected trip ID.

### `filteredTripOptions`

Filters the user's trips inside the add-to-trip modal. This helps the user find the correct trip when they have many saved trips.

### `liveTripValidationError`

Checks whether the selected place can be added to the selected trip day and time. It validates:

- a trip is selected
- start and end times exist
- end time is after start time
- the place is not already in that day
- the new slot does not overlap another slot

### `addPlaceToTrip()`

Adds the selected place to the selected trip day. It builds the updated trip day payload and sends it to the backend with `api.user.updateTrip`.

If the update succeeds, the modal closes and the user sees a success message.

## Favourites Context

`FavouritesContext.jsx` gives the app a single source of truth for saved place IDs.

### `refreshFavourites(options)`

Loads the user's favourite place IDs from the backend. It uses `AbortController` so old requests do not overwrite newer results.

### `isFavourite(placeId)`

Checks whether a place ID is currently saved by the user.

### `isBusy(placeId)`

Checks whether a favourite action is already in progress for a place.

### `toggleFavourite(placeId)`

Performs an optimistic favourite toggle. The UI updates immediately, then the backend request is sent.

If the request succeeds, the context refreshes favourites. If the request fails, the UI rolls back to the previous state.

The context also keeps a short local deleted list so recently removed favourites do not reappear because of delayed backend responses.

## Community API Functions

### `communityFeed(params)`

Loads public community posts or reels from `/api/feed`. It supports query parameters such as format, limit, offset, sort, and place ID.

### `feedPublic.post(postId)`

Loads a single feed post by ID. This is used for deep links such as `#feed-post-123`.

### `feedPublic.comments(postId)`

Loads comments for a post.

### `feedPublic.addComment(postId, bodyOrPayload)`

Adds a comment or reply to a post.

### `feedPublic.toggleLike(postId)`

Toggles like status for a post.

### `feedPublic.toggleSave(postId)`

Toggles saved status for a post.

### `feedPublic.toggleCommentLike(postId, commentId)`

Toggles like status for a comment.

### `feedPublic.updateComment(postId, commentId, body)`

Updates an existing comment.

### `feedPublic.deleteComment(postId, commentId)`

Deletes a comment.

### `user.feed.create(body)`

Creates a new community post or reel for a logged-in user.

### `user.feed.update(id, body)`

Updates an existing post owned or managed by the current user.

### `user.feed.delete(id)`

Deletes a post owned or managed by the current user.

### `user.feed.upload(file, placeId, options)`

Uploads an image or video for a community post or reel.

### `user.feed.placeSearch(q, opts)`

Searches places that can be linked to a community post.

## Community Hub Page

The community hub has four tabs:

- Feed
- Reels
- Offers
- Proposals

It can show either all community content or content scoped to a specific place.

### `loadSeenIds(key)`

Loads a list of seen post IDs from local storage. This allows the app to put unseen posts before already seen posts.

### `DiscoverSkeleton`

Displays loading placeholders that match the selected tab.

### `discoverFetchError(err, t)`

Converts API errors into user-friendly messages. Network errors use the translated network error message.

### `DiscoverProposalPanel`

Manages the proposals tab. It allows users or guests to choose a venue, enter contact details, send a message or offer, and check for venue replies.

### `phoneOk()`

Validates that the phone number contains enough digits before a proposal is submitted.

### `onSubmit(e)`

Submits a proposal or inquiry to the selected venue. Logged-in users send a simpler payload because their account already identifies them. Guests must provide name, email, and phone number.

### `checkVenueReply()`

Checks whether a venue has replied to a submitted inquiry. Guests must provide the same email used when the inquiry was sent.

### `DiscoverEmpty`

Displays an empty state with navigation links when a tab has no content.

### `Discover`

This is the main community hub component. It manages tabs, loading state, feed posts, reels, offers, proposals, seen posts, and venue-specific feed state.

### `patchFeedPost(id, patch)` and `patchReelPost(id, patch)`

Update one post in local state after actions such as like, save, edit, or comment count changes.

### `removeFeedPost(id)` and `removeReelPost(id)`

Remove deleted posts from local state.

### `markFeedSeen(id)` and `markReelSeen(id)`

Mark posts as seen when they become visible in the viewport. The IDs are saved in local storage.

### `orderedFeedPosts` and `orderedReels`

Move unseen posts before seen posts. This improves the browsing experience by showing fresh content first.

### `loadMoreFeed()`

Loads the next page of regular feed posts. It prevents duplicate posts and updates pagination state.

### `loadMoreReels()`

Loads the next page of reels. It works like feed pagination but uses reel format and a separate offset.

### Business Studio Detection

The community page calls `api.business.me()` for logged-in users. If the user owns places, the page can show a business studio link.

### Deep Link Handling

The page supports URLs with hashes such as `#feed-post-123`. If the post is already loaded, the page scrolls to it. If it is not loaded, the page fetches that post and opens the correct tab.

### Offers Loading

When the Offers tab is active, the page loads public promotions. If the page is venue-scoped, it filters offers to the current place.

### Redeemed Offer Loading

When a logged-in user opens the Offers tab, the page loads already redeemed promotion IDs so redeemed coupons can show the correct state.

### Proposals Loading

When the Proposals tab is active, the page loads either the current place or a list of available places. The proposal form then uses that list for venue selection.

### Infinite Scroll

The feed and reels tabs use `IntersectionObserver` sentinels to load more content automatically when the user scrolls near the bottom.

### Active Reel Detection

The reels tab tracks which reel is closest to the center of the viewport. That active reel receives playback focus through `FeedPostCard`.

## Feed Post Card

`FeedPostCard.jsx` is responsible for rendering and managing a single community post or reel.

### `mediaUrl(url)`

Normalizes media URLs and fixes old malformed image extensions.

### `nestComments(list)`

Groups a flat comment list into root comments and one level of replies.

### `removeCommentAndReplies(comments, deletedId)`

Removes a comment and its direct replies from local comment state.

### `commentLooksEdited(c)`

Checks whether a comment was edited by comparing `updatedAt` and `createdAt`.

### `formatCompactCount(n)`

Formats large like and comment counts, for example `1200` becomes `1.2K`.

### `contentKind(t)`

Normalizes the post type into either `post` or `reel`.

### `loadComments()`

Loads comments for the post and stores them locally.

### `openComments()` and `toggleComments()`

Open or toggle the comments panel. Comments are loaded the first time the panel opens.

### `requireAuth()`

Checks whether the user is logged in before allowing actions such as like, save, comment, or owner edit. If the user is not logged in, it redirects to `/login`.

### `showFeedActionError(e)`

Converts feed action errors into readable messages, including authentication errors, hidden likes, disabled comments, blocked accounts, and network errors.

### `handleLike()`

Optimistically toggles post like status. The UI updates immediately, then the backend confirms the change.

### `handleSave()`

Toggles saved status for a post.

### `handleShare()`

Uses the browser share API when available. If sharing is unavailable, it falls back to copying the post link.

### `handleToggleCommentLike(commentId)`

Optimistically toggles a like on a comment.

### `handlePostComment(e)`

Adds a new comment or reply to the post. It updates local comments and comment counts after success.

### `updateComment(commentId)`

Updates a user's existing comment.

### `deleteComment(commentId)`

Deletes a comment and removes it from local state.

### Owner Edit Functions

The card supports owner or manager editing when `i_manage_post` is true. The edit flow can update captions, images, videos, and advanced media URLs.

### Owner Delete Function

The owner delete flow calls `api.user.feed.delete` and removes the post from the community list after success.

## Community Create Page

`CommunityCreate.jsx` allows logged-in users to create a post or reel.

### `parseCommaList(s)`

Converts comma, semicolon, or newline-separated text into a clean array.

### `parseTaggedIds(s)`

Parses tagged user IDs and limits the result to 40 entries.

### `placeSearch` Flow

The page searches places as the user types. It waits briefly before calling `api.user.feed.placeSearch`, which avoids sending a request for every keypress.

### `pickPlace(p)`

Sets the selected place for the post and stores display information about the chosen venue.

### `toggleStickerPick(emoji)`

Adds or removes a sticker from the selected sticker list.

### `onPickFile(file)`

Uploads the selected image or video. It requires a linked place first because uploaded media is connected to a place.

### `useMyLocation()`

Uses browser geolocation to attach location coordinates to the post metadata.

### `onSubmit(e)`

Validates the selected place, caption, and media. It then builds the post payload and calls `api.user.feed.create`.

After success, the user is redirected back to the community hub and the new post is opened through a hash link.

## Offer Card

`OfferCard.jsx` displays offers and coupons in the community Offers tab.

### `isCouponItem(item)`

Checks whether an offer ID represents a coupon.

### `isPlacePromoItem(item)`

Checks whether an offer ID represents a place promotion.

### `isRedeemableOffer(item)`

Checks whether the offer can be redeemed with a code.

### `formatOfferDate(iso, lang)`

Formats offer start and end dates for the selected language.

### `formatOfferAmount(n, lang)`

Formats discount amounts using localized number formatting.

### `resolveCouponTitle`, `resolveCouponSubtitle`, `resolveCouponDiscountLabel`, and `resolveCouponTerms`

Build display text for coupons when the backend provides raw coupon fields.

### `offerValidityText`

Creates the valid-from or valid-until line shown on an offer.

### `handleRedeem(e)`

Submits a coupon or promotion code to the backend. If redemption succeeds, the card shows a redeemed state and may start a checkout countdown window.

## Global Search Bar

`GlobalSearchBar.jsx` is a reusable place search component.

### `updateQuery(next)`

Updates the search query either internally or through a controlled parent component.

### Places Loading

The component loads places for the current language and stores them for suggestions.

### `suggestions`

Filters places using `filterPlacesByQuery` and limits the result to eight suggestions.

### `goPlace(p)`

Navigates directly to a place detail page.

### `pickPlace(p)`

Selects a place. If the parent passed `onSelectPlace`, it calls that custom behavior. Otherwise, it navigates to the place detail page.

### `goDiscoverAll()`

Navigates to `/discover` with the current search query.

### `onKeyDown(e)`

Handles keyboard interaction. Escape closes the panel, and Enter selects the first suggestion or opens discovery search results.

## Map Page

The Map page provides a full interactive Google Maps experience for logged-in users. It supports normal browsing, trip-specific maps, single-place directions, event coordinate focus, nearby sorting, route sharing, and live navigation.

### Map Constants

The page defines constants for Tripoli center coordinates, zoom levels, marker fitting padding, Google Places concurrency, route modes, and live navigation refresh thresholds.

### `formatMapDistanceM(meters)`

Formats distance for nearby lists.

### `haversineMeters(a, b)`

Calculates straight-line distance between two latitude and longitude points. It is used for nearby sorting.

### `isLikelySafari()` and `isIosDevice()`

Detect browser and device conditions for Safari/iOS-specific live navigation handling.

### `getTurnIcon(instrHtml)`

Chooses a visual icon for a route instruction, such as left turn, right turn, roundabout, or destination.

### `getCurrentPositionAsync(options)`

Wraps browser geolocation in a Promise.

### `getCurrentPositionWithSafariFallback()`

Attempts high-accuracy geolocation first, then falls back to less strict options for Safari.

### `getFirstWatchPosition(options, timeoutMs)`

Uses `watchPosition` to get the first available location fix. This is useful when `getCurrentPosition` fails but location tracking still works.

### `isPermissionDeniedError(err)`

Checks whether a geolocation error means the user denied location permission.

### `stripHtml(html)`

Removes HTML from Google route instructions.

### `formatRouteDuration(seconds)` and `formatRouteDistance(meters)`

Format route summary values for display.

### `buildChromeAppUrl(url)`

Converts a normal web URL into a Chrome app URL for iOS handoff.

### `buildChromeMapHandoffUrl(options)`

Builds a map URL that can pass trip IDs, travel mode, handoff code, and auto-start options to another browser session.

### `getDateForDayLabel(startDate, dayIndex)`

Formats a trip day label for map trip views.

### `reorderRoutesByFastestTraffic(directionsResult, isDriving)`

When Google returns multiple driving routes, this function puts the fastest traffic-aware route first.

### `getRouteSummary(directionsResult)`

Extracts total duration, distance, and turn-by-turn steps from a Google Directions result.

### `findPlaceFromText(query, apiKey)`

Searches Google Places for a place using text.

### `getPlaceDetails(placeId, apiKey)`

Loads Google Places details such as coordinates, rating, address, phone, website, opening hours, and photo reference.

### `placePhotoUrl(photoReference, apiKey, maxWidth)`

Builds a Google Places photo URL.

### `escapeHtml(s)`

Escapes text before inserting it into Google Maps info window HTML.

### `MapPage`

The main map component. It manages place loading, Google Maps setup, markers, route state, nearby sorting, live navigation, user location, trip filtering, map drawer state, and map onboarding.

### Handoff Session Consumption

The map reads a `handoff` query parameter and calls `api.auth.consumeChromeHandoff`. If the backend returns a session, the map applies it with `applySession`.

This supports moving a map session from Safari to Chrome on iOS.

### Trip and Query Loading

The map can load:

- a full public place list
- a list of specific trip place IDs from route state
- trip IDs from the query string
- a coordinate focus from navigation state
- a search query from the URL

### Catalog Loading for Add Stop

When the user adds a stop to a trip from the map, the map loads the full place catalog if it has not already been fetched.

### Google Place Data Enrichment

The map enriches local place data with Google Places data when coordinates or extra details are missing. It limits concurrent Google requests to avoid overloading the browser and API.

### `withCoords`

Combines local place coordinates and Google-enriched coordinates into one list of places that can be displayed on the map.

### `currentDayPlaceIds`

Returns the place IDs for the currently selected trip day.

### `mapDisplayPlaces`

Builds the list of places displayed on the map. In trip mode, places follow the trip waypoint order.

### `placesInTripOrder`

Returns trip places with coordinates in the correct route order.

### `mapBrowseMarkers`

Applies map search filtering to the marker list. If there is no query, all display places are shown.

### `markersVisibleOnMap`

Controls which markers are visible. On mobile drawer views, it may show only the selected marker to reduce clutter.

### `nearbyAnchoredList`

Sorts places by distance from:

- the user's current location
- a selected place
- the nearest trip stop

### `swipeDeckPlaces`

Builds the ordered place list used by the mobile swipe deck.

### `commitAddStop(rawId)`

Adds a place to the current trip map state. It updates route state and keeps trip days synchronized.

### `handleCopyRouteLink()`

Copies the current map URL to the clipboard.

### `handleSendToPhone()`

Uses the browser share API or clipboard fallback to share the current map route.

### `handleOpenInChrome()`

Creates a Chrome handoff code and redirects iOS Safari users to Chrome with the same trip route.

### `focusMapOnPlace(place, maps, map, infoWindow)`

Centers the map on a place, zooms in, and opens its info window.

### `handlePlaceSelect(place, opts)`

Handles selection from the map drawer or search results. In add-stop mode, it adds the stop. Otherwise, it selects and focuses the place.

### `handleMapSearchPick(p)`

Connects search results to map selection.

### Info Window Action Handler

The map listens for clicks inside Google Maps info window HTML. It handles "view details" links and "directions" actions.

### Google Maps Setup Effect

The map loads the Google Maps script, creates the map, creates the info window, builds markers, adds marker click handlers, and fits map bounds.

### Event or Deep-Link Focus Marker

The map can show a temporary marker for coordinates that are not part of the place directory, such as an event location.

### `triggerMapResize()`

Forces Google Maps to recalculate layout when panels open, close, or resize.

### Route Drawing Effect

When a trip is active, the map builds a Google Directions request. It supports walking and driving only. In live navigation mode, the origin becomes the user's current location.

### `handleNearbyModeAll()`

Resets nearby sorting to normal list order.

### `handleNearbyModeMe()`

Requests the user's location and sorts places by distance from the user.

### `handleNearbyModePlace()`

Sorts places by distance from the selected place.

### `handleNearbyModeTrip()`

Sorts places by distance from the nearest trip stop.

### `handleMyLocation()`

Centers the map on the user's current location.

### `startLiveNavigation()`

Requests location permission, gets the first location fix, starts live navigation, and triggers route refresh.

### Auto-Start Live Navigation

If the URL contains `autostart=1`, the map starts live navigation automatically when trip data is ready.

### `handleDirections(place)`

Converts one place into a one-stop map trip and opens directions for it.

### `stopLiveNavigation()`

Stops live navigation, clears live-navigation state, and refreshes the route.

### One-Time Trip Location Fix

When a trip map opens, the page tries to get the user's location once. This helps show directions immediately, especially for one-stop trips.

### Live Navigation Watch

During live navigation, the map watches the user's position. It updates the user marker and refreshes the route when enough time passes or the user moves enough distance.

### `handleZoomToFit()`

Fits the map viewport around all visible markers.

### `handleShowAllPlaces()`

Resets the map back to the full place list.

### `dismissMapOnboarding()`

Hides the map onboarding message and saves the choice in local storage.

### `MapDrawerSwipeDeck`

Displays a mobile-friendly one-place-at-a-time drawer. It supports keyboard and pointer swipe navigation between places.

### `buildInfoContent(p, apiKey, strings, isDark)`

Builds the HTML content for a Google Maps info window. It includes place name, address, image, rating, open status, and action links.

## Profile API Functions

### `user.profile()`

Loads the current user's profile.

### `user.updateProfile(data)`

Updates the user's editable profile fields and preferences.

### `user.uploadAvatar(file)`

Uploads a profile avatar using `FormData` instead of JSON.

### `user.changePassword(currentPassword, newPassword)`

Changes the current user's password.

## Profile Page

The Profile page lets a logged-in user manage account information and security settings.

### `formatMemberSince(date, locale)`

Formats the account creation date as both a full date and a short month/year label.

### `formatProfileId(id)`

Shortens long profile IDs for display.

### `Profile`

The main profile page component. It loads profile data, stores editable fields, handles avatar upload, handles profile updates, handles password changes, and signs the user out.

### Profile Loading

When the page opens, it calls `api.user.profile()`. The returned data fills the profile form fields, preferences, avatar, and account summary.

### `handleSaveProfile(e)`

Saves editable profile fields:

- name
- bio
- city
- analytics preference
- tips preference

After saving, it calls `refreshUser()` so the global auth user state matches the updated profile.

### `handleAvatarPick(file)`

Uploads a selected avatar image. If upload succeeds, it updates the profile avatar and refreshes the global user state.

### `handleChangePassword(e)`

Validates the current password, new password rules, and password confirmation. If valid, it calls `api.user.changePassword`.

After success, it clears the password fields and shows a success message.

### `quickLinks`

Provides shortcut links to planning, trips, favourites, and messages.

### HCI Settings Panel

The profile page includes `HciSettingsPanel`, which provides user-facing interaction or usability preference settings.

### Logout Button

The account section calls `logout()` from `AuthContext` to clear the session and sign the user out.

## Security and Validation Notes

### Protected Client Routes

`/map`, `/profile`, `/community/create`, `/trips`, `/favourites`, and `/messages` are protected by `ProtectedRoute`.

If a user is not logged in, they are redirected to `/login`, and the app remembers the page they were trying to open.

### Client Validation

The client validates form input for user experience, such as:

- trip time ranges
- password strength
- phone number format
- required proposal fields
- required community post place, caption, and media

The backend must still validate all data because client-side checks can be bypassed.

### Auth Required Actions

Actions such as favouriting, adding to a trip, creating posts, liking posts, saving posts, commenting, map access, and profile editing require authentication.

### Local Storage

The client uses local storage for:

- seen feed and reel IDs
- map onboarding dismissed state
- recently deleted favourites
- authentication token and user data through the auth system

### Geolocation

The map uses browser geolocation for nearby sorting, "my location", and live navigation. It handles unsupported browsers, denied permissions, insecure contexts, and Safari-specific fallback behavior.

### Optimistic Updates

Favourites, likes, saves, and comment likes use optimistic updates. The UI changes immediately, then rolls back if the backend request fails.

## Summary

The Discovery, Community, Map, and Profile modules form the main interactive client experience of Visit Tripoli. Discovery helps users find places and build trips. Community provides feeds, reels, offers, proposals, and post creation. Map gives logged-in users a full Google Maps experience with trip routes and live navigation. Profile allows users to manage personal data, preferences, avatar, security, and logout.

Together, these modules connect public tourism browsing with authenticated user features such as saved places, trip planning, community participation, navigation, and account management.
