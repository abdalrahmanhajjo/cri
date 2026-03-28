/**
 * One-off generator: writes server/migrations/020_tripoli_heritage_places_reset.sql
 * Run: node server/scripts/generate-020-heritage-migration.js
 */
const fs = require('fs');
const path = require('path');

const categories = [
  ['heritage_overview', 'Tripoli overview & history', 'fas fa-book-open', 'City introduction and deep historical narrative for visitors.', '["history","heritage","culture","tripoli","introduction","guide"]', '#1a5f7a'],
  ['castles_towers', 'Castles & towers', 'fas fa-chess-rook', 'Citadels and military towers from Crusader, Mamluk and later periods.', '["castle","citadel","fort","tower","crusader","mamluk","history","heritage","landmark"]', '#6B4423'],
  ['mosques', 'Historic mosques', 'fas fa-mosque', 'Mamluk and Ottoman mosques across the old city and river quarters.', '["mosque","mamluk","islamic","prayer","minaret","religious","history"]', '#1e5631'],
  ['madrasas', 'Madrasas', 'fas fa-school', 'Islamic colleges and Quranic schools.', '["madrasa","school","mamluk","islamic","education","heritage"]', '#3d5a80'],
  ['khanqahs_takiyas', 'Khanqahs & takiyas', 'fas fa-archway', 'Sufi lodges, khanqahs and the Mawlawi takiya.', '["sufi","khanqah","takiya","religious","heritage","dervish"]', '#5c4d7d'],
  ['khans', 'Khans (caravanserais)', 'fas fa-warehouse', 'Historic merchant inns and covered trade buildings.', '["khan","caravanserai","market","souk","shopping","historic","trade","souq"]', '#8B4513'],
  ['hammams', 'Hammams', 'fas fa-bath', 'Traditional public bathhouses, Mamluk and Ottoman.', '["hammam","bath","ottoman","mamluk","heritage"]', '#5d4e37'],
  ['old_markets', 'Historic markets', 'fas fa-store', 'Old souks and market quarters still in use.', '["souk","market","shopping","bazaar","old city","traditional"]', '#b45309'],
  ['churches', 'Churches & shrines', 'fas fa-church', 'Christian churches and shrines from Crusader era to 19th century.', '["church","christian","orthodox","cathedral","crusader","heritage"]', '#4a5568'],
  ['modern_heritage', 'Modern Tripoli landmarks', 'fas fa-train', '19th–20th century stations, clock tower and Al-Tal square.', '["train","station","clock","square","ottoman","heritage","tal"]', '#2c5282'],
  ['natural_urban', 'Nature & major sites', 'fas fa-water', 'River, offshore islands, and the international fairgrounds.', '["river","island","sea","nature","fair","niemeyer","coast","mina","outdoors","water"]', '#0c5c59'],
  ['living_heritage', 'Cuisine & crafts', 'fas fa-utensils', 'Tripolitan food culture and artisanal handicraft traditions.', '["food","cuisine","sweets","craft","handicraft","tradition","restaurant"]', '#c05621'],
];

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function row(p) {
  const img = p.images || '[]';
  const tags = JSON.stringify(p.tags || []);
  const idLit = esc(p.id);
  return `(
  '${idLit}',
  '${esc(p.name)}',
  '${esc(p.description)}',
  '${esc(p.location)}',
  ${p.lat != null ? p.lat : 'NULL'},
  ${p.lng != null ? p.lng : 'NULL'},
  NULL,
  '${esc(img)}'::jsonb,
  '${esc(p.catName)}',
  '${esc(p.catId)}',
  '${esc(p.duration)}',
  '${esc(p.price)}',
  '${esc(p.bestTime)}',
  ${p.rating != null ? p.rating : 'NULL'},
  ${p.reviewCount != null ? p.reviewCount : 'NULL'},
  NULL,
  '${esc(tags)}'::jsonb,
  encode(digest('${idLit}', 'sha256'), 'hex')
)`;
}

const places = [];

