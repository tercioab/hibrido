import planoJson from './plano_time_hibrido.json';
import type {
  ChaveZona,
  Exercicio,
  ItemCorrida,
  ItemMusculacao,
  Plano,
  SessaoCorrida,
  TreinoMusculacao,
} from './tipos';

/** Dado seed, somente leitura. Nunca é gravado — o que o app grava vive no IndexedDB. */
export const plano = planoJson as unknown as Plano;

export const TOTAL_CORRIDAS = plano.corrida.reduce((n, s) => n + s.sessoes.length, 0);
export const TOTAL_TREINOS = plano.musculacao.reduce((n, s) => n + s.treinos.length, 0);

// ---------------------------------------------------------------------------
// Formatação de apoio
// ---------------------------------------------------------------------------

export function segParaMinTexto(seg: number): string {
  if (seg % 60 === 0) return `${seg / 60}min`;
  if (seg < 60) return `${seg}s`;
  return `${Math.floor(seg / 60)}min${String(seg % 60).padStart(2, '0')}`;
}

export function faseDaSemana(semana: number): string {
  const fase = plano.meta.fases.find((f) => f.semanas.includes(semana));
  return fase?.nome ?? '—';
}

export function semanaDentroDaFase(semana: number): { indice: number; total: number } {
  const fase = plano.meta.fases.find((f) => f.semanas.includes(semana));
  if (!fase) return { indice: 0, total: 0 };
  return { indice: fase.semanas.indexOf(semana) + 1, total: fase.semanas.length };
}

export const percentuaisZona: Record<ChaveZona, [number, number]> = {
  Z1: [0.5, 0.59],
  Z2: [0.6, 0.69],
  Z3: [0.7, 0.79],
  Z4: [0.8, 0.89],
  Z5: [0.9, 0.95],
};

export function rotuloPercentualZona(zona: ChaveZona): string {
  const [a, b] = percentuaisZona[zona];
  return `${Math.round(a * 100)}–${Math.round(b * 100)}% FCmáx`;
}

// ---------------------------------------------------------------------------
// Corrida — lista achatada de 36 sessões
// ---------------------------------------------------------------------------

export function duracaoPrevistaSessao(sessao: SessaoCorrida): number {
  const base = sessao.aquecimento.duracao_seg + sessao.volta_calma.duracao_seg;
  if (sessao.prova_final || !sessao.correr || !sessao.caminhar) {
    // A prova é livre: estimamos 3km a ~9min/km só para a barra de progresso.
    const estimado = (sessao.corrida_continua?.distancia_km ?? 3) * 9 * 60;
    return base + estimado;
  }
  return (
    base + sessao.repeticoes * (sessao.correr.duracao_seg + sessao.caminhar.duracao_seg)
  );
}

function volumeCorrida(sessao: SessaoCorrida): number {
  if (!sessao.correr) return 0;
  return sessao.repeticoes * sessao.correr.duracao_seg;
}

export function resumoSessaoCorrida(sessao: SessaoCorrida): string {
  if (sessao.prova_final) {
    return `Prova alvo — ${sessao.corrida_continua?.distancia_km ?? 3}km contínuos`;
  }
  if (!sessao.correr || !sessao.caminhar) return 'Sessão de corrida';
  return `Intervalado ${sessao.tipo_intervalo} — ${sessao.repeticoes}x correr ${segParaMinTexto(
    sessao.correr.duracao_seg,
  )} / caminhar ${segParaMinTexto(sessao.caminhar.duracao_seg)}`;
}

function volumeSemanalCorrida(semana: number): number {
  const s = plano.corrida.find((w) => w.semana === semana);
  if (!s) return 0;
  return s.sessoes.reduce((n, ss) => n + volumeCorrida(ss), 0);
}

export const listaCorridas: ItemCorrida[] = (() => {
  const itens: ItemCorrida[] = [];
  let i = 0;
  for (const semana of plano.corrida) {
    // Deload = o volume de corrida da semana cai em relação à anterior.
    // A semana 12 tem a prova e não conta como deload (é taper de prova).
    const anterior = volumeSemanalCorrida(semana.semana - 1);
    const atual = volumeSemanalCorrida(semana.semana);
    const temProva = semana.sessoes.some((s) => s.prova_final);
    // Deload de corrida = queda relevante de volume (semanas 4 e 8 do plano).
    const deload = semana.semana > 1 && atual < anterior * 0.9 && !temProva;
    for (const sessao of semana.sessoes) {
      itens.push({
        indiceSequencial: i++,
        semana: semana.semana,
        etapa: semana.etapa,
        ordemNaSemana: sessao.ordem,
        sessao,
        duracaoPrevistaSeg: duracaoPrevistaSessao(sessao),
        volumeCorridaSeg: volumeCorrida(sessao),
        resumo: resumoSessaoCorrida(sessao),
        deload,
      });
    }
  }
  return itens;
})();

// ---------------------------------------------------------------------------
// Musculação — lista achatada de 48 treinos
// ---------------------------------------------------------------------------

function volumeTreino(treino: TreinoMusculacao): number {
  return treino.exercicios.reduce((n, e) => n + (e.series ?? 0), 0);
}

/**
 * Repetições planejadas na semana. Na musculação deste plano a progressão é por
 * intensidade: dentro de cada fase as metas caem (15 → 12 → 10 = mais carga) e
 * voltam a subir na última semana da fase, quando a carga alivia.
 */
