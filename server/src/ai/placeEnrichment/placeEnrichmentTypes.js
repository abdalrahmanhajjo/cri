/**
 * @typedef {Object} SuitableFor
 * @property {boolean} families
 * @property {boolean} couples
 * @property {boolean} solo
 * @property {boolean} groups
 */

/**
 * @typedef {Object} PhysicalProfile
 * @property {'low' | 'medium' | 'high'} walkingEffort
 * @property {'indoor' | 'outdoor' | 'mixed'} indoorOutdoor
 * @property {number} heatSuitability - Score out of 10
 * @property {number} rainSuitability - Score out of 10
 */

/**
 * @typedef {Object} PlannerSignals
 * @property {number} culturalScore - out of 10
 * @property {number} foodScore - out of 10
 * @property {number} scenicScore - out of 10
 * @property {number} photoScore - out of 10
 * @property {number} hiddenGemScore - out of 10
 * @property {number} anchorValue - out of 10, how well it serves as a main attraction
 * @property {number} familyFriendlyScore - out of 10
 * @property {number} relaxationScore - out of 10
 */

/**
 * @typedef {Object} VisitProfile
 * @property {number} recommendedDurationMinutes
 * @property {string} bestTimeOfDay - e.g. "Morning", "Late Afternoon"
 * @property {string[]} pairingTags - e.g. ["coffee", "dinner"]
 */

/**
 * @typedef {Object} AreaContext
 * @property {string} neighborhoodCharacter
 */

/**
 * @typedef {Object} AIPlaceProfile
 * @property {string} semanticSummary
 * @property {string[]} vibeTags
 * @property {string[]} tripStyleTags
 * @property {string[]} interestTags
 * @property {string[]} idealVisitTimes
 * @property {SuitableFor} suitableFor
 * @property {PhysicalProfile} physicalProfile
 * @property {PlannerSignals} plannerSignals
 * @property {VisitProfile} visitProfile
 * @property {AreaContext} areaContext
 * @property {string[]} explanationFragments
 * @property {string} embeddingText
 * @property {string} enrichmentVersion
 * @property {string} enrichedAt
 */

module.exports = {};