places.push({
  id: 'tripoli_introduction',
  name: 'Tripoli — introduction',
  description:
    'The second-largest city in Lebanon and capital of North Lebanon, Tripoli lies about 85 km north of Beirut. It is a welcoming city where history and the present coexist, with a lively economy and a calm rhythm of life. The city holds numerous historical and archaeological buildings — over forty listed as heritage — including mosques, schools, caravanserais and public baths, most from the Mamluk period, especially the 14th century AD. Its markets and caravanserais group artisans by trade — soap makers, goldsmiths, herbalists, tanners, tailors and more — forming urban quarters that still carry medieval character.',
  location: 'Tripoli, North Lebanon',
  lat: 34.4347,
  lng: 35.8365,
  catName: 'Tripoli overview & history',
  catId: 'heritage_overview',
  duration: '15–30 mins read',
  price: '',
  bestTime: 'Any time',
  tags: ['tripoli', 'lebanon', 'introduction', 'heritage', 'mamluk', 'souks'],
});

places.push({
  id: 'tripoli_journey_history',
  name: 'A journey into Tripoli’s history',
  description:
    'Historical records show Tripoli existed by the 14th century BC; the city was once called Wahliya in Tell el-Amarna letters, on what is now Abou Samra Hill. By the 9th century BC Phoenicians built a trading post on the peninsula of El-Mina; it became a federal hub in the Persian era. Tripoli commanded key military and commercial crossroads: the Akkar gateway, two natural harbours and offshore islets. Under Alexander’s successors it remained an important naval station; Roman rule brought grand public buildings — temples such as Baal (possibly under today’s Taynal Mosque) and Astarte appear on coinage, and inscriptions describe games in its stadium. A severe earthquake and tsunami struck in 551 AD. After the Islamic conquest (after 635 AD) Tripoli served the Umayyad navy; under Fatimid judges of the Banu Ammar in the mid-11th century it gained autonomy as a centre of science and culture. In 1109 the Crusaders besieged and captured the city, destroying much of its fabric. Later periods restored maritime and cultural prominence.',
  location: 'Historical overview — Tripoli',
  lat: 34.436,
  lng: 35.838,
  catName: 'Tripoli overview & history',
  catId: 'heritage_overview',
  duration: '30–45 mins read',
  price: '',
  bestTime: 'Any time',
  tags: ['history', 'phoenician', 'roman', 'crusader', 'islamic', 'fatimid'],
});

places.push({
  id: 'tripoli_citadel_saint_gilles',
  name: 'Tripoli Castle (Citadel of Saint-Gilles)',
  description:
    'Known in the Crusader era as Tallat el-Hajjaj, on the summit of Abi Samra. Established in 645 by the Arab commander Sufyan al-Azdi, rebuilt by Count Raymond de Saint-Gilles, and restored by Prince Asandamir al-Korji after the Mamluks burned it in 1289; it has been renovated many times. The citadel has a main gate in the first tower and two smaller gates under the 12th and 22nd towers; openings lead to stairs down to underground levels used as prisons, arms stores and catacombs linked to surrounding houses and coastal towers.',
  location: 'Abi Samra hill, Tripoli',
  lat: 34.4562,
  lng: 35.8431,
  catName: 'Castles & towers',
  catId: 'castles_towers',
  duration: '1–2 hours',
  price: '',
  bestTime: 'Morning or late afternoon',
  rating: 4.7,
  reviewCount: 0,
  tags: ['citadel', 'crusader', 'mamluk', 'fortress', 'castle'],
});

places.push({
  id: 'barsbay_tower',
  name: 'Barsbay Tower (Lion Tower)',
  description:
    'Built in the mid-14th century by Prince Sayf al-Din Barsbay bin Abdullah bin Hamza al-Nasiri; also called the Lion Tower. A notable example of Mamluk military architecture.',
  location: 'Tripoli waterfront / port area',
  lat: 34.451,
  lng: 35.81,
  catName: 'Castles & towers',
  catId: 'castles_towers',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Daylight',
  tags: ['tower', 'mamluk', 'military', 'port'],
});

places.push({
  id: 'great_mansouri_mosque',
  name: 'Great al-Mansouri Mosque',
  description:
    'The oldest mosque in Tripoli and the first built in the Mamluk era — a major landmark. Sultan al-Ashraf Khalil bin Qalawun built it in 1294 on the ruins of an old church; Sultan al-Nasir Muhammad bin Qalawun added the arcades around the outer courtyard in 1315. It covers about 3,224 m². The four-storey minaret is in Italian Lombard style; the wooden minbar retains fine geometric decoration.',
  location: 'Old city — al-Nouri quarter area',
  lat: 34.4341,
  lng: 35.8354,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '45 mins – 1 hour',
  price: '',
  bestTime: 'Between prayer times',
  rating: 4.8,
  reviewCount: 0,
  tags: ['mosque', 'mamluk', 'minaret', 'great mosque'],
});

