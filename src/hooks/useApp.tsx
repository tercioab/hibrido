import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CONFIG_PADRAO } from '../db/db';
import * as repo from '../db/repositorio';
import {
  listaCorridas,
  listaTreinos,
  TOTAL_CORRIDAS,
  TOTAL_TREINOS,
} from '../dados/plano';
import { calcularFcMax, calcularZonas, type FaixaZona } from '../logica/calculos';
import type {
  ConfiguracoesUsuario,
  ItemCorrida,
  ItemMusculacao,
  Progresso,
  RegistroPesoCorporal,
  SessaoCorridaConcluida,
  TreinoMuscConcluido,
} from '../dados/tipos';

interface ContextoApp {
  carregando: boolean;
  config: ConfiguracoesUsuario;
  progresso: Progresso;
  corridas: SessaoCorridaConcluida[];
  treinos: TreinoMuscConcluido[];
  pesos: RegistroPesoCorporal[];
  proximaCorrida: ItemCorrida | null;
  proximoTreino: ItemMusculacao | null;
  fcMax: number;
  zonas: FaixaZona[];
  totalCorridas: number;
  totalTreinos: number;
  atualizar: () => Promise<void>;
  salvarConfig: (parcial: Partial<ConfiguracoesUsuario>) => Promise<void>;
}

const Ctx = createContext<ContextoApp | null>(null);

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<ConfiguracoesUsuario>(CONFIG_PADRAO);
  const [progresso, setProgresso] = useState<Progresso>({
    id: 'unico',
    corridaProximoIndice: 0,
    musculacaoProximoIndice: 0,
  });
  const [corridas, setCorridas] = useState<SessaoCorridaConcluida[]>([]);
  const [treinos, setTreinos] = useState<TreinoMuscConcluido[]>([]);
  const [pesos, setPesos] = useState<RegistroPesoCorporal[]>([]);

  const atualizar = useCallback(async () => {
    const [c, p, cs, ts, ps] = await Promise.all([
      repo.lerConfiguracoes(),
      repo.lerProgresso(),
      repo.listarCorridas(),
      repo.listarTreinosConcluidos(),
      repo.listarPesos(),
    ]);
    setConfig(c);
    setProgresso(p);
    setCorridas(cs);
    setTreinos(ts);
    setPesos(ps);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  const salvarConfig = useCallback(async (parcial: Partial<ConfiguracoesUsuario>) => {
    const novo = await repo.salvarConfiguracoes(parcial);
    setConfig(novo);
  }, []);

  // Tema
  useEffect(() => {
    const raiz = document.documentElement;
    const aplicar = () => {
      const prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const escuro = config.tema === 'escuro' || (config.tema === 'sistema' && prefereEscuro);
      raiz.classList.toggle('dark', escuro);
      raiz.style.colorScheme = escuro ? 'dark' : 'light';
    };
    aplicar();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [config.tema]);

  const valor = useMemo<ContextoApp>(() => {
    const fcMax = calcularFcMax(config.idade, config.metodoFcMax);
    return {
      carregando,
      config,
      progresso,
      corridas,
      treinos,
      pesos,
      proximaCorrida: listaCorridas[progresso.corridaProximoIndice] ?? null,
      proximoTreino: listaTreinos[progresso.musculacaoProximoIndice] ?? null,
      fcMax,
      zonas: calcularZonas(fcMax, {
        fcRepouso: config.fcRepouso,
        usarKarvonen: config.usarKarvonen,
      }),
      totalCorridas: TOTAL_CORRIDAS,
      totalTreinos: TOTAL_TREINOS,
      atualizar,
      salvarConfig,
    };
  }, [carregando, config, progresso, corridas, treinos, pesos, atualizar, salvarConfig]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApp(): ContextoApp {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp precisa estar dentro de <ProvedorApp>');
  return ctx;
}
