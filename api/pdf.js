const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let browser = null;
  try {
    const { html, filename } = req.body;
    if (!html) return res.status(400).json({ error: 'html required' });

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

    // Inject print color CSS
    await page.addStyleTag({
      content: '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename||'Career_Destiny_Report'}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.status(200).send(pdf);

  } catch(err) {
    console.error('PDF error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if(browser) await browser.close();
  }
};