places.push({
  id: 'sidi_abd_al_wahed_meknasi_mosque',
  name: 'Mosque of Sidi Abd al-Wahed al-Meknasi',
  description:
    'Built in 1306 by Sheikh Abd al-Wahed al-Meknasi, a Moroccan imam — among Tripoli’s oldest Mamluk mosques. Noted for Moroccan architectural influence and one of the smallest minarets among the old city’s mosques.',
  location: 'Old city, Tripoli',
  lat: 34.4335,
  lng: 35.8346,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '20–30 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'mamluk', 'moroccan'],
});

places.push({
  id: 'al_burtasi_mosque_madrasa',
  name: 'Al-Burtasi Mosque and Madrasa',
  description:
    'Built in the 14th century by Issa bin Omar al-Burtasi; functioned as a law school linked to the Shafi’i school. On the bank of the Abou Ali River; praised as a masterpiece mixing Byzantine, Fatimid and Andalusian influences, with an arched minaret. Popular with European travellers in the 19th century.',
  location: 'Abou Ali River bank, old city',
  lat: 34.4329,
  lng: 35.8324,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Daylight',
  tags: ['mosque', 'madrasa', 'river', 'mamluk'],
});

places.push({
  id: 'al_tawba_mosque',
  name: 'Al-Tawba Mosque (Mosque of Repentance)',
  description:
    'Built in the 14th century under Sultan al-Nasir Qalawun. Tradition holds it was founded as repentance after the architect of the Great Mansouri Mosque was found to have embezzled funds from that project. On the Abou Ali River; noted for a bronze plaque marking the 1643 flood, and a handsome dome and hexagonal minaret.',
  location: 'Abou Ali River bank',
  lat: 34.4332,
  lng: 35.8328,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '30 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'river', 'mamluk'],
});

places.push({
  id: 'al_attar_mosque',
  name: 'Al-Attar Mosque',
  description:
    'Built in 1334 by Badr al-Din al-Attar on a Crusader church foundation. North of Khan al-Masriyin (Egyptians’ Khan). It has Tripoli’s tallest minaret — square and unusually ornate, like a military tower. Three gates: north to the new market, west named for its builder-engraver, east with geometric patterns and historic inscriptions.',
  location: 'Old city, near Khan al-Misriyye',
  lat: 34.4343,
  lng: 35.8355,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Between prayer times',
  rating: 4.6,
  reviewCount: 0,
  tags: ['mosque', 'minaret', 'mamluk'],
});

places.push({
  id: 'taynal_mosque',
  name: 'Taynal Mosque',
  description:
    'Outside the old city wall in Bab al-Raml, built by Mamluk prince Sayf al-Din Taynal al-Hajib on a demolished Crusader church. Fortress-like appearance; hidden passages in the walls; large dome on four Byzantine capitals over granite columns on a marble courtyard; minaret with twin stone staircases; celebrated wooden mihrab.',
  location: 'Bab al-Raml neighbourhood',
  lat: 34.4325,
  lng: 35.8288,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '45 mins – 1 hour',
  price: '',
  bestTime: 'Morning',
  rating: 4.7,
  reviewCount: 0,
  tags: ['mosque', 'mamluk', 'dome', 'mihrab'],
});

places.push({
  id: 'al_uwaysiya_mosque',
  name: 'Al-Uwaysiya Mosque',
  description:
    'Began as a small Mamluk zawiya; later the Ottomans converted it to a mosque and added an Ottoman minaret. It has the largest dome among Tripoli’s medieval mosques. Linked to Sufi Sheikh Uwais al-Roumi. On the west bank of the Abou Ali, lane toward the fish market.',
  location: 'Abou Ali River, west bank',
  lat: 34.4338,
  lng: 35.8339,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '30 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'dome', 'sufi', 'ottoman'],
});

