/**
 * Om Karthi Healing Centre Sitemap & Robots.txt Generator Script (High Performance)
 *
 * Automatically generates a standard compliance-ready sitemap.xml
 * and robots.txt based on static routes and live products fetched from API/local data.
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = (process.env.SITE_URL || 'https://omkarthihealingcentre.in').replace(/\/+$/, '');
const WEBSITE_ID = process.env.WEBSITE_ID || '';
const API_BASE = process.env.API_BASE || 'https://api.builder.agentzee.ai';
const TODAY = new Date().toISOString().split('T')[0];
const PAGE_SIZE = 100; // Fetch 100 items per batch for speed

// Valid static routes for Om Karthi Healing Centre
const staticRoutes = [
  { url: '/', priority: '1.00', changefreq: 'daily' },
  { url: '/index.html', priority: '1.00', changefreq: 'daily' }
];

/**
 * High-performance fetch of all products from live storefront API with parallel requests
 */
async function fetchProductsFromAPI() {
  if (!WEBSITE_ID) {
    return [];
  }
  const startTime = Date.now();
  console.log('Fetching products from Storefront API (optimized)...');

  try {
    const initialUrl = `${API_BASE}/api/storefront/products/?website_id=${WEBSITE_ID}&page=1&page_size=${PAGE_SIZE}`;
    const res = await fetch(initialUrl, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.warn(`API returned status ${res.status}`);
      return [];
    }

    const data = await res.json();
    let allProducts = data.results || (Array.isArray(data) ? data : []);

    const totalCount = data.count || allProducts.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    if (totalPages > 1) {
      const pagePromises = [];
      for (let p = 2; p <= Math.min(totalPages, 20); p++) {
        const pageUrl = `${API_BASE}/api/storefront/products/?website_id=${WEBSITE_ID}&page=${p}&page_size=${PAGE_SIZE}`;
        pagePromises.push(
          fetch(pageUrl, {
            headers: { 'ngrok-skip-browser-warning': 'true' },
            signal: AbortSignal.timeout(8000)
          })
            .then(r => (r.ok ? r.json() : null))
            .then(d => (d && (d.results || Array.isArray(d)) ? (d.results || d) : []))
            .catch(err => {
              console.warn(`Page ${p} fetch failed: ${err.message}`);
              return [];
            })
        );
      }

      const resultsArray = await Promise.all(pagePromises);
      resultsArray.forEach(batch => {
        allProducts = allProducts.concat(batch);
      });
    }

    console.log(`Fetched ${allProducts.length} products in ${Date.now() - startTime}ms.`);
    return allProducts;
  } catch (err) {
    console.warn(`API fetch error: ${err.message}`);
    return [];
  }
}

/**
 * Fallback to load products.json if it exists
 */
function loadLocalProducts(rootDir) {
  const productsPath = path.join(rootDir, 'products.json');
  if (fs.existsSync(productsPath)) {
    try {
      const data = fs.readFileSync(productsPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading products.json:', err.message);
    }
  }
  return [];
}

async function generateSitemap() {
  const rootDir = path.resolve(__dirname, '..');

  // Discover any additional static HTML pages in root directory
  try {
    const files = fs.readdirSync(rootDir);
    files.forEach(file => {
      if (file.endsWith('.html') && file !== 'index.html') {
        const pageName = file.replace('.html', '');
        if (!staticRoutes.some(r => r.url === `/${pageName}`)) {
          staticRoutes.push({ url: `/${pageName}`, priority: '0.80', changefreq: 'weekly' });
          staticRoutes.push({ url: `/${file}`, priority: '0.80', changefreq: 'weekly' });
        }
      }
    });
  } catch (err) {
    console.error('Error reading root directory:', err);
  }

  // Try live API first
  let products = await fetchProductsFromAPI();

  // Fallback to local products.json if API returned nothing
  if (!products || products.length === 0) {
    console.log('Falling back to local products.json...');
    products = loadLocalProducts(rootDir);
  }

  console.log(`Found ${products.length} products to include in sitemap.`);

  const chunks = [];
  chunks.push(`<?xml version="1.0" encoding="UTF-8"?>\n`);
  chunks.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`);
  chunks.push(`        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`);
  chunks.push(`        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n\n`);

  chunks.push(`  <!-- Main Static Pages -->\n`);
  for (let i = 0; i < staticRoutes.length; i++) {
    const route = staticRoutes[i];
    chunks.push(`  <url>\n`);
    chunks.push(`    <loc>${DOMAIN}${route.url}</loc>\n`);
    chunks.push(`    <lastmod>${TODAY}</lastmod>\n`);
    chunks.push(`    <changefreq>${route.changefreq}</changefreq>\n`);
    chunks.push(`    <priority>${route.priority}</priority>\n`);
    chunks.push(`  </url>\n`);
  }

  if (products.length > 0) {
    chunks.push(`\n  <!-- Dynamic Product Detail Pages -->\n`);
    const seenIds = new Set();

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const id = prod.id || prod._id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const encodedId = encodeURIComponent(id);

        chunks.push(`  <url>\n`);
        chunks.push(`    <loc>${DOMAIN}/view-product?id=${encodedId}</loc>\n`);
        chunks.push(`    <lastmod>${TODAY}</lastmod>\n`);
        chunks.push(`    <changefreq>weekly</changefreq>\n`);
        chunks.push(`    <priority>0.80</priority>\n`);
        chunks.push(`  </url>\n`);

        chunks.push(`  <url>\n`);
        chunks.push(`    <loc>${DOMAIN}/view-product.html?id=${encodedId}</loc>\n`);
        chunks.push(`    <lastmod>${TODAY}</lastmod>\n`);
        chunks.push(`    <changefreq>weekly</changefreq>\n`);
        chunks.push(`    <priority>0.80</priority>\n`);
        chunks.push(`  </url>\n`);
      }
    }
  }

  chunks.push(`</urlset>\n`);

  const xml = chunks.join('');
  const outputPath = path.join(rootDir, 'sitemap.xml');
  await fs.promises.writeFile(outputPath, xml, 'utf8');
  console.log(`✓ Successfully generated sitemap.xml with ${staticRoutes.length + (products.length * 2)} URLs at: ${outputPath}`);
}

async function generateRobotsTxt() {
  const rootDir = path.resolve(__dirname, '..');
  const robotsContent = `# ==============================================================================
# Robots.txt for Om Karthi Healing Centre (${DOMAIN})
# ==============================================================================

User-agent: *
Allow: /
Allow: /assets/
Allow: /styles.css
Allow: /script.js

# Sitemap location
Sitemap: ${DOMAIN}/sitemap.xml
`;

  const outputPath = path.join(rootDir, 'robots.txt');
  await fs.promises.writeFile(outputPath, robotsContent, 'utf8');
  console.log(`✓ Successfully generated robots.txt at: ${outputPath}`);
}

(async () => {
  try {
    await generateSitemap();
    await generateRobotsTxt();
  } catch (err) {
    console.error('Sitemap generator error:', err);
    process.exit(1);
  }
})();
