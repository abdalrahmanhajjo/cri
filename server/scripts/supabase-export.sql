-- Supabase/PostgreSQL export
-- Generated: 2026-03-04T21:46:20.122Z
-- Schema: public

-- Table: categories
DROP TABLE IF EXISTS "categories" CASCADE;
CREATE TABLE "categories" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "icon" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "tags" JSONB DEFAULT '[]'::jsonb,
  "count" INTEGER DEFAULT 0,
  "color" VARCHAR(20),
  PRIMARY KEY ("id")
);

-- Data: categories (8 rows)
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('souks', 'Old Souks', 'fas fa-store-alt', 'Traditional markets dating back centuries', '["market","shopping","traditional","historic"]', 8, '#8B4513');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('historical', 'Historical Sites', 'fas fa-landmark', 'Ancient castles, citadels and historical monuments', '["castle","fortress","ancient","heritage"]', 10, '#B8860B');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('mosques', 'Mosques & Religious', 'fas fa-mosque', 'Beautiful mosques and religious architecture', '["religious","islamic","architecture","prayer"]', 8, '#228B22');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('food', 'Food & Restaurants', 'fas fa-utensils', 'Traditional Lebanese cuisine and local eateries', '["food","restaurant","lebanese","cuisine"]', 10, '#DC143C');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('cultural', 'Cultural Centers', 'fas fa-theater-masks', 'Museums, art galleries and cultural venues', '["museum","art","culture","gallery"]', 6, '#4B0082');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('architecture', 'Architecture', 'fas fa-archway', 'Mamluk and Ottoman era architectural marvels', '["architecture","mamluk","ottoman","design"]', 8, '#2F4F4F');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('historic', 'Historic Sites', 'landmark', 'Historic landmarks and monuments', '["history","heritage"]', 0, '#8B4513');
INSERT INTO "categories" ("id", "name", "icon", "description", "tags", "count", "color") VALUES ('markets', 'Markets & Souks', 'shopping-bag', 'Traditional markets', '["shopping","souks"]', 0, '#D2691E');

-- Table: category_translations
DROP TABLE IF EXISTS "category_translations" CASCADE;
CREATE TABLE "category_translations" (
  "category_id" VARCHAR(50) NOT NULL,
  "lang" VARCHAR(5) NOT NULL,
  "name" VARCHAR(100),
  "description" TEXT,
  "tags" JSONB,
  PRIMARY KEY ("category_id", "lang")
);

-- Table: email_verification_tokens
DROP TABLE IF EXISTS "email_verification_tokens" CASCADE;
CREATE TABLE "email_verification_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Data: email_verification_tokens (2 rows)
INSERT INTO "email_verification_tokens" ("id", "user_id", "token_hash", "expires_at", "used_at", "created_at") VALUES ('4c6dcb25-ca1b-43c7-8a0f-9b5a98f992a9', '889eeece-eaea-42fe-8b6f-984b25f4ed5f', '6bf9787e5fd731100ae27fe9ea6b437dcc2eab5eef04906b429c32b6421bdd55', '2026-02-17T21:49:14.244Z', '2026-02-16T21:49:31.224Z', '2026-02-16T21:49:13.630Z');
INSERT INTO "email_verification_tokens" ("id", "user_id", "token_hash", "expires_at", "used_at", "created_at") VALUES ('5ef393a8-b6b5-4013-a890-62a91bbc7522', '7f20999b-103e-407b-8696-55a70a399e80', '68c1f7777c962fd3e7c250b649749bee009497248caaf368887288c0f498cdac', '2026-02-18T08:23:10.068Z', '2026-02-17T08:24:06.728Z', '2026-02-17T08:23:09.234Z');

-- Table: event_translations
DROP TABLE IF EXISTS "event_translations" CASCADE;
CREATE TABLE "event_translations" (
  "event_id" VARCHAR(50) NOT NULL,
  "lang" VARCHAR(5) NOT NULL,
  "name" VARCHAR(255),
  "description" TEXT,
  "location" VARCHAR(255),
  "category" VARCHAR(100),
  "organizer" VARCHAR(255),
  "price_display" VARCHAR(50),
  "status" VARCHAR(50),
  PRIMARY KEY ("event_id", "lang")
);

-- Table: events
DROP TABLE IF EXISTS "events" CASCADE;
CREATE TABLE "events" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "start_date" TIMESTAMPTZ NOT NULL,
  "end_date" TIMESTAMPTZ NOT NULL,
  "location" VARCHAR(255) NOT NULL,
  "image" VARCHAR(500),
  "category" VARCHAR(100) NOT NULL,
  "organizer" VARCHAR(255),
  "price" DOUBLE PRECISION,
  "price_display" VARCHAR(50),
  "status" VARCHAR(50),
  "place_id" VARCHAR(50),
  PRIMARY KEY ("id")
);

-- Data: events (1 rows)
INSERT INTO "events" ("id", "name", "description", "start_date", "end_date", "location", "image", "category", "organizer", "price", "price_display", "status", "place_id") VALUES ('1', 'Festival', 'coloring festival', '2026-02-15T19:54:00.000Z', '2026-02-15T21:54:00.000Z', 'Tripoli lebanon', '', 'Food & Restaurants', 'Me', 10, 'Free', 'active', NULL);

-- Table: feed_comments
DROP TABLE IF EXISTS "feed_comments" CASCADE;
CREATE TABLE "feed_comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "author_name" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Data: feed_comments (1 rows)
INSERT INTO "feed_comments" ("id", "post_id", "user_id", "author_name", "body", "created_at") VALUES ('4b08fbc4-6f5f-4f2f-aff9-f6c3dac7fd58', '83180661-1793-4ba0-824e-dbef2398f017', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'abdalrahman Hajjo', 'like the post !', '2026-02-20T09:23:22.109Z');

-- Table: feed_likes
DROP TABLE IF EXISTS "feed_likes" CASCADE;
CREATE TABLE "feed_likes" (
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("post_id", "user_id")
);