places.push({
  id: 'al_tahham_mosque',
  name: 'Al-Tahham Mosque',
  description:
    'Mamluk-era mosque; builder unknown. Above shops in al-Haddadine, reached by stairs; small minaret but distinguished by granite columns with Corinthian capitals, carvings and ornament.',
  location: 'Al-Haddadine quarter',
  lat: 34.4336,
  lng: 35.8349,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '20–30 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'haddadine', 'mamluk'],
});

places.push({
  id: 'al_muallaq_mosque',
  name: 'Al-Muallaq Mosque (The Suspended Mosque)',
  description:
    'Built in 1555 by Mahmoud Lotfi al-Zaim (Ottoman era) above cellars and shops in al-Haddadine — hence “Suspended.” Also called Mahmudiyah. Octagonal minaret with eight arches and balconied circular floral motifs at the top.',
  location: 'Al-Haddadine',
  lat: 34.4341,
  lng: 35.8351,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'ottoman', 'suspended', 'minaret'],
});

places.push({
  id: 'al_hamdi_mosque',
  name: 'Al-Hamdi Mosque (Tanners’ Mosque)',
  description:
    'Thought to date from the turn of the 16th century (late Mamluk Levant). Originally Mosque al-Tuffahi; also called al-Dabbaghin (tanners). Demolished and rebuilt in 1892 under Sultan Abdul Hamid II.',
  location: 'Old city, Tripoli',
  lat: 34.4339,
  lng: 35.8352,
  catName: 'Historic mosques',
  catId: 'mosques',
  duration: '20–30 mins',
  price: '',
  bestTime: 'Between prayer times',
  tags: ['mosque', 'ottoman', 'tanners'],
});

const madrasas = [
  ['al_mashhad_madrasa', 'Al-Mashhad Madrasa', 'Mamluk-era madrasa named for a shrine inside. Faces al-Shamsiya Madrasa in al-Nouri quarter, right of the Great Mansouri main entrance. Noted for mosaic and marble gate and Mamluk muqarnas.', 34.434, 35.8353],
  ['al_nouriya_madrasa', 'Al-Nouriya Madrasa', 'Often dated to 1310 by Prince Sangar bin Abdullah al-Nouri, or attributed to a wealthy citizen or Prince Nour al-Din who also built Hammam al-Nouri opposite. Black-and-white striped Arabic portal; marble mihrab with mosaics among the finest in Tripoli.', 34.4342, 35.8355],
  ['al_qartawiya_madrasa', 'Al-Qartawiya Madrasa', 'One of six schools around the Great Mansouri Mosque; among the largest Mamluk religious institutions. Ordered by Prince Sayf al-Din Qaratay (1316–1326). Rear wall with geometry, ornament and Quranic verses used to post public rulings; monumental muqarnas gate.', 34.4339, 35.8354],
  ['al_qadiriya_madrasa', 'Al-Qadiriya Madrasa', '14th-century Mamluk madrasa; second largest after al-Qartawiya. Recently converted into a mosque. Plain gate; tomb of an unidentified person inside.', 34.4338, 35.8352],
  ['al_nasiriya_madrasa', 'Al-Nasiriya Madrasa', 'Mid-14th century, built by Sultan Hassan bin Muhammad bin Qalawun (al-Nasir). Left of the road to the Great Mansouri; inscription “Glory to Mawlana Sultan Nasir.”', 34.43405, 35.83545],
  ['al_saqraqiya_madrasa', 'Al-Saqraqiya Madrasa', 'Early 14th century by Sayf al-Din Aqraq. Facade inscriptions give founding date and endowed properties.', 34.4337, 35.8351],
  ['al_khatouniya_madrasa', 'Al-Khatouniya Madrasa', '1374, by Prince Izz al-Din Edmer al-Ashrafi and his wife Argoun Khatoun. Haddadine (Saff al-Blat), faces al-Saqraqiya. Prince’s blazon between windows; property laws carved on entry wall.', 34.4335, 35.835],
];

for (const [id, name, desc, lat, lng] of madrasas) {
  places.push({
    id,
    name,
    description: desc,
    location: 'Old city — near Great Mansouri / al-Nouri quarter',
    lat,
    lng,
    catName: 'Madrasas',
    catId: 'madrasas',
    duration: '30–45 mins',
    price: '',
    bestTime: 'Morning',
    tags: ['madrasa', 'mamluk', 'school'],
  });
}

