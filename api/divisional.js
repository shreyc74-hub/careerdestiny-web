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

// North Indian chart: map x,y coordinate to house number
// Chart is 480x480. Center is 241,241.
// Houses are triangular regions. We determine house by angle from center.
function coordToHouse(x, y, cx, cy) {
  const dx = x - cx;
  const dy = y - cy;  // Note: SVG y increases downward
  
  // Get angle in degrees (0 = right, going clockwise)
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  
  // Distance from center
  const dist = Math.sqrt(dx*dx + dy*dy);
  
  // North Indian chart house regions by angle:
  // The chart has 12 triangular houses arranged around center
  // Top-right triangle (H1): angle ~315-360 or 0-45, but top portion
  // We need to consider both angle and which quadrant
  
  // Quadrant-based approach for North Indian chart:
  // Top-right corner: H1
  // Top-center: H2  
  // Top-left corner: H3
  // Left-top: H4
  // Left-center: H5
  // Left-bottom: H6
  // Bottom-left corner: H7
  // Bottom-center: H8
  // Bottom-right corner: H9
  // Right-bottom: H10
  // Right-center: H11
  // Right-top: H12
  
  const px = x / 480;  // normalized 0-1
  const py = y / 480;  // normalized 0-1
  
  // Use the actual house number text positions to determine boundaries
  // H1: top-right area (x>240, y<240, closer to corner)
  // H2: top-center
  // H3: top-left area
  // H4: left-top area  
  // H5: left-center
  // H6: left-bottom area
  // H7: bottom-left area
  // H8: bottom-center
  // H9: bottom-right area
  // H10: right-bottom area
  // H11: right-center
  // H12: right-top area

  // Determine by which of 12 angular sectors the point falls in
  // Normalize angle so 0 is up (north)
  let northAngle = (angle + 90) % 360;  // 0=up, 90=right, 180=down, 270=left
  
  // Each house occupies 30 degrees, starting from H1 at top-right
  // H1 center is at ~45deg from top (northeast)
  // Offset: H1 starts at 15deg (from north, going clockwise)
  const houseAngle = ((northAngle - 15 + 360) % 360);
  const house = Math.floor(houseAngle / 30) + 1;
  
  return Math.min(Math.max(house, 1), 12);
}

// Parse planet positions from SVG text
function parseSVGPlanets(svg) {
  const cx = 241, cy = 241;  // center of 480x480 chart
  const planets = {};
  
  // Extract all text elements with planet classes
  const textRegex = /<text x="(\d+)" y="(\d+)"[^>]*class="pk-planet-([^"]+)"[^>]*>([^<]+)<\/text>/g;
  let match;
  
  while ((match = textRegex.exec(svg)) !== null) {
    const x = parseInt(match[1]);
    const y = parseInt(match[2]);
    const className = match[3];
    const label = match[4].trim();
    
    const house = coordToHouse(x, y, cx, cy);
    
    // Map class name to planet name
    const planetMap = {
      'ascendant': 'Ascendant',
      'sun': 'Sun', 'moon': 'Moon', 'mars': 'Mars',
      'mercury': 'Mercury', 'jupiter': 'Jupiter', 'venus': 'Venus',
      'saturn': 'Saturn', 'rahu': 'Rahu', 'ketu': 'Ketu',
      'uranus': 'Uranus', 'neptune': 'Neptune', 'pluto': 'Pluto'
    };
    
    const planetName = planetMap[className] || className;
    planets[planetName] = { house, label, x, y };
  }
  
  return planets;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { coordinates, datetime, chart_type } = req.query;
    if (!coordinates || !datetime || !chart_type) {
      return res.status(400).json({ error: 'coordinates, datetime, chart_type required' });
    }

    const dt = datetime.replace(' ', '+');
    const token = await getToken();
    
    const url = `${BASE}/v2/astrology/chart?ayanamsa=1&coordinates=${encodeURIComponent(coordinates)}&datetime=${encodeURIComponent(dt)}&chart_type=${chart_type}&chart_style=north-indian&format=svg`;
    
    const svgRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const svg = await svgRes.text();
    
    if (!svg.includes('<svg')) {
      return res.status(500).json({ error: 'Invalid SVG response', raw: svg.slice(0, 200) });
    }
    
    const planets = parseSVGPlanets(svg);
    
    // Find Lagna house
    const lagnaHouse = planets['Ascendant'] ? planets['Ascendant'].house : null;
    
    // Build house-wise planet list
    const houses = {};
    for (let i = 1; i <= 12; i++) houses[i] = [];
    
    Object.entries(planets).forEach(([name, data]) => {
      if (houses[data.house]) houses[data.house].push(name);
    });
    
    res.status(200).json({
      status: 'ok',
      chart_type,
      lagna_house: lagnaHouse,
      planets,
      houses,
      svg
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