-- Data: feed_likes (5 rows)
INSERT INTO "feed_likes" ("post_id", "user_id", "created_at") VALUES ('83180661-1793-4ba0-824e-dbef2398f017', '889eeece-eaea-42fe-8b6f-984b25f4ed5f', '2026-02-20T11:00:10.073Z');
INSERT INTO "feed_likes" ("post_id", "user_id", "created_at") VALUES ('83180661-1793-4ba0-824e-dbef2398f017', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', '2026-02-20T11:18:57.870Z');
INSERT INTO "feed_likes" ("post_id", "user_id", "created_at") VALUES ('83180661-1793-4ba0-824e-dbef2398f017', '7f20999b-103e-407b-8696-55a70a399e80', '2026-02-20T11:33:09.658Z');
INSERT INTO "feed_likes" ("post_id", "user_id", "created_at") VALUES ('3ec3dd97-d351-41e0-a963-38acec93c1af', '7f20999b-103e-407b-8696-55a70a399e80', '2026-02-20T11:52:46.747Z');
INSERT INTO "feed_likes" ("post_id", "user_id", "created_at") VALUES ('3ec3dd97-d351-41e0-a963-38acec93c1af', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', '2026-03-01T10:01:57.401Z');

-- Table: feed_posts
DROP TABLE IF EXISTS "feed_posts" CASCADE;
CREATE TABLE "feed_posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "author_name" VARCHAR(255) NOT NULL,
  "place_id" VARCHAR(50),
  "caption" TEXT,
  "image_url" VARCHAR(500),
  "video_url" VARCHAR(500),
  "type" VARCHAR(20) DEFAULT 'image'::character varying,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "author_role" VARCHAR(20) DEFAULT 'regular'::character varying,
  PRIMARY KEY ("id")
);

-- Data: feed_posts (2 rows)
INSERT INTO "feed_posts" ("id", "user_id", "author_name", "place_id", "caption", "image_url", "video_url", "type", "created_at", "author_role") VALUES ('83180661-1793-4ba0-824e-dbef2398f017', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'abdalrahman Hajjo', 'hallab_sweets', 'Welcome to Your Home ! Peace of Love ', NULL, NULL, 'news', '2026-02-19T08:30:36.679Z', 'business_owner');
INSERT INTO "feed_posts" ("id", "user_id", "author_name", "place_id", "caption", "image_url", "video_url", "type", "created_at", "author_role") VALUES ('3ec3dd97-d351-41e0-a963-38acec93c1af', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'abdalrahman Hajjo', 'hallab_sweets', 'sweats', NULL, NULL, 'news', '2026-02-17T18:06:06.703Z', 'business_owner');

-- Table: feed_saves
DROP TABLE IF EXISTS "feed_saves" CASCADE;
CREATE TABLE "feed_saves" (
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("post_id", "user_id")
);

-- Data: feed_saves (2 rows)
INSERT INTO "feed_saves" ("post_id", "user_id", "created_at") VALUES ('3ec3dd97-d351-41e0-a963-38acec93c1af', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', '2026-02-20T09:43:42.887Z');
INSERT INTO "feed_saves" ("post_id", "user_id", "created_at") VALUES ('83180661-1793-4ba0-824e-dbef2398f017', '889eeece-eaea-42fe-8b6f-984b25f4ed5f', '2026-02-20T11:01:00.129Z');

-- Table: interest_translations
DROP TABLE IF EXISTS "interest_translations" CASCADE;
CREATE TABLE "interest_translations" (
  "interest_id" VARCHAR(50) NOT NULL,
  "lang" VARCHAR(5) NOT NULL,
  "name" VARCHAR(100),
  "description" TEXT,
  "tags" JSONB,
  PRIMARY KEY ("interest_id", "lang")
);

-- Table: interests
DROP TABLE IF EXISTS "interests" CASCADE;
CREATE TABLE "interests" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "icon" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(20) NOT NULL,
  "count" INTEGER DEFAULT 0,
  "popularity" INTEGER DEFAULT 0,
  "tags" JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY ("id")
);

-- Data: interests (8 rows)
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('nature', 'Nature & Outdoors', 'tree', 'Parks, beaches and natural spots', '#228B22', 0, 8, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('photography', 'Photography', 'camera', 'Scenic and photogenic locations', '#9932CC', 0, 6, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('culture', 'Culture & Heritage', 'landmark', 'Historic sites, traditions and local culture', '#8B4513', 0, 10, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('food', 'Food & Dining', 'utensils', 'Local cuisine, sweets and street food', '#CD853F', 0, 9, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('shopping', 'Shopping', 'shopping-bag', 'Markets, souks and handicrafts', '#D2691E', 0, 9, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('history', 'History', 'book', 'Ancient sites and historic monuments', '#4682B4', 0, 8, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('architecture', 'Architecture', 'building', 'Historic buildings and design', '#5F9EA0', 0, 7, '[]');
INSERT INTO "interests" ("id", "name", "icon", "description", "color", "count", "popularity", "tags") VALUES ('religion', 'Religious Sites', 'mosque', 'Mosques and spiritual places', '#6B8E23', 0, 7, '[]');

-- Table: password_reset_tokens
DROP TABLE IF EXISTS "password_reset_tokens" CASCADE;
CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Data: password_reset_tokens (2 rows)
INSERT INTO "password_reset_tokens" ("id", "user_id", "token_hash", "expires_at", "used_at", "created_at") VALUES ('92305c2e-74b1-4b03-9318-de8529bee687', '7f20999b-103e-407b-8696-55a70a399e80', '7978f5b0781bc06e82645117f73bd62cf2a9523467bd7bf05fa98cb7abd7c9fb', '2026-02-17T08:40:07.099Z', '2026-02-17T08:25:59.882Z', '2026-02-17T08:25:06.250Z');
INSERT INTO "password_reset_tokens" ("id", "user_id", "token_hash", "expires_at", "used_at", "created_at") VALUES ('38696f4f-988c-4734-ae43-a7da731c8fb0', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', '09edb400b08a74fe651cea4fe4ce7503d6e50020ab5fc5914631ef12defd8138', '2026-03-04T12:50:46.316Z', NULL, '2026-03-04T12:35:46.262Z');

-- Table: phone_otp_codes
DROP TABLE IF EXISTS "phone_otp_codes" CASCADE;
CREATE TABLE "phone_otp_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phone" VARCHAR(20) NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "attempts" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: place_owners
DROP TABLE IF EXISTS "place_owners" CASCADE;
CREATE TABLE "place_owners" (
  "user_id" UUID NOT NULL,
  "place_id" VARCHAR(50) NOT NULL,
  PRIMARY KEY ("place_id", "user_id")
);

-- Data: place_owners (1 rows)
INSERT INTO "place_owners" ("user_id", "place_id") VALUES ('3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'hallab_sweets');

-- Table: place_translations
DROP TABLE IF EXISTS "place_translations" CASCADE;
CREATE TABLE "place_translations" (
  "place_id" VARCHAR(50) NOT NULL,
  "lang" VARCHAR(5) NOT NULL,
  "name" VARCHAR(255),
  "description" TEXT,
  "location" VARCHAR(255),
  "category" VARCHAR(100),
  "duration" VARCHAR(50),
  "price" VARCHAR(50),
  "best_time" VARCHAR(100),
  "tags" JSONB,
  PRIMARY KEY ("lang", "place_id")
);

-- Table: places
DROP TABLE IF EXISTS "places" CASCADE;
CREATE TABLE "places" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "location" VARCHAR(255),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "search_name" VARCHAR(255),
  "images" JSONB DEFAULT '[]'::jsonb,
  "category" VARCHAR(100),
  "category_id" VARCHAR(50),
  "duration" VARCHAR(50),
  "price" VARCHAR(50),
  "best_time" VARCHAR(100),
  "rating" DOUBLE PRECISION,
  "review_count" INTEGER,
  "hours" JSONB,
  "tags" JSONB,
  PRIMARY KEY ("id")
);

-- Data: places (30 rows)
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('hallab_sweets', 'Abdul Rahman Hallab & Sons', 'Tripoli''s most famous sweet shop, established in 1881. Renowned for baklava, knefeh, and maamoul. The shop''s beautiful Ottoman-era building features traditional architecture.', 'Azmi Street, City Center', 34.43507, 35.834486, NULL, '["/uploads/places/5e0e37a43d74a56b1d7548c846e332ad.jpg","/uploads/places/ebf495f9de189c686785c0cc9204a78d.jpg","/uploads/places/d1600253690b8765218716fa93a3b89e.png"]', 'Food & Restaurants', 'food', '30 mins', '10', 'All Day (8 AM - 10 PM)', 4.9, 567, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_khayyatin', 'Khan al-Khayyatin (Tailors'' Market)', 'The largest covered market in Tripoli, dating back to the 14th century. This magnificent Mamluk-era structure spans over 1,200 square meters and houses dozens of textile shops and tailors.', 'Old City, Tripoli', 34.4333, 35.8333, NULL, '["https://mounzerhamze.com/wp-content/uploads/2020/09/Khayatine-4.jpg"]', 'Old Souks', 'souks', '1-2 hours', '0', 'Morning to Afternoon (9 AM - 4 PM)', 4.8, 256, NULL, '["market","textiles","historic","shopping","mamluk","crafts"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('great_mosque_tripoli', 'Great Mosque of Tripoli (Jami'' al-Kabir)', 'Originally built as the Cathedral of St. Mary of the Tower by the Crusaders in the 12th century, converted to a mosque after the Mamluk conquest in 1289. Unique blend of Crusader and Islamic architecture.', 'Old City Center', 34.4344, 35.8361, NULL, '["https://c8.alamy.com/compfr/c8r7ny/cour-de-la-grande-mosquee-vieille-ville-tripoli-dans-le-nord-du-liban-c8r7ny.jpg"]', 'Mosques & Religious', 'mosques', '45 mins - 1 hour', '0', 'Morning (9-11 AM) or Between Prayer Times', 4.8, 198, NULL, '["mosque","crusader","converted","architecture","gothic","mamluk"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_saboun', 'Khan al-Saboun (Soap Khan)', 'Famous for traditional Tripoli olive oil soap production, dating back to the 17th century. Watch master soap makers demonstrate the ancient craft. Purchase authentic Tripoli soap in various shapes and scents.', 'Old City, near Clock Tower', 34.4336, 35.8344, NULL, '["https://luxortravel.net/storage/707/khan-al-saboun-tripoli.jpg"]', 'Old Souks', 'souks', '45 mins - 1 hour', '0', 'All Day (9 AM - 6 PM)', 4.7, 189, NULL, '["soap","traditional","crafts","shopping","olive oil","artisan"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('taynal_mosque', 'Taynal Mosque', 'One of Tripoli''s most beautiful Mamluk mosques, built in 1336. Features stunning black and white striped stonework (ablaq), a magnificent minaret, and an elegant courtyard with a central fountain.', 'Old City Center', 34.4342, 35.8356, NULL, '["https://c8.alamy.com/comp/2JGW7BC/taynal-mosque-north-governorate-tripoli-lebanon-2JGW7BC.jpg"]', 'Mosques & Religious', 'mosques', '30-45 mins', '0', 'Between Prayer Times (10 AM - 12 PM or 2-4 PM)', 4.7, 167, NULL, '["mosque","mamluk","architecture","ablaq","minaret","peaceful"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('clock_tower', 'Tripoli Clock Tower (Al-Sa''at Square)', 'Iconic Ottoman-era clock tower built in 1901 to commemorate Sultan Abdul Hamid II''s reign. Standing 30 meters tall, the heart of Tripoli''s old city. The square is always bustling with activity.', 'Al-Sa''at Square, City Center', 34.4361, 35.8383, NULL, '["https://c8.alamy.com/comp/CN0CPP/clock-tower-in-tripoli-CN0CPP.jpg"]', 'Historical Sites', 'historical', '20-30 mins', '0', 'All Day, Best at Sunset', 4.6, 312, NULL, '["landmark","ottoman","square","historic","iconic","meeting point"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('madrasa_qartawiyya', 'Madrasa al-Qartawiyya', 'Stunning Mamluk-era Islamic school built in 1326. Features a beautiful courtyard with central fountain, intricate geometric patterns, elegant arches, and a magnificent portal with calligraphy.', 'Old City Center', 34.4339, 35.8353, NULL, '["https://c8.alamy.com/comp/ATD4YK/qartawiyya-madrasa-tripoli-lebanon-ATD4YK.jpg"]', 'Architecture', 'architecture', '45 mins - 1 hour', '0', 'Morning (9 AM - 12 PM)', 4.7, 145, NULL, '["madrasa","mamluk","geometric","courtyard","architecture","islamic school"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('gold_souk', 'Gold Souk (Souk al-Dhahab)', 'Vibrant market specializing in gold and jewelry with intricate designs and traditional Lebanese craftsmanship. Watch skilled goldsmiths at work. Bargaining is expected.', 'Old City, near Citadel', 34.4348, 35.8367, NULL, '["https://c8.alamy.com/comp/A3A73H/the-gold-souk-in-tripoli-libya-A3A73H.jpg"]', 'Old Souks', 'souks', '1-2 hours', '0', 'Afternoon (2-6 PM)', 4.5, 134, NULL, '["gold","jewelry","shopping","crafts","traditional","bargaining"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('burtasiyat_mosque', 'Burtasiyat Mosque', 'Beautiful Mamluk mosque built in 1310, known for its elegant octagonal minaret and peaceful courtyard. Features traditional Mamluk architecture with black and white striped stonework.', 'Old City, near Port', 34.4328, 35.8322, NULL, '["https://thumbs.dreamstime.com/z/al-bertasi-mosque-tripoli-der-libanon-138151158.jpg"]', 'Mosques & Religious', 'mosques', '30 mins', '0', 'Between Prayer Times', 4.7, 98, NULL, '["mosque","mamluk","minaret","peaceful","port","octagonal"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('spice_market', 'Spice Market (Souk al-Bahar)', 'Colorful and aromatic market filled with exotic spices, herbs, dried fruits, nuts, and traditional Middle Eastern ingredients. Perfect for za''atar, sumac, and regional specialties.', 'Old City, near Clock Tower', 34.4356, 35.8378, NULL, '["https://mybayutcdn.bayut.com/mybayut/wp-content/uploads/Spice-Souk-in-Dubai1-768x480.jpg"]', 'Old Souks', 'souks', '45 mins', '0', 'Morning (9 AM - 1 PM)', 4.7, 156, NULL, '["spices","herbs","food","aromatic","traditional","zaatar"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('muallaq_mosque', 'Al-Muallaq Mosque (Hanging Mosque)', 'Unique mosque built in the 16th century, known as the Hanging Mosque because it was constructed over shops and market stalls. Features beautiful Mamluk architecture and intricate decorations.', 'Old City Center', 34.4341, 35.8351, NULL, '["https://i0.wp.com/tripoli-lebanon.com/wp/wp-content/uploads/2021/07/11.jpg?w=890&ssl=1"]', 'Mosques & Religious', 'mosques', '30-45 mins', '0', 'Between Prayer Times', 4.8, 167, NULL, '["mosque","mamluk","unique","architecture","hanging","innovative"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_askar', 'Khan al-Askar (Soldiers'' Khan)', 'Historic covered market from the Mamluk period. Today houses shops selling traditional crafts, textiles, and souvenirs. Beautiful vaulted ceilings and stone arches.', 'Old City Center', 34.4335, 35.8347, NULL, '["https://mounzerhamze.com/wp-content/uploads/2020/09/khan-alaskar-1.jpg"]', 'Old Souks', 'souks', '1 hour', '0', 'Morning (9 AM - 1 PM)', 4.6, 112, NULL, '["market","historic","mamluk","crafts","authentic","local"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('attar_mosque', 'Al-Attar Mosque', 'Historic Mamluk mosque built in 1330, known for stunning geometric patterns and traditional Islamic architecture. Beautiful black and white striped stonework and impressive minaret.', 'Old City Center', 34.4343, 35.8355, NULL, '["https://c8.alamy.com/comp/C8R7BW/al-attar-mosque-from-the-14th-century-souk-tripoli-northern-lebanon-C8R7BW.jpg"]', 'Mosques & Religious', 'mosques', '30 mins', '0', 'Between Prayer Times', 4.6, 89, NULL, '["mosque","mamluk","geometric","islamic","calligraphy","peaceful"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('furn_samak', 'Burj al-Samak ', 'Local favorite famous for fresh fish sandwiches and traditional manakish. Unassuming street food spot serving locals for decades. Simple, authentic flavors.', 'Al mina', 34.454665, 35.8122797, NULL, '["/uploads/places/387f21f23da0bd3fc51fca6b8f37e5fa.jpg"]', 'Food & Restaurants', 'food', '30-45 mins', '8', 'Lunch (11 AM - 2 PM)', 4.1, 289, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('tripoli_museum', 'Tripoli Museum of History', 'Comprehensive museum showcasing Tripoli''s history from Phoenician times through Crusader, Mamluk, Ottoman, and modern eras. Artifacts, pottery, coins, weapons, manuscripts.', 'Azmi Street', 34.4372, 35.8391, NULL, '["/uploads/places/3d1cf4b1b1838230ff2ffa7c369b634b.jpg","/uploads/places/79bd7520921dc40f920b7051a29bf85f.jpg","/uploads/places/a9319bc2c959db9836e5a058b81deb10.jpg","/uploads/places/9817b90e0878864743c54cc2ca32cf36.jpg"]', 'Cultural Centers', 'cultural', '1.5-2 hours', '3', 'Morning or Afternoon (9 AM - 4 PM)', 4.5, 145, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_misriyye', 'Khan al-Misriyye (Egyptian Khan)', 'Historic khan built in the 14th century, originally used by Egyptian merchants. Beautiful Mamluk architecture with central courtyard and arched passageways.', 'Old City Center', 34.4337, 35.8349, NULL, '["https://i0.wp.com/tripoli-lebanon.com/wp/wp-content/uploads/2021/06/khan-misriin.jpg?w=886&ssl=1"]', 'Old Souks', 'souks', '45 mins - 1 hour', '0', 'Morning (9 AM - 1 PM)', 4.5, 78, NULL, '["market","historic","mamluk","crafts","egyptian","merchants"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('madrasa_nuriyya', 'Madrasa al-Nuriyya', 'Beautiful Mamluk-era Islamic school built in 1333. Elegant courtyard, beautiful portal with calligraphy, peaceful atmosphere.', 'Old City Center', 34.434, 35.8352, NULL, '["https://c8.alamy.com/comp/ATD89X/nuriyya-madrasa-tripoli-lebanon-ATD89X.jpg"]', 'Architecture', 'architecture', '45 mins', '0', 'Morning (9 AM - 12 PM)', 4.6, 67, NULL, '["madrasa","mamluk","architecture","islamic school","courtyard","peaceful"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('abu_ali_river', 'Abu Ali River Promenade', 'Scenic promenade along the Abu Ali River. Walking paths, cafes, green spaces. Beautiful views of river, bridges, and surrounding architecture.', 'Along Abu Ali River', 34.4389, 35.84, NULL, '["https://thumbs.dreamstime.com/z/medieval-citadel-next-to-river-abou-ali-tripoli-lebanon-162839614.jpg"]', 'Historical Sites', 'historical', '1 hour', '0', 'Evening (5-8 PM) or Early Morning', 4.4, 112, NULL, '["river","promenade","scenic","peaceful","walking","cafes"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_shuna', 'Khan al-Shuna', 'Historic khan from the Mamluk period. Central courtyard surrounded by two-story arcades. Shops selling traditional products, crafts, and local goods.', 'Old City Center', 34.4338, 35.835, NULL, '["https://i.pinimg.com/originals/38/36/99/38369921bb692bb5314fac5a39ede69c.jpg"]', 'Old Souks', 'souks', '45 mins - 1 hour', '0', 'Morning (9 AM - 1 PM)', 4.5, 89, NULL, '["market","historic","mamluk","architecture","courtyard","traditional"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('sidi_abdul_wahid', 'Sidi Abdul Wahid Mosque', 'Historic mosque built in the 14th century, dedicated to a local saint. Traditional Mamluk architecture with beautiful minaret and peaceful interior.', 'Old City Center', 34.4334, 35.8345, NULL, '["https://i0.wp.com/tripoli-lebanon.com/wp/wp-content/uploads/2021/07/list3-09.jpg?resize=893%2C583&ssl=1"]', 'Mosques & Religious', 'mosques', '20-30 mins', '0', 'Between Prayer Times', 4.5, 56, NULL, '["mosque","mamluk","saint","spiritual","peaceful","historic"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_aziz', 'Khan al-Aziz', 'Smaller charming khan with traditional architecture. Shops selling local crafts, textiles, traditional products. More intimate, less crowded atmosphere.', 'Old City Center', 34.4336, 35.8348, NULL, '["https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhjOkQSMpKkAzkF4J5cqMsYIN5ZTfiv5S89B42iDW5fgf6iDidC0hVl95paXCoFntlOTELU2uktyC1e2xI2nHNS06W5Cc5kNH37hO6Ie2jf0QrSOSwiqrCQmFHNGy-jA4YoAwFLwOFPoCV0/w1200-h630-p-k-no-nu/Lebanon53.jpg"]', 'Old Souks', 'souks', '30-45 mins', '0', 'Morning (9 AM - 1 PM)', 4.4, 78, NULL, '["market","historic","crafts","intimate","traditional","local"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('madrasa_tawriziyya', 'Madrasa al-Tawriziyya', 'Beautiful Mamluk-era Islamic school built in 1326. Elegant courtyard, portal with geometric patterns. Sophisticated Mamluk architectural style.', 'Old City Center', 34.4341, 35.8354, NULL, '["https://c8.alamy.com/comp/ATDEGN/mashad-madrasa-tripoli-lebanon-ATDEGN.jpg"]', 'Architecture', 'architecture', '45 mins', '0', 'Morning (9 AM - 12 PM)', 4.6, 67, NULL, '["madrasa","mamluk","architecture","islamic school","geometric","peaceful"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('cultural_heritage_center', 'Rachid Karame Cultural Center', 'Center preserving Tripoli''s cultural heritage through exhibitions and workshops. Traditional crafts, local customs. Workshops on soap making, weaving, metalwork.', 'City Center', 34.4396133422852, 35.825912, NULL, '["/uploads/places/bb985dc4a8b84744f656037afe594aba.jpg","/uploads/places/ff2e66aaf96c59d04e1bccfde99488d8.jpg","/uploads/places/9bac2b6e32b8a3203e846167bd9b3e43.jpg","/uploads/places/68c537458caf5d1fd7f6ad4a87418efb.jpg","/uploads/places/753b999ece9870ce4813999d173ab567.jpg","/uploads/places/9f29d177ed3466f516d0ca10554787f2.jpg","/uploads/places/f5451c8041bdb556934d3ccdf5b611d5.jpg"]', 'Cultural Centers', 'cultural', '1-1.5 hours', '4', 'Afternoon (2-5 PM)', 4.5, 89, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('khan_franji', 'Khan al-Franji (Frankish Khan)', 'Historic khan from the Crusader period, later used by European merchants. Mix of Crusader and Mamluk architectural styles. Testament to Tripoli''s role as trading hub.', 'Old City Center', 34.4339, 35.8351, NULL, '["https://www.rjtravelagency.com/wp-content/uploads/2023/04/Khan-Al-Franj.jpg"]', 'Old Souks', 'souks', '45 mins - 1 hour', '0', 'Morning (9 AM - 1 PM)', 4.5, 67, NULL, '["market","historic","crusader","frankish","trading","architecture"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('place_2', 'Khan al-Saboun', 'Traditional soap market', 'Old City', 34.435, 35.839, NULL, '[]', 'Markets & Souks', 'markets', '1 hour', 'varies', 'Any', 4.5, 85, NULL, '["soap","souvenirs"]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('cafe_nostalgie', 'Cafe Younes', 'Charming traditional café serving authentic Lebanese coffee, tea, and light snacks. Vintage furniture, old photographs. Locals gather to play backgammon and socialize.', 'Old City Center', 34.4351, 35.8365, NULL, '["/uploads/places/b8533315f0a917f58e73077da69d5aca.jpg","/wp-content/uploads/2023/04/Cafe-Younes-3-FINAL-1024x538.jpg"]', 'Food & Restaurants', 'food', '45 mins - 1 hour', '5', 'All Day, Best in Afternoon', 4.5, 198, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('Akra', 'Akra', 'Akra is an old family business that serves traditional Lebanese breakfast. Today, Akra tops the must-visit list of Tripoli, Lebanon. Experience an authentic breakfast with an original taste before you start your day off in the city!', 'Al Koura Square Mohammad El Husseini Street, Tripoli 1300 Lebanon', 34.4356246, 35.8402394, NULL, '["/uploads/places/0e94e2b1929781c4769bc9d4c2e5451f.jpg"]', 'Food & Restaurants', 'food', '0.5-1 hours', '', '', 4.2, NULL, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('Baytna', 'Baytna', '#2 of 48 Restaurants in Tripoli
Lebanese, Mediterranean ', '', 34.4287527, 35.8282973, NULL, '["/uploads/places/17f4ce997c8c48ab63fcf61b0b4563e5.jpg"]', 'Food & Restaurants', 'food', '', '', '', 4.4, NULL, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('Rawand', 'Rawand', 'Rawand is the perfect place to enjoy fine food and great cocktails with excellent service in comfortable and atmospheric surroundings. Offering a relaxed atmosphere with its soft lighting, Rawand is a unique boutique style restaurant; it offers its guests an intimate and cozy setting.', 'Achier El Daya, Tripoli, North 1300', 34.428436, 35.8285179138184, NULL, '["/uploads/places/9cc0c4adb10fc951e7c686f75fa032b7.webp"]', 'Food & Restaurants', 'food', '', '', '', 4, NULL, NULL, '[]');
INSERT INTO "places" ("id", "name", "description", "location", "latitude", "longitude", "search_name", "images", "category", "category_id", "duration", "price", "best_time", "rating", "review_count", "hours", "tags") VALUES ('place_1', 'Citadel of Tripoli', 'Historic fortress overlooking the city', 'Tripoli', 34.433399, 34.8445014953613, NULL, '["/uploads/places/c87dae9b3bc47a18cfe328151819004d.jpg"]', 'Historic Sites', 'historic', '2-3 hours', 'Free', 'Morning', 4.4, 120, NULL, '[]');

-- Table: profiles
DROP TABLE IF EXISTS "profiles" CASCADE;
CREATE TABLE "profiles" (
  "user_id" UUID NOT NULL,
  "username" VARCHAR(100),
  "city" VARCHAR(255),
  "bio" TEXT,
  "mood" VARCHAR(50) DEFAULT 'mixed'::character varying,
  "pace" VARCHAR(50) DEFAULT 'normal'::character varying,
  "analytics" BOOLEAN DEFAULT true,
  "show_tips" BOOLEAN DEFAULT true,
  "app_rating" INTEGER DEFAULT 0,
  "updated_at" TIMESTAMPTZ DEFAULT now(),
  "onboarding_completed" BOOLEAN DEFAULT false,
  "onboarding_completed_at" TIMESTAMPTZ,
  PRIMARY KEY ("user_id")
);

-- Data: profiles (4 rows)
INSERT INTO "profiles" ("user_id", "username", "city", "bio", "mood", "pace", "analytics", "show_tips", "app_rating", "updated_at", "onboarding_completed", "onboarding_completed_at") VALUES ('889eeece-eaea-42fe-8b6f-984b25f4ed5f', NULL, NULL, NULL, 'mixed', 'normal', true, true, 0, '2026-02-16T21:49:38.732Z', true, '2026-02-16T21:49:39.345Z');
INSERT INTO "profiles" ("user_id", "username", "city", "bio", "mood", "pace", "analytics", "show_tips", "app_rating", "updated_at", "onboarding_completed", "onboarding_completed_at") VALUES ('7f20999b-103e-407b-8696-55a70a399e80', NULL, NULL, NULL, 'mixed', 'normal', true, true, 0, '2026-02-17T08:24:20.076Z', true, '2026-02-17T08:24:20.931Z');
INSERT INTO "profiles" ("user_id", "username", "city", "bio", "mood", "pace", "analytics", "show_tips", "app_rating", "updated_at", "onboarding_completed", "onboarding_completed_at") VALUES ('462d834c-0d5d-447e-b883-ad6ec7a14f8d', NULL, NULL, NULL, 'mixed', 'normal', true, true, 0, '2026-03-01T12:11:55.910Z', true, '2026-03-01T12:11:55.854Z');
INSERT INTO "profiles" ("user_id", "username", "city", "bio", "mood", "pace", "analytics", "show_tips", "app_rating", "updated_at", "onboarding_completed", "onboarding_completed_at") VALUES ('3fd98eac-eccb-4de0-8718-d05c5ca01d01', '@abdalrahmanhajjo', '', '', 'mixed', 'normal', true, true, 0, '2026-03-01T00:57:14.363Z', true, '2026-03-01T00:57:14.273Z');

-- Table: saved_events
DROP TABLE IF EXISTS "saved_events" CASCADE;
CREATE TABLE "saved_events" (
  "user_id" UUID NOT NULL,
  "event_id" VARCHAR(50) NOT NULL,
  PRIMARY KEY ("event_id", "user_id")
);

-- Table: saved_places
DROP TABLE IF EXISTS "saved_places" CASCADE;
CREATE TABLE "saved_places" (
  "user_id" UUID NOT NULL,
  "place_id" VARCHAR(50) NOT NULL,
  PRIMARY KEY ("place_id", "user_id")
);

-- Data: saved_places (2 rows)
INSERT INTO "saved_places" ("user_id", "place_id") VALUES ('3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'khan_franji');
INSERT INTO "saved_places" ("user_id", "place_id") VALUES ('3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'hallab_sweets');

-- Table: saved_tours
DROP TABLE IF EXISTS "saved_tours" CASCADE;
CREATE TABLE "saved_tours" (
  "user_id" UUID NOT NULL,
  "tour_id" VARCHAR(50) NOT NULL,
  PRIMARY KEY ("tour_id", "user_id")
);

-- Table: tour_translations
DROP TABLE IF EXISTS "tour_translations" CASCADE;
CREATE TABLE "tour_translations" (
  "tour_id" VARCHAR(50) NOT NULL,
  "lang" VARCHAR(5) NOT NULL,
  "name" VARCHAR(255),
  "description" TEXT,
  "difficulty" VARCHAR(50),
  "badge" VARCHAR(50),
  "duration" VARCHAR(50),
  "price_display" VARCHAR(50),
  "includes" JSONB,
  "excludes" JSONB,
  "highlights" JSONB,
  "itinerary" JSONB,
  PRIMARY KEY ("lang", "tour_id")
);

-- Table: tours
DROP TABLE IF EXISTS "tours" CASCADE;
CREATE TABLE "tours" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "duration" VARCHAR(50) NOT NULL,
  "duration_hours" INTEGER NOT NULL,
  "locations" INTEGER NOT NULL,
  "rating" DOUBLE PRECISION NOT NULL,
  "reviews" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "currency" VARCHAR(10) NOT NULL,
  "price_display" VARCHAR(50) NOT NULL,
  "badge" VARCHAR(50),
  "badge_color" VARCHAR(20),
  "description" TEXT NOT NULL,
  "image" VARCHAR(500) NOT NULL,
  "difficulty" VARCHAR(50) NOT NULL,
  "languages" JSONB DEFAULT '[]'::jsonb,
  "includes" JSONB DEFAULT '[]'::jsonb,
  "excludes" JSONB DEFAULT '[]'::jsonb,
  "highlights" JSONB DEFAULT '[]'::jsonb,
  "itinerary" JSONB DEFAULT '[]'::jsonb,
  "place_ids" JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY ("id")
);

-- Data: tours (4 rows)
INSERT INTO "tours" ("id", "name", "duration", "duration_hours", "locations", "rating", "reviews", "price", "currency", "price_display", "badge", "badge_color", "description", "image", "difficulty", "languages", "includes", "excludes", "highlights", "itinerary", "place_ids") VALUES ('tour_old_city', 'Old City Highlights', '4-5 hours', 5, 5, 4.7, 128, 15, 'USD', '$15', 'Popular', '#0F766E', 'Discover Tripoli''s most iconic historic sites: the Citadel, Clock Tower, and stunning Mamluk mosques. A guided journey through centuries of history.', 'https://thumbs.dreamstime.com/z/medieval-citadel-next-to-river-abou-ali-tripoli-lebanon-162839614.jpg', 'Easy', '["English","Arabic"]', '["Expert local guide","Walking tour"]', '[]', '["Visit Abu Ali River Promenade","Visit Tripoli Clock Tower (Al-Sa''at Square)","Visit Madrasa al-Nuriyya"]', '[{"time":"09:00","activity":"Abu Ali River Promenade","description":"Scenic promenade along the Abu Ali River. Walking paths, cafes, green spaces. Beautiful views of river, bridges, and sur..."},{"time":"11:00","activity":"Tripoli Clock Tower (Al-Sa''at Square)","description":"Iconic Ottoman-era clock tower built in 1901 to commemorate Sultan Abdul Hamid II''s reign. Standing 30 meters tall, the ..."},{"time":"13:00","activity":"Madrasa al-Nuriyya","description":"Beautiful Mamluk-era Islamic school built in 1333. Elegant courtyard, beautiful portal with calligraphy, peaceful atmosp..."},{"time":"15:00","activity":"Madrasa al-Qartawiyya","description":"Stunning Mamluk-era Islamic school built in 1326. Features a beautiful courtyard with central fountain, intricate geomet..."},{"time":"17:00","activity":"Madrasa al-Tawriziyya","description":"Beautiful Mamluk-era Islamic school built in 1326. Elegant courtyard, portal with geometric patterns. Sophisticated Maml..."}]', '["abu_ali_river","clock_tower","madrasa_nuriyya","madrasa_qartawiyya","madrasa_tawriziyya"]');
INSERT INTO "tours" ("id", "name", "duration", "duration_hours", "locations", "rating", "reviews", "price", "currency", "price_display", "badge", "badge_color", "description", "image", "difficulty", "languages", "includes", "excludes", "highlights", "itinerary", "place_ids") VALUES ('tour_food_tasting', 'Tripoli Food Tour', '3-4 hours', 4, 5, 4.7, 128, 25, 'USD', '$25', 'Foodie', '#D97706', 'Taste authentic Lebanese cuisine: Hallab sweets, street food, traditional cafés, and local restaurants. A culinary journey through Tripoli.', '/uploads/places/5e0e37a43d74a56b1d7548c846e332ad.jpg', 'Easy', '["English","Arabic"]', '["Expert local guide","Walking tour"]', '[]', '["Visit Abdul Rahman Hallab & Sons","Visit Akra","Visit Baytna"]', '[{"time":"09:00","activity":"Abdul Rahman Hallab & Sons","description":"Tripoli''s most famous sweet shop, established in 1881. Renowned for baklava, knefeh, and maamoul. The shop''s beautiful O..."},{"time":"11:00","activity":"Akra","description":"Akra is an old family business that serves traditional Lebanese breakfast. Today, Akra tops the must-visit list of Tripo..."},{"time":"13:00","activity":"Baytna","description":"#2 of 48 Restaurants in Tripoli\nLebanese, Mediterranean "},{"time":"15:00","activity":"Burj al-Samak ","description":"Local favorite famous for fresh fish sandwiches and traditional manakish. Unassuming street food spot serving locals for..."},{"time":"17:00","activity":"Cafe Younes","description":"Charming traditional café serving authentic Lebanese coffee, tea, and light snacks. Vintage furniture, old photographs. ..."}]', '["hallab_sweets","Akra","Baytna","furn_samak","cafe_nostalgie"]');
INSERT INTO "tours" ("id", "name", "duration", "duration_hours", "locations", "rating", "reviews", "price", "currency", "price_display", "badge", "badge_color", "description", "image", "difficulty", "languages", "includes", "excludes", "highlights", "itinerary", "place_ids") VALUES ('tour_souks_markets', 'Souks & Markets Tour', '3-4 hours', 4, 5, 4.7, 128, 0, 'USD', 'Free', 'Free', '#059669', 'Explore the vibrant souks: Khan al-Khayyatin, Soap Khan, Spice Market, and Gold Souk. Experience authentic Tripoli shopping and crafts.', 'https://c8.alamy.com/comp/A3A73H/the-gold-souk-in-tripoli-libya-A3A73H.jpg', 'Easy', '["English","Arabic"]', '["Expert local guide","Walking tour"]', '[]', '["Visit Gold Souk (Souk al-Dhahab)","Visit Khan al-Askar (Soldiers'' Khan)","Visit Khan al-Aziz"]', '[{"time":"09:00","activity":"Gold Souk (Souk al-Dhahab)","description":"Vibrant market specializing in gold and jewelry with intricate designs and traditional Lebanese craftsmanship. Watch ski..."},{"time":"11:00","activity":"Khan al-Askar (Soldiers'' Khan)","description":"Historic covered market from the Mamluk period. Today houses shops selling traditional crafts, textiles, and souvenirs. ..."},{"time":"13:00","activity":"Khan al-Aziz","description":"Smaller charming khan with traditional architecture. Shops selling local crafts, textiles, traditional products. More in..."},{"time":"15:00","activity":"Khan al-Franji (Frankish Khan)","description":"Historic khan from the Crusader period, later used by European merchants. Mix of Crusader and Mamluk architectural style..."},{"time":"17:00","activity":"Khan al-Khayyatin (Tailors'' Market)","description":"The largest covered market in Tripoli, dating back to the 14th century. This magnificent Mamluk-era structure spans over..."}]', '["gold_souk","khan_askar","khan_aziz","khan_franji","khan_khayyatin"]');
INSERT INTO "tours" ("id", "name", "duration", "duration_hours", "locations", "rating", "reviews", "price", "currency", "price_display", "badge", "badge_color", "description", "image", "difficulty", "languages", "includes", "excludes", "highlights", "itinerary", "place_ids") VALUES ('tour_culture_architecture', 'Culture & Architecture', '4-5 hours', 5, 5, 4.7, 128, 10, 'USD', '$10', 'Cultural', '#4B0082', 'Museums, madrasas, mosques, and Mamluk mansions. Dive into Tripoli''s rich cultural heritage and architectural marvels.', '/uploads/places/bb985dc4a8b84744f656037afe594aba.jpg', 'Moderate', '["English","Arabic"]', '["Expert local guide","Walking tour"]', '[]', '["Visit Rachid Karame Cultural Center","Visit Tripoli Museum of History","Visit Al-Attar Mosque"]', '[{"time":"09:00","activity":"Rachid Karame Cultural Center","description":"Center preserving Tripoli''s cultural heritage through exhibitions and workshops. Traditional crafts, local customs. Work..."},{"time":"11:00","activity":"Tripoli Museum of History","description":"Comprehensive museum showcasing Tripoli''s history from Phoenician times through Crusader, Mamluk, Ottoman, and modern er..."},{"time":"13:00","activity":"Al-Attar Mosque","description":"Historic Mamluk mosque built in 1330, known for stunning geometric patterns and traditional Islamic architecture. Beauti..."},{"time":"15:00","activity":"Al-Muallaq Mosque (Hanging Mosque)","description":"Unique mosque built in the 16th century, known as the Hanging Mosque because it was constructed over shops and market st..."},{"time":"17:00","activity":"Burtasiyat Mosque","description":"Beautiful Mamluk mosque built in 1310, known for its elegant octagonal minaret and peaceful courtyard. Features traditio..."}]', '["cultural_heritage_center","tripoli_museum","attar_mosque","muallaq_mosque","burtasiyat_mosque"]');

-- Table: trips
DROP TABLE IF EXISTS "trips" CASCADE;
CREATE TABLE "trips" (
  "id" VARCHAR(50) NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "description" TEXT,
  "days" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Data: trips (3 rows)
INSERT INTO "trips" ("id", "user_id", "name", "start_date", "end_date", "description", "days", "created_at") VALUES ('trip_1771447424333_5o08a7j', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'Old City Highlights', '2026-02-24T22:00:00.000Z', '2026-02-26T22:00:00.000Z', 'Must-see historic sites, citadel, mosques, and the Clock Tower.', '[{"date":"2026-02-25","slots":[{"endTime":"11:00","placeId":"hallab_sweets","startTime":"9:00"},{"endTime":"13:00","placeId":"abu_ali_river","startTime":"11:00"},{"endTime":"15:00","placeId":"Akra","startTime":"13:00"}]},{"date":"2026-02-26","slots":[{"endTime":"11:00","placeId":"attar_mosque","startTime":"9:00"},{"endTime":"13:00","placeId":"muallaq_mosque","startTime":"11:00"},{"endTime":"15:00","placeId":"Baytna","startTime":"13:00"}]}]', '2026-02-18T20:43:44.349Z');
INSERT INTO "trips" ("id", "user_id", "name", "start_date", "end_date", "description", "days", "created_at") VALUES ('trip_1771447424585_yh62mc2', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'Souks & Food Tour', '2026-03-03T22:00:00.000Z', '2026-03-05T22:00:00.000Z', 'Markets, souks, and authentic Lebanese dining.', '[{"date":"2026-02-25","slots":[{"endTime":"11:00","placeId":"gold_souk","startTime":"9:00"},{"endTime":"13:00","placeId":"khan_askar","startTime":"11:00"},{"endTime":"15:00","placeId":"khan_aziz","startTime":"13:00"}]},{"date":"2026-02-26","slots":[{"endTime":"11:00","placeId":"khan_franji","startTime":"9:00"},{"endTime":"13:00","placeId":"khan_khayyatin","startTime":"11:00"},{"endTime":"15:00","placeId":"khan_misriyye","startTime":"13:00"}]},{"date":"2026-02-27","slots":[{"endTime":"11:00","placeId":"khan_saboun","startTime":"9:00"},{"endTime":"13:00","placeId":"khan_shuna","startTime":"11:00"}]}]', '2026-02-18T20:43:44.600Z');
INSERT INTO "trips" ("id", "user_id", "name", "start_date", "end_date", "description", "days", "created_at") VALUES ('trip_1771447424773_ntjrlef', '3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'Culture & Architecture', '2026-03-10T22:00:00.000Z', '2026-03-12T22:00:00.000Z', 'Museums, madrasas, mosques, and Mamluk architecture.', '[{"date":"2026-02-25","slots":[{"endTime":"11:00","placeId":"cultural_heritage_center","startTime":"9:00"},{"endTime":"13:00","placeId":"tripoli_museum","startTime":"11:00"},{"endTime":"15:00","placeId":"attar_mosque","startTime":"13:00"}]},{"date":"2026-02-26","slots":[{"endTime":"11:00","placeId":"muallaq_mosque","startTime":"9:00"},{"endTime":"13:00","placeId":"burtasiyat_mosque","startTime":"11:00"},{"endTime":"15:00","placeId":"great_mosque_tripoli","startTime":"13:00"}]}]', '2026-02-18T20:43:44.787Z');

-- Table: users
DROP TABLE IF EXISTS "users" CASCADE;
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255),
  "name" VARCHAR(255),
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "auth_provider" VARCHAR(50) DEFAULT 'email'::character varying,
  "auth_provider_id" VARCHAR(255),
  "email_verified" BOOLEAN DEFAULT false,
  "phone_verified" BOOLEAN DEFAULT false,
  "is_admin" BOOLEAN DEFAULT false,
  "is_business_owner" BOOLEAN DEFAULT false,
  "avatar_url" TEXT,
  PRIMARY KEY ("id")
);

-- Data: users (4 rows)
INSERT INTO "users" ("id", "email", "password_hash", "name", "created_at", "auth_provider", "auth_provider_id", "email_verified", "phone_verified", "is_admin", "is_business_owner", "avatar_url") VALUES ('889eeece-eaea-42fe-8b6f-984b25f4ed5f', 'abedhajjo56@gmail.com', '$2a$12$kL7Vy0vXFYfDHCehYx2fqe7ruh.xfAfZrdBZrUGQnGOF6gDTNkeAq', 'abed hajjo', '2026-02-16T21:42:32.776Z', 'email', NULL, true, false, false, false, NULL);
INSERT INTO "users" ("id", "email", "password_hash", "name", "created_at", "auth_provider", "auth_provider_id", "email_verified", "phone_verified", "is_admin", "is_business_owner", "avatar_url") VALUES ('7f20999b-103e-407b-8696-55a70a399e80', 'm.matari2005@gmail.com', '$2a$12$a/Xq7L6E4bLv9/.6qLQT3uh.EoMdcgr/9yZWasszlhGs6fnY4tG9O', 'Mohammed Matari', '2026-02-17T08:23:08.735Z', 'email', NULL, true, false, false, false, NULL);
INSERT INTO "users" ("id", "email", "password_hash", "name", "created_at", "auth_provider", "auth_provider_id", "email_verified", "phone_verified", "is_admin", "is_business_owner", "avatar_url") VALUES ('462d834c-0d5d-447e-b883-ad6ec7a14f8d', 'ahmadhajjo57@gmail.com', NULL, 'Ahmad Hajjo', '2026-03-01T12:08:25.360Z', 'google', '103229502600069170717', true, false, false, false, NULL);
INSERT INTO "users" ("id", "email", "password_hash", "name", "created_at", "auth_provider", "auth_provider_id", "email_verified", "phone_verified", "is_admin", "is_business_owner", "avatar_url") VALUES ('3fd98eac-eccb-4de0-8718-d05c5ca01d01', 'abedhajjo57@gmail.com', '$2a$12$fmZZATI.b4GpwcsAXxVKPugPJ7kzP6f03A7FHGu8BcqtgFA0rkoz6', 'abdalrahman Hajjo', '2026-02-15T22:55:26.997Z', 'email', NULL, true, false, false, true, '/uploads/images/4f5ac2857d4cf3b853f30068af22bcaf.jpg');
