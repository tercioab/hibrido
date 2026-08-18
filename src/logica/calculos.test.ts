import { describe, expect, it } from 'vitest';
import {
  arredondarCarga,
  brzycki,
  calcularFcMax,
  calcularZonas,
  epley,
  sugerirCarga,
} from './calculos';
import {
  anotarExercicios,
  descansoEmSegundos,
  idYoutube,
  listaCorridas,
  listaTreinos,
  metasDeRepeticao,
  TOTAL_TREINOS,
} from '../dados/plano';

describe('FCmáx e zonas', () => {
  it('usa Tanaka por padrão', () => {
    expect(calcularFcMax(30, 'tanaka')).toBe(187); // 208 - 21
    expect(calcularFcMax(30, '220-idade')).toBe(190);
  });

  it('zonas por percentual direto da FCmáx', () => {
    const z = calcularZonas(190);
    const z3 = z.find((f) => f.zona === 'Z3')!;
    expect(z3.min).toBe(133);
    expect(z3.max).toBe(150);
  });

  it('Karvonen leva a FC de repouso em conta', () => {
    const z = calcularZonas(190, { fcRepouso: 60, usarKarvonen: true });
    const z3 = z.find((f) => f.zona === 'Z3')!;
    expect(z3.min).toBe(151); // (190-60)*0.70 + 60
    expect(z3.max).toBe(163); // (190-60)*0.79 + 60
  });

  it('ignora Karvonen sem FC de repouso válida', () => {
    const z = calcularZonas(190, { usarKarvonen: true });
    expect(z.find((f) => f.zona === 'Z1')!.min).toBe(95);
  });
});

describe('1RM', () => {
  it('Epley e Brzycki', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
    expect(brzycki(100, 10)).toBeCloseTo(133.33, 2);
  });

  it('arredonda carga para 2,5kg', () => {
    expect(arredondarCarga(53.4)).toBe(52.5);
    expect(arredondarCarga(54)).toBe(55);
  });

  it('sugere carga menor quando a meta de reps aumenta', () => {
    const s10 = sugerirCarga(60, 10, 10)!;
    const s15 = sugerirCarga(60, 10, 15)!;
    expect(s10.peso).toBe(60);
    expect(s15.peso).toBeLessThan(s10.peso);
  });

  it('devolve null com entrada inválida', () => {
    expect(sugerirCarga(0, 10, 10)).toBeNull();
  });
});

describe('plano de musculação', () => {
  it('achata 48 treinos', () => {
    expect(listaTreinos).toHaveLength(48);
    expect(TOTAL_TREINOS).toBe(48);
  });

  it('expande a pirâmide em metas por série', () => {
    expect(metasDeRepeticao({
      bloco: 5, tipo_bloco: 'PIRÂMIDE', nome: 'TERRA', series: 4,
      repeticoes: '15-12-10-8', esquema: 'piramide', descanso_sugerido: '90s-2min', video: '',
    })).toEqual([15, 12, 10, 8]);
  });

  it('usa a fase pesada do 6+12 como meta', () => {
    expect(metasDeRepeticao({
      bloco: 5, tipo_bloco: '6 PESADO + 12 LEVE', nome: 'FLEXORA', series: 4,
      repeticoes: '6+12', esquema: 'pesado_leve', descanso_sugerido: '60-90s', video: '',
    })).toEqual([6, 6, 6, 6]);
  });

  it('lê o maior descanso sugerido do texto', () => {
    expect(descansoEmSegundos('60-90s')).toBe(90);
    expect(descansoEmSegundos('90s-2min')).toBe(120);
    expect(descansoEmSegundos('30-45s (sem descanso entre drops)')).toBe(45);
  });

  it('extrai o id de vídeo dos dois formatos de link do plano', () => {
    expect(idYoutube('https://www.youtube.com/watch?v=oM4dQnw2r44')).toBe('oM4dQnw2r44');
    expect(idYoutube('https://youtu.be/gjOFf8vzjPo')).toBe('gjOFf8vzjPo');
  });

  it('marca pares de bi-set no mesmo bloco', () => {
    const comBiSet = listaTreinos
      .flatMap((t) => anotarExercicios(t.treino))
      .filter((e) => e.biSet);
    expect(comBiSet.length).toBeGreaterThan(0);
    expect(comBiSet.filter((e) => e.primeiroDoBiSet).length).toBe(comBiSet.length / 2);
  });

  it('marca deload nas semanas de alívio de cada trilha', () => {
    const semanasCorrida = [...new Set(listaCorridas.filter((c) => c.deload).map((c) => c.semana))];
    expect(semanasCorrida).toEqual([4, 8]);
    const semanasMusc = [...new Set(listaTreinos.filter((t) => t.deload).map((t) => t.semana))];
    expect(semanasMusc).toEqual([4, 8, 12]);
  });

  it('todo exercício do plano tem vídeo', () => {
    for (const item of listaTreinos) {
      for (const ex of item.treino.exercicios) {
        expect(idYoutube(ex.video)).toBeTruthy();
      }
    }
  });
});
