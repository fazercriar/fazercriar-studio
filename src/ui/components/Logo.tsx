import { useId } from 'react';
import { BRAND, SYMBOL_BASE_1, SYMBOL_BASE_2, SYMBOL_BASE_WIDTH, SYMBOL_BULB, SYMBOL_C, SYMBOL_C_WIDTH } from '../brand';

/** Símbolo lâmpada-C. `tone` define a cor do C e da base. */
export function LogoSymbol({ size = 32, tone = BRAND.branco }: { size?: number; tone?: string }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND.laranjaClaro} />
          <stop offset="1" stopColor={BRAND.laranjaEscuro} />
        </linearGradient>
      </defs>
      <path d={SYMBOL_C} fill="none" stroke={tone} strokeWidth={SYMBOL_C_WIDTH} />
      <path d={SYMBOL_BULB} fill={`url(#${gid})`} />
      <path d={`${SYMBOL_BASE_1} ${SYMBOL_BASE_2}`} stroke={tone} strokeWidth={SYMBOL_BASE_WIDTH} strokeLinecap="round" />
    </svg>
  );
}

/** Logotipo horizontal: "Fazer" laranja + símbolo no lugar do C + "riar". */
export function Logo({ dark = true, tagline = false, size = 26 }: { dark?: boolean; tagline?: boolean; size?: number }) {
  const tone = dark ? BRAND.branco : BRAND.grafite;
  return (
    <span className="logo" style={{ fontSize: size }} aria-label="FazerCriar">
      <span className="logo-word">
        <span className="logo-fazer">Fazer</span>
        <span className="logo-c">
          <LogoSymbol size={size * 1.18} tone={tone} />
        </span>
        <span className="logo-riar" style={{ color: tone }}>riar</span>
      </span>
      {tagline && <span className="logo-tag" style={{ color: tone }}>IDEIAS GANHAM FORMA.</span>}
    </span>
  );
}
