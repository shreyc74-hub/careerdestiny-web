const fetch = require('node-fetch');

const CLIENT_ID = process.env.PROKERALA_CLIENT_ID;
const CLIENT_SECRET = process.env.PROKERALA_CLIENT_SECRET;
const BASE = 'https://api.prokerala.com';

let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

const SIGNS = ['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrischika','Dhanu','Makar','Kumbha','Meena'];
const LORDS = ['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];

function calcDivisional(planets, division) {
  return planets.map(p => {
    const lon = p.longitude;
    const divLon = (lon * division) % 360;
    const signIdx = Math.floor(divLon / 30);
    return {
      id: p.id,
      name: p.name,
      longitude: divLon,
      degree: parseFloat((divLon % 30).toFixed(4)),
      position: signIdx + 1,
      is_retrograde: p.is_retrograde,
      rasi: { id: signIdx, name: SIGNS[signIdx], lord: { name: LORDS[signIdx] } }
    };
  });
}

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }) }


// North Indian chart SVG parser
// Numbers in cells = Rashi (sign) numbers 1-12
// Top-center diamond = House 1 (Lagna), rest counter-clockwise
// Cell center coordinates for 480x480 chart:
var CELL_CENTERS = [
  {sign:null, x:241, y:216},  // top-center — this is H1, sign determined by number printed
  {sign:null, x:123, y:98},   // upper-left triangle
  {sign:null, x:98,  y:123},  // left-top
  {sign:null, x:216, y:241},  // left-center
  {sign:null, x:98,  y:359},  // left-bottom
  {sign:null, x:123, y:384},  // lower-left triangle
  {sign:null, x:241, y:266},  // bottom-center
  {sign:null, x:359, y:384},  // lower-right triangle
  {sign:null, x:376, y:359},  // right-bottom
  {sign:null, x:266, y:241},  // right-center
  {sign:null, x:376, y:123},  // right-top
  {sign:null, x:359, y:98}    // upper-right triangle
];

// Cell index order going counter-clockwise from top-center:
// 0=H1(top-ctr), 1=H2(upper-left), 2=H3(left-top), 3=H4(left-ctr),
// 4=H5(left-bot), 5=H6(lower-left), 6=H7(bot-ctr), 7=H8(lower-right),
// 8=H9(right-bot), 9=H10(right-ctr), 10=H11(right-top), 11=H12(upper-right)

var PLANET_MAP = {
  'ascendant':'Ascendant','sun':'Sun','moon':'Moon','mars':'Mars',
  'mercury':'Mercury','jupiter':'Jupiter','venus':'Venus',
  'saturn':'Saturn','rahu':'Rahu','ketu':'Ketu'
};

var RASHI_NAMES = ['','Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya',
  'Tula','Vrischika','Dhanu','Makar','Kumbha','Meena'];

function parseSVGChart(svg) {
  // Step 1: Extract sign numbers from cells
  // Find all plain text numbers (no class) with their coordinates
  var numRegex = /<text x="(\d+)" y="(\d+)" font-size="\d+"\s*>(\d+)<\/text>/g;
  var cellSigns = {}; // cell_index -> sign_number
  var match;
  
  while ((match = numRegex.exec(svg)) !== null) {
    var nx = parseInt(match[1]);
    var ny = parseInt(match[2]);
    var signNum = parseInt(match[3]);
    if (signNum < 1 || signNum > 12) continue;
    
    // Find which cell this number belongs to
    var minDist = Infinity;
    var cellIdx = 0;
    CELL_CENTERS.forEach(function(cell, i) {
      var d = Math.sqrt(Math.pow(nx-cell.x,2) + Math.pow(ny-cell.y,2));
      if (d < minDist) { minDist = d; cellIdx = i; }
    });
    cellSigns[cellIdx] = signNum;
  }
  
  // Step 2: Determine Lagna sign — it's the sign in cell index 0 (top-center)
  var lagnaSign = cellSigns[0] || 1;
  
  // Step 3: Build cell -> house mapping
  // Cell 0 = House 1, Cell 1 = House 2, etc. (counter-clockwise)
  var cellToHouse = {};
  for (var i = 0; i < 12; i++) cellToHouse[i] = i + 1;
  
  // Step 4: Build sign -> house mapping
  var signToHouse = {};
  for (var ci = 0; ci < 12; ci++) {
    var sn = cellSigns[ci];
    if (sn) signToHouse[sn] = ci + 1;
  }
  
  // Step 5: Extract planet positions
  var planetRegex = /<text x="(\d+)" y="(\d+)"[^>]*class="pk-planet-([^"]+)"[^>]*>([^<]+)<\/text>/g;
  var planets = {};
  
  while ((match = planetRegex.exec(svg)) !== null) {
    var px = parseInt(match[1]);
    var py = parseInt(match[2]);
    var cls = match[3];
    var label = match[4].trim();
    var planetName = PLANET_MAP[cls];
    if (!planetName) continue;
    
    // Find nearest cell
    var minD = Infinity;
    var nearCell = 0;
    CELL_CENTERS.forEach(function(cell, i) {
      var d = Math.sqrt(Math.pow(px-cell.x,2) + Math.pow(py-cell.y,2));
      if (d < minD) { minD = d; nearCell = i; }
    });
    
    var house = nearCell + 1;
    var signInCell = cellSigns[nearCell] || lagnaSign;
    
    planets[planetName] = {
      house: house,
      sign: signInCell,
      signName: RASHI_NAMES[signInCell] || '?',
      label: label
    };
  }
  
  return {
    lagnaSign: lagnaSign,
    lagnaSignName: RASHI_NAMES[lagnaSign] || '?',
    signToHouse: signToHouse,
    planets: planets,
    cellSigns: cellSigns
  };
}

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

