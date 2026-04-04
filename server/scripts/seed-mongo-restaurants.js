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
      'https://images.unsplash.com/photo-1565299585323-38d6b0865efd?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.8,
    reviewCount: 1250,
    price: '$$',
    hours: {
      Monday: '06:00–14:00',
      Tuesday: '06:00–14:00',
      Wednesday: '06:00–14:00',
      Thursday: '06:00–14:00',
      Friday: '06:00–12:00',
      Saturday: '06:00–14:00',
      Sunday: '06:00–14:00'
    },
    tags: ['lebanese', 'breakfast', 'traditional', 'hummus', 'fatteh'],
    diningProfile: {
      cuisines: ['Lebanese', 'Traditional'],
      bestFor: ['Breakfast', 'Brunch'],
      features: ['Outdoor seating', 'Family friendly', 'Authentic'],
      menuSections: [
        {
          title: 'Signature Dishes',
          items: [
            { name: 'Hummus with Meat', price: '$8.00', description: 'Creamy chickpeas topped with sautéed lamb and pine nuts.' },
            { name: 'Fatteh', price: '$7.50', description: 'Chickpeas, toasted bread, and warm yogurt sauce.' }
          ]
        },
        {
          title: 'Cold Mezza',
          items: [
            { name: 'Labneh', price: '$4.00', description: 'Strained yogurt with olive oil.' },
            { name: 'Fresh Vegetables', price: '$3.00', description: 'Seasonal local vegetables.' }
          ]
        }
      ],
      contactPhone: '+961 6 438 500',
      socialMedia: {
        instagram: 'https://instagram.com/akra_tripoli',
        facebook: 'https://facebook.com/akratripoli'
      }
    }
  },
  {
    id: 'rest-hallab-001',
    name: 'Hallab 1881',
    searchName: 'hallab 1881',
    description: 'The legendary "Kasr el Helou". Since 1881, offering the finest Lebanese sweets. A must-visit destination for anyone coming to Tripoli.',
    location: 'Riad El Solh Street, Tripoli, Lebanon',
    latitude: 34.4333,
    longitude: 35.8333,
    category: 'Sweets',
    categoryId: 'dining',
    images: [
      'https://images.unsplash.com/photo-1514516348920-f5d8958d51c0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.9,
    reviewCount: 3200,
    price: '$$$',
    hours: {
      Monday: '08:00–23:00',
      Tuesday: '08:00–23:00',
      Wednesday: '08:00–23:00',
      Thursday: '08:00–23:00',
      Friday: '08:00–23:00',
      Saturday: '08:00–23:00',
      Sunday: '08:00–23:00'
    },
    tags: ['sweets', 'dessert', 'baklava', 'knefe', 'historic'],
    diningProfile: {
      cuisines: ['Oriental Sweets'],
      bestFor: ['Afternoon Tea', 'Dessert'],
      features: ['Historic building', 'Iconic', 'Large seating area'],
      menuSections: [
        {
          title: 'Historic Specialties',
          items: [
            { name: 'Knefe', price: '$5.00', description: 'Warm cheese pastry with sugar syrup.' },
            { name: 'Baklava Box', price: '$25.00', description: 'A selection of our finest handmade baklava.' }
          ]
        }
      ],
      contactPhone: '+961 6 444 444',
      socialMedia: {
        instagram: 'https://instagram.com/hallab1881',
        website: 'https://hallab.com.lb'
      }
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
    
    console.log(`Successfully seeded ${mockPlaces.length} mock restaurants.`);
    
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await client.close();
  }
}

seed();