places.push({
  id: 'al_khanqah_tripoli',
  name: 'Al-Khanqah',
  description:
    'Built in 1467 in al-Haddadine under Prince Qaynay al-Mu’ayyadi. Named for Sitt Salha (“Khanqah”). Sufis, warriors and visitors lodged here for worship and city defence. Large gate, narrow passage, courtyard with a calm central pool.',
  location: 'Al-Haddadine',
  lat: 34.4336,
  lng: 35.83495,
  catName: 'Khanqahs & takiyas',
  catId: 'khanqahs_takiyas',
  duration: '30 mins',
  price: '',
  bestTime: 'By arrangement',
  tags: ['khanqah', 'sufi', 'mamluk'],
});

places.push({
  id: 'takiya_al_mawlawiya',
  name: 'Al-Takiya al-Mawlawiya',
  description:
    'One of seven Ottoman Mawlawi takiyas outside Turkey (with Cairo, Jerusalem, Damascus, Aleppo, Bosnia, Cyprus). Built 1619 by Samsunji Ali for Mawlawi dervishes of Jalaluddin Rumi’s order. Served worship and teaching until the mid-20th century.',
  location: 'Tripoli',
  lat: 34.4348,
  lng: 35.8362,
  catName: 'Khanqahs & takiyas',
  catId: 'khanqahs_takiyas',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Check access',
  tags: ['takiya', 'mawlawi', 'ottoman', 'sufi'],
});

places.push({
  id: 'souk_haraj',
  name: 'Souk Haraj',
  description:
    'Crusader-era monumental hall with crossing vaults on two large granite columns, possibly reusing a church or Roman temple. Under the Mamluks converted to a khan: upper floor for merchants, ground for trade and animals.',
  location: 'Old city markets',
  lat: 34.4345,
  lng: 35.8358,
  catName: 'Khans (caravanserais)',
  catId: 'khans',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Morning',
  tags: ['souk', 'khan', 'vault', 'crusader'],
});

places.push({
  id: 'khan_al_askar',
  name: 'Khan al-Askar',
  description:
    'After fire destroyed the Saint-Gilles citadel, the Mamluks built this instead of barracks there. Two long rectangular blocks with a central stable for horses; about 400 m²; used through Ottoman and French periods.',
  location: 'Old city',
  lat: 34.4335,
  lng: 35.8347,
  catName: 'Khans (caravanserais)',
  catId: 'khans',
  duration: '45 mins – 1 hour',
  price: '',
  bestTime: 'Morning',
  tags: ['khan', 'mamluk', 'military'],
});

places.push({
  id: 'khan_al_khayyatin',
  name: 'Khan al-Khayyatin (Tailors’ Khan)',
  description:
    'Long rectangular plan: ground floor like a street of workshops; upper rooms under a series of ten arches. East and west entrances; western gate has a column with Roman Corinthian capital. Often dated stylistically to the 17th century and later Ottoman context in guides.',
  location: 'Old city souks',
  lat: 34.4333,
  lng: 35.8333,
  catName: 'Khans (caravanserais)',
  catId: 'khans',
  duration: '1 hour',
  price: '',
  bestTime: 'Morning to afternoon',
  tags: ['khan', 'tailors', 'textiles', 'souk'],
});

places.push({
  id: 'khan_al_saboun',
  name: 'Khan al-Saboun',
  description:
    'Built 1480 under governor Youssef Bey Sifa; first as military barracks, then as a khan. Centre of Tripoli soap production and trade; still noted for its tall original wooden gate with side windows for guards to watch the entrance.',
  location: 'Old city, near clock tower area',
  lat: 34.4336,
  lng: 35.8344,
  catName: 'Khans (caravanserais)',
  catId: 'khans',
  duration: '45 mins – 1 hour',
  price: '',
  bestTime: 'Daytime',
  tags: ['khan', 'soap', 'ottoman', 'craft'],
});

places.push({
  id: 'hammam_izz_ed_dine',
  name: 'Hammam Izz Ed-Dine',
  description:
    'Among Tripoli’s oldest baths, near Khan al-Khayyatin. Prince Izz Ed-Dine Aybak al-Mawsili built it in 1294 on Crusader foundations; architecture parallels the khan. Floor later paved with Carrara marble; new entry to Nahhasin market side c. late 19th century. Entry carved with Lamb of God and a Crusader inscription.',
  location: 'Near Khan al-Khayyatin',
  lat: 34.43325,
  lng: 35.83335,
  catName: 'Hammams',
  catId: 'hammams',
  duration: '45 mins',
  price: '',
  bestTime: 'Traditional hours',
  tags: ['hammam', 'mamluk', 'bath'],
});

places.push({
  id: 'hammam_al_nouri',
  name: 'Hammam al-Nouri',
  description:
    'In the al-Nouri area near the Great Mansouri and several madrasas. Attributed to Prince Sinjir bin Abdullah al-Nouri or Nour al-Din; early 8th century AH with the facing madrasa.',
  location: 'Al-Nouri quarter',
  lat: 34.43415,
  lng: 35.8355,
  catName: 'Hammams',
  catId: 'hammams',
  duration: '45 mins',
  price: '',
  bestTime: 'Check opening',
  tags: ['hammam', 'mamluk'],
});

places.push({
  id: 'hammam_al_abed',
  name: 'Hammam al-Abed',
  description:
    'Tripoli’s only working historic hammam today. Probably mid-17th century Ottoman. Name linked to tradition of a murdered African servant at the door. Central hall under a large dome with pool and terraces; warm and hot rooms with steam and showers.',
  location: 'Old city',
  lat: 34.4344,
  lng: 35.8358,
  catName: 'Hammams',
  catId: 'hammams',
  duration: '1–2 hours',
  price: '',
  bestTime: 'Afternoon or evening',
  tags: ['hammam', 'bath', 'operational'],
});

places.push({
  id: 'hammam_al_jadid',
  name: 'Hammam al-Jadid',
  description:
    'Built 1740 by Asaad Pasha al-Azem — “the new hammam” beside older Mamluk and early Ottoman baths. Ornate gate, marble hall, large dome, central pond and fountain. Famous single-stone carved 14-link chain and bucket at the entrance.',
  location: 'Old city',
  lat: 34.4342,
  lng: 35.836,
  catName: 'Hammams',
  catId: 'hammams',
  duration: '1 hour',
  price: '',
  bestTime: 'By arrangement',
  tags: ['hammam', 'ottoman', 'architecture'],
});

places.push({
  id: 'tripoli_old_markets_network',
  name: 'Tripoli old markets',
  description:
    'Among the world’s few ancient market networks still serving their original purpose. Some lines of trade go back eight centuries. Each souk took its name from its craft; the web runs from the east bank of the Abou Ali to Haddadine Gate — goldsmiths, herbs, shoes and more.',
  location: 'Old city — river to Haddadine',
  lat: 34.4346,
  lng: 35.8364,
  catName: 'Historic markets',
  catId: 'old_markets',
  duration: '2–3 hours',
  price: '',
  bestTime: 'Morning',
  tags: ['souk', 'market', 'shopping', 'heritage'],
});

places.push({
  id: 'shrine_our_lady_yunis',
  name: 'Greek Orthodox shrine of Our Lady of Yunis',
  description:
    'Legend: a Yunishid man spared by the Virgin at this chapel; shrine marks the apparition. Popular with Christian visitors; old city. Latin inscription indicates Crusader-era origins.',
  location: 'Old city',
  lat: 34.435,
  lng: 35.8368,
  catName: 'Churches & shrines',
  catId: 'churches',
  duration: '20–30 mins',
  price: '',
  bestTime: 'Daylight',
  tags: ['church', 'shrine', 'crusader', 'orthodox'],
});

places.push({
  id: 'st_george_greek_orthodox_cathedral',
  name: 'St George Greek Orthodox Cathedral',
  description:
    'Largest historic church in Tripoli; Dabbagha area near Churches Street. Built from 1863 over ten years; inscription names builder Sophrianos. Rich icons, inscriptions and decoration.',
  location: 'Dabbagha — Churches Street',
  lat: 34.4352,
  lng: 35.8365,
  catName: 'Churches & shrines',
  catId: 'churches',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Services or visits by arrangement',
  tags: ['cathedral', 'orthodox', '19th century'],
});

