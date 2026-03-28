-- Remove all feed posts (reels/posts), trips, saved places, and place-tied engagement.
-- feed_comments / likes / saves cascade from feed_posts where FKs are present.

DELETE FROM feed_posts;

DELETE FROM trips;

DELETE FROM saved_places;
DELETE FROM user_favourites;

DELETE FROM place_checkins;
DELETE FROM place_inquiries;
DELETE FROM place_messaging_blocks;
DELETE FROM place_promotions;
DELETE FROM place_reviews;
DELETE FROM place_owners;
