import { useTheme } from '../contexts/ThemeContext.jsx';

export default function ApertureMark({ s = 64, ink: inkProp, accent: accentProp, bg }) {
  const ctx = useTheme();
  const T = ctx?.T;
  const inkColor    = inkProp    || T?.ink    || '#19191A';
  const accentColor = accentProp || T?.accent || 'oklch(0.48 0.13 258)';
  const stroke1 = Math.max(1.5, s * 0.038);
  const stroke2 = Math.max(1.2, s * 0.032);
  const dotR    = Math.max(2, s * 0.08) * (92 / s) / 2 * 1.6;
  const sw1     = stroke1 * (92 / s);
  const sw2     = stroke2 * (92 / s);
  return (
    <svg
      width={s} height={s} viewBox="0 0 92 92" fill="none" aria-hidden="true"
      style={{ background: bg || 'transparent', borderRadius: bg ? s * 0.22 : 0, flexShrink: 0 }}
    >
      <path d="M46 8 A38 38 0 1 0 78 65" stroke={inkColor} strokeWidth={sw1} strokeLinecap="round" fill="none" />
      <path d="M46 22 A24 24 0 1 0 66 58" stroke={inkColor} strokeWidth={sw2} strokeLinecap="round" fill="none" />
      <circle cx="46" cy="46" r={dotR} fill={accentColor} />
    </svg>
  );
}
