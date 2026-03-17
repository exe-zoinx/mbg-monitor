async function analyze(name, url, searchPattern) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow', signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    // Find any links to article pages
    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    const links = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      if (url.includes(searchPattern) && !url.includes('login') && !url.includes('account') && !url.includes('javascript')) {
        links.push(url);
      }
    }
    console.log('\n=== ' + name + ' ===');
    console.log('Total article links: ' + links.length);
    links.slice(0, 5).forEach(l => console.log('  ' + l.slice(0, 120)));
    // Find article titles near those links
    if (links.length > 0) {
      const sampleUrl = links[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleMatch = html.match(new RegExp('href="' + sampleUrl + '"[^>]*>([^<]{10,})'));
      if (titleMatch) console.log('  Title: ' + titleMatch[1].slice(0, 100));
      // Try h2/h3 tags near links
      const h2Match = html.match(new RegExp('<h[23][^>]*>[^<]*<a[^>]*href="' + sampleUrl + '"[^>]*>([^<]+)'));
      if (h2Match) console.log('  H2Title: ' + h2Match[1].slice(0, 100));
    }
  } catch (e) { console.log(name + ': ERROR ' + e.message); }
}

(async () => {
  await analyze('Kompas', 'https://search.kompas.com/search/?q=keracunan+mbg&sort=date', '/read/');
  await analyze('Detik', 'https://www.detik.com/search/searchall?query=keracunan+mbg&sortby=time', 'detik.com/');
  await analyze('Tempo', 'https://www.tempo.co/search?q=keracunan+mbg', 'tempo.co/');
  await analyze('Tribun', 'https://www.tribunnews.com/search?q=keracunan+mbg', 'tribunnews.com/');
  await analyze('Suara', 'https://www.suara.com/search?q=keracunan+mbg', 'suara.com/');
  await analyze('Republika', 'https://www.republika.co.id/search?q=keracunan+mbg', 'republika.co.id/');
})();