places.push({
  id: 'st_nicholas_greek_orthodox_church',
  name: 'St Nicholas Greek Orthodox Church',
  description:
    'Early 19th century: Muslims and Orthodox agreed to replace a church near al-Uwaysiyat (lost to a factory in Tarbiah). New church in Levantine style — rectangular, no domes; four apses and four naves. Museum icons from the old building.',
  location: 'Old city',
  lat: 34.4339,
  lng: 35.8341,
  catName: 'Churches & shrines',
  catId: 'churches',
  duration: '30 mins',
  price: '',
  bestTime: 'By arrangement',
  tags: ['orthodox', 'church'],
});

places.push({
  id: 'st_joseph_syriac_catholic_church',
  name: 'St Joseph Syriac Catholic Church',
  description:
    'Originally a 19th-century Franciscan church beside St George Greek Orthodox Cathedral.',
  location: 'Near St George Cathedral',
  lat: 34.43522,
  lng: 35.83652,
  catName: 'Churches & shrines',
  catId: 'churches',
  duration: '20 mins',
  price: '',
  bestTime: 'By arrangement',
  tags: ['syriac', 'catholic', 'church'],
});

places.push({
  id: 'st_michael_maronite_church',
  name: 'St Michael Maronite Church',
  description:
    'Large Western-style cathedral; inscription over door gives 1858.',
  location: 'Tripoli',
  lat: 34.4349,
  lng: 35.8372,
  catName: 'Churches & shrines',
  catId: 'churches',
  duration: '30 mins',
  price: '',
  bestTime: 'By arrangement',
  tags: ['maronite', 'church'],
});

places.push({
  id: 'el_mina_train_station',
  name: 'El-Mina train station',
  description:
    'Around 1900 the first train reached El-Mina; the station was paid for by Tripoli residents and linked the city to Istanbul and cities such as Paris on the Orient Express network. Remaining structures act as a kind of museum awaiting restoration; rolling stock includes German 1985 and French 1985 and 1901 sets on site per local inventory.',
  location: 'El-Mina',
  lat: 34.451,
  lng: 35.808,
  catName: 'Modern Tripoli landmarks',
  catId: 'modern_heritage',
  duration: '30–45 mins',
  price: '',
  bestTime: 'Daylight',
  tags: ['train', 'station', 'heritage', 'mina'],
});

places.push({
  id: 'al_hamidiya_clock',
  name: 'Al-Hamidiya clock tower',
  description:
    'Ottoman clock built 1901 for the 25th anniversary of Sultan Abdul Hamid II’s accession; centre of Al-Tal square. Built before the Ottoman Saray (1890, demolished 1960s). Five levels with internal spiral iron stair.',
  location: 'Al-Tal square',
  lat: 34.4361,
  lng: 35.8383,
  catName: 'Modern Tripoli landmarks',
  catId: 'modern_heritage',
  duration: '15–20 mins',
  price: '',
  bestTime: 'Any time',
  tags: ['clock', 'ottoman', 'tal', 'landmark'],
});

places.push({
  id: 'al_tal_square',
  name: 'Al-Tal square',
  description:
    'Late 19th-century hub of modern Tripoli outside the Mamluk core. Ottoman and European-style buildings — banks, cafés, hotels, parks, villas and former government seats including the demolished Ottoman Seray. Many structures neglected but evocative of the modern city’s past.',
  location: 'Al-Tal, Tripoli',
  lat: 34.4363,
  lng: 35.8385,
  catName: 'Modern Tripoli landmarks',
  catId: 'modern_heritage',
  duration: '1 hour',
  price: '',
  bestTime: 'Evening stroll',
  tags: ['square', 'ottoman', 'urban', 'tal'],
});

places.push({
  id: 'rashid_karami_international_fair',
  name: 'Rashid Karami International Fair',
  description:
    'Conceived in the late 1950s; built 1964–1975 from 1960s designs. Brazilian architect Oscar Niemeyer master-planned roughly one million square metres — a landmark of modern architecture.',
  location: 'Tripoli fairgrounds',
  lat: 34.421,
  lng: 35.872,
  catName: 'Nature & major sites',
  catId: 'natural_urban',
  duration: '1–2 hours',
  price: '',
  bestTime: 'Daytime events or exterior visit',
  tags: ['fair', 'niemeyer', 'architecture', 'modern'],
});

