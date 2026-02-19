const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

function getSystemPrompt() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    return `You are Sawaari AI, a helpful ride-sharing assistant for the Sawaari app — a hyperlocal cab-sharing and carpooling platform in India. You help users in their native language.

Today's date is ${dateStr} and current time is ${timeStr}.

You can perform these ACTIONS by returning structured JSON:

1. SEARCH_RIDES — extract source, destination, date, time, passenger count from user message and search available rides
2. REGISTER_RIDE — collect source, destination, date, time, vehicle type, seat count from user and register a new ride
3. REQUEST_JOIN — help user request to join a specific ride (needs rideId)
4. TRIGGER_SOS — if user says anything indicating danger, distress or emergency including:
   Tamil: உதவி, ஆபத்து, காப்பாற்று, பயமாக இருக்கு
   Telugu: సహాయం, ప్రమాదం, కాపాడు, భయంగా ఉంది
   Malayalam: സഹായം, അപകടം, രക്ഷിക്കൂ, പേടിയാകുന്നു
   Hindi: मदद, खतरा, बचाओ, डर लग रहा है
   English: help, danger, emergency, save me, SOS, someone following me, i feel unsafe
   → Immediately return ACTION: TRIGGER_SOS
5. GENERAL_HELP — answer questions about how Sawaari works, features, safety, pink mode, fareshare, driveshare etc.

IMPORTANT — For REGISTER_RIDE and SEARCH_RIDES params:
- "date" MUST be in YYYY-MM-DD format (e.g. "2026-02-20"). Convert "tomorrow", "today", relative dates to actual YYYY-MM-DD.
- "rideTime" MUST be in HH:MM 24-hour format (e.g. "09:00", "14:30"). Convert "9am" to "09:00", "2:30pm" to "14:30".
- "vehicleType" MUST be one of: "Car", "Auto", "Cab", "Mini Bus"
- "seatsAvailable" MUST be a number (e.g. 4, not "four")
- DO NOT generate the reply assuming the ride is registered. Say something like "Let me register that for you..." or "Registering your ride..." — the system will confirm the registration.

Always respond in the SAME language the user spoke in.
Be warm, friendly, concise — like a helpful local friend.
If you need more info to complete an action, ask one question at a time in the user's language.

Return ONLY valid JSON, nothing else, no markdown:
{
  "reply": "your response in user's language",
  "action": "SEARCH_RIDES | REGISTER_RIDE | REQUEST_JOIN | TRIGGER_SOS | GENERAL_HELP | null",
  "params": {}
}`;
}

