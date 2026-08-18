// Motor do cronômetro de corrida — puro e sem dependência de React/DOM.
// Toda a contagem é derivada de timestamps (Date.now), nunca de "quantos ticks
// já rodaram", para não acumular erro nem perder tempo quando o navegador
// suspende o timer com a tela apagada.

import type { ChaveZona, NomeFaseCronometro, SessaoCorrida } from '../dados/tipos';

export interface FaseCronometro {
  indice: number;
  tipo: NomeFaseCronometro;
  rotulo: string;
  /** null = fase livre (a prova de 3km), o usuário encerra manualmente. */
  duracaoSeg: number | null;
  zona: ChaveZona;
  /** Preenchido só no bloco principal: "intervalo 3 de 7". */
  intervalo?: { numero: number; total: number };
}

export interface EstadoCronometro {
  fases: FaseCronometro[];
  indiceFase: number;
  decorridoNaFaseMs: number;
  decorridoTotalMs: number;
  rodando: boolean;
  concluido: boolean;
  /** Timestamp do último recálculo. */
  referenciaMs: number;
}

export interface ResultadoTick {
  estado: EstadoCronometro;
  /** Fases em que o cronômetro *entrou* neste tick (para bip/vibração). */
  transicoes: FaseCronometro[];
  /** true quando a sessão terminou exatamente neste tick. */
  concluiuAgora: boolean;
}

// ---------------------------------------------------------------------------
// Montagem das fases a partir da sessão do plano
// ---------------------------------------------------------------------------

export function montarFases(sessao: SessaoCorrida): FaseCronometro[] {
  const fases: FaseCronometro[] = [];
  const push = (f: Omit<FaseCronometro, 'indice'>) =>
    fases.push({ ...f, indice: fases.length });

  push({
    tipo: 'aquecimento',
    rotulo: 'AQUECER',
    duracaoSeg: sessao.aquecimento.duracao_seg,
    zona: sessao.aquecimento.zona,
  });

  if (sessao.prova_final || !sessao.correr || !sessao.caminhar) {
    push({
      tipo: 'livre',
      rotulo: 'CORRER',
      duracaoSeg: null,
      zona: sessao.corrida_continua?.zona ?? 'Z3',
    });
  } else {
    const total = sessao.repeticoes;
    for (let n = 1; n <= total; n++) {
      push({
        tipo: 'correr',
        rotulo: 'CORRER',
        duracaoSeg: sessao.correr.duracao_seg,
        zona: sessao.correr.zona,
        intervalo: { numero: n, total },
      });
      push({
        tipo: 'caminhar',
        rotulo: 'CAMINHAR',
        duracaoSeg: sessao.caminhar.duracao_seg,
        zona: sessao.caminhar.zona,
        intervalo: { numero: n, total },
      });
    }
  }

  push({
    tipo: 'volta_calma',
    rotulo: 'VOLTA À CALMA',
    duracaoSeg: sessao.volta_calma.duracao_seg,
    zona: sessao.volta_calma.zona,
  });

  return fases;
}