function repeticoesSemanais(semana: number): number {
  const s = plano.musculacao.find((w) => w.semana === semana);
  if (!s) return 0;
  return s.treinos.reduce(
    (n, t) =>
      n +
      t.exercicios.reduce(
        (m, e) => m + metasDeRepeticao(e).reduce((k: number, r) => k + (r ?? 0), 0),
        0,
      ),
    0,
  );
}

export const listaTreinos: ItemMusculacao[] = (() => {
  const itens: ItemMusculacao[] = [];
  let i = 0;
  for (const semana of plano.musculacao) {
    // As metas voltam a subir = a carga desce: é a semana de alívio da fase.
    const anterior = repeticoesSemanais(semana.semana - 1);
    const atual = repeticoesSemanais(semana.semana);
    const deload = semana.semana > 1 && atual > anterior * 1.15;
    for (const treino of semana.treinos) {
      itens.push({
        indiceSequencial: i++,
        semana: semana.semana,
        etapa: semana.etapa,
        letra: treino.letra,
        titulo: treino.titulo,
        treino,
        volumeSeries: volumeTreino(treino),
        resumo: `Treino ${treino.letra} — ${treino.titulo}, ${treino.exercicios.length} exercícios`,
        deload,
      });
    }
  }
  return itens;
})();

// ---------------------------------------------------------------------------
// Exercícios
// ---------------------------------------------------------------------------

/** Id determinístico de um exercício dentro de um treino específico. */
export function idExercicio(
  semana: number,
  letra: string,
  bloco: number,
  nome: string,
): string {
  return `s${semana}-${letra}-b${bloco}-${normalizarNome(nome)}`;
}

/** Chave estável do exercício entre semanas — liga o histórico de carga. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Meta de repetições por série, já expandida (pirâmide vira [15,12,10,8]). */
export function metasDeRepeticao(ex: Exercicio): (number | null)[] {
  const series = ex.series ?? 0;
  if (!ex.repeticoes) return Array.from({ length: series }, () => null);
  if (ex.esquema === 'piramide') {
    const partes = ex.repeticoes.split('-').map((p) => Number(p));
    return Array.from({ length: series }, (_, i) => partes[i] ?? partes[partes.length - 1] ?? null);
  }
  if (ex.esquema === 'pesado_leve') {
    // "6+12" — cada série tem duas fases; a meta registrada é a fase pesada.
    const pesado = Number(ex.repeticoes.split('+')[0]);
    return Array.from({ length: series }, () => (Number.isFinite(pesado) ? pesado : null));
  }
  const n = Number(ex.repeticoes);
  return Array.from({ length: series }, () => (Number.isFinite(n) ? n : null));
}

export function rotuloSerieRep(ex: Exercicio): string {
  if (ex.esquema === 'mobilidade') return 'Mobilidade — sem série fixa';
  if (!ex.series) return ex.repeticoes ?? '—';
  if (ex.esquema === 'dropset') return `${ex.series}× dropset`;
  if (ex.esquema === 'tabata') return `${ex.series}× Tabata (20s ON / 10s OFF)`;
  if (!ex.repeticoes) return `${ex.series} séries`;
  return `${ex.series}× ${ex.repeticoes}`;
}

export function rotuloBloco(ex: Exercicio): string {
  return `Bloco ${String(ex.bloco).padStart(2, '0')} — ${ex.tipo_bloco}`;
}

/** Um exercício faz bi-set quando divide o bloco com outro exercício do mesmo tipo. */
export interface ExercicioComContexto {
  exercicio: Exercicio;
  indiceNoTreino: number;
  biSet: boolean;
  primeiroDoBiSet: boolean;
  ultimoDoBiSet: boolean;
}

export function anotarExercicios(treino: TreinoMusculacao): ExercicioComContexto[] {
  const porBloco = new Map<number, Exercicio[]>();
  for (const ex of treino.exercicios) {
    const atual = porBloco.get(ex.bloco) ?? [];
    atual.push(ex);
    porBloco.set(ex.bloco, atual);
  }
  return treino.exercicios.map((exercicio, indiceNoTreino) => {
    const grupo = porBloco.get(exercicio.bloco) ?? [exercicio];
    const biSet = grupo.length > 1 && exercicio.tipo_bloco.toUpperCase().includes('BI-SET');
    const posicao = grupo.indexOf(exercicio);
    return {
      exercicio,
      indiceNoTreino,
      biSet,
      primeiroDoBiSet: biSet && posicao === 0,
      ultimoDoBiSet: biSet && posicao === grupo.length - 1,
    };
  });
}

/** Registra carga? Mobilidade/tabata não têm peso a anotar. */
export function registraCarga(ex: Exercicio): boolean {
  return ex.esquema !== 'mobilidade' && ex.esquema !== 'tabata';
}

/** Segundos sugeridos de descanso — pega o maior valor do texto ("60-90s" → 90). */
export function descansoEmSegundos(texto: string): number {
  const minutos = [...texto.matchAll(/(\d+)\s*min/gi)].map((m) => Number(m[1]) * 60);
  const segundos = [...texto.matchAll(/(\d+)\s*s/gi)].map((m) => Number(m[1]));
  const valores = [...minutos, ...segundos].filter((v) => Number.isFinite(v));
  if (!valores.length) return 60;
  return Math.max(...valores);
}

/** Id do vídeo do YouTube a partir de qualquer formato de link do plano. */
export function idYoutube(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export function urlEmbedYoutube(url: string): string {
  const id = idYoutube(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : url;
}

export function thumbYoutube(url: string): string | null {
  const id = idYoutube(url);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}