// POST /api/agent — AI chatbot endpoint
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { message, detectedLanguage, conversationHistory } = req.body;
        const userId = req.user.userId;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        // Build messages array for Groq
        const messages = [{ role: 'system', content: getSystemPrompt() }];

        // Add conversation history (last 10)
        if (conversationHistory && Array.isArray(conversationHistory)) {
            const recent = conversationHistory.slice(-10);
            for (const msg of recent) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }
        }

        // Add current message
        messages.push({
            role: 'user',
            content: `[Language: ${detectedLanguage || 'en-IN'}] ${message}`,
        });

        // Call Groq
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: 'json_object' },
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';

        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch {
            // If JSON parse fails, wrap the text as a reply
            parsed = { reply: rawContent, action: null, params: {} };
        }

        const action = parsed.action || null;
        const params = parsed.params || {};
        let reply = parsed.reply || "I'm here to help!";
        let rideResults = null;

        // Execute actions
        if (action === 'SEARCH_RIDES' && params.source && params.destination) {
            rideResults = executeSearchRides(params, userId);
            if (rideResults.length === 0) {
                const noRidesMsg = {
                    'ta-IN': 'தற்போது சவாரிகள் இல்லை. உங்களுக்கு ஒரு சவாரி பதிவு செய்யவா?',
                    'te-IN': 'ప్రస్తుతం రైడ్‌లు లేవు. మీకు ఒక రైడ్ రిజిస్టర్ చేయమంటారా?',
                    'ml-IN': 'ഇപ്പോൾ യാത്രകൾ ഇല്ല. നിങ്ങൾക്ക് ഒരു യാത്ര രജിസ്റ്റർ ചെയ്യണോ?',
                    'hi-IN': 'अभी कोई राइड नहीं मिली। क्या मैं आपके लिए एक राइड रजिस्टर करूँ?',
                    'en-IN': 'No rides found right now. Want me to register one for you?',
                };
                reply = noRidesMsg[detectedLanguage] || noRidesMsg['en-IN'];
            }
        } else if (action === 'REGISTER_RIDE') {
            // Normalize params from AI
            if (params.date) {
                params.date = normalizeDate(params.date);
            }
            if (params.rideTime) {
                params.rideTime = normalizeTime(params.rideTime);
            }
            if (params.seatsAvailable) {
                params.seatsAvailable = String(parseInt(params.seatsAvailable) || 4);
            }
            console.log('🤖 REGISTER_RIDE params (normalized):', JSON.stringify(params));

            const required = ['source', 'destination', 'date', 'rideTime', 'vehicleType', 'seatsAvailable'];
            const missing = required.filter(f => !params[f]);
            if (missing.length === 0) {
                const result = executeRegisterRide(params, userId);
                if (result.error) {
                    console.error('🤖 REGISTER_RIDE failed:', result.error);
                    reply = result.error;
                } else {
                    console.log('🤖 REGISTER_RIDE success, ride ID:', result.ride?.id);
                    rideResults = [result.ride];
                    // Override reply with confirmation message
                    const successMsg = {
                        'ta-IN': `✅ சவாரி பதிவு செய்யப்பட்டது! ${params.source} → ${params.destination}, ${params.date} ${params.rideTime}`,
                        'te-IN': `✅ రైడ్ రిజిస్టర్ అయింది! ${params.source} → ${params.destination}, ${params.date} ${params.rideTime}`,
                        'ml-IN': `✅ യാത്ര രജിസ്റ്റർ ചെയ്തു! ${params.source} → ${params.destination}, ${params.date} ${params.rideTime}`,
                        'hi-IN': `✅ राइड रजिस्टर हो गई! ${params.source} → ${params.destination}, ${params.date} ${params.rideTime}`,
                        'en-IN': `✅ Ride registered! ${params.source} → ${params.destination} on ${params.date} at ${params.rideTime}. Check "My Rides" to see it!`,
                    };
                    reply = successMsg[detectedLanguage] || successMsg['en-IN'];
                }
            } else {
                console.log('🤖 REGISTER_RIDE missing params:', missing);
            }
            // If missing, the AI reply should be asking for the missing info
        } else if (action === 'REQUEST_JOIN' && params.rideId) {
            const result = executeRequestJoin(params.rideId, userId);
            if (result.error) {
                reply = result.error;
            }
        }

        res.json({
            reply,
            action,
            params,
            rideResults,
        });
    } catch (err) {
        console.error('Agent error:', err);
        res.status(500).json({
            error: 'AI service unavailable',
            reply: 'Sawaari AI is unavailable — please use the app directly.',
        });
    }
});

// ─── PARAM NORMALIZERS ────────────────────────────────────────────────────────

