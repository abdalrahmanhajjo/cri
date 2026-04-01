-- Remove all tours, events, user saves, and translation rows for them.

DELETE FROM saved_events;
DELETE FROM saved_tours;

DELETE FROM event_translations;
DELETE FROM tour_translations;

DELETE FROM events;
DELETE FROM tours;
