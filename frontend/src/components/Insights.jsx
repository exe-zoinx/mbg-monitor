import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmtNum } from '../lib/constants';

// Compact analytics panel: monthly case trend + hardest-hit provinces.
// Header always shows the headline numbers so the panel reads without opening it.

const MLBL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const monthLabel = (key) => `${MLBL[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

export default function Insights({
  incidents, onPickMonth, onPickProvince, activeMonth, forceOpen = 0,
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

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
      .slice(0, 6);
  }, [incidents]);

  if (!months.length) return null;

  const peak = Math.max(1, ...months.map(m => m.cases));
  const topVictims = Math.max(1, ...provinces.map(p => p.victims));
  const last = months[months.length - 1];
  const shown = months.find(m => m.key === activeMonth) || last;

  // 3 bulan terakhir vs 3 sebelumnya — the number people actually want at a glance.
  const tail = months.slice(-3).reduce((s, m) => s + m.cases, 0);
  const prev = months.slice(-6, -3).reduce((s, m) => s + m.cases, 0);
  const delta = prev ? Math.round(((tail - prev) / prev) * 100) : 0;

  const trend = delta > 3 ? { icon: TrendingUp, color: 'var(--red)', label: `+${delta}%` }
    : delta < -3 ? { icon: TrendingDown, color: 'var(--grn)', label: `${delta}%` }
      : { icon: Minus, color: 'var(--mu)', label: 'stabil' };
  const TI = trend.icon;
  const totalVictims = months.reduce((s, m) => s + m.victims, 0);

  return (
    <div id="mbg-insights" className="mbg-insights" style={{ borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
      <button
        className="mbg-insights-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="mbg-insights-body"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: open ? 'var(--sf2)' : 'transparent', border: 'none',
          cursor: 'pointer', padding: '9px 14px', textAlign: 'left', color: 'var(--tx)',
          borderBottom: open ? '1px solid var(--bd)' : 'none', minHeight: 44,
        }}
      >
        <span style={{
          fontFamily: 'var(--mo)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--tx)',
        }}>
          Analitik
        </span>
        <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)' }}>
          {fmtNum(incidents.length)} insiden · {fmtNum(totalVictims)} korban
        </span>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3,
          fontFamily: 'var(--mo)', fontSize: 10, fontWeight: 700, color: trend.color,
          background: '#ffffff08', borderRadius: 10, padding: '3px 8px', whiteSpace: 'nowrap',
        }}
          title="Kasus 3 bulan terakhir dibanding 3 bulan sebelumnya"
        >
          <TI size={11} strokeWidth={2.5} /> {trend.label}
        </span>
        <span
          className="mbg-insights-toggle"
          style={{
            marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--mo)', fontSize: 10, fontWeight: 700,
            color: open ? 'var(--tx)' : 'var(--pur)',
            background: open ? '#ffffff0d' : '#bc8cff1a',
            border: `1px solid ${open ? 'var(--bd2)' : '#bc8cff66'}`,
            borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap',
            flexShrink: 0, minHeight: 24,
          }}
        >
          {open ? 'Tutup' : 'Buka'}
          <ChevronDown
            size={13}
            strokeWidth={3}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}
          />
        </span>
      </button>

      {open && (
        <div id="mbg-insights-body" style={{ padding: '10px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', letterSpacing: '0.06em' }}>
              TREN BULANAN
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--tx)' }}>
              {monthLabel(shown.key)}: {fmtNum(shown.cases)} insiden · {fmtNum(shown.victims)} korban
              {shown.deaths ? ` · ${shown.deaths} meninggal` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 78 }}>
            {months.map((m) => {
              const on = activeMonth === m.key;
              const h = Math.max(4, Math.round((m.cases / peak) * 74));
              return (
                <button
                  key={m.key}
                  onClick={() => onPickMonth(on ? '' : m.key)}
                  title={`${monthLabel(m.key)}: ${m.cases} insiden, ${fmtNum(m.victims)} korban, ${m.deaths} meninggal`}
                  aria-pressed={on}
                  aria-label={`Filter ${monthLabel(m.key)}`}
                  className="insights-bar"
                  style={{
                    flex: 1, minWidth: 12, height: '100%', padding: 0, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'flex-end',
                  }}
                >
                  <span style={{
                    display: 'block', width: '100%', height: h, borderRadius: 3,
                    background: on ? 'var(--red)' : m.deaths ? 'var(--pur)' : 'rgba(248,81,73,0.5)',
                    outline: on ? '1px solid var(--tx)' : 'none', outlineOffset: 1,
                  }} />
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {months.map((m, i) => (
              <span key={m.key} style={{
                flex: 1, minWidth: 12, fontFamily: 'var(--mo)', fontSize: 8, lineHeight: 1.1,
                color: activeMonth === m.key ? 'var(--red)' : 'var(--mu)',
                textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                {months.length > 10 ? (i % 2 === 0 ? MLBL[Number(m.key.slice(5, 7)) - 1] : '')
                  : MLBL[Number(m.key.slice(5, 7)) - 1]}
              </span>
            ))}
          </div>

          <div style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span><span style={{ color: 'rgba(248,81,73,0.75)' }}>■</span> keracunan</span>
            <span><span style={{ color: 'var(--pur)' }}>■</span> ada korban meninggal</span>
            <span style={{ marginLeft: 'auto' }}>{activeMonth ? 'klik batang aktif untuk melepas filter' : 'klik batang untuk memfilter bulan'}</span>
          </div>

          <div style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', letterSpacing: '0.06em', margin: '12px 0 6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>PROVINSI TERDAMPAK — 6 teratas</span>
            <span>kasus · korban · jiwa</span>
          </div>

          {provinces.map((p, idx) => (
            <button
              key={p.name}
              onClick={() => onPickProvince(p.name)}
              title={`Filter ${p.name}: ${p.cases} insiden, ${fmtNum(p.victims)} korban, ${p.deaths} meninggal`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', padding: '4px 0',
                cursor: 'pointer', textAlign: 'left', color: 'var(--tx)',
              }}
            >
              <span style={{ flex: '0 0 14px', fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)' }}>
                {idx + 1}
              </span>
              <span style={{ flex: '0 0 92px', fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ flex: 1, height: 6, background: '#ffffff10', borderRadius: 3, overflow: 'hidden', minWidth: 24 }}>
                <span style={{ display: 'block', height: '100%', width: `${(p.victims / topVictims) * 100}%`, background: 'var(--red)', borderRadius: 3 }} />
              </span>
              <span style={{ flexShrink: 0, fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', minWidth: 74, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {p.cases} · <span style={{ color: 'var(--red)' }}>{fmtNum(p.victims)}</span>
                {p.deaths ? <span style={{ color: 'var(--pur)' }}> · {p.deaths}</span> : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
