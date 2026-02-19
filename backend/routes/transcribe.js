const express = require('express');
const router = express.Router();
const multer = require('multer');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/transcribe — Azure Speech-to-Text with auto language detection
router.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const speechKey = process.env.AZURE_SPEECH_KEY;
        const speechRegion = process.env.AZURE_SPEECH_REGION;

        if (!speechKey || !speechRegion) {
            console.error('Azure Speech credentials missing');
            return res.status(500).json({ error: 'transcription_failed', message: 'Speech service not configured' });
        }

        const audioBuffer = req.file.buffer;

        // Create push stream and push audio data
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(audioBuffer);
        pushStream.close();

        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);

        // Set up auto language detection for Indian languages
        const autoDetectConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages([
            'ta-IN', 'te-IN', 'ml-IN', 'hi-IN', 'en-IN'
        ]);

        const recognizer = sdk.SpeechRecognizer.FromConfig(
            speechConfig, autoDetectConfig, audioConfig
        );

        const result = await new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync(
                (result) => {
                    recognizer.close();
                    resolve(result);
                },
                (err) => {
                    recognizer.close();
                    reject(err);
                }
            );
        });

        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            const detectedLang = result.language ||
                sdk.AutoDetectSourceLanguageResult.fromResult(result)?.language || 'en-IN';

            console.log(`🎤 Transcribed: "${result.text}" [${detectedLang}]`);

            res.json({
                transcript: result.text,
                detectedLanguage: detectedLang,
            });
        } else if (result.reason === sdk.ResultReason.NoMatch) {
            console.log('🎤 No speech recognized');
            res.json({ transcript: '', error: 'no_speech' });
        } else {
            console.error('🎤 Recognition failed:', result.reason);
            res.status(400).json({ error: 'transcription_failed' });
        }
    } catch (err) {
        console.error('Transcription error:', err);
        res.status(500).json({ error: 'transcription_failed', message: err.message });
    }
});

module.exports = router;
