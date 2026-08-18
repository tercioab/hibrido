import { describe, expect, it } from 'vitest';
import {
  alternarPausa,
  criarEstado,
  duracaoTotalFases,
  encerrar,
  iniciar,
  formatarMMSS,
  montarFases,
  progressoSessao,
  pularFase,
  restanteNaFaseSeg,
  tick,
} from './cronometro';
import type { SessaoCorrida } from '../dados/tipos';
import { listaCorridas, TOTAL_CORRIDAS } from '../dados/plano';

const sessaoIntervalada: SessaoCorrida = {
  ordem: 1,
  rotulo_original_planilha: '3ª feira',
  tipo_intervalo: '1:3',
  aquecimento: { duracao_seg: 300, zona: 'Z1' },
  repeticoes: 3,
  correr: { duracao_seg: 30, zona: 'Z3' },
  caminhar: { duracao_seg: 90, zona: 'Z1' },
  volta_calma: { duracao_seg: 300, zona: 'Z1' },
  prova_final: false,
};

const sessaoProva: SessaoCorrida = {
  ordem: 3,
  rotulo_original_planilha: 'Domingo',
  tipo_intervalo: null,
  aquecimento: { duracao_seg: 300, zona: 'Z1' },
  repeticoes: 1,
  corrida_continua: { distancia_km: 3, zona: 'Z3' },
  volta_calma: { duracao_seg: 300, zona: 'Z1' },
  prova_final: true,
};

describe('montarFases', () => {
  it('monta aquecimento + N pares correr/caminhar + volta à calma', () => {
    const fases = montarFases(sessaoIntervalada);
    expect(fases).toHaveLength(1 + 3 * 2 + 1);
    expect(fases.map((f) => f.tipo)).toEqual([
      'aquecimento',
      'correr', 'caminhar',
      'correr', 'caminhar',
      'correr', 'caminhar',
      'volta_calma',
    ]);
    expect(duracaoTotalFases(fases)).toBe(300 + 3 * (30 + 90) + 300);
  });

  it('numera os intervalos para o indicador "3 de 7"', () => {
    const fases = montarFases(sessaoIntervalada);
    expect(fases[5].intervalo).toEqual({ numero: 3, total: 3 });
  });

  it('a prova final vira uma fase livre entre aquecimento e volta à calma', () => {
    const fases = montarFases(sessaoProva);
    expect(fases.map((f) => f.tipo)).toEqual(['aquecimento', 'livre', 'volta_calma']);
    expect(fases[1].duracaoSeg).toBeNull();
  });
});

