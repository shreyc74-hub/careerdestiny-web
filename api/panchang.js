const fetch = require('node-fetch');

const CLIENT_ID = process.env.PROKERALA_CLIENT_ID;
const CLIENT_SECRET = process.env.PROKERALA_CLIENT_SECRET;
const BASE = 'https://api.prokerala.com';

let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  // Concurrent requests arriving while the cache is empty/expired share the
  // same in-flight fetch instead of each firing their own token request.
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
      });
      const data = await res.json();
      cachedToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return cachedToken;
    } finally {
      tokenPromise = null;
    }
  })();
  return tokenPromise;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { coordinates, datetime, la } = req.query;
    if (!coordinates) {
      return res.status(400).json({ error: 'coordinates required' });
    }

    // Default to right now in IST, same convention as the gochar endpoint
    // in chart.js, so a caller with no birth-specific datetime still gets
    // today's panchang for the given location.
    let dt = datetime;
    if (!dt) {
      const now = new Date();
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const pad = n => String(n).padStart(2, '0');
      dt = `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth()+1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:00+05:30`;
    } else {
      dt = dt.replace(' ', '+');
    }

    const token = await getToken();
    const params = { ayanamsa: 1, coordinates, datetime: dt };
    if (la) params.la = la;
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const apiRes = await fetch(`${BASE}/v2/astrology/panchang?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await apiRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
