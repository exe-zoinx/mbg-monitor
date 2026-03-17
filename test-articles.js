// Test content extraction from individual article pages
async function testArticlePage(name, url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow', signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    
    // Try to find article body content
    const patterns = [
      { name: 'kompas-content', regex: /<div\s+class="[^"]*read__content[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'kompas-body', regex: /<div\s+class="[^"]*article__body[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'detik-body', regex: /<div\s+class="[^"]*detail__body[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'detik-body-text', regex: /<div\s+class="[^"]*itp_bodycontent[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'tempo-body', regex: /<div\s+class="[^"]*article-content[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'tempo-detail', regex: /<div\s+class="[^"]*detail-wrap[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'liputan6-body', regex: /<div\s+class="[^"]*article-content-body[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'tribun-body', regex: /<div\s+class="[^"]*txt-article[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'republika-body', regex: /<div\s+class="[^"]*article-content[^"]*">([\s\S]*?)<\/div>/ },
      { name: 'generic-article', regex: /<article[^>]*>([\s\S]*?)<\/article>/ },
      { name: 'generic-content', regex: /<div\s+class="[^"]*content[^"]*">([\s\S]*?)<\/div>/ },
    ];
    
    console.log('\n=== ' + name + ' ===');
    console.log('Page size: ' + html.length);
    
    for (const p of patterns) {
      const m = html.match(p.regex);
      if (m) {
        const text = m[1].replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 100) {
          console.log('  Pattern "' + p.name + '": ' + text.length + ' chars');
          console.log('  Preview: ' + text.slice(0, 200));
          break;
        }
      }
    }
    
    // Also try extracting all paragraphs
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pRegex.exec(html)) !== null) {
      const t = pm[1].replace(/<[^>]+>/g, '').trim();
      if (t.length > 30) paragraphs.push(t);
    }
    if (paragraphs.length > 0) {
      console.log('  Paragraphs: ' + paragraphs.length + ' total');
      console.log('  First para: ' + paragraphs[0].slice(0, 150));
    }
  } catch (e) { console.log(name + ': ERROR ' + e.message); }
}

(async () => {
  // Test specific article pages
  await testArticlePage('Kompas-Article', 'https://surabaya.kompas.com/read/2026/03/17/110923978/viral-usai-sindir-rakyat-jelata-kurang-bersyukur-pegawai-sppg-purb');
  await testArticlePage('Antara-Article', 'https://www.antaranews.com/berita/5475394/bgn-telusuri-dugaan-keracunan-penerima-mbg-di-nabire');
  
  // Search for actual keracunan articles
  const searchUrl = 'https://search.kompas.com/search/?q=keracunan+MBG+siswa&sort=date';
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();
  
  // Extract all /read/ links
  const linkRegex = /href="(https?:\/\/[^"]*kompas\.com\/read\/[^"]+)"/g;
  const links = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  console.log('\n=== Kompas Search Results ===');
  console.log('Found ' + links.length + ' unique article links');
  
  // Find titles for those links
  for (const link of links.slice(0, 5)) {
    const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try title attribute
    const titleMatch = html.match(new RegExp('href="' + escaped + '"[^>]*title="([^"]+)"'));
    // Try h2/h3 content
    const h2Match = html.match(new RegExp('<h[23][^>]*>\\s*<a[^>]*href="' + escaped + '"[^>]*>\\s*([^<]+)'));
    const title = titleMatch?.[1] || h2Match?.[1] || 'no title';
    console.log('  ' + title.trim().slice(0, 80));
    console.log('    ' + link.slice(0, 100));
  }
})();
