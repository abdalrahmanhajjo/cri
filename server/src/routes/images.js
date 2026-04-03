const express = require('express');
const { getGridFSBucket } = require('../mongo');

const router = express.Router();

/**
 * GET /api/images/:filename
 * Streams an image/video from MongoDB GridFS
 */
router.get('/:filename', async (req, res) => {
  try {
    const bucket = await getGridFSBucket();
    const filename = req.params.filename;

    // Check if file exists
    const files = await bucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream from GridFS
    const downloadStream = bucket.openDownloadStreamByName(filename);
    
    downloadStream.on('error', (err) => {
      console.error('[images] download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream image' });
      }
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('[images] route error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
