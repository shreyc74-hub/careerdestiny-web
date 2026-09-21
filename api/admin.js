const fetch = require('node-fetch');
const { verifyAdmin } = require('./_adminAuth');

const SUPABASE_URL = 'https://ybuqwggrkbtdubnzeecb.supabase.co';
// Server-side only — set as a Vercel environment variable, never
// committed, never sent to the browser. Bypasses RLS entirely, which is
// exactly why this whole file exists behind verifyAdmin() and nowhere
// near client code.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbAdmin(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// auth.users isn't a normal public-schema table — PostgREST doesn't
// expose it, so listing real accounts goes through Supabase's separate
// Admin Auth API instead of the regular /rest/v1 path sbAdmin() uses.
async function sbAuthAdmin(path) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase auth admin error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// One endpoint, dispatched by `action` — new admin sections (guest
// approval, coupon/token redemption, etc.) slot in as new cases here
// later without touching the auth/access-pattern set up in this file.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Admin API not configured — SUPABASE_SERVICE_ROLE_KEY is missing' });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const { action } = req.query;
  try {
    switch (action) {
      case 'overview': {
        const [leads, chatSessions, chartAnalyses, leadRevisits, leadMessages, usersData] = await Promise.all([
          sbAdmin('/leads?select=id,created_at&order=created_at.desc&limit=1000'),
          sbAdmin('/chat_sessions?select=id&limit=1000'),
          sbAdmin('/chart_analyses?select=id&limit=1000'),
          sbAdmin('/lead_revisits?select=visit_count'),
          sbAdmin('/lead_messages?select=id&limit=1000'),
          sbAuthAdmin('/users?per_page=1000')
        ]);
        const now = Date.now();
        const last24h = leads.filter(l => now - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000).length;
        return res.status(200).json({
          totalLeads: leads.length,
          leadsLast24h: last24h,
          totalUsers: (usersData.users || []).length,
          totalChatSessions: chatSessions.length,
          totalChartAnalyses: chartAnalyses.length,
          totalRevisitProfiles: leadRevisits.length,
          totalRevisits: leadRevisits.reduce((sum, r) => sum + (r.visit_count || 0), 0),
          totalLeadMessages: leadMessages.length
        });
      }
      case 'leads': {
        return res.status(200).json(await sbAdmin('/leads?select=*&order=created_at.desc&limit=300'));
      }
      case 'chat_sessions': {
        return res.status(200).json(await sbAdmin('/chat_sessions?select=id,title,subtitle,updated_at,user_id,profile_id&order=updated_at.desc&limit=300'));
      }
      case 'chat_session_detail': {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id required' });
        const rows = await sbAdmin(`/chat_sessions?select=*&id=eq.${encodeURIComponent(id)}`);
        return res.status(200).json((rows && rows[0]) || null);
      }
      case 'lead_revisits': {
        return res.status(200).json(await sbAdmin('/lead_revisits?select=*&order=visit_count.desc&limit=300'));
      }
      case 'lead_messages': {
        const { lead_id } = req.query;
        const path = lead_id
          ? `/lead_messages?select=*&lead_id=eq.${encodeURIComponent(lead_id)}&order=created_at.asc`
          : '/lead_messages?select=*&order=created_at.desc&limit=1000';
        return res.status(200).json(await sbAdmin(path));
      }
      case 'chart_analyses': {
        return res.status(200).json(await sbAdmin('/chart_analyses?select=id,profile_id,verdict,biz_score,job_score,computed_at&order=computed_at.desc&limit=300'));
      }
      case 'users': {
        // One extra query for ALL profiles, grouped by owner here, rather
        // than one query per user — a user can have several profiles
        // (their own chart plus family members'), so there's no single
        // "the" birth details to show inline; a count plus a preview of
        // the earliest one (usually their own) is the useful middle
        // ground between showing nothing and showing every profile.
        const [authData, allProfiles] = await Promise.all([
          sbAuthAdmin('/users?per_page=1000'),
          sbAdmin('/profiles?select=user_id,name,dob,place,created_at&order=created_at.asc')
        ]);
        const profilesByUser = {};
        allProfiles.forEach(p => {
          if (!profilesByUser[p.user_id]) profilesByUser[p.user_id] = [];
          profilesByUser[p.user_id].push(p);
        });
        const users = (authData.users || []).map(u => {
          const profiles = profilesByUser[u.id] || [];
          const primary = profiles[0] || null;
          return {
            id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
            profileCount: profiles.length,
            primaryProfile: primary ? { name: primary.name, dob: primary.dob, place: primary.place } : null
          };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.status(200).json(users);
      }
      case 'user_detail': {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        const [profiles, chatSessions] = await Promise.all([
          sbAdmin(`/profiles?select=*&user_id=eq.${encodeURIComponent(user_id)}`),
          sbAdmin(`/chat_sessions?select=id,title,subtitle,updated_at&user_id=eq.${encodeURIComponent(user_id)}&order=updated_at.desc`)
        ]);
        return res.status(200).json({ profiles, chatSessions });
      }
      default:
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
