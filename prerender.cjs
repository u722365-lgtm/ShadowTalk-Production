const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const PORT = 8089;
const DIST_DIR = path.resolve(__dirname, 'dist');

// The critical routes we want perfectly indexed by Google
const ROUTES_TO_PRERENDER = [
  '/',
  '/founder',
  '/about',
  '/pricing',
  '/chatbot',
  '/execute',
  '/research',
  '/computer',
  '/security',
  '/insights',
  '/forge',
  '/marketplace',
  '/missioncontrol'
];

// Simple static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(DIST_DIR, reqPath);

  // SPA Fallback
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.js') contentType = 'text/javascript';
  else if (ext === '.css') contentType = 'text/css';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.json') contentType = 'application/json';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end(`Error: ${err.code}`);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

async function runPrerender() {
  console.log('Starting prerender static server...');
  server.listen(PORT);

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Speed up by aborting unnecessary requests
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const rType = req.resourceType();
    if (['image', 'media', 'font', 'websocket'].includes(rType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  for (const route of ROUTES_TO_PRERENDER) {
    console.log(`Prerendering route: ${route}`);
    const url = `http://localhost:${PORT}${route}`;
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Give react-helmet and React rendering time to settle
      // since networkidle0 will timeout if there are open websockets
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      let html = await page.content();
      
      let outDir = DIST_DIR;
      if (route !== '/') {
        outDir = path.join(DIST_DIR, route.substring(1));
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
      }
      
      const outPath = path.join(outDir, 'index.html');
      fs.writeFileSync(outPath, html);
      console.log(`✅ Saved: ${outPath}`);
    } catch (e) {
      console.error(`❌ Failed to prerender ${route}:`, e.message);
    }
  }

  await browser.close();
  server.close();
  console.log('Prerendering complete!');
}

runPrerender().catch(err => {
  console.error('Prerender error:', err);
  process.exit(1);
});
