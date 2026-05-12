// Test script to verify wiki scraping
import { scrapeWikiTable } from './worker/src/wiki-scrape.js';

const incidents = await scrapeWikiTable({});
console.log('\n=== TOTALS ===');
console.log(`Total incidents: ${incidents.length}`);
const totalVictims = incidents.reduce((sum, inc) => sum + inc.victims, 0);
const totalDeaths = incidents.reduce((sum, inc) => sum + inc.deaths, 0);
console.log(`Total victims (bergejala): ${totalVictims}`);
console.log(`Total deaths (meninggal): ${totalDeaths}`);

// Show breakdown
console.log('\n=== BY PROVINCE (top 10) ===');
const byProvince = {};
for (const inc of incidents) {
  byProvince[inc.province] = (byProvince[inc.province] || 0) + 1;
}
for (const [prov, count] of Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${prov}: ${count}`);
}

console.log('\n=== SAMPLE (first 10) ===');
for (const inc of incidents.slice(0, 10)) {
  console.log(`  ${inc.date} - ${inc.kabupaten}, ${inc.province}: ${inc.victims} victims`);
}