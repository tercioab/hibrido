import Dexie, { type Table } from 'dexie';
import type {
  ConfiguracoesUsuario,
  Progresso,
  RascunhoTreino,
  RegistroPesoCorporal,
  SessaoCorridaConcluida,
  TreinoMuscConcluido,
} from '../dados/tipos';

/**
 * Banco local (IndexedDB). Guarda APENAS o que o app grava — o plano em si
 * vem do JSON seed empacotado com o app e nunca é escrito aqui.
 */
export class BancoTimeHibrido extends Dexie {
  configuracoes!: Table<ConfiguracoesUsuario, string>;
  progresso!: Table<Progresso, string>;
  corridas!: Table<SessaoCorridaConcluida, string>;
  treinos!: Table<TreinoMuscConcluido, string>;
  pesos!: Table<RegistroPesoCorporal, string>;
  rascunhos!: Table<RascunhoTreino, string>;

  constructor() {
    super('time-hibrido');
    this.version(1).stores({
      configuracoes: 'id',
      progresso: 'id',
      corridas: 'id, indiceSequencial, dataHora, semana',
      treinos: 'id, indiceSequencial, dataHora, semana',
      pesos: 'id, data',
      rascunhos: 'id',
    });
  }
}

export const db = new BancoTimeHibrido();

export const CONFIG_PADRAO: ConfiguracoesUsuario = {
  id: 'unico',
  idade: 30,
  metodoFcMax: 'tanaka',
  usarKarvonen: false,
  tema: 'sistema',
  manterTelaAcesa: true,
  somAtivo: true,
  vibracaoAtiva: true,
  onboardingConcluido: false,
};

export const PROGRESSO_PADRAO: Progresso = {
  id: 'unico',
  corridaProximoIndice: 0,
  musculacaoProximoIndice: 0,
};
