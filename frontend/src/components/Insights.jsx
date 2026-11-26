import { useMemo } from 'react';
import { fmtNum } from '../lib/constants';

// Compact analytics panel: monthly case trend + hardest-hit provinces.
// Native <details> keeps it collapsed until needed (no state, works on mobile).

const MLBL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function Insights({ incidents, onPickMonth, onPickProvince, activeMonth }) {
  const months = useMemo(() => {
    const map = new Map();
    for (const i of incidents) {
      if (!/^\d{4}-\d{2}/.test(i.date || '')) continue;
      const k = i.date.slice(0, 7);
      const e = map.get(k) || { cases: 0, victims: 0, deaths: 0 };
      e.cases += 1;
      e.victims += i.victims || 0;
      e.deaths += i.deaths || 0;
      map.set(k, e);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-18)
      .map(([key, v]) => ({ key, ...v }));
  }, [incidents]);

  const provinces = useMemo(() => {
    const map = new Map();
    for (const i of incidents) {
      const p = (i.province || '').trim();
      if (!p) continue;
      const e = map.get(p) || { cases: 0, victims: 0, deaths: 0 };
      e.cases += 1;
      e.victims += i.victims || 0;
      e.deaths += i.deaths || 0;
      map.set(p, e);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.victims - a.victims)
      .slice(0, 8);
  }, [incidents]);

  const peak = Math.max(1, ...months.map(m => m.cases));
  const topVictims = Math.max(1, ...provinces.map(p => p.victims));
  const sumCases = months.reduce((s, m) => s + m.cases, 0);

  if (!months.length) return null;

  return (
    <details className="mbg-insights" style={{ borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
      <summary style={{
        cursor: 'pointer', padding: '7px 14px',
        fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        Analitik &middot; {fmtNum(sumCases)} kasus / {months.length} bulan
      </summary>

      <div style={{ padding: '2px 14px 10px' }}>
        <div style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', marginBottom: 6 }}>
          TREN BULANAN — klik batang untuk memfilter
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
          {months.map((m) => {
            const on = activeMonth === m.key;
            const h = Math.max(2, Math.round((m.cases / peak) * 52));
            return (
              <button
                key={m.key}
                onClick={() => onPickMonth(on ? '' : m.key)}
                title={`${m.key}: ${m.cases} insiden, ${fmtNum(m.victims)} korban, ${m.deaths} meninggal`}
                aria-pressed={on}
                style={{
                  flex: 1, minWidth: 0, height: h, padding: 0, cursor: 'pointer',
                  background: on ? 'var(--red)' : m.deaths ? 'var(--pur)' : 'rgba(248,81,73,0.45)',
                  border: on ? '1px solid var(--tx)' : 'none',
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
          {months.map((m, i) => (
            <span key={m.key} style={{
              flex: 1, minWidth: 0, fontFamily: 'var(--mo)', fontSize: 7,
              color: 'var(--mu)', textAlign: 'center', overflow: 'hidden',
            }}>
              {i % 3 === 0 ? MLBL[Number(m.key.slice(5, 7)) - 1] : ''}
            </span>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', margin: '10px 0 5px' }}>
          PROVINSI TERDAMPAK — klik untuk mencari
        </div>
        {provinces.map((p) => (
          <button
            key={p.name}
            onClick={() => onPickProvince(p.name)}
            title={`${p.cases} insiden · ${p.deaths} meninggal`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'none', border: 'none', padding: '3px 0',
              cursor: 'pointer', textAlign: 'left', color: 'var(--tx)',
            }}
          >
            <span style={{ flex: '0 0 96px', fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
            <span style={{ flex: 1, height: 5, background: '#ffffff10', borderRadius: 3, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(p.victims / topVictims) * 100}%`, background: 'var(--red)', borderRadius: 3 }} />
            </span>
            <span style={{ flexShrink: 0, fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--red)', minWidth: 42, textAlign: 'right' }}>
              {fmtNum(p.victims)}
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}
