import { useCallback, useEffect, useRef, useState } from 'react';
import {
  alternarPausa as alternarPausaPuro,
  criarEstado,
  encerrar as encerrarPuro,
  iniciar as iniciarPuro,
  montarFases,
  pularFase as pularFasePuro,
  tick,
  type EstadoCronometro,
  type FaseCronometro,
} from '../logica/cronometro';
import type { SessaoCorrida } from '../dados/tipos';

/**
 * Casca React em volta do motor puro: dispara ticks a cada 250ms e re-sincroniza
 * ao voltar do segundo plano (o setInterval é congelado com a tela apagada, mas
 * o cálculo é por timestamp, então nada se perde).
 */
export function useCronometro(
  sessao: SessaoCorrida,
  aoTrocarFase?: (fase: FaseCronometro) => void,
  aoConcluir?: () => void,
) {
  const [estado, setEstado] = useState<EstadoCronometro>(() =>
    criarEstado(montarFases(sessao), Date.now()),
  );
  const cbFase = useRef(aoTrocarFase);
  const cbFim = useRef(aoConcluir);
  cbFase.current = aoTrocarFase;
  cbFim.current = aoConcluir;

  const aplicar = useCallback((resultado: ReturnType<typeof tick>) => {
    setEstado(resultado.estado);
    for (const fase of resultado.transicoes) cbFase.current?.(fase);
    if (resultado.concluiuAgora) cbFim.current?.();
  }, []);

  const sincronizar = useCallback(() => {
    setEstado((atual) => {
      const r = tick(atual, Date.now());
      for (const fase of r.transicoes) cbFase.current?.(fase);
      if (r.concluiuAgora) cbFim.current?.();
      return r.estado;
    });
  }, []);

  useEffect(() => {
    if (!estado.rodando) return;
    const id = window.setInterval(sincronizar, 250);
    return () => window.clearInterval(id);
  }, [estado.rodando, sincronizar]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') sincronizar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [sincronizar]);

  const iniciar = useCallback(() => setEstado((e) => iniciarPuro(e, Date.now())), []);
  const alternarPausa = useCallback(() => setEstado((e) => alternarPausaPuro(e, Date.now())), []);
  const pular = useCallback(() => {
    setEstado((atual) => {
      const r = pularFasePuro(atual, Date.now());
      for (const fase of r.transicoes) cbFase.current?.(fase);
      if (r.concluiuAgora) cbFim.current?.();
      return r.estado;
    });
  }, []);
  const encerrar = useCallback(() => {
    setEstado((e) => {
      const novo = encerrarPuro(e, Date.now());
      cbFim.current?.();
      return novo;
    });
  }, []);

  return { estado, iniciar, alternarPausa, pular, encerrar, aplicar };
}