places.push({
  id: 'palm_islands_nature_reserve',
  name: 'Palm Islands Nature Reserve',
  description:
    'Three uninhabited islands off El-Mina; named for large palms on one island — also called Rabbits Island (Araneb). Islands: Rabbits (largest), al-Sanani, al-Fanar (Ramkine).',
  location: 'Off El-Mina coast',
  lat: 34.542,
  lng: 35.785,
  catName: 'Nature & major sites',
  catId: 'natural_urban',
  duration: 'Half day (boat)',
  price: '',
  bestTime: 'Calm weather',
  tags: ['island', 'nature', 'reserve', 'sea', 'mina'],
});

places.push({
  id: 'abou_ali_river',
  name: 'Abou Ali River',
  description:
    '20th-century floods damaged historic riverfront architecture; widening the bed changed Tripoli’s old landscape. Before that, the river inspired European painters and travellers as the classic eastern city waterfront. The expansion and floods permanently altered the banks.',
  location: 'Through Tripoli',
  lat: 34.4389,
  lng: 35.84,
  catName: 'Nature & major sites',
  catId: 'natural_urban',
  duration: 'Walking along embankments',
  price: '',
  bestTime: 'Morning or evening',
  tags: ['river', 'waterfront', 'urban'],
});

places.push({
  id: 'tripolitan_cuisine',
  name: 'Tripolitan cuisine',
  description:
    'Tripoli’s traditional food is rich and varied — especially sweets: the city is known for dozens of kinds of oriental pastries and desserts, plus beloved everyday dishes and drinks.',
  location: 'Citywide',
  lat: 34.435,
  lng: 35.836,
  catName: 'Cuisine & crafts',
  catId: 'living_heritage',
  duration: 'Varies',
  price: '',
  bestTime: 'Markets and sweet shops — daytime',
  tags: ['food', 'sweets', 'cuisine', 'culture'],
});

places.push({
  id: 'artisanal_crafts_tripoli',
  name: 'Artisanal crafts of Tripoli',
  description:
    'Tripoli is known for fine traditional handicrafts. Older masters still try to teach youth, though many trades are endangered or extinct; advocates call for stronger celebration of this heritage.',
  location: 'Souks and workshops — old city',
  lat: 34.4344,
  lng: 35.8358,
  catName: 'Cuisine & crafts',
  catId: 'living_heritage',
  duration: '1–2 hours',
  price: '',
  bestTime: 'Morning workshops',
  tags: ['craft', 'handicraft', 'heritage', 'souk'],
});

let sql = `-- Tripoli Explorer — full heritage reset (places + categories)
-- Source: supplied Tripoli heritage guide (introduction, sites by type).
-- WARNING: Deletes ALL saved place rows and ALL places, then replaces categories.
-- Trip itineraries (trips.days) may still contain old place IDs until users edit them.
-- (No BEGIN/COMMIT: run-migrations.js wraps this file in a transaction.)

DELETE FROM saved_places;
DELETE FROM user_favourites;

-- Orphan FK-free references so DELETE places never fails on dangling links
UPDATE feed_posts SET place_id = NULL WHERE place_id IS NOT NULL;
UPDATE events SET place_id = NULL WHERE place_id IS NOT NULL;

DELETE FROM place_translations;
DELETE FROM places;

DELETE FROM category_translations;
DELETE FROM categories;

`;

for (const [id, name, icon, desc, tags, color] of categories) {
  sql += `INSERT INTO categories (id, name, icon, description, tags, count, color) VALUES (
  '${esc(id)}',
  '${esc(name)}',
  '${esc(icon)}',
  '${esc(desc)}',
  '${esc(tags)}'::jsonb,
  0,
  '${esc(color)}'
);\n`;
}

sql += `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO places (id, name, description, location, latitude, longitude, search_name, images, category, category_id, duration, price, best_time, rating, review_count, hours, tags, checkin_token) VALUES
`;

sql += places.map(row).join(',\n');
sql += `;
`;

const out = path.join(__dirname, '../migrations/020_tripoli_heritage_places_reset.sql');
fs.writeFileSync(out, sql, 'utf8');
console.log('Wrote', out, 'places:', places.length, 'categories:', categories.length);
