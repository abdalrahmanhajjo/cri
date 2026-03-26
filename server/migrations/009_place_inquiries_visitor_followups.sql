-- Extra visitor messages on the same inquiry thread (same proposal).
ALTER TABLE place_inquiries
  ADD COLUMN IF NOT EXISTS visitor_followups JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN place_inquiries.visitor_followups IS
  'Array of { "body": string, "createdAt": ISO string } appended when visitor continues the thread.';
