import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { plano } from '../dados/plano';
import {
  arredondarCarga,
  brzycki,
  calcularFcMax,
  calcularZonas,
  epley,
  tabelaPercentuais,
} from '../logica/calculos';
import { Botao, Campo, Cartao } from '../componentes/Ui';
import type { MetodoFcMax } from '../dados/tipos';

export default function Calculadoras() {
  const { config, salvarConfig } = useApp();

  // FCmáx --------------------------------------------------------------------
  const [idade, setIdade] = useState(String(config.idade));
  const [fcRepouso, setFcRepouso] = useState(config.fcRepouso ? String(config.fcRepouso) : '');
  const [metodo, setMetodo] = useState<MetodoFcMax>(config.metodoFcMax);
  const [karvonen, setKarvonen] = useState(config.usarKarvonen);

  const idadeNum = Number(idade);
  const fcMax = calcularFcMax(idadeNum, metodo);
  const fcRepousoNum = Number(fcRepouso);
  const karvonenPossivel = fcRepousoNum > 30 && fcRepousoNum < fcMax;
  const zonas = calcularZonas(fcMax, {
    fcRepouso: karvonenPossivel ? fcRepousoNum : undefined,
    usarKarvonen: karvonen && karvonenPossivel,
  });

  // 1RM ----------------------------------------------------------------------
  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('');
  const pesoNum = Number(peso.replace(',', '.'));
  const repsNum = Number(reps);
  const umEpley = epley(pesoNum, repsNum);
  const umBrzycki = brzycki(pesoNum, repsNum);
  const valido = umEpley > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calculadoras</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        As mesmas contas das ferramentas do programa, feitas aqui dentro — funcionam offline.
      </p>

      <Cartao className="space-y-4">
        <h2 className="text-lg font-bold">FCmáx e zonas de treino</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Idade"
            type="number"
            inputMode="numeric"
            value={idade}
            onChange={(e) => setIdade(e.target.value)}
          />
          <Campo
            rotulo="FC repouso (opcional)"
            type="number"
            inputMode="numeric"
            value={fcRepouso}
            onChange={(e) => setFcRepouso(e.target.value)}
            placeholder="bpm"
          />
        </div>

        <div className="flex gap-2">
          {(['tanaka', '220-idade'] as MetodoFcMax[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetodo(m)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
                metodo === m
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'bg-white text-slate-700 ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'
              }`}
            >
              {m === 'tanaka' ? 'Tanaka' : '220 − idade'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {metodo === 'tanaka'
            ? 'FCmáx = 208 − (0,7 × idade) — mais precisa que a clássica.'
            : 'FCmáx = 220 − idade — fórmula clássica, tende a subestimar em adultos mais velhos.'}
        </p>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={karvonen && karvonenPossivel}
            disabled={!karvonenPossivel}
            onChange={(e) => setKarvonen(e.target.checked)}
            className="h-5 w-5 rounded accent-emerald-600"
          />
          <span className={karvonenPossivel ? '' : 'text-slate-400'}>
            Usar Karvonen (reserva de FC): ((FCmáx − FCrep) × %) + FCrep
          </span>
        </label>

        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/40">
          <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
            Sua FCmáx
          </p>
          <p className="tabular text-4xl font-black text-emerald-700 dark:text-emerald-300">
            {fcMax || '—'}
            <span className="text-lg font-semibold"> bpm</span>
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <th className="pb-1">Zona</th>
              <th className="pb-1">% FCmáx</th>
              <th className="pb-1 text-right">BPM</th>
            </tr>
          </thead>
          <tbody>
            {zonas.map((z) => (
              <tr
                key={z.zona}
                className={`border-t border-slate-200 dark:border-slate-800 ${
                  z.zona === 'Z3' ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
                }`}
              >
                <td className="py-2 font-bold">{z.zona}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">
                  {Math.round(z.percentualMin * 100)}–{Math.round(z.percentualMax * 100)}%
                </td>
                <td className="tabular py-2 text-right font-semibold">
                  {z.min}–{z.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
          {zonas.map((z) => (
            <li key={z.zona}>
              <strong>{z.zona}:</strong> {plano.zonas_fc[z.zona]}
            </li>
          ))}
        </ul>

        <Botao
          variante="secundario"
          className="w-full"
          onClick={() =>
            void salvarConfig({
              idade: idadeNum,
              metodoFcMax: metodo,
              fcRepouso: karvonenPossivel ? fcRepousoNum : undefined,
              usarKarvonen: karvonen && karvonenPossivel,
            })
          }
        >
          Usar esses valores no app
        </Botao>
      </Cartao>

      <Cartao className="space-y-4">
        <h2 className="text-lg font-bold">1RM (repetição máxima)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Peso levantado (kg)"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            placeholder="Ex.: 60"
          />
          <Campo
            rotulo="Repetições feitas"
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="Ex.: 10"
          />
        </div>

        {valido ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-800">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Epley
                </p>
                <p className="tabular text-2xl font-black">{umEpley.toFixed(1)}kg</p>
                <p className="text-[10px] text-slate-500">peso × (1 + reps/30)</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-center dark:bg-slate-800">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Brzycki
                </p>
                <p className="tabular text-2xl font-black">{umBrzycki.toFixed(1)}kg</p>
                <p className="text-[10px] text-slate-500">peso × 36 / (37 − reps)</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold">Cargas sugeridas (sobre o 1RM de Epley)</p>
              <table className="w-full text-sm">
                <tbody>
                  {tabelaPercentuais(umEpley).map((linha) => (
                    <tr key={linha.percentual} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-2 font-semibold">{Math.round(linha.percentual * 100)}%</td>
                      <td className="tabular py-2 text-right font-semibold">{linha.peso}kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Valores arredondados para {arredondarCarga(2.5)}kg (incremento típico de anilha). Na
                tela do treino, o botão “Sugerir carga” faz essa conta automaticamente a partir do
                seu último registro do exercício.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Informe peso e repetições para calcular.
          </p>
        )}
      </Cartao>
    </div>
  );
}
