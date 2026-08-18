// Calculadoras que substituem o chatbot externo do PDF:
// FCmáx (Tanaka / 220-idade) + zonas (percentual direto ou Karvonen)
// e 1RM (Epley / Brzycki) com tabela de percentuais de carga.

import { percentuaisZona, plano } from '../dados/plano';
import type { ChaveZona, MetodoFcMax } from '../dados/tipos';

export const ZONAS: ChaveZona[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

export function calcularFcMax(idade: number, metodo: MetodoFcMax): number {
  if (!Number.isFinite(idade) || idade <= 0) return 0;
  const bruto = metodo === '220-idade' ? 220 - idade : 208 - 0.7 * idade;
  return Math.round(bruto);
}

export interface FaixaZona {
  zona: ChaveZona;
  min: number;
  max: number;
  percentualMin: number;
  percentualMax: number;
  descricao: string;
}

/**
 * Zonas em BPM. Com `fcRepouso` e Karvonen usa a reserva de frequência
 * cardíaca: FC = ((FCmáx - FCrep) * %) + FCrep.
 */
export function calcularZonas(
  fcMax: number,
  opcoes: { fcRepouso?: number; usarKarvonen?: boolean } = {},
): FaixaZona[] {
  const { fcRepouso, usarKarvonen } = opcoes;
  const karvonen = Boolean(usarKarvonen && fcRepouso && fcRepouso > 0 && fcRepouso < fcMax);
  const bpm = (percentual: number) =>
    karvonen
      ? Math.round((fcMax - (fcRepouso as number)) * percentual + (fcRepouso as number))
      : Math.round(fcMax * percentual);

  return ZONAS.map((zona) => {
    const [pMin, pMax] = percentuaisZona[zona];
    return {
      zona,
      min: bpm(pMin),
      max: bpm(pMax),
      percentualMin: pMin,
      percentualMax: pMax,
      descricao: plano.zonas_fc[zona],
    };
  });
}

export function faixaDaZona(
  zona: ChaveZona,
  fcMax: number,
  opcoes: { fcRepouso?: number; usarKarvonen?: boolean } = {},
): FaixaZona {
  return calcularZonas(fcMax, opcoes).find((f) => f.zona === zona) as FaixaZona;
}

// ---------------------------------------------------------------------------
// 1RM
// ---------------------------------------------------------------------------

export function epley(peso: number, reps: number): number {
  if (peso <= 0 || reps <= 0) return 0;
  return peso * (1 + reps / 30);
}

export function brzycki(peso: number, reps: number): number {
  if (peso <= 0 || reps <= 0 || reps >= 37) return 0;
  return (peso * 36) / (37 - reps);
}

export const PERCENTUAIS_CARGA = [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

export function tabelaPercentuais(um: number): { percentual: number; peso: number }[] {
  return PERCENTUAIS_CARGA.map((p) => ({ percentual: p, peso: arredondarCarga(um * p) }));
}

/** Arredonda para o incremento realista de anilha/halter (2,5 kg). */
export function arredondarCarga(peso: number, incremento = 2.5): number {
  if (!Number.isFinite(peso) || peso <= 0) return 0;
  return Math.round(peso / incremento) * incremento;
}

/**
 * Peso de trabalho sugerido: estima o 1RM (Epley) a partir do último registro
 * e volta para a meta de repetições de hoje, invertendo a mesma fórmula.
 */
export function sugerirCarga(
  ultimoPeso: number,
  ultimasReps: number,
  metaReps: number,
): { peso: number; um: number } | null {
  if (ultimoPeso <= 0 || ultimasReps <= 0 || metaReps <= 0) return null;
  const um = epley(ultimoPeso, ultimasReps);
  const peso = um / (1 + metaReps / 30);
  return { peso: arredondarCarga(peso), um: Math.round(um * 10) / 10 };
}
