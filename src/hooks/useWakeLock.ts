import { useCallback, useEffect, useRef, useState } from 'react';

type Sentinela = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };

/**
 * Mantém a tela acesa durante o treino (Wake Lock API). Onde a API não existe
 * (iOS antigo, alguns navegadores), `suportado` fica false e a tela avisa o
 * usuário para não deixar o celular bloquear sozinho.
 */
export function useWakeLock(ativo: boolean) {
  const sentinelaRef = useRef<Sentinela | null>(null);
  const [ativoDeFato, setAtivoDeFato] = useState(false);
  const suportado = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const solicitar = useCallback(async () => {
    if (!suportado || sentinelaRef.current) return;
    try {
      const s = (await (navigator as unknown as {
        wakeLock: { request: (t: 'screen') => Promise<Sentinela> };
      }).wakeLock.request('screen')) as Sentinela;
      sentinelaRef.current = s;
      setAtivoDeFato(true);
      s.addEventListener('release', () => {
        sentinelaRef.current = null;
        setAtivoDeFato(false);
      });
    } catch {
      setAtivoDeFato(false);
    }
  }, [suportado]);

  const liberar = useCallback(async () => {
    try {
      await sentinelaRef.current?.release();
    } catch {
      /* já liberado */
    }
    sentinelaRef.current = null;
    setAtivoDeFato(false);
  }, []);

  useEffect(() => {
    if (ativo) void solicitar();
    else void liberar();
    return () => {
      void liberar();
    };
  }, [ativo, solicitar, liberar]);

  // O sistema solta o wake lock quando a aba perde o foco; reconquista ao voltar.
  useEffect(() => {
    const aoVoltar = () => {
      if (ativo && document.visibilityState === 'visible') void solicitar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [ativo, solicitar]);

  return { suportado, ativo: ativoDeFato };
}
