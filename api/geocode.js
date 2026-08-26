const fetch = require('node-fetch');

async function tryNominatim(place, limit) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=${limit}&addressdetails=1`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'CareerDestinyApp/1.0 (careerdestiny.in)', 'Accept-Language': 'en' },
    timeout: 6000
  });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const data = await r.json();
  if (!data || !data.length) return [];
  return data.map(item => {
    const locality = item.address?.city || item.address?.town || item.address?.village
      || item.address?.county || item.address?.municipality || item.address?.state_district
      || item.address?.suburb || item.address?.hamlet;
    return {
      lat: item.lat,
      lon: item.lon,
      display_name: item.display_name,
      // Fall back to the first two segments of display_name whenever none of the
      // known locality keys matched — otherwise short_name silently drops the
      // city and keeps only state/country (e.g. "Uttar Pradesh, India").
      short_name: locality
        ? [locality, item.address?.state, item.address?.country].filter(Boolean).join(', ')
        : item.display_name.split(',').slice(0, 2).join(',').trim()
    };
  });
}

async function tryPhoton(place, limit) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(place)}&limit=${limit}&lang=en`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'CareerDestinyApp/1.0' },
    timeout: 6000
  });
  if (!r.ok) throw new Error(`Photon ${r.status}`);
  const data = await r.json();
  if (!data || !data.features || !data.features.length) return [];
  return data.features.map(f => {
    const p = f.properties;
    const coords = f.geometry.coordinates;
    const short = [p.city || p.town || p.village || p.name, p.state, p.country].filter(Boolean).join(', ');
    return {
      lat: String(coords[1]),
      lon: String(coords[0]),
      display_name: [p.name, p.city || p.town, p.state, p.country].filter(Boolean).join(', '),
      short_name: short || p.name
    };
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { place, limit } = req.query;
  if (!place) return res.status(400).json({ error: 'place required' });

  const lim = parseInt(limit) || 5;

  try {
    // Try Nominatim first
    let results = [];
    try {
      results = await tryNominatim(place, lim);
    } catch (e1) {
      console.log('Nominatim failed:', e1.message, '— trying Photon');
      // Fallback to Photon
      try {
        results = await tryPhoton(place, lim);
      } catch (e2) {
        console.log('Photon also failed:', e2.message);
        throw new Error('Both geocoding services unavailable. Please try again in a moment.');
      }
    }

    if (!results.length) {
      return res.status(200).json({
        error: `Could not find "${place}". Try being more specific — e.g. "Ghaziabad, Uttar Pradesh, India".`
      });
    }

    return res.status(200).json(results);

  } catch (err) {
    console.error('Geocode error:', err.message);
    return res.status(200).json({
      error: err.message || 'Location service unavailable. Please try again.'
    });
  }
};