/** Duração total prevista em segundos; fases livres contam como 0. */
export function duracaoTotalFases(fases: FaseCronometro[]): number {
  return fases.reduce((n, f) => n + (f.duracaoSeg ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function criarEstado(fases: FaseCronometro[], agoraMs: number): EstadoCronometro {
  return {
    fases,
    indiceFase: 0,
    decorridoNaFaseMs: 0,
    decorridoTotalMs: 0,
    rodando: false,
    concluido: fases.length === 0,
    referenciaMs: agoraMs,
  };
}

export function iniciar(estado: EstadoCronometro, agoraMs: number): EstadoCronometro {
  if (estado.concluido) return estado;
  return { ...estado, rodando: true, referenciaMs: agoraMs };
}

export function pausar(estado: EstadoCronometro, agoraMs: number): EstadoCronometro {
  if (!estado.rodando) return estado;
  const { estado: atualizado } = tick(estado, agoraMs);
  return { ...atualizado, rodando: false, referenciaMs: agoraMs };
}

export function alternarPausa(estado: EstadoCronometro, agoraMs: number): EstadoCronometro {
  return estado.rodando ? pausar(estado, agoraMs) : iniciar(estado, agoraMs);
}

/** Pula para a próxima fase (ou encerra, se era a última). */
export function pularFase(estado: EstadoCronometro, agoraMs: number): ResultadoTick {
  const base = estado.rodando ? tick(estado, agoraMs).estado : estado;
  if (base.concluido) return { estado: base, transicoes: [], concluiuAgora: false };

  const proximo = base.indiceFase + 1;
  const concluido = proximo >= base.fases.length;
  const estadoNovo: EstadoCronometro = {
    ...base,
    indiceFase: concluido ? base.fases.length - 1 : proximo,
    decorridoNaFaseMs: concluido ? base.decorridoNaFaseMs : 0,
    concluido,
    rodando: concluido ? false : base.rodando,
    referenciaMs: agoraMs,
  };
  return {
    estado: estadoNovo,
    transicoes: concluido ? [] : [base.fases[proximo]],
    concluiuAgora: concluido,
  };
}

/** Encerra a sessão manualmente (o "encerrar" do botão). */
export function encerrar(estado: EstadoCronometro, agoraMs: number): EstadoCronometro {
  const base = estado.rodando ? tick(estado, agoraMs).estado : estado;
  return { ...base, rodando: false, concluido: true, referenciaMs: agoraMs };
}

/**
 * Recalcula o estado até `agoraMs`. Aguenta saltos grandes de tempo (tela
 * apagada, aba em segundo plano) atravessando quantas fases forem necessárias.
 */
export function tick(estado: EstadoCronometro, agoraMs: number): ResultadoTick {
  if (!estado.rodando || estado.concluido) {
    return { estado: { ...estado, referenciaMs: agoraMs }, transicoes: [], concluiuAgora: false };
  }

  let restanteDelta = Math.max(0, agoraMs - estado.referenciaMs);
  let indiceFase = estado.indiceFase;
  let decorridoNaFaseMs = estado.decorridoNaFaseMs;
  let decorridoTotalMs = estado.decorridoTotalMs;
  let concluido = false;
  const transicoes: FaseCronometro[] = [];

  while (restanteDelta > 0) {
    const fase = estado.fases[indiceFase];
    if (!fase) {
      concluido = true;
      break;
    }
    if (fase.duracaoSeg === null) {
      // Fase livre: absorve tudo, só sai por ação do usuário.
      decorridoNaFaseMs += restanteDelta;
      decorridoTotalMs += restanteDelta;
      restanteDelta = 0;
      break;
    }
    const restanteNaFase = fase.duracaoSeg * 1000 - decorridoNaFaseMs;
    if (restanteDelta < restanteNaFase) {
      decorridoNaFaseMs += restanteDelta;
      decorridoTotalMs += restanteDelta;
      restanteDelta = 0;
      break;
    }
    // A fase terminou dentro deste intervalo de tempo.
    decorridoTotalMs += restanteNaFase;
    restanteDelta -= restanteNaFase;
    const proximo = indiceFase + 1;
    if (proximo >= estado.fases.length) {
      indiceFase = estado.fases.length - 1;
      decorridoNaFaseMs = fase.duracaoSeg * 1000;
      concluido = true;
      break;
    }
    indiceFase = proximo;
    decorridoNaFaseMs = 0;
    transicoes.push(estado.fases[proximo]);
  }

  return {
    estado: {
      ...estado,
      indiceFase,
      decorridoNaFaseMs,
      decorridoTotalMs,
      concluido,
      rodando: concluido ? false : estado.rodando,
      referenciaMs: agoraMs,
    },
    transicoes,
    concluiuAgora: concluido,
  };
}

// ---------------------------------------------------------------------------
// Leituras derivadas (para a UI)
// ---------------------------------------------------------------------------

export function faseAtual(estado: EstadoCronometro): FaseCronometro | undefined {
  return estado.fases[estado.indiceFase];
}

export function proximaFase(estado: EstadoCronometro): FaseCronometro | undefined {
  return estado.fases[estado.indiceFase + 1];
}

/** Segundos restantes na fase atual (arredondados para cima). null em fase livre. */
export function restanteNaFaseSeg(estado: EstadoCronometro): number | null {
  const fase = faseAtual(estado);
  if (!fase || fase.duracaoSeg === null) return null;
  return Math.max(0, Math.ceil((fase.duracaoSeg * 1000 - estado.decorridoNaFaseMs) / 1000));
}

export function decorridoNaFaseSeg(estado: EstadoCronometro): number {
  return Math.floor(estado.decorridoNaFaseMs / 1000);
}

export function decorridoTotalSeg(estado: EstadoCronometro): number {
  return Math.floor(estado.decorridoTotalMs / 1000);
}

/** 0..1 — quanto da sessão já passou, considerando só as fases com duração. */
export function progressoSessao(estado: EstadoCronometro): number {
  const total = duracaoTotalFases(estado.fases) * 1000;
  if (total <= 0) return estado.concluido ? 1 : 0;
  let feito = 0;
  for (let i = 0; i < estado.indiceFase; i++) feito += (estado.fases[i].duracaoSeg ?? 0) * 1000;
  const fase = faseAtual(estado);
  if (fase?.duracaoSeg != null) feito += Math.min(estado.decorridoNaFaseMs, fase.duracaoSeg * 1000);
  return Math.min(1, feito / total);
}

export function formatarMMSS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatarHMS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  if (h === 0) return formatarMMSS(s);
  return `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
