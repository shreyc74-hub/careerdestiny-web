const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');
const fetch = require('node-fetch');

const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

function buildEmailHtml(name, verdict) {
  const recipientName = name || 'there';
  const verdictColor = verdict === 'BUSINESS' ? '#1D9E75' : verdict === 'JOB' ? '#534AB7' : '#c9a96e';
  const verdictLabel = verdict === 'BUSINESS' ? 'Independent Path' : verdict === 'JOB' ? 'Employment Path' : 'Mixed Path';
  const verdictDesc = verdict === 'BUSINESS'
    ? 'Your chart strongly supports building your own venture.'
    : verdict === 'JOB'
    ? 'Your chart supports a structured employment path.'
    : 'Your chart supports both employment and entrepreneurship.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Career Destiny Report</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:32px 16px;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Hero Header -->
      <tr><td style="background:#1a1025;border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;position:relative;">
        <!-- Stars bg via gradient -->
        <div style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:16px 16px 0 0;background:radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 1px, transparent 1px),radial-gradient(circle at 80% 70%, rgba(255,255,255,0.03) 1px, transparent 1px);background-size:40px 40px;"></div>
        
        <!-- Tag -->
        <div style="display:inline-block;font-size:10px;letter-spacing:0.2em;color:#c9a96e;border:0.5px solid #c9a96e;padding:4px 14px;border-radius:2px;text-transform:uppercase;margin-bottom:20px;">Vedic Jyotish · Career Analysis</div>
        
        <!-- Brand -->
        <div style="font-size:32px;font-weight:300;color:#ffffff;letter-spacing:0.05em;margin-bottom:6px;">Career Destiny</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:0.08em;margin-bottom:28px;">careerdestiny.in</div>
        
        <!-- Verdict Badge -->
        <div style="display:inline-block;background:rgba(201,169,110,0.12);border:0.5px solid rgba(201,169,110,0.5);border-radius:12px;padding:14px 28px;">
          <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">Career Destiny Verdict</div>
          <div style="font-size:26px;font-weight:600;color:${verdictColor};letter-spacing:0.08em;">${verdict || 'MIXED'}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">${verdictLabel}</div>
        </div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="background:#ffffff;padding:32px 40px 24px;">
        <p style="font-size:16px;color:#1a1a1a;font-weight:500;margin:0 0 8px;">Hi ${recipientName},</p>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 8px;">${verdictDesc}</p>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">Your complete Career Destiny Report is attached as a PDF. Here's what's inside:</p>
      </td></tr>

      <!-- 4 Section Cards -->
      <tr><td style="background:#ffffff;padding:0 40px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Card 1 -->
            <td width="48%" style="background:#fafaf8;border:0.5px solid #e8e8e8;border-radius:10px;padding:16px 18px;vertical-align:top;">
              <div style="font-size:20px;margin-bottom:8px;">📊</div>
              <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">Job vs Business</div>
              <div style="font-size:11px;color:#888;line-height:1.5;">Complete 7-factor Sapta Sutri scorecard with your exact verdict and the one factor that could change it</div>
            </td>
            <td width="4%"></td>
            <!-- Card 2 -->
            <td width="48%" style="background:#fafaf8;border:0.5px solid #e8e8e8;border-radius:10px;padding:16px 18px;vertical-align:top;">
              <div style="font-size:20px;margin-bottom:8px;">💰</div>
              <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">Wealth Picture</div>
              <div style="font-size:11px;color:#888;line-height:1.5;">When wealth arrives, how it flows, how much, the biggest obstacle, and foreign income possibility</div>
            </td>
          </tr>
          <tr><td colspan="3" style="padding:8px 0;"></td></tr>
          <tr>
            <!-- Card 3 -->
            <td width="48%" style="background:#fafaf8;border:0.5px solid #e8e8e8;border-radius:10px;padding:16px 18px;vertical-align:top;">
              <div style="font-size:20px;margin-bottom:8px;">🎯</div>
              <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">Career Direction</div>
              <div style="font-size:11px;color:#888;line-height:1.5;">Specific roles or business types backed by your planetary combinations, yogas, and strongest assets</div>
            </td>
            <td width="4%"></td>
            <!-- Card 4 -->
            <td width="48%" style="background:#fafaf8;border:0.5px solid #e8e8e8;border-radius:10px;padding:16px 18px;vertical-align:top;">
              <div style="font-size:20px;margin-bottom:8px;">⏰</div>
              <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">Timing + Action</div>
              <div style="font-size:11px;color:#888;line-height:1.5;">Your next 2 positive windows, one caution period, current transits, and the single most important next step</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Attachment Note -->
      <tr><td style="background:#ffffff;padding:0 40px 32px;">
        <div style="background:linear-gradient(135deg,#1a1025 0%,#2d1f4a 100%);border-radius:10px;padding:20px 24px;text-align:center;">
          <div style="font-size:24px;margin-bottom:8px;">📎</div>
          <div style="font-size:13px;font-weight:600;color:#c9a96e;margin-bottom:4px;">Your Report is Attached</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">Open the PDF attached to this email for your complete analysis. For best experience, open on desktop.</div>
        </div>
      </td></tr>

      <!-- Divider -->
      <tr><td style="background:#ffffff;padding:0 40px;">
        <div style="height:0.5px;background:#eee;"></div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
        <div style="font-size:13px;font-weight:500;color:#c9a96e;margin-bottom:6px;">Career Destiny</div>
        <div style="font-size:11px;color:#aaa;line-height:1.6;">Vedic Jyotish Career Analysis · careerdestiny.in<br/>Timing indicates probability windows — your choices determine the outcome.</div>
      </td></tr>

    </table>
    </td></tr>
  </table>

</body>
</html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let browser = null;
  try {
    const { html, email, name, verdict } = req.body;
    if (!html) return res.status(400).json({ error: 'html required' });
    if (!email) return res.status(400).json({ error: 'email required' });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Step 1 — Generate PDF
    const executablePath = await chromium.executablePath(CHROMIUM_URL);
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--font-render-hinting=none'
      ],
      defaultViewport: { width: 794, height: 1123 },
      executablePath,
      headless: true
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.addStyleTag({
      content: '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });

    await browser.close();
    browser = null;

    // Step 2 — Send via Resend REST API
    const filename = `Career_Destiny_Report_${(name || 'Report').replace(/\s+/g, '_')}.pdf`;
    const pdfBase64 = Buffer.from(pdf).toString('base64');
    const emailHtml = buildEmailHtml(name, verdict);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Career Destiny <reports@careerdestiny.in>',
        to: [email],
        subject: `${name ? name + ' — ' : ''}Your Career Destiny Report is ready`,
        html: emailHtml,
        attachments: [
          {
            filename: filename,
            content: pdfBase64,
            type: 'application/pdf'
          }
        ]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend error:', result);
      return res.status(500).json({ error: result.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, message: 'Report sent to ' + email });

  } catch (err) {
    console.error('Email error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
};