function normalizeDate(dateStr) {
    if (!dateStr) return dateStr;
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const today = new Date();
    const lower = dateStr.toLowerCase().trim();

    if (lower === 'today') {
        return today.toISOString().split('T')[0];
    }
    if (lower === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
    if (lower === 'day after tomorrow') {
        const dat = new Date(today);
        dat.setDate(dat.getDate() + 2);
        return dat.toISOString().split('T')[0];
    }

    // Try parsing various date formats
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    // Fallback: return as-is and let the DB handle it
    console.warn('⚠️ Could not normalize date:', dateStr);
    return dateStr;
}

function normalizeTime(timeStr) {
    if (!timeStr) return timeStr;
    // Already in HH:MM format
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    // H:MM format
    if (/^\d{1}:\d{2}$/.test(timeStr)) return '0' + timeStr;

    const lower = timeStr.toLowerCase().trim();

    // Handle formats like "9am", "9 am", "9:00am", "9:00 am", "2:30pm"
    const match = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const period = match[3];

        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Fallback: return as-is
    console.warn('⚠️ Could not normalize time:', timeStr);
    return timeStr;
}

// ─── ACTION EXECUTORS ─────────────────────────────────────────────────────────

function executeSearchRides(params, userId) {
    try {
        const db = getDb();
        const now = new Date().toISOString();

        let query = `
            SELECT r.id, r.source, r.destination, r.date, r.ride_time, r.vehicle_type,
                   r.seats_available, r.pink_mode, r.status,
                   u.username AS owner_username, u.gender AS owner_gender, u.id AS owner_id,
                   (SELECT COUNT(*) FROM ride_members rm WHERE rm.ride_id = r.id) AS member_count
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE r.expires_at > ? AND r.user_id != ? AND r.trip_completed = 0
        `;
        const queryParams = [now, userId];

        if (params.date) {
            query += ` AND r.date = ?`;
            queryParams.push(params.date);
        }

        query += ` ORDER BY r.date ASC, r.ride_time ASC LIMIT 10`;

        const rides = db.prepare(query).all(...queryParams);

        // Filter by route overlap
        const src = (params.source || '').toLowerCase();
        const dst = (params.destination || '').toLowerCase();

        return rides.filter(r => {
            const rs = r.source.toLowerCase();
            const rd = r.destination.toLowerCase();
            return (rs.includes(src) || src.includes(rs)) &&
                (rd.includes(dst) || dst.includes(rd));
        }).map(r => {
            const profile = getPublicProfileSimple(db, r.owner_id);
            return { ...r, owner_profile: profile };
        });
    } catch (err) {
        console.error('Search rides error:', err);
        return [];
    }
}

function executeRegisterRide(params, userId) {
    try {
        const db = getDb();
        const { source, destination, date, rideTime, vehicleType, seatsAvailable } = params;

        console.log('📝 executeRegisterRide called:', { source, destination, date, rideTime, vehicleType, seatsAvailable, userId });

        // Check emergency contact
        const creator = db.prepare(`SELECT emergency_contact_name FROM users WHERE id = ?`).get(userId);
        if (!creator?.emergency_contact_name) {
            return { error: 'You must set up an emergency contact before creating a ride.' };
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return { error: `Invalid date format: ${date}. Use YYYY-MM-DD.` };
        }

        // Validate time format
        if (!/^\d{2}:\d{2}$/.test(rideTime)) {
            return { error: `Invalid time format: ${rideTime}. Use HH:MM.` };
        }

        const hour = parseInt(rideTime.split(':')[0]);
        let timeSlot = 'Custom';
        if (hour < 6) timeSlot = 'Early Morning';
        else if (hour < 12) timeSlot = 'Morning';
        else if (hour < 16) timeSlot = 'Afternoon';
        else if (hour < 20) timeSlot = 'Evening';
        else timeSlot = 'Night';

        const { v4: uuidv4 } = require('uuid');
        // Use proper ISO format with timezone offset for expiry
        const expiresAt = `${date}T${rideTime}:00.000+05:30`;
        const trackingToken = uuidv4();

        const result = db.prepare(`
            INSERT INTO rides (user_id, source, destination, date, time_slot, ride_time, vehicle_type,
                seats_available, male_count, female_count, pink_mode, expires_at, tracking_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
        `).run(userId, source.trim(), destination.trim(), date, timeSlot, rideTime, vehicleType,
            parseInt(seatsAvailable), expiresAt, trackingToken);

        console.log('📝 Ride inserted with ID:', result.lastInsertRowid);

        db.prepare(`INSERT OR IGNORE INTO ride_members (ride_id, user_id) VALUES (?, ?)`).run(result.lastInsertRowid, userId);

        console.log('📝 ride_members entry created for ride', result.lastInsertRowid, 'user', userId);

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ?`).get(result.lastInsertRowid);
        console.log('📝 Ride fetched back:', ride?.id, ride?.source, ride?.destination);
        return { ride };
    } catch (err) {
        console.error('Register ride error:', err);
        return { error: 'Failed to register ride.' };
    }
}

function executeRequestJoin(rideId, userId) {
    try {
        const db = getDb();
        const now = new Date().toISOString();

        const ride = db.prepare(`SELECT * FROM rides WHERE id = ? AND expires_at > ?`).get(rideId, now);
        if (!ride) return { error: 'Ride not found or expired.' };
        if (ride.trip_started) return { error: 'Cannot join a ride already in progress.' };

        const alreadyMember = db.prepare(`SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?`).get(rideId, userId);
        if (alreadyMember) return { error: 'You are already a member of this ride.' };

        const existing = db.prepare(`SELECT * FROM ride_requests WHERE ride_id = ? AND requester_id = ?`).get(rideId, userId);
        if (existing?.status === 'pending') return { error: 'You already have a pending request.' };

        db.prepare(`INSERT INTO ride_requests (ride_id, requester_id, status) VALUES (?, ?, 'pending')`).run(rideId, userId);
        return { success: true };
    } catch (err) {
        console.error('Request join error:', err);
        return { error: 'Failed to send join request.' };
    }
}

function getPublicProfileSimple(db, userId) {
    const user = db.prepare(`SELECT id, username, gender, aadhaar_verified, trip_count FROM users WHERE id = ?`).get(userId);
    if (!user) return null;
    const ratingRow = db.prepare(`SELECT AVG(stars) as avg_rating, COUNT(*) as rating_count FROM ratings WHERE rated_user = ?`).get(userId);
    return {
        id: user.id,
        username: user.username,
        gender: user.gender,
        aadhaar_verified: !!user.aadhaar_verified,
        trip_count: user.trip_count,
        avg_rating: ratingRow?.avg_rating ? Math.round(ratingRow.avg_rating * 10) / 10 : null,
        rating_count: ratingRow?.rating_count || 0,
    };
}

module.exports = router;
