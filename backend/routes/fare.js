const express = require('express');
const router = express.Router();
const https = require('https');

// ── Log key status on startup ────────────────────────────────────────────────
console.log('ORS KEY:', process.env.ORS_API_KEY ? 'LOADED ✅' : 'MISSING ❌');

// Mileage lookup by vehicle type (km/litre)
const MILEAGE = {
    'Auto': 25,
    'Cab': 15,
    '4-Seater': 15,
    '5-Seater': 12,
    'SUV': 10,
    'Mini Bus': 8,
    'Car': 15,  // default for FairShare "Car" type
};

// 6-hour petrol price cache
let petrolCache = { price: null, fetchedAt: 0 };
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FALLBACK_PRICE = 102; // ₹/litre

// Scrape current petrol price for Coimbatore
async function fetchPetrolPrice() {
    const now = Date.now();
    if (petrolCache.price && (now - petrolCache.fetchedAt) < CACHE_TTL_MS) {
        return petrolCache.price;
    }

    try {
        const cheerio = require('cheerio');
        const html = await new Promise((resolve, reject) => {
            const req = https.get(
                'https://www.mypetrolprice.com/petrol-price-in-Coimbatore',
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html',
                    },
                    timeout: 5000,
                },
                (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }
            );
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });

        const $ = cheerio.load(html);
        let price = null;

        $('*').each((i, el) => {
            const text = $(el).text();
            const match = text.match(/(?:₹|Rs\.?)\s*(9[0-9]|1[01][0-9])\.\d{2}/);
            if (match && !price) {
                price = parseFloat(match[1] + '.' + match[0].split('.')[1]);
            }
        });

        if (price && price > 80 && price < 130) {
            petrolCache = { price, fetchedAt: now };
            console.log(`⛽ Petrol price fetched: ₹${price}/litre`);
            return price;
        }
    } catch (err) {
        console.warn('Petrol price scrape failed, using fallback:', err.message);
    }

    return FALLBACK_PRICE;
}

// Haversine straight-line distance in km
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3; // 1.3x road factor
}

// Get road distance from ORS API (lng,lat order — ORS uses [lng, lat])
async function getDistanceKm(srcLat, srcLng, dstLat, dstLng) {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) throw new Error('ORS_API_KEY not set');

    // IMPORTANT: ORS expects longitude FIRST then latitude
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${srcLng},${srcLat}&end=${dstLng},${dstLat}`;

    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'Accept': 'application/json, application/geo+json' },
            timeout: 8000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const distM = json?.features?.[0]?.properties?.segments?.[0]?.distance;
                    if (distM && distM > 0) {
                        resolve(distM / 1000);
                    } else {
                        console.error('ORS bad response:', JSON.stringify(json).slice(0, 300));
                        reject(new Error('ORS returned zero or missing distance'));
                    }
                } catch (e) {
                    reject(new Error('ORS parse error: ' + e.message));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('ORS timeout')); });
    });
}

// POST /api/fare/calculate
router.post('/calculate', async (req, res) => {
    try {
        const { source_lat, source_lng, destination_lat, destination_lng, vehicle_type, seats_filled } = req.body;

        // Debug: log incoming coords
        console.log('Fare calc coords:', { source_lat, source_lng, destination_lat, destination_lng, vehicle_type, seats_filled });

        const sLat = parseFloat(source_lat);
        const sLng = parseFloat(source_lng);
        const dLat = parseFloat(destination_lat);
        const dLng = parseFloat(destination_lng);

        if (!source_lat || !source_lng || !destination_lat || !destination_lng ||
            isNaN(sLat) || isNaN(sLng) || isNaN(dLat) || isNaN(dLng)) {
            return res.status(400).json({ error: 'Valid source and destination coordinates are required. Please select locations from the autocomplete dropdown.' });
        }

        const mileage = MILEAGE[vehicle_type] || 15;
        const seatsFilledNum = parseInt(seats_filled) || 1;

        // Step 1: Distance — try ORS, fall back to Haversine
        let distance_km;
        let isEstimated = false;

        try {
            distance_km = await getDistanceKm(sLat, sLng, dLat, dLng);
            console.log(`✅ ORS distance: ${distance_km.toFixed(2)} km`);
        } catch (err) {
            console.warn('ORS API failed, using Haversine fallback:', err.message);
            distance_km = haversineDistanceKm(sLat, sLng, dLat, dLng);
            isEstimated = true;
            console.log(`📐 Haversine fallback distance: ${distance_km.toFixed(2)} km`);
        }

        if (!distance_km || distance_km <= 0) {
            return res.status(400).json({ error: 'Could not calculate distance between these locations' });
        }

        // Step 2: Petrol price
        const petrol_price_per_litre = await fetchPetrolPrice();

        // Step 3 & 4: Calculate fare (strict cost-sharing, no profit)
        const fuel_cost = (distance_km / mileage) * petrol_price_per_litre;
        const buffer_amount = fuel_cost * 0.1; // 10% for tolls/misc
        const total_trip_cost = fuel_cost + buffer_amount;
        const total_persons = seatsFilledNum + 1; // +1 for driver
        const cost_per_person = total_trip_cost / total_persons;
        const driver_saves = total_trip_cost - cost_per_person;

        res.json({
            distance_km: Math.round(distance_km * 10) / 10,
            petrol_price_per_litre,
            fuel_cost: Math.round(fuel_cost * 100) / 100,
            buffer_amount: Math.round(buffer_amount * 100) / 100,
            total_trip_cost: Math.round(total_trip_cost * 100) / 100,
            cost_per_person: Math.round(cost_per_person * 100) / 100,
            driver_saves: Math.round(driver_saves * 100) / 100,
            isEstimated,
            legal_note: 'Fare calculated by Sawaari. Cost-sharing only — no profit element.',
            breakdown: {
                fuel_cost: Math.round(fuel_cost * 100) / 100,
                buffer_amount: Math.round(buffer_amount * 100) / 100,
                total_persons,
                mileage_kmpl: mileage,
                vehicle_type: vehicle_type || 'Standard',
            },
        });
    } catch (err) {
        console.error('Fare calculation error:', err);
        res.status(500).json({ error: 'Failed to calculate fare' });
    }
});

module.exports = router;
