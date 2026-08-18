import { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { listaCorridas, normalizarNome } from '../dados/plano';
import { formatarHMS } from '../logica/cronometro';
import { GraficoBarras, GraficoLinha, Heatmap, type Ponto } from '../componentes/Graficos';
import { Botao, Campo, Cartao, Etiqueta, Vazio } from '../componentes/Ui';
import { registrarPeso } from '../db/repositorio';

type Aba = 'musculacao' | 'corrida' | 'corpo';

export default function Historico() {
  const { corridas, treinos, pesos, atualizar } = useApp();
  const [aba, setAba] = useState<Aba>('musculacao');
  const [novoPeso, setNovoPeso] = useState('');

  // --- Exercícios: agrega por chave estável do nome -------------------------
  const porExercicio = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; pontos: Ponto[]; volumePorSemana: Map<number, number>; ultimaCarga: number }
    >();
    for (const treino of treinos) {
      for (const ex of treino.exercicios) {
        const comCarga = ex.series.filter((s) => (s.pesoKg ?? 0) > 0);
        if (!comCarga.length) continue;
        const chave = ex.chaveExercicio || normalizarNome(ex.nome);
        const atual =
          mapa.get(chave) ??
          { nome: ex.nome, pontos: [], volumePorSemana: new Map<number, number>(), ultimaCarga: 0 };
        const maiorCarga = Math.max(...comCarga.map((s) => s.pesoKg as number));
        const volume = ex.series.reduce(
          (n, s) => n + (s.pesoKg ?? 0) * (s.repeticoesFeitas ?? 0),
          0,
        );
        atual.pontos.push({
          rotulo: new Date(treino.dataHora).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          }),
          valor: maiorCarga,
        });
        atual.volumePorSemana.set(
          treino.semana,
          (atual.volumePorSemana.get(treino.semana) ?? 0) + volume,
        );
        atual.ultimaCarga = maiorCarga;
        mapa.set(chave, atual);
      }
    }
    return [...mapa.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  }, [treinos]);

  const [exercicioAberto, setExercicioAberto] = useState<string | null>(null);

  const dias = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of [...corridas, ...treinos]) {
      const c = new Date(s.dataHora).toISOString().slice(0, 10);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [corridas, treinos]);

  const pontosPeso: Ponto[] = pesos.map((p) => ({
    rotulo: new Date(p.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    valor: p.pesoKg,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Histórico e evolução</h1>

      <Cartao>
        <p className="mb-2 text-sm font-semibold">Dias treinados</p>
        <Heatmap dias={dias} />
      </Cartao>

      <div className="flex gap-2">
        {(
          [
            ['musculacao', 'Musculação'],
            ['corrida', 'Corrida'],
            ['corpo', 'Peso corporal'],
          ] as [Aba, string][]
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            onClick={() => setAba(chave)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              aba === chave
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'musculacao' && (
        <div className="space-y-3">
          {porExercicio.length === 0 ? (
            <Vazio>
              Nenhuma carga registrada ainda. Ao concluir um treino com pesos, a evolução aparece
              aqui.
            </Vazio>
          ) : (
            porExercicio.map(([chave, dados]) => {
              const aberto = exercicioAberto === chave;
              const semanas = [...dados.volumePorSemana.entries()].sort((a, b) => a[0] - b[0]);
              return (
                <Cartao key={chave}>
                  <button
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setExercicioAberto(aberto ? null : chave)}
                  >
                    <div>
                      <h2 className="font-bold leading-tight">{dados.nome}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {dados.pontos.length} {dados.pontos.length === 1 ? 'sessão' : 'sessões'} ·
                        última carga {dados.ultimaCarga}kg
                      </p>
                    </div>
                    <span className="text-slate-400">{aberto ? '▲' : '▼'}</span>
                  </button>
                  {aberto && (
                    <div className="mt-3 space-y-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Carga máxima por sessão (kg)
                        </p>
                        <GraficoLinha pontos={dados.pontos} unidade="kg" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Volume por semana (kg × reps)
                        </p>
                        <GraficoBarras
                          pontos={semanas.map(([s, v]) => ({ rotulo: `S${s}`, valor: v }))}
                        />
                      </div>
                    </div>
                  )}
                </Cartao>
              );
            })
          )}

          {treinos.length > 0 && (
            <Cartao>
              <p className="mb-2 text-sm font-semibold">Treinos concluídos</p>
              <ul className="space-y-2">
                {[...treinos].reverse().map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold">
                        S{t.semana} · Treino {t.letraTreino}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.titulo}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      <p>{new Date(t.dataHora).toLocaleDateString('pt-BR')}</p>
                      {!t.completoAteOFim && <Etiqueta cor="ambar">parcial</Etiqueta>}
                    </div>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      )}

      {aba === 'corrida' && (
        <div className="space-y-3">
          {corridas.length === 0 ? (
            <Vazio>Nenhuma corrida registrada ainda.</Vazio>
          ) : (
            <>
              <Cartao>
                <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Duração das sessões (min)
                </p>
                <GraficoLinha
                  pontos={corridas.map((c) => ({
                    rotulo: new Date(c.dataHora).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    }),
                    valor: Math.round((c.duracaoTotalSeg / 60) * 10) / 10,
                  }))}
                  unidade="min"
                  cor="#0ea5e9"
                />
              </Cartao>

              {corridas
                .filter((c) => c.provaFinal)
                .map((c) => (
                  <Cartao
                    key={c.id}
                    className="bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900"
                  >
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      🏆 Prova alvo — 3km
                    </p>
                    <p className="tabular text-3xl font-black text-amber-900 dark:text-amber-100">
                      {formatarHMS(c.duracaoTotalSeg)}
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {new Date(c.dataHora).toLocaleString('pt-BR')}
                      {c.distanciaKm ? ` · ${c.distanciaKm}km` : ''}
                    </p>
                  </Cartao>
                ))}

              <Cartao>
                <p className="mb-2 text-sm font-semibold">Sessões</p>
                <ul className="space-y-2">
                  {[...corridas].reverse().map((c) => {
                    const item = listaCorridas[c.indiceSequencial];
                    return (
                      <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <p className="font-semibold">
                            S{c.semana} · sessão {c.ordemNaSemana}
                            {c.provaFinal ? ' · PROVA' : ''}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item?.resumo ?? c.tipoIntervalo ?? ''}
                          </p>
                          {c.observacoes && (
                            <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
                              {c.observacoes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="tabular font-semibold">{formatarHMS(c.duracaoTotalSeg)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(c.dataHora).toLocaleDateString('pt-BR')}
                          </p>
                          {!c.completoAteOFim && <Etiqueta cor="ambar">interrompida</Etiqueta>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            </>
          )}
        </div>
      )}

      {aba === 'corpo' && (
        <div className="space-y-3">
          <Cartao>
            <div className="flex items-end gap-2">
              <Campo
                rotulo="Registrar peso de hoje (kg)"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={novoPeso}
                onChange={(e) => setNovoPeso(e.target.value)}
                className="flex-1"
                placeholder="Ex.: 81.4"
              />
              <Botao
                disabled={!(Number(novoPeso) > 0)}
                onClick={async () => {
                  await registrarPeso(Number(novoPeso.replace(',', '.')));
                  setNovoPeso('');
                  await atualizar();
                }}
              >
                Salvar
              </Botao>
            </div>
          </Cartao>

          {pesos.length === 0 ? (
            <Vazio>Nenhum peso registrado ainda.</Vazio>
          ) : (
            <Cartao>
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Peso corporal (kg)
              </p>
              <GraficoLinha pontos={pontosPeso} unidade="kg" cor="#8b5cf6" />
              <p className="mt-2 text-sm">
                Primeiro registro: <strong>{pesos[0].pesoKg}kg</strong> · atual:{' '}
                <strong>{pesos[pesos.length - 1].pesoKg}kg</strong> · variação{' '}
                <strong>
                  {(pesos[pesos.length - 1].pesoKg - pesos[0].pesoKg).toFixed(1).replace('-', '−')}
                  kg
                </strong>
              </p>
            </Cartao>
          )}
        </div>
      )}
    </div>
  );
}
