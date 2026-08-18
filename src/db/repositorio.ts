import { db, CONFIG_PADRAO, PROGRESSO_PADRAO } from './db';
import type {
  Backup,
  ConfiguracoesUsuario,
  ExercicioRegistrado,
  Progresso,
  RascunhoTreino,
  RegistroPesoCorporal,
  SessaoCorridaConcluida,
  TreinoMuscConcluido,
} from '../dados/tipos';
import { TOTAL_CORRIDAS, TOTAL_TREINOS } from '../dados/plano';

function novoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// --- Configurações ---------------------------------------------------------

export async function lerConfiguracoes(): Promise<ConfiguracoesUsuario> {
  return (await db.configuracoes.get('unico')) ?? CONFIG_PADRAO;
}

export async function salvarConfiguracoes(
  parcial: Partial<ConfiguracoesUsuario>,
): Promise<ConfiguracoesUsuario> {
  const atual = await lerConfiguracoes();
  const novo = { ...atual, ...parcial, id: 'unico' as const };
  await db.configuracoes.put(novo);
  return novo;
}

// --- Progresso -------------------------------------------------------------

export async function lerProgresso(): Promise<Progresso> {
  return (await db.progresso.get('unico')) ?? PROGRESSO_PADRAO;
}

async function salvarProgresso(parcial: Partial<Progresso>): Promise<Progresso> {
  const atual = await lerProgresso();
  const novo = { ...atual, ...parcial, id: 'unico' as const };
  await db.progresso.put(novo);
  return novo;
}

/** Corrige um avanço indevido (ou refaz uma sessão) sem apagar o histórico. */
export async function ajustarIndiceCorrida(indice: number): Promise<Progresso> {
  return salvarProgresso({ corridaProximoIndice: Math.min(Math.max(0, indice), TOTAL_CORRIDAS) });
}

export async function ajustarIndiceMusculacao(indice: number): Promise<Progresso> {
  return salvarProgresso({ musculacaoProximoIndice: Math.min(Math.max(0, indice), TOTAL_TREINOS) });
}

// --- Corridas --------------------------------------------------------------

export async function registrarCorrida(
  dados: Omit<SessaoCorridaConcluida, 'id'>,
): Promise<SessaoCorridaConcluida> {
  const sessao: SessaoCorridaConcluida = { ...dados, id: novoId() };
  await db.corridas.put(sessao);
  const progresso = await lerProgresso();
  // Só avança se a sessão registrada era mesmo a "próxima" (evita pular treino
  // ao reabrir uma sessão antiga pelo histórico).
  if (dados.indiceSequencial === progresso.corridaProximoIndice) {
    await salvarProgresso({
      corridaProximoIndice: Math.min(progresso.corridaProximoIndice + 1, TOTAL_CORRIDAS),
    });
  }
  return sessao;
}

export async function listarCorridas(): Promise<SessaoCorridaConcluida[]> {
  const todas = await db.corridas.toArray();
  return todas.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}

export async function apagarCorrida(id: string): Promise<void> {
  await db.corridas.delete(id);
}

// --- Musculação ------------------------------------------------------------

export async function registrarTreino(
  dados: Omit<TreinoMuscConcluido, 'id'>,
): Promise<TreinoMuscConcluido> {
  const treino: TreinoMuscConcluido = { ...dados, id: novoId() };
  await db.treinos.put(treino);
  const progresso = await lerProgresso();
  if (dados.indiceSequencial === progresso.musculacaoProximoIndice) {
    await salvarProgresso({
      musculacaoProximoIndice: Math.min(progresso.musculacaoProximoIndice + 1, TOTAL_TREINOS),
    });
  }
  await limparRascunho();
  return treino;
}

export async function listarTreinosConcluidos(): Promise<TreinoMuscConcluido[]> {
  const todos = await db.treinos.toArray();
  return todos.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}

export async function apagarTreino(id: string): Promise<void> {
  await db.treinos.delete(id);
}

