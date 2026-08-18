import { useState } from 'react';
import { plano, urlEmbedYoutube } from '../dados/plano';
import { calcularFcMax, calcularZonas } from '../logica/calculos';
import { useApp } from '../hooks/useApp';
import { registrarPeso } from '../db/repositorio';
import { Botao, Campo, Cartao } from '../componentes/Ui';
import type { MetodoFcMax } from '../dados/tipos';

export default function Onboarding() {
  const { salvarConfig, atualizar } = useApp();
  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [peso, setPeso] = useState('');
  const [fcRepouso, setFcRepouso] = useState('');
  const [metodo, setMetodo] = useState<MetodoFcMax>('tanaka');

  const idadeNum = Number(idade);
  const idadeValida = Number.isFinite(idadeNum) && idadeNum >= 10 && idadeNum <= 100;
  const fcMax = calcularFcMax(idadeNum, metodo);
  const fcRepousoNum = Number(fcRepouso);
  const usarKarvonen = Number.isFinite(fcRepousoNum) && fcRepousoNum > 30 && fcRepousoNum < fcMax;
  const zonas = calcularZonas(fcMax, {
    fcRepouso: usarKarvonen ? fcRepousoNum : undefined,
    usarKarvonen,
  });

  async function concluir() {
    await salvarConfig({
      nome: nome.trim() || undefined,
      idade: idadeNum,
      fcRepouso: usarKarvonen ? fcRepousoNum : undefined,
      pesoCorporalKg: Number(peso) > 0 ? Number(peso) : undefined,
      metodoFcMax: metodo,
      usarKarvonen,
      onboardingConcluido: true,
    });
    if (Number(peso) > 0) await registrarPeso(Number(peso));
    await atualizar();
  }

  return (
    <div className="pt-segura mx-auto max-w-xl px-4 pb-10">
      <header className="py-6">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {plano.meta.programa}
        </p>
        <h1 className="text-2xl font-bold">Bem-vindo ao Time Híbrido Tracker</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plano.meta.objetivo}</p>
      </header>

      {passo === 0 && (
        <div className="space-y-4">
          <Cartao>
            <h2 className="mb-2 font-semibold">Vídeo de boas-vindas</h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={urlEmbedYoutube(plano.videos_orientacao.video_boas_vindas)}
                title="Vídeo de boas-vindas"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Cartao>

          <Cartao className="bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Aviso importante</h2>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{plano.meta.aviso}</p>
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              Responsável técnico: {plano.meta.cref_responsavel}
            </p>
          </Cartao>

          <Botao className="w-full" onClick={() => setPasso(1)}>
            Entendi, vamos começar
          </Botao>
        </div>
      )}

      {passo === 1 && (
        <div className="space-y-4">
          <Cartao className="space-y-4">
            <Campo
              rotulo="Seu nome (opcional)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como quer ser chamado"
            />
            <Campo
              rotulo="Idade (obrigatório)"
              type="number"
              inputMode="numeric"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              placeholder="Ex.: 34"
              dica="Usada para calcular sua FCmáx e as zonas de treino."
            />
            <Campo
              rotulo="Peso corporal em kg (opcional)"
              type="number"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ex.: 82.5"
            />
            <Campo
              rotulo="FC de repouso em bpm (opcional)"
              type="number"
              inputMode="numeric"
              value={fcRepouso}
              onChange={(e) => setFcRepouso(e.target.value)}
              placeholder="Ex.: 62"
              dica="Medida em repouso, deitado. Habilita o método de Karvonen, mais preciso."
            />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Fórmula da FCmáx
              </span>
              <div className="flex gap-2">
                {(['tanaka', '220-idade'] as MetodoFcMax[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetodo(m)}
                    className={`flex-1 rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition ${
                      metodo === m
                        ? 'bg-emerald-600 text-white ring-emerald-600'
                        : 'bg-white text-slate-700 ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'
                    }`}
                  >
                    {m === 'tanaka' ? 'Tanaka (208 − 0,7×idade)' : 'Clássica (220 − idade)'}
                  </button>
                ))}
              </div>
            </div>
          </Cartao>

          {idadeValida && (
            <Cartao>
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">Sua FCmáx</h2>
                <span className="text-3xl font-bold tabular text-emerald-600 dark:text-emerald-400">
                  {fcMax} <span className="text-base font-medium">bpm</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Zonas calculadas {usarKarvonen ? 'por Karvonen (com FC de repouso)' : 'como % direto da FCmáx'}.
              </p>
              <ul className="mt-3 space-y-1.5">
                {zonas.map((z) => (
                  <li key={z.zona} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">{z.zona}</span>
                    <span className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {Math.round(z.percentualMin * 100)}–{Math.round(z.percentualMax * 100)}%
                    </span>
                    <span className="tabular font-semibold">
                      {z.min}–{z.max} bpm
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <div className="flex gap-2">
            <Botao variante="secundario" className="flex-1" onClick={() => setPasso(0)}>
              Voltar
            </Botao>
            <Botao className="flex-[2]" disabled={!idadeValida} onClick={() => void concluir()}>
              Começar o programa
            </Botao>
          </div>
          {!idadeValida && (
            <p className="text-center text-xs text-slate-500">Informe uma idade entre 10 e 100.</p>
          )}
        </div>
      )}
    </div>
  );
}
