-- Contact phone on visitor inquiries (proposals / messages to venues).
ALTER TABLE place_inquiries
  ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(40);