describe('tick', () => {
  const t0 = 1_700_000_000_000;

  it('não conta tempo enquanto está pausado', () => {
    const e = criarEstado(montarFases(sessaoIntervalada), t0);
    const { estado } = tick(e, t0 + 60_000);
    expect(estado.decorridoTotalMs).toBe(0);
    expect(estado.indiceFase).toBe(0);
  });

  it('conta o tempo decorrido dentro da fase', () => {
    const e = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    const { estado } = tick(e, t0 + 10_000);
    expect(restanteNaFaseSeg(estado)).toBe(290);
    expect(estado.indiceFase).toBe(0);
  });

  it('atravessa a fronteira da fase e avisa a transição', () => {
    const e = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    const { estado, transicoes } = tick(e, t0 + 300_000);
    expect(estado.indiceFase).toBe(1);
    expect(transicoes.map((f) => f.tipo)).toEqual(['correr']);
    expect(estado.decorridoNaFaseMs).toBe(0);
  });

  it('atravessa VÁRIAS fases de uma vez (tela apagada / aba em segundo plano)', () => {
    const e = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    // 300s aquecimento + 30s correr + 90s caminhar = 420s; +25s no 2º "correr"
    const { estado, transicoes } = tick(e, t0 + 445_000);
    expect(estado.indiceFase).toBe(3); // 0 aquec, 1 correr, 2 caminhar, 3 correr
    expect(estado.fases[estado.indiceFase].tipo).toBe('correr');
    expect(estado.decorridoNaFaseMs).toBe(25_000);
    expect(transicoes.map((f) => f.tipo)).toEqual(['correr', 'caminhar', 'correr']);
  });

  it('não perde tempo ao somar vários ticks pequenos (sem deriva)', () => {
    let estado = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    for (let i = 1; i <= 1000; i++) estado = tick(estado, t0 + i * 137).estado;
    expect(estado.decorridoTotalMs).toBe(137_000);
  });

  it('conclui a sessão ao fim da volta à calma', () => {
    const fases = montarFases(sessaoIntervalada);
    const e = iniciar(criarEstado(fases, t0), t0);
    const { estado, concluiuAgora } = tick(e, t0 + duracaoTotalFases(fases) * 1000 + 5_000);
    expect(concluiuAgora).toBe(true);
    expect(estado.concluido).toBe(true);
    expect(estado.rodando).toBe(false);
    expect(progressoSessao(estado)).toBe(1);
  });

  it('a fase livre da prova absorve o tempo sem avançar sozinha', () => {
    const e = iniciar(criarEstado(montarFases(sessaoProva), t0), t0);
    const { estado } = tick(e, t0 + 300_000 + 20 * 60_000);
    expect(estado.indiceFase).toBe(1);
    expect(estado.fases[1].tipo).toBe('livre');
    expect(restanteNaFaseSeg(estado)).toBeNull();
    expect(estado.concluido).toBe(false);
  });
});

describe('controles', () => {
  const t0 = 1_700_000_000_000;

  it('pausar congela o tempo e retomar volta a contar', () => {
    let estado = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    estado = tick(estado, t0 + 10_000).estado;
    estado = alternarPausa(estado, t0 + 10_000);
    estado = tick(estado, t0 + 120_000).estado; // 110s parado
    expect(estado.decorridoTotalMs).toBe(10_000);
    estado = alternarPausa(estado, t0 + 120_000);
    estado = tick(estado, t0 + 125_000).estado;
    expect(estado.decorridoTotalMs).toBe(15_000);
  });

  it('pular fase vai para a próxima e sinaliza a transição', () => {
    const e = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    const { estado, transicoes } = pularFase(e, t0 + 5_000);
    expect(estado.indiceFase).toBe(1);
    expect(transicoes[0].tipo).toBe('correr');
    expect(estado.decorridoNaFaseMs).toBe(0);
  });

  it('pular na última fase conclui a sessão', () => {
    const fases = montarFases(sessaoIntervalada);
    let estado = criarEstado(fases, t0);
    estado = { ...estado, indiceFase: fases.length - 1, rodando: true };
    const r = pularFase(estado, t0 + 1_000);
    expect(r.concluiuAgora).toBe(true);
    expect(r.estado.concluido).toBe(true);
  });

  it('encerrar preserva o tempo já corrido', () => {
    let estado = iniciar(criarEstado(montarFases(sessaoIntervalada), t0), t0);
    estado = encerrar(estado, t0 + 42_000);
    expect(estado.concluido).toBe(true);
    expect(estado.decorridoTotalMs).toBe(42_000);
  });
});

describe('formatação e plano real', () => {
  it('formata MM:SS', () => {
    expect(formatarMMSS(0)).toBe('00:00');
    expect(formatarMMSS(65)).toBe('01:05');
    expect(formatarMMSS(600)).toBe('10:00');
  });

  it('todas as 36 sessões do plano geram fases válidas', () => {
    expect(listaCorridas).toHaveLength(36);
    expect(TOTAL_CORRIDAS).toBe(36);
    for (const item of listaCorridas) {
      const fases = montarFases(item.sessao);
      expect(fases[0].tipo).toBe('aquecimento');
      expect(fases[fases.length - 1].tipo).toBe('volta_calma');
      expect(fases.every((f) => f.duracaoSeg === null || f.duracaoSeg > 0)).toBe(true);
    }
  });
});
