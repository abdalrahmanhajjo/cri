const { translatePlaceFields } = require('../../utils/translation');
const { getCollection } = require('../../mongo');

/**
 * Automatically translates a place document into Arabic and French.
 */
async function autoTranslatePlace(placeId, rawData) {
  try {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) return;

    console.log(`[Auto-Translate] Starting for place ${placeId}...`);
    
    // Fields to translate
    const fieldsToTranslate = {
      name: rawData.name,
      description: rawData.description,
      location: rawData.location,
      category: rawData.category,
      duration: rawData.duration,
      price: rawData.price,
      best_time: rawData.best_time || rawData.bestTime
    };

    // Filter out empty fields
    const filteredFields = {};
    for (const [k, v] of Object.entries(fieldsToTranslate)) {
      if (v) filteredFields[k] = v;
    }

    if (Object.keys(filteredFields).length === 0) return;

    // Translate to Arabic
    const arTrans = await translatePlaceFields(filteredFields, 'ar');
    // Translate to French
    const frTrans = await translatePlaceFields(filteredFields, 'fr');

    if (!arTrans && !frTrans) return;

    const translations = {};
    if (arTrans) translations.ar = arTrans;
    if (frTrans) translations.fr = frTrans;

    const placesColl = await getCollection('places');
    await placesColl.updateOne(
      { id: placeId },
      { $set: { translations } }
    );

    console.log(`[Auto-Translate] Success for place ${placeId}`);
  } catch (err) {
    console.error(`[Auto-Translate] Failed for place ${placeId}:`, err.message);
  }
}

/**
 * Automatically translates an event document.
 */
async function autoTranslateEvent(eventId, rawData) {
  try {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) return;

    console.log(`[Auto-Translate] Starting for event ${eventId}...`);
    
    const fieldsToTranslate = {
      name: rawData.name,
      description: rawData.description,
      location: rawData.location,
      category: rawData.category,
      organizer: rawData.organizer,
      price_display: rawData.price_display || rawData.priceDisplay
    };

    const filteredFields = {};
    for (const [k, v] of Object.entries(fieldsToTranslate)) {
      if (v) filteredFields[k] = v;
    }

    const arTrans = await translatePlaceFields(filteredFields, 'ar');
    const frTrans = await translatePlaceFields(filteredFields, 'fr');

    if (!arTrans && !frTrans) return;

    const translations = {};
    if (arTrans) translations.ar = arTrans;
    if (frTrans) translations.fr = frTrans;

    const eventsColl = await getCollection('events');
    await eventsColl.updateOne(
      { id: eventId },
      { $set: { translations } }
    );

    console.log(`[Auto-Translate] Success for event ${eventId}`);
  } catch (err) {
    console.error(`[Auto-Translate] Failed for event ${eventId}:`, err.message);
  }
}

/**
 * Automatically translates a tour document.
 */
async function autoTranslateTour(tourId, rawData) {
  try {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) return;

    console.log(`[Auto-Translate] Starting for tour ${tourId}...`);
    
    const fieldsToTranslate = {
      name: rawData.name,
      description: rawData.description,
      itinerary: rawData.itinerary,
      duration: rawData.duration,
      price_display: rawData.price_display || rawData.priceDisplay
    };

    const filteredFields = {};
    for (const [k, v] of Object.entries(fieldsToTranslate)) {
      if (v) filteredFields[k] = v;
    }

    const arTrans = await translatePlaceFields(filteredFields, 'ar');
    const frTrans = await translatePlaceFields(filteredFields, 'fr');

    if (!arTrans && !frTrans) return;

    const translations = {};
    if (arTrans) translations.ar = arTrans;
    if (frTrans) translations.fr = frTrans;

    const toursColl = await getCollection('tours');
    await toursColl.updateOne(
      { id: tourId },
      { $set: { translations } }
    );

    console.log(`[Auto-Translate] Success for tour ${tourId}`);
  } catch (err) {
    console.error(`[Auto-Translate] Failed for tour ${tourId}:`, err.message);
  }
}

function autoTranslatePlaceBackground(placeId, rawData) {
  autoTranslatePlace(placeId, rawData).catch(e => console.error(e));
}

function autoTranslateEventBackground(eventId, rawData) {
  autoTranslateEvent(eventId, rawData).catch(e => console.error(e));
}

function autoTranslateTourBackground(tourId, rawData) {
  autoTranslateTour(tourId, rawData).catch(e => console.error(e));
}

module.exports = {
  autoTranslatePlaceBackground,
  autoTranslateEventBackground,
  autoTranslateTourBackground
};
