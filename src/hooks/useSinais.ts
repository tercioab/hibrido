import { useCallback, useEffect, useRef } from 'react';

/**
 * Bips (WebAudio) + vibração para as trocas de fase da corrida.
 * O AudioContext só pode ser criado depois de um gesto do usuário — por isso
 * `preparar()` é chamado no botão "iniciar".
 */
export function useSinais(opcoes: { som: boolean; vibracao: boolean }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const { som, vibracao } = opcoes;

  const preparar = useCallback(() => {
    if (!som) return;
    if (!ctxRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) ctxRef.current = new Ctor();
    }
    void ctxRef.current?.resume();
  }, [som]);

  const bip = useCallback(
    (quantidade: number, frequencia: number) => {
      if (!som) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      void ctx.resume();
      for (let i = 0; i < quantidade; i++) {
        const inicio = ctx.currentTime + i * 0.22;
        const osc = ctx.createOscillator();
        const ganho = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequencia;
        ganho.gain.setValueAtTime(0.0001, inicio);
        ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
        osc.connect(ganho).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.2);
      }
    },
    [som],
  );

  const vibrar = useCallback(
    (padrao: number | number[]) => {
      if (!vibracao) return;
      navigator.vibrate?.(padrao);
    },
    [vibracao],
  );

  /** 2 bips agudos ao entrar em CORRER, 1 grave ao entrar em CAMINHAR. */
  const sinalizarFase = useCallback(
    (tipo: 'correr' | 'caminhar' | 'aquecimento' | 'volta_calma' | 'livre' | 'fim') => {
      switch (tipo) {
        case 'correr':
        case 'livre':
          bip(2, 880);
          vibrar([250, 120, 250]);
          break;
        case 'caminhar':
          bip(1, 440);
          vibrar(400);
          break;
        case 'fim':
          bip(3, 660);
          vibrar([300, 150, 300, 150, 500]);
          break;
        default:
          bip(1, 587);
          vibrar(200);
      }
    },
    [bip, vibrar],
  );

  useEffect(() => () => void ctxRef.current?.close(), []);

  return { preparar, sinalizarFase, bip, vibrar };
}
