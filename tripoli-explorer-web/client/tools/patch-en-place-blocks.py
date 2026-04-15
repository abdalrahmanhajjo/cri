import pathlib

p = pathlib.Path(__file__).resolve().parent.parent / "src" / "i18n" / "translations.js"
s = p.read_text(encoding="utf-8")
start = s.index("      exploreDining:")
end = s.index("    business:", start)
new = """      exploreDining: 'Explore dining options',
      exploreHotels: 'Browse hotels and stays',
      experienceTitle: 'Deep discovery, on your terms',
      experienceLead:
        'Search and categories span culture, food, stays, and neighbourhood corners — jump between themes and save favourites as you go.',
      experienceCol1Title: 'Every angle',
      experienceCol1Body:
        'Filter the full directory or wander category by category — each card opens rich detail, map, and trip actions.',
      experienceCol2Title: 'Map when you need it',
      experienceCol2Body:
        'Open the map from any place for context, or use Dining and Stays in the nav when you want a shorter, focused list.',
      experienceCol3Title: 'Plan around your days',
      experienceCol3Body:
        'Add stops to trips with day and time — the same planner you use elsewhere keeps everything coherent.',
      sponsoredStripTitle: 'Partner spotlight',
      sponsoredStripLead:
        'These listings support Tripoli Explorer — explore them like any other place; sponsorship stays visible by design.',
    },
    diningGuide: {
      eyebrow: 'Eat & drink',
      title: 'Restaurants & cafés',
      subtitle:
        'Cafés, sweets, seafood, and classics — curated from the same food theme as our home map. Search, filter by style, then open a place or add it to your trip.',
      searchLabel: 'Search dining listings',
      topPicksTitle: 'Top picks',
      topPicksSub: 'Highest rated in your current filters',
      sponsoredKicker: 'Featured partners',
      categoryFilterLabel: 'Style',
      allStyles: 'All styles',
      sortLabel: 'Sort',
      mainCollectionTitle: 'All dining spots',
      browseDiscover: 'Full places directory',
      openFilters: 'Filters & sort',
      dockLabel: 'Dining shortcuts',
      resultsSr: 'Dining results',
      heroMapCta: 'View map',
      experienceTitle: 'A fuller taste of Tripoli',
      experienceLead:
        'Search and filters are just the start — plan meals on the map, open full place pages for menus and hours, and add stops to your itinerary.',
      experienceCol1Title: 'Start on the map',
      experienceCol1Body:
        'See cafés, sweets, and kitchens in context with the rest of the city — then open a place for photos, hours, and contact.',
      experienceCol2Title: 'Styles that match the meal',
      experienceCol2Body:
        'Filter by category for the vibe you want — from quick bites to long tables — and let ratings help you decide.',
      experienceCol3Title: 'Build your trip',
      experienceCol3Body:
        'Add restaurants to a day in your plan so the best tables are not an afterthought — reorder whenever you like.',
      sponsoredSectionLead: 'Featured listings — clearly marked. Open them like any other place.',
      flowSectionLabel: 'Quick filters',
      flowTitle: 'What do you need?',
      flowLead:
        'Use one filter to narrow the list. Each venue still has its own page — call, menu, offers, and trips.',
      flowLabel_all: 'All dining',
      flowHint_all: 'Full list with your search and filters',
      flowLabel_reserve: 'Book a table',
      flowHint_reserve: 'Places that accept reservations',
      flowLabel_order: 'Order ahead',
      flowHint_order: 'Delivery or takeaway where listed',
      flowLabel_menu: 'Menus & set meals',
      flowHint_menu: 'Listings with a menu or set-meal note',
      flowLabel_offers: 'Deals & specials',
      flowHint_offers: 'Keywords like offers, specials, or promos in the listing',
      flowEmpty:
        'No places match this step with your current search. Clear the search or try another step.',
      cardQuickGroupLabel: 'Quick actions for this place',
      cardActionBook: 'Book',
      cardActionOrder: 'Order',
      cardActionMenu: 'Menu',
      cardActionOffers: 'Offers',
    },
    hotelGuide: {
      eyebrow: 'Stay',
      title: 'Tripoli hotels & stays',
      subtitle:
        'A separate guide from dining and the main directory: hotels, guesthouses and sleep-focused listings only. Filter, compare, then open details or add to your trip.',
      topPicksTitle: 'Guest favourites',
      topPicksSub: 'Best-rated with your current search and filters',
      sponsoredKicker: 'Featured stays',
      categoryFilterLabel: 'Type of stay',
      allStyles: 'All',
      sortLabel: 'Sort',
      mainCollectionTitle: 'All accommodation listings',
      browseDiscover: 'Full places directory',
      openFilters: 'Filters & sort',
      dockLabel: 'Stay shortcuts',
      resultsSr: 'Hotel results',
      heroMapCta: 'View map',
      experienceTitle: 'Stay with confidence',
      experienceLead:
        'Dedicated stay listings, honest filters, and trip planning so your nights match your days in Tripoli.',
      experienceCol1Title: 'Plot your base',
      experienceCol1Body:
        'See your hotel beside sights and dining — move between this guide and the city map whenever you need.',
      experienceCol2Title: 'Find your kind of stay',
      experienceCol2Body:
        'Guesthouses, hotels, and sleep-focused spots only — filter by type until the short list feels right.',
      experienceCol3Title: 'Nights that fit the plan',
      experienceCol3Body:
        'Add stays to your trip with day and time — the same planner keeps hotels, meals, and sights aligned.',
      sponsoredSectionLead: 'Featured stays — clearly marked. Open them like any other place.',
    },
"""
p.write_text(s[:start] + new + s[end:], encoding="utf-8")
print("patched", start, end)
