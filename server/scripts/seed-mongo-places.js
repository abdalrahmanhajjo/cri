const { MongoClient } = require('mongodb');
const url = 'mongodb+srv://visittripoli2:VisitTripoli76536462@visittripoli.kxrcxfh.mongodb.net/?appName=VisitTripoli';
const client = new MongoClient(url);

const mockPlaces = [
  {
    id: 'rest-akra-001',
    name: 'Akra Restaurant',
    searchName: 'akra restaurant',
    description: 'The most famous traditional breakfast spot in Tripoli. Famous for its Hummus, Fatteh, and authentic Lebanese atmosphere in the heart of the old city.',
    location: 'Al-Tabbaneh, Tripoli, Lebanon',
    latitude: 34.4367,
    longitude: 35.8497,
    category: 'Restaurant',
    categoryId: 'dining',
    images: [
      'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1565299585323-38d6b0865efd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1574484284002-952d9215676f?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.8,
    reviewCount: 1250,
    price: '$$',
    bestTime: 'Early Morning (7 AM - 9 AM)',
    duration: '1-2 Hours',
    insiderTip: 'Go early during the week to avoid the massive Sunday crowds. Their "Fatteh" is legendary—ask for extra pine nuts!',
    hours: {
      Monday: '06:00–14:00',
      Tuesday: '06:00–14:00',
      Wednesday: '06:00–14:00',
      Thursday: '06:00–14:00',
      Friday: '06:00–12:00',
      Saturday: '06:00–14:00',
      Sunday: '06:00–14:00'
    },
    tags: ['lebanese', 'breakfast', 'traditional', 'hummus', 'fatteh', 'family friendly', 'authentic'],
    ratingDistribution: { 5: 850, 4: 300, 3: 80, 2: 15, 1: 5 },
    diningProfile: {
      cuisines: ['Lebanese', 'Traditional'],
      bestFor: ['Breakfast', 'Brunch'],
      features: ['Outdoor seating', 'Family friendly', 'Authentic'],
      contactPhone: '+961 6 438 500',
      socialMedia: { instagram: 'https://instagram.com/akra_tripoli', facebook: 'https://facebook.com/akratripoli' },
      coupons: [
        { id: 'AKRA10', code: 'AKRA10', description: '10% off on your first breakfast', expiry: '2026-12-31' }
      ]
    }
  },
  {
    id: 'tourism-citadel-001',
    name: 'Citadel of Raymond de Saint-Gilles',
    searchName: 'citadel tripoli',
    description: 'A massive Crusader fortress rebuilt by the Mamluks and Ottomans. It offers the most spectacular panoramic views of Tripoli and the Abu Ali River.',
    location: 'Citadel Hill, Tripoli, Lebanon',
    latitude: 34.4335,
    longitude: 35.8441,
    category: 'Historic Landmark',
    categoryId: 'tourism',
    images: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1564507592333-c60657eaa0ae?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.7,
    reviewCount: 3420,
    price: '$5.00',
    bestTime: 'Sunset (4:30 PM - 6:00 PM)',
    duration: '2-3 Hours',
    insiderTip: 'Climb to the highest ramparts just before sunset for the most incredible photos of the city. Also, check out the small museum inside for Crusader artifacts.',
    hours: {
      Monday: '09:00–18:00',
      Tuesday: '09:00–18:00',
      Wednesday: '09:00–18:00',
      Thursday: '09:00–18:00',
      Friday: '09:00–18:00',
      Saturday: '09:00–18:00',
      Sunday: '09:00–18:00'
    },
    tags: ['historic', 'crusader', 'mamluk', 'panoramic view', 'museum', 'photography', 'iconic'],
    ratingDistribution: { 5: 2800, 4: 450, 3: 120, 2: 30, 1: 20 },
    diningProfile: {
      contactPhone: '+961 6 445 000',
      socialMedia: { website: 'https://culture.gov.lb' }
    }
  },
  {
    id: 'tourism-mosque-001',
    name: 'Great Mansouri Mosque',
    searchName: 'mansouri mosque',
    description: 'The largest and oldest mosque in Tripoli, built in the 13th century. Known for its beautiful Mamluk architecture and peaceful central courtyard.',
    location: 'Old Souks, Tripoli, Lebanon',
    latitude: 34.4361,
    longitude: 35.8415,
    category: 'Religious Landmark',
    categoryId: 'tourism',
    images: [
      'https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1566114085547-82fa70c27934?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.9,
    reviewCount: 1850,
    price: 'Free',
    bestTime: 'Morning (after 10 AM)',
    duration: '45-60 Mins',
    insiderTip: 'Dress modestly when entering. The central courtyard is one of the most peaceful spots in the entire city—perfect for a quiet moment of reflection.',
    hours: {
      Monday: '04:00–21:00',
      Tuesday: '04:00–21:00',
      Wednesday: '04:00–21:00',
      Thursday: '04:00–21:00',
      Friday: '04:00–21:00',
      Saturday: '04:00–21:00',
      Sunday: '04:00–21:00'
    },
    tags: ['religious', 'mamluk', 'peaceful', 'historic', 'architecture', 'quiet'],
    ratingDistribution: { 5: 1650, 4: 150, 3: 40, 2: 5, 1: 5 },
    diningProfile: {
      socialMedia: { facebook: 'https://facebook.com/mansourimosque' }
    }
  }
];

async function seed() {
  try {
    await client.connect();
    const db = client.db('visittripoli');
    const collection = db.collection('places');
    
    for (const place of mockPlaces) {
      await collection.updateOne(
        { id: place.id },
        { $set: { ...place, _id: place.id, syncedAt: new Date() } },
        { upsert: true }
      );
    }
    
    console.log(`Successfully seeded ${mockPlaces.length} premium places (Restaurants & Landmarks) with rich data.`);
    
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await client.close();
  }
}

seed();
