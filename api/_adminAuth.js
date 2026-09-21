const fetch = require('node-fetch');

// Not a route — files prefixed with `_` are excluded from Vercel's
// file-based API routing, so this only exists to be required by the
// actual admin endpoints.

const ADMIN_EMAIL = 'shreyc74@gmail.com';
const SUPABASE_URL = 'https://ybuqwggrkbtdubnzeecb.supabase.co';
// Same publishable/anon key already embedded in public/index.html — not a
// secret, just needed here to ask Supabase's auth server whose token this
// is. Never used to grant data access itself; that's what
// SUPABASE_SERVICE_ROLE_KEY (checked by the caller) is for.
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlidXF3Z2dya2J0ZHVibnplZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDIzOTcsImV4cCI6MjEwMzMxODM5N30.LOw-zbFjhVjvNVJcjeeMzJF2mFrUXb-tm10XcgAE8zg';

// Verifies the request's Authorization: Bearer <token> genuinely belongs
// to the hardcoded admin account, by asking Supabase who the token
// actually belongs to — never trusting anything the client claims about
// its own identity.
async function verifyAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY }
    });
    if (!res.ok) return false;
    const user = await res.json();
    return !!(user && user.email === ADMIN_EMAIL);
  } catch (e) {
    return false;
  }
}

module.exports = { verifyAdmin, ADMIN_EMAIL };