/** Último registro com carga de um exercício (pela chave estável do nome). */
export async function ultimoRegistroDoExercicio(
  chaveExercicio: string,
): Promise<{ registro: ExercicioRegistrado; dataHora: string } | null> {
  const treinos = await listarTreinosConcluidos();
  for (let i = treinos.length - 1; i >= 0; i--) {
    const ex = treinos[i].exercicios.find(
      (e) => e.chaveExercicio === chaveExercicio && e.series.some((s) => (s.pesoKg ?? 0) > 0),
    );
    if (ex) return { registro: ex, dataHora: treinos[i].dataHora };
  }
  return null;
}

// --- Rascunho de treino em andamento --------------------------------------

export async function lerRascunho(): Promise<RascunhoTreino | undefined> {
  return db.rascunhos.get('unico');
}

export async function salvarRascunho(rascunho: Omit<RascunhoTreino, 'id'>): Promise<void> {
  await db.rascunhos.put({ ...rascunho, id: 'unico' });
}

export async function limparRascunho(): Promise<void> {
  await db.rascunhos.delete('unico');
}

// --- Peso corporal ---------------------------------------------------------

export async function registrarPeso(pesoKg: number, data = new Date().toISOString()): Promise<void> {
  await db.pesos.put({ id: novoId(), data, pesoKg });
  await salvarConfiguracoes({ pesoCorporalKg: pesoKg });
}

export async function listarPesos(): Promise<RegistroPesoCorporal[]> {
  const todos = await db.pesos.toArray();
  return todos.sort((a, b) => a.data.localeCompare(b.data));
}

export async function apagarPeso(id: string): Promise<void> {
  await db.pesos.delete(id);
}

// --- Backup ----------------------------------------------------------------

export async function exportarBackup(): Promise<Backup> {
  const [configuracoes, progresso, corridas, treinos, pesos] = await Promise.all([
    db.configuracoes.get('unico'),
    db.progresso.get('unico'),
    listarCorridas(),
    listarTreinosConcluidos(),
    listarPesos(),
  ]);
  return {
    formato: 'time-hibrido-backup',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    configuracoes: configuracoes ?? null,
    progresso: progresso ?? null,
    corridas,
    treinos,
    pesos,
  };
}

export function validarBackup(dados: unknown): dados is Backup {
  if (!dados || typeof dados !== 'object') return false;
  const b = dados as Partial<Backup>;
  return (
    b.formato === 'time-hibrido-backup' &&
    Array.isArray(b.corridas) &&
    Array.isArray(b.treinos) &&
    Array.isArray(b.pesos)
  );
}

/** Substitui todo o conteúdo local pelo do backup. */
export async function importarBackup(backup: Backup): Promise<void> {
  await db.transaction(
    'rw',
    [db.configuracoes, db.progresso, db.corridas, db.treinos, db.pesos, db.rascunhos],
    async () => {
      await Promise.all([
        db.corridas.clear(),
        db.treinos.clear(),
        db.pesos.clear(),
        db.rascunhos.clear(),
      ]);
      if (backup.configuracoes) await db.configuracoes.put({ ...backup.configuracoes, id: 'unico' });
      if (backup.progresso) await db.progresso.put({ ...backup.progresso, id: 'unico' });
      if (backup.corridas.length) await db.corridas.bulkPut(backup.corridas);
      if (backup.treinos.length) await db.treinos.bulkPut(backup.treinos);
      if (backup.pesos.length) await db.pesos.bulkPut(backup.pesos);
    },
  );
}

/** Zera progresso e histórico, preservando as configurações do usuário. */
export async function resetarProgresso(): Promise<void> {
  await db.transaction(
    'rw',
    [db.progresso, db.corridas, db.treinos, db.pesos, db.rascunhos],
    async () => {
      await Promise.all([
        db.corridas.clear(),
        db.treinos.clear(),
        db.pesos.clear(),
        db.rascunhos.clear(),
      ]);
      await db.progresso.put(PROGRESSO_PADRAO);
    },
  );
}