async function getD1Planets(params, token) {
  const qs = Object.entries({ ayanamsa: 1, ...params })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const r = await fetch(`${BASE}/v2/astrology/planet-position?${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { endpoint, ...params } = req.query;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    if (params.datetime) {
      params.datetime = params.datetime.replace(' ', '+');
    }

    const token = await getToken();

    // D9 Navamsha — parse from Prokerala SVG
    if (endpoint === 'navamsha') {
      const qs = `ayanamsa=1&coordinates=${encodeURIComponent(params.coordinates)}&datetime=${encodeURIComponent(params.datetime)}&chart_type=navamsa&chart_style=north-indian&format=svg`;
      const svgRes = await fetch(`${BASE}/v2/astrology/chart?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      const svg = await svgRes.text();
      if (!svg.includes('<svg')) return res.status(500).json({ error: 'Invalid SVG', raw: svg.slice(0,200) });
      const parsed = parseSVGChart(svg);
      // Convert to planet_position format compatible with buildSummary
      const planets = Object.entries(parsed.planets).map(([name, data]) => ({
        name: name,
        rasi: { name: data.signName },
        position: data.house,
        degree: 0,
        is_retrograde: false
      }));
      // Add Ascendant
      planets.unshift({
        name: 'Ascendant',
        rasi: { name: parsed.lagnaSignName },
        position: 1,
        degree: 0,
        is_retrograde: false
      });
      return res.status(200).json({
        status: 'ok',
        data: { planet_position: planets, chart_type: 'navamsha', lagna: parsed.lagnaSignName }
      });
    }

    // D10 Dashamsha — parse from Prokerala SVG
    if (endpoint === 'dashamsha') {
      const qs = `ayanamsa=1&coordinates=${encodeURIComponent(params.coordinates)}&datetime=${encodeURIComponent(params.datetime)}&chart_type=dasamsa&chart_style=north-indian&format=svg`;
      const svgRes = await fetch(`${BASE}/v2/astrology/chart?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      const svg = await svgRes.text();
      if (!svg.includes('<svg')) return res.status(500).json({ error: 'Invalid SVG', raw: svg.slice(0,200) });
      const parsed = parseSVGChart(svg);
      const planets = Object.entries(parsed.planets).map(([name, data]) => ({
        name: name,
        rasi: { name: data.signName },
        position: data.house,
        degree: 0,
        is_retrograde: false
      }));
      planets.unshift({
        name: 'Ascendant',
        rasi: { name: parsed.lagnaSignName },
        position: 1,
        degree: 0,
        is_retrograde: false
      });
      return res.status(200).json({
        status: 'ok',
        data: { planet_position: planets, chart_type: 'dashamsha', lagna: parsed.lagnaSignName }
      });
    }

    // Gochar — today's planet positions
    if (endpoint === 'gochar') {
      const now = new Date();
      const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const pad = n => String(n).padStart(2, '0');
      const todayDT = `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth()+1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:00+05:30`;
      const coords = params.coordinates || '28.6139,77.2090';
      const qs = `ayanamsa=1&coordinates=${encodeURIComponent(coords)}&datetime=${encodeURIComponent(todayDT)}`;
      const r = await fetch(`${BASE}/v2/astrology/planet-position?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      return res.status(200).json({ ...data, chart_type: 'gochar', date: todayDT });
    }


    // chart-svg-parsed: returns SVG + parsed house/sign positions
    if (endpoint === 'chart-svg-parsed') {
      const qs = Object.entries({ ayanamsa: 1, ...params, format: 'svg' })
        .filter(([k]) => k !== 'endpoint')
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      const url = BASE + '/v2/astrology/chart?' + qs;
      const apiRes = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const svg = await apiRes.text();
      if (!svg.includes('<svg')) return res.status(500).json({ error: 'Invalid SVG', raw: svg.slice(0,200) });
      const parsed = parseSVGChart(svg);
      return res.status(200).json({ status: 'ok', ...parsed, svg });
    }
    // SVG chart endpoints — return raw SVG
    if (endpoint === 'chart-svg') {
      const qs = Object.entries({ ayanamsa: 1, ...params })
        .map(([k, v]) => k + '=' + encodeURIComponent(v))
        .join('&');
      const url = BASE + '/v2/astrology/chart?' + qs;
      const apiRes = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const svg = await apiRes.text();
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send(svg);
    }
    // All other standard Prokerala endpoints
    const qs = Object.entries({ ayanamsa: 1, ...params })
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${BASE}/v2/astrology/${endpoint}?${qs}`;
    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await apiRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
