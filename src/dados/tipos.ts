// Tipos que descrevem o `plano_time_hibrido.json` (dado SEED, somente leitura)
// e os tipos de progresso que o app grava no IndexedDB.

// ---------------------------------------------------------------------------
// SEED — plano_time_hibrido.json
// ---------------------------------------------------------------------------

export type ChaveZona = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

export interface Fase {
  nome: string;
  semanas: number[];
}

export interface MetaPlano {
  programa: string;
  objetivo: string;
  nivel: string;
  duracao_semanas: number;
  fases: Fase[];
  cref_responsavel: string;
  aviso: string;
}

export interface TrechoTemporizado {
  duracao_seg: number;
  zona: ChaveZona;
}

export interface CorridaContinua {
  distancia_km: number;
  zona: ChaveZona;
}

export interface SessaoCorrida {
  ordem: number;
  rotulo_original_planilha: string;
  tipo_intervalo: string | null;
  aquecimento: TrechoTemporizado;
  repeticoes: number;
  correr?: TrechoTemporizado;
  caminhar?: TrechoTemporizado;
  corrida_continua?: CorridaContinua;
  volta_calma: TrechoTemporizado;
  prova_final: boolean;
}

export interface SemanaCorrida {
  semana: number;
  etapa: string;
  sessoes: SessaoCorrida[];
}

export type EsquemaExercicio =
  | 'padrao'
  | 'mobilidade'
  | 'piramide'
  | 'dropset'
  | 'pesado_leve'
  | 'tabata';

export interface Exercicio {
  bloco: number;
  tipo_bloco: string;
  nome: string;
  series: number | null;
  repeticoes: string | null;
  esquema: EsquemaExercicio;
  descanso_sugerido: string;
  video: string;
}

export type LetraTreino = 'A' | 'B' | 'C' | 'D';

export interface TreinoMusculacao {
  letra: LetraTreino;
  titulo: string;
  exercicios: Exercicio[];
}

export interface SemanaMusculacao {
  semana: number;
  etapa: string;
  treinos: TreinoMusculacao[];
}

export interface VideosOrientacao {
  video_boas_vindas: string;
  video_como_ler_planilha_corrida: string;
  video_como_ler_treino_musculacao: string;
}

export interface Plano {
  meta: MetaPlano;
  zonas_fc: Record<ChaveZona, string>;
  corrida: SemanaCorrida[];
  musculacao: SemanaMusculacao[];
  videos_orientacao: VideosOrientacao;
  ferramentas_originais_referencia: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Listas achatadas (índice sequencial = "de onde eu parei")
// ---------------------------------------------------------------------------

export interface ItemCorrida {
  indiceSequencial: number; // 0..35
  semana: number;
  etapa: string;
  ordemNaSemana: number;
  sessao: SessaoCorrida;
  /** Segundos totais previstos (aquecimento + blocos + volta à calma). */
  duracaoPrevistaSeg: number;
  /** Segundos apenas correndo — usado para detectar deload. */
  volumeCorridaSeg: number;
  resumo: string;
  deload: boolean;
}

export interface ItemMusculacao {
  indiceSequencial: number; // 0..47
  semana: number;
  etapa: string;
  letra: LetraTreino;
  titulo: string;
  treino: TreinoMusculacao;
  /** Séries totais previstas na sessão — usado para detectar deload. */
  volumeSeries: number;
  resumo: string;
  deload: boolean;
}

// ---------------------------------------------------------------------------
// PROGRESSO — gravado no IndexedDB
// ---------------------------------------------------------------------------

export interface Progresso {
  id: 'unico';
  corridaProximoIndice: number; // 0..36 (36 = programa concluído)
  musculacaoProximoIndice: number; // 0..48
}

export type NomeFaseCronometro = 'aquecimento' | 'correr' | 'caminhar' | 'volta_calma' | 'livre';

export interface SessaoCorridaConcluida {
  id: string;
  indiceSequencial: number;
  semana: number;
  ordemNaSemana: number;
  dataHora: string; // ISO
  duracaoTotalSeg: number;
  completoAteOFim: boolean;
  distanciaKm?: number;
  provaFinal: boolean;
  tipoIntervalo: string | null;
  observacoes?: string;
}

export interface SerieRegistrada {
  numeroSerie: number;
  pesoKg: number | null;
  repeticoesFeitas: number | null;
}

export interface ExercicioRegistrado {
  exercicioId: string; // determinístico: semana-treino-bloco-nome
  chaveExercicio: string; // só o nome normalizado — liga o mesmo exercício entre semanas
  nome: string;
  series: SerieRegistrada[];
}

export interface TreinoMuscConcluido {
  id: string;
  indiceSequencial: number;
  semana: number;
  letraTreino: LetraTreino;
  titulo: string;
  dataHora: string;
  exercicios: ExercicioRegistrado[];
  completoAteOFim: boolean;
  observacoes?: string;
}

export type MetodoFcMax = 'tanaka' | '220-idade';

export interface ConfiguracoesUsuario {
  id: 'unico';
  nome?: string;
  idade: number;
  fcRepouso?: number;
  pesoCorporalKg?: number;
  metodoFcMax: MetodoFcMax;
  /** Karvonen (reserva de FC) para o cálculo das zonas — exige fcRepouso. */
  usarKarvonen: boolean;
  tema: 'claro' | 'escuro' | 'sistema';
  manterTelaAcesa: boolean;
  somAtivo: boolean;
  vibracaoAtiva: boolean;
  onboardingConcluido: boolean;
}

export interface RegistroPesoCorporal {
  id: string;
  data: string; // ISO
  pesoKg: number;
}

/** Rascunho de um treino de musculação em andamento (permite sair e continuar depois). */
export interface RascunhoTreino {
  id: 'unico';
  indiceSequencial: number;
  iniciadoEm: string;
  exercicios: ExercicioRegistrado[];
  observacoes?: string;
}

export interface Backup {
  formato: 'time-hibrido-backup';
  versao: 1;
  exportadoEm: string;
  configuracoes: ConfiguracoesUsuario | null;
  progresso: Progresso | null;
  corridas: SessaoCorridaConcluida[];
  treinos: TreinoMuscConcluido[];
  pesos: RegistroPesoCorporal[];
}
