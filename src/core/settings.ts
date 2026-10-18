// Perfis de material, máquina e custos. Os valores padrão são EXEMPLOS: ajuste em Configurações.

export interface Material {
  id: string;
  nome: string;
  espessura: number; // mm
  kerf: number; // mm (largura total do corte)
  ponteMin: number; // mm
  detalheMin: number; // mm
  corteVel: number; // mm/s
  cortePot: number; // %
  gravVel: number; // mm/s
  gravPot: number; // %
  intervalo: number; // mm entre linhas de gravação
  chapaPreco: number; // R$
  chapaW: number; // mm
  chapaH: number; // mm
  cor: string; // cor da prévia
  corGravacao: string; // cor da gravação na prévia
}

export interface Machine {
  nome: string;
  areaW: number;
  areaH: number;
  deslocVel: number; // mm/s em vazio
  perfuracaoS: number; // s por contorno
  aceleracaoLinhaS: number; // s extra por linha de gravação
  fatorCalibracao: number; // multiplica o tempo total
  custoMinuto: number; // R$/min de máquina
}

export interface Pricing {
  custoFixo: number; // R$ por pedido
  margem: number; // %
  perda: number; // % de material perdido
}

export interface OpColors {
  corte: string;
  gravacao: string;
  marcacao: string;
}

export interface Settings {
  materials: Material[];
  machine: Machine;
  pricing: Pricing;
  colors: OpColors;
  /** Espaço entre peças na chapa do lote (mm). */
  espacamentoLote: number;
}

export const DEFAULT_SETTINGS: Settings = {
  materials: [
    { id: 'mdf3', nome: 'MDF cru 3 mm', espessura: 3, kerf: 0.15, ponteMin: 1.5, detalheMin: 1.0, corteVel: 15, cortePot: 60, gravVel: 300, gravPot: 25, intervalo: 0.1, chapaPreco: 12, chapaW: 600, chapaH: 400, cor: '#C9A27E', corGravacao: '#5B3A1F' },
    { id: 'mdf6', nome: 'MDF cru 6 mm', espessura: 6, kerf: 0.2, ponteMin: 2.5, detalheMin: 1.5, corteVel: 8, cortePot: 75, gravVel: 300, gravPot: 25, intervalo: 0.1, chapaPreco: 20, chapaW: 600, chapaH: 400, cor: '#C29A74', corGravacao: '#5B3A1F' },
    { id: 'compensado3', nome: 'Compensado 3 mm', espessura: 3, kerf: 0.15, ponteMin: 1.8, detalheMin: 1.0, corteVel: 14, cortePot: 60, gravVel: 300, gravPot: 22, intervalo: 0.1, chapaPreco: 18, chapaW: 600, chapaH: 400, cor: '#E3C79A', corGravacao: '#6B4423' },
    { id: 'acrilico3', nome: 'Acrílico 3 mm', espessura: 3, kerf: 0.2, ponteMin: 1.5, detalheMin: 1.0, corteVel: 12, cortePot: 65, gravVel: 350, gravPot: 18, intervalo: 0.08, chapaPreco: 45, chapaW: 600, chapaH: 400, cor: '#F2F2F2', corGravacao: '#BDBDBD' },
  ],
  machine: { nome: 'Laser CO2 600 × 400', areaW: 600, areaH: 400, deslocVel: 300, perfuracaoS: 0.3, aceleracaoLinhaS: 0.02, fatorCalibracao: 1.15, custoMinuto: 1.5 },
  pricing: { custoFixo: 2, margem: 100, perda: 15 },
  colors: { corte: '#FF0000', gravacao: '#000000', marcacao: '#0000FF' },
  espacamentoLote: 3,
};
