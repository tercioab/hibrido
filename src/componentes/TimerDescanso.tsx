import { useEffect, useRef, useState } from 'react';
import { formatarMMSS } from '../logica/cronometro';

/** Mini cronômetro regressivo de descanso entre séries. */
export function TimerDescanso({
  segundos,
  aoTerminar,
}: {
  segundos: number;
  aoTerminar?: () => void;
}) {
  const [fimEm, setFimEm] = useState<number | null>(null);
  const [restante, setRestante] = useState(segundos);
  const cb = useRef(aoTerminar);
  cb.current = aoTerminar;

  useEffect(() => {
    if (fimEm === null) return;
    const atualizar = () => {
      const falta = Math.max(0, Math.ceil((fimEm - Date.now()) / 1000));
      setRestante(falta);
      if (falta === 0) {
        setFimEm(null);
        cb.current?.();
      }
    };
    atualizar();
    const id = window.setInterval(atualizar, 250);
    return () => window.clearInterval(id);
  }, [fimEm]);

  const rodando = fimEm !== null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (rodando) {
            setFimEm(null);
            setRestante(segundos);
          } else {
            setFimEm(Date.now() + segundos * 1000);
          }
        }}
        className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          rodando
            ? 'bg-sky-600 text-white'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
        }`}
      >
        {rodando ? `⏱ ${formatarMMSS(restante)} — parar` : `⏱ Descansar ${formatarMMSS(segundos)}`}
      </button>
      {rodando && (
        <button
          onClick={() => setFimEm((f) => (f ?? Date.now()) + 30_000)}
          className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          +30s
        </button>
      )}
    </div>
  );
}
