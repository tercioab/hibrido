import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import {
  faseDaSemana,
  plano,
  segParaMinTexto,
  semanaDentroDaFase,
} from '../dados/plano';
import { formatarMMSS } from '../logica/cronometro';
import { AvisoDeload, Barra, Botao, Cartao, Etiqueta } from '../componentes/Ui';
import { Heatmap } from '../componentes/Graficos';

export default function Dashboard() {
  const {
    config,
    progresso,
    proximaCorrida,
    proximoTreino,
    corridas,
    treinos,
    totalCorridas,
    totalTreinos,
    zonas,
    fcMax,
  } = useApp();

  const semanaAtual = Math.min(proximaCorrida?.semana ?? 12, proximoTreino?.semana ?? 12);
  const fase = faseDaSemana(semanaAtual);
  const dentro = semanaDentroDaFase(semanaAtual);

  const dias = new Map<string, number>();
  for (const s of [...corridas, ...treinos]) {
    const chave = new Date(s.dataHora).toISOString().slice(0, 10);
    dias.set(chave, (dias.get(chave) ?? 0) + 1);
  }

  const z3 = zonas.find((z) => z.zona === 'Z3');
  const tudoConcluido = !proximaCorrida && !proximoTreino;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {config.nome ? `Olá, ${config.nome}` : 'Time Híbrido'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {plano.meta.programa} · {plano.meta.nivel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">FCmáx</p>
          <p className="text-xl font-bold tabular text-emerald-600 dark:text-emerald-400">
            {fcMax}
          </p>
        </div>
      </header>

      <Cartao>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Fase atual
            </p>
            <p className="text-xl font-bold">Etapa {fase}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Semana {semanaAtual} de {plano.meta.duracao_semanas}
              {dentro.total ? ` · ${dentro.indice}ª de ${dentro.total} na fase` : ''}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              corrida na semana {proximaCorrida?.semana ?? plano.meta.duracao_semanas} ·
              musculação na semana {proximoTreino?.semana ?? plano.meta.duracao_semanas}
            </p>
          </div>
          <Etiqueta cor="roxo">{fase}</Etiqueta>
        </div>
        <div className="mt-3">
          <Barra valor={(semanaAtual - 1) / plano.meta.duracao_semanas} cor="bg-violet-500" />
        </div>
      </Cartao>

      {tudoConcluido && (
        <Cartao className="bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">
          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
            🏆 Programa completo!
          </p>
          <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
            Você concluiu as {totalCorridas} corridas e os {totalTreinos} treinos das 12 semanas.
          </p>
        </Cartao>
      )}

      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
        Corrida e musculação são <strong>trilhas independentes</strong>: cada uma continua de onde
        você parou, sem depender do dia da semana nem uma da outra.
      </p>

      {/* Próxima corrida */}
      <Cartao>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Próxima corrida
            </p>
            <p className="text-lg font-bold">
              {proximaCorrida
                ? `Semana ${proximaCorrida.semana} · sessão ${proximaCorrida.ordemNaSemana} de 3`
                : 'Trilha de corrida concluída 🎉'}
            </p>
          </div>
          {proximaCorrida?.sessao.prova_final ? (
            <Etiqueta cor="ambar">PROVA ALVO</Etiqueta>
          ) : (
            <Etiqueta cor="verde">
              {progresso.corridaProximoIndice}/{totalCorridas}
            </Etiqueta>
          )}
        </div>

        {proximaCorrida && (
          <>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              {proximaCorrida.resumo}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Aquecimento {segParaMinTexto(proximaCorrida.sessao.aquecimento.duracao_seg)} Z1 ·
              volta à calma {segParaMinTexto(proximaCorrida.sessao.volta_calma.duracao_seg)} Z1 ·
              previsto ~{formatarMMSS(proximaCorrida.duracaoPrevistaSeg)}
              {z3 ? ` · trechos de corrida em Z3 (${z3.min}–${z3.max} bpm)` : ''}
            </p>
            {proximaCorrida.deload && (
              <div className="mt-3">
                <AvisoDeload tipo="corrida" />
              </div>
            )}
            <Link to={`/corrida/${proximaCorrida.indiceSequencial}`}>
              <Botao className="mt-3 w-full">
                {proximaCorrida.sessao.prova_final ? '🏁 Iniciar prova de 3km' : '▶ Iniciar corrida'}
              </Botao>
            </Link>
          </>
        )}
        <div className="mt-3">
          <Barra valor={progresso.corridaProximoIndice / totalCorridas} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {progresso.corridaProximoIndice} de {totalCorridas} corridas concluídas
          </p>
        </div>
      </Cartao>

      {/* Próximo treino */}
      <Cartao>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Próximo treino de musculação
            </p>
            <p className="text-lg font-bold">
              {proximoTreino
                ? `Semana ${proximoTreino.semana} · Treino ${proximoTreino.letra}`
                : 'Trilha de musculação concluída 🎉'}
            </p>
          </div>
          <Etiqueta cor="azul">
            {progresso.musculacaoProximoIndice}/{totalTreinos}
          </Etiqueta>
        </div>

        {proximoTreino && (
          <>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{proximoTreino.titulo}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {proximoTreino.treino.exercicios.length} exercícios ·{' '}
              {proximoTreino.volumeSeries} séries previstas
            </p>
            {proximoTreino.deload && (
              <div className="mt-3">
                <AvisoDeload tipo="musculacao" />
              </div>
            )}
            <Link to={`/treino/${proximoTreino.indiceSequencial}`}>
              <Botao className="mt-3 w-full">▶ Iniciar treino</Botao>
            </Link>
          </>
        )}
        <div className="mt-3">
          <Barra valor={progresso.musculacaoProximoIndice / totalTreinos} cor="bg-sky-500" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {progresso.musculacaoProximoIndice} de {totalTreinos} treinos concluídos
          </p>
        </div>
      </Cartao>

      <Cartao>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Dias treinados</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">últimas 15 semanas</p>
        </div>
        <Heatmap dias={dias} />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {corridas.length + treinos.length} sessões registradas no total.
        </p>
      </Cartao>
    </div>
  );
}
