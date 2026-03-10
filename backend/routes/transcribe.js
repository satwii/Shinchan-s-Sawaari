const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/transcribe — Sarvam AI saaras:v3 (native Indian script output)
router.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file received' });
        }

        const sarvamKey = process.env.SARVAM_API_KEY;
        if (!sarvamKey) {
            console.error('SARVAM_API_KEY missing from .env');
            return res.status(500).json({ error: 'transcription_failed', message: 'Sarvam API key not configured' });
        }

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'audio.webm',
            contentType: req.file.mimetype || 'audio/webm',
        });
        formData.append('model', 'saaras:v3');
        formData.append('language_code', 'unknown'); // auto-detect
        formData.append('mode', 'transcribe');        // returns native script

        const response = await axios.post(
            'https://api.sarvam.ai/speech-to-text',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'api-subscription-key': sarvamKey,
                },
                timeout: 15000,
            }
        );

        const transcript = response.data.transcript || '';
        const detectedLanguage = response.data.language_code || 'en-IN';

        console.log(`🎤 Sarvam transcript: "${transcript}" [${detectedLanguage}]`);

        if (!transcript.trim()) {
            return res.json({ transcript: '', error: 'no_speech' });
        }

        res.json({ transcript, detectedLanguage });

    } catch (err) {
        console.error('Sarvam transcription error:', err.response?.data || err.message);
        res.status(500).json({ error: 'transcription_failed', message: err.message });
    }
});

module.exports = router;
