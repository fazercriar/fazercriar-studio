const mmFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtMm = (v: number) => `${mmFmt.format(v)} mm`;
export const fmtDims = (w: number, h: number) => `${mmFmt.format(w)} × ${mmFmt.format(h)} mm`;
export const fmtBrl = (v: number) => brl.format(v);

export function fmtTime(s: number): string {
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}
