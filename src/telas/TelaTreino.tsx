import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import {
  anotarExercicios,
  descansoEmSegundos,
  idExercicio,
  listaTreinos,
  metasDeRepeticao,
  normalizarNome,
  registraCarga,
  rotuloBloco,
  rotuloSerieRep,
  thumbYoutube,
  urlEmbedYoutube,
} from '../dados/plano';
import { sugerirCarga } from '../logica/calculos';
import {
  lerRascunho,
  registrarTreino,
  salvarRascunho,
  ultimoRegistroDoExercicio,
} from '../db/repositorio';
import type { Exercicio, ExercicioRegistrado, SerieRegistrada } from '../dados/tipos';
import {
  AvisoDeload,
  Barra,
  Botao,
  Cartao,
  Confirmacao,
  ModalVideo,
} from '../componentes/Ui';
import { TimerDescanso } from '../componentes/TimerDescanso';
import { useSinais } from '../hooks/useSinais';

type MapaRegistros = Record<string, ExercicioRegistrado>;

export default function TelaTreino() {
  const { indice } = useParams();
  const navegar = useNavigate();
  const { config, atualizar, progresso } = useApp();
  const item = listaTreinos[Number(indice)];

  const { preparar, sinalizarFase } = useSinais({
    som: config.somAtivo,
    vibracao: config.vibracaoAtiva,
  });

  const anotados = useMemo(() => (item ? anotarExercicios(item.treino) : []), [item]);
  const [registros, setRegistros] = useState<MapaRegistros>({});
  const [ultimos, setUltimos] = useState<
    Record<string, { peso: number; reps: number; dataHora: string }>
  >({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; titulo: string } | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const carregouRef = useRef(false);

  // Carrega rascunho + últimas cargas do histórico ---------------------------
  useEffect(() => {
    if (!item || carregouRef.current) return;
    carregouRef.current = true;
    (async () => {
      const base: MapaRegistros = {};
      for (const ex of item.treino.exercicios) {
        const id = idExercicio(item.semana, item.letra, ex.bloco, ex.nome);
        // Mobilidade não tem série no plano; guardamos uma linha só para
        // registrar "feito" sem inventar dado que o JSON não tem.
        const linhas = Math.max(1, metasDeRepeticao(ex).length);
        base[id] = {
          exercicioId: id,
          chaveExercicio: normalizarNome(ex.nome),
          nome: ex.nome,
          series: Array.from({ length: linhas }, (_, i) => ({
            numeroSerie: i + 1,
            pesoKg: null,
            repeticoesFeitas: null,
          })),
        };
      }

      const rascunho = await lerRascunho();
      if (rascunho && rascunho.indiceSequencial === item.indiceSequencial) {
        for (const reg of rascunho.exercicios) {
          if (base[reg.exercicioId]) base[reg.exercicioId] = reg;
        }
        setObservacoes(rascunho.observacoes ?? '');
      }

      const historico: Record<string, { peso: number; reps: number; dataHora: string }> = {};
      for (const ex of item.treino.exercicios) {
        const chave = normalizarNome(ex.nome);
        if (historico[chave]) continue;
        const ultimo = await ultimoRegistroDoExercicio(chave);
        if (!ultimo) continue;
        const comPeso = ultimo.registro.series.filter((s) => (s.pesoKg ?? 0) > 0);
        const melhor = comPeso[comPeso.length - 1];
        if (melhor?.pesoKg) {
          historico[chave] = {
            peso: melhor.pesoKg,
            reps: melhor.repeticoesFeitas ?? 0,
            dataHora: ultimo.dataHora,
          };
        }
      }
      setUltimos(historico);

      // Pré-preenche o peso sugerido (último usado), sem tocar no que o rascunho já tinha.
      if (!rascunho || rascunho.indiceSequencial !== item.indiceSequencial) {
        for (const ex of item.treino.exercicios) {
          const id = idExercicio(item.semana, item.letra, ex.bloco, ex.nome);
          const ultimo = historico[normalizarNome(ex.nome)];
          if (ultimo && registraCarga(ex)) {
            base[id].series = base[id].series.map((s) => ({ ...s, pesoKg: ultimo.peso }));
          }
        }
      }

      setRegistros(base);
      setAberto(
        item.treino.exercicios.length
          ? idExercicio(item.semana, item.letra, item.treino.exercicios[0].bloco, item.treino.exercicios[0].nome)
          : null,
      );
      setPronto(true);
    })();
  }, [item]);

  // Salva rascunho a cada mudança (permite sair e continuar depois) ----------
  useEffect(() => {
    if (!item || !pronto) return;
    const id = window.setTimeout(() => {
      void salvarRascunho({
        indiceSequencial: item.indiceSequencial,
        iniciadoEm: new Date().toISOString(),
        exercicios: Object.values(registros),
        observacoes,
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [registros, observacoes, item, pronto]);

  if (!item) {
    return (
      <div className="p-6">
        <p>Treino não encontrado.</p>
        <Botao className="mt-4" onClick={() => navegar('/')}>
          Voltar
        </Botao>
      </div>
    );
  }

  function alterarSerie(
    exercicioId: string,
    numeroSerie: number,
    campo: 'pesoKg' | 'repeticoesFeitas',
    valor: string,
  ) {
    const numero = valor === '' ? null : Number(valor.replace(',', '.'));
    setRegistros((atual) => {
      const reg = atual[exercicioId];
      if (!reg) return atual;
      const series: SerieRegistrada[] = reg.series.map((s) =>
        s.numeroSerie === numeroSerie
          ? { ...s, [campo]: numero !== null && Number.isFinite(numero) ? numero : null }
          : s,
      );
      return { ...atual, [exercicioId]: { ...reg, series } };
    });
  }

  function aplicarSugestao(ex: Exercicio, exercicioId: string) {
    const ultimo = ultimos[normalizarNome(ex.nome)];
    const metas = metasDeRepeticao(ex);
    if (!ultimo) return;
    setRegistros((atual) => {
      const reg = atual[exercicioId];
      if (!reg) return atual;
      const series = reg.series.map((s, i) => {
        const meta = metas[i] ?? metas[0];
        const sugestao = meta ? sugerirCarga(ultimo.peso, ultimo.reps || meta, meta) : null;
        return { ...s, pesoKg: sugestao?.peso ?? ultimo.peso };
      });
      return { ...atual, [exercicioId]: { ...reg, series } };
    });
  }

  function alternarFeito(exercicioId: string) {
    setRegistros((atual) => {
      const reg = atual[exercicioId];
      if (!reg) return atual;
      const feito = reg.series.every((s) => (s.repeticoesFeitas ?? 0) > 0);
      return {
        ...atual,
        [exercicioId]: {
          ...reg,
          series: reg.series.map((s) => ({ ...s, repeticoesFeitas: feito ? null : 1 })),
        },
      };
    });
  }

  function bateuTodasAsMetas(ex: Exercicio, exercicioId: string): boolean {
    const metas = metasDeRepeticao(ex);
    const reg = registros[exercicioId];
    if (!reg || !metas.length || metas.some((m) => m === null)) return false;
    return reg.series.every(
      (s, i) => (s.repeticoesFeitas ?? 0) >= (metas[i] ?? Infinity) && (s.pesoKg ?? 0) > 0,
    );
  }

  const totalExercicios = item.treino.exercicios.length;
  const feitos = item.treino.exercicios.filter((ex) => {
    const id = idExercicio(item.semana, item.letra, ex.bloco, ex.nome);
    const reg = registros[id];
    if (!reg) return false;
    if (!registraCarga(ex)) return reg.series.some((s) => (s.repeticoesFeitas ?? 0) > 0);
    return reg.series.some((s) => (s.pesoKg ?? 0) > 0 || (s.repeticoesFeitas ?? 0) > 0);
  }).length;

  async function concluir() {
    setSalvando(true);
    await registrarTreino({
      indiceSequencial: item.indiceSequencial,
      semana: item.semana,
      letraTreino: item.letra,
      titulo: item.titulo,
      dataHora: new Date().toISOString(),
      exercicios: Object.values(registros),
      completoAteOFim: feitos === totalExercicios,
      observacoes: observacoes.trim() || undefined,
    });
    await atualizar();
    navegar('/', { replace: true });
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <header className="mb-4">
        <button onClick={() => navegar('/')} className="text-sm font-semibold text-slate-500">
          ← Início
        </button>
        <h1 className="mt-1 text-2xl font-bold">
          Treino {item.letra} — {item.titulo}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Semana {item.semana} · etapa {item.etapa} · {totalExercicios} exercícios
        </p>
        <div className="mt-3">
          <Barra valor={feitos / totalExercicios} cor="bg-sky-500" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {feitos} de {totalExercicios} exercícios registrados
          </p>
        </div>
        {item.deload && (
          <div className="mt-3">
            <AvisoDeload tipo="musculacao" />
          </div>
        )}
        {progresso.musculacaoProximoIndice !== item.indiceSequencial && (
          <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Treino aberto fora da sequência — salvar registra o histórico, mas não avança o
            ponteiro do programa.
          </p>
        )}
      </header>

      <div className="space-y-3">
        {anotados.map(({ exercicio: ex, biSet, primeiroDoBiSet, ultimoDoBiSet }) => {
          const id = idExercicio(item.semana, item.letra, ex.bloco, ex.nome);
          const reg = registros[id];
          const metas = metasDeRepeticao(ex);
          const expandido = aberto === id;
          const ultimo = ultimos[normalizarNome(ex.nome)];
          const thumb = thumbYoutube(ex.video);
          const bateu = bateuTodasAsMetas(ex, id);

          return (
            <div
              key={id}
              className={
                biSet
                  ? `relative border-l-4 border-violet-400 pl-2 ${
                      primeiroDoBiSet ? 'pt-1' : ''
                    } ${ultimoDoBiSet ? 'pb-1' : ''}`
                  : ''
              }
            >
              {primeiroDoBiSet && (
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  ⇅ Bi-set — os dois exercícios em sequência, sem descanso entre eles
                </p>
              )}
              <Cartao>
                <button
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => setAberto(expandido ? null : id)}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="hidden h-14 w-24 rounded-lg object-cover sm:block"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {rotuloBloco(ex)}
                    </p>
                    <h2 className="text-base font-bold leading-tight">{ex.nome}</h2>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                      {rotuloSerieRep(ex)} · descanso {ex.descanso_sugerido}
                    </p>
                  </div>
                  <span className="text-slate-400">{expandido ? '▲' : '▼'}</span>
                </button>

                {expandido && (
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      <Botao
                        variante="secundario"
                        className="text-sm"
                        onClick={() => setVideo({ url: urlEmbedYoutube(ex.video), titulo: ex.nome })}
                      >
                        ▶ Ver vídeo
                      </Botao>
                      <TimerDescanso
                        segundos={descansoEmSegundos(ex.descanso_sugerido)}
                        aoTerminar={() => {
                          preparar();
                          sinalizarFase('correr');
                        }}
                      />
                    </div>

                    {ultimo && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Último registro: <strong>{ultimo.peso}kg</strong>
                          {ultimo.reps ? ` × ${ultimo.reps} reps` : ''} em{' '}
                          {new Date(ultimo.dataHora).toLocaleDateString('pt-BR')}
                        </span>
                        {registraCarga(ex) && (
                          <button
                            onClick={() => aplicarSugestao(ex, id)}
                            className="rounded-lg bg-emerald-100 px-2 py-1 font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          >
                            💡 Sugerir carga (1RM)
                          </button>
                        )}
                      </div>
                    )}

                    {ex.esquema === 'pesado_leve' && (
                      <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Cada série tem duas fases: 6 repetições pesadas + 12 leves. Registre a carga
                        da fase pesada.
                      </p>
                    )}
                    {ex.esquema === 'dropset' && (
                      <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Dropset: leve até a falha e reduza a carga sem descanso. Registre a carga
                        inicial de cada série.
                      </p>
                    )}
                    {ex.esquema === 'tabata' && (
                      <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Protocolo Tabata: 20s de esforço / 10s de pausa, sem parar entre os
                        exercícios da sequência.
                      </p>
                    )}
                    {ex.esquema === 'mobilidade' && (
                      <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Mobilidade: siga o vídeo, sem carga. Marque as repetições só se quiser
                        registrar que fez.
                      </p>
                    )}

                    {reg && !registraCarga(ex) && (
                      <button
                        onClick={() => alternarFeito(id)}
                        className={`min-h-12 w-full rounded-xl px-4 text-base font-semibold transition ${
                          reg.series.every((s) => (s.repeticoesFeitas ?? 0) > 0)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {reg.series.every((s) => (s.repeticoesFeitas ?? 0) > 0)
                          ? '✓ Feito'
                          : 'Marcar como feito'}
                      </button>
                    )}

                    {reg && ex.esquema !== 'mobilidade' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span>Série</span>
                          <span>Peso (kg)</span>
                          <span>Reps feitas</span>
                        </div>
                        {reg.series.map((s, i) => (
                          <div key={s.numeroSerie} className="grid grid-cols-[3.5rem_1fr_1fr] gap-2">
                            <div className="flex items-center text-sm font-semibold">
                              {s.numeroSerie}ª
                              {metas[i] != null && (
                                <span className="ml-1 text-xs font-normal text-slate-400">
                                  /{metas[i]}
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              disabled={!registraCarga(ex)}
                              value={s.pesoKg ?? ''}
                              onChange={(e) => alterarSerie(id, s.numeroSerie, 'pesoKg', e.target.value)}
                              placeholder={registraCarga(ex) ? 'kg' : '—'}
                              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg tabular outline-none focus:border-emerald-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              type="number"
                              inputMode="numeric"
                              value={s.repeticoesFeitas ?? ''}
                              onChange={(e) =>
                                alterarSerie(id, s.numeroSerie, 'repeticoesFeitas', e.target.value)
                              }
                              placeholder={metas[i] != null ? String(metas[i]) : 'reps'}
                              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg tabular outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {bateu && (
                      <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                        ✅ Você completou todas as repetições da meta — considere subir a carga na
                        próxima sessão deste exercício.
                      </p>
                    )}
                  </div>
                )}
              </Cartao>
            </div>
          );
        })}
      </div>

      <Cartao className="mt-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Observações do treino (opcional)
          </span>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Sensações, ajustes de máquina, dores…"
          />
        </label>
      </Cartao>

      <div className="pb-segura fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex gap-2">
          <Botao variante="secundario" className="flex-1" onClick={() => navegar('/')}>
            Salvar e continuar depois
          </Botao>
          <Botao className="flex-[2]" disabled={salvando} onClick={() => setConfirmarFim(true)}>
            ✅ Concluir treino
          </Botao>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
          O que você digita fica salvo automaticamente como rascunho.
        </p>
      </div>

      {video && (
        <ModalVideo url={video.url} titulo={video.titulo} aoFechar={() => setVideo(null)} />
      )}

      {confirmarFim && (
        <Confirmacao
          titulo="Concluir este treino?"
          descricao={
            <>
              <p>
                {feitos} de {totalExercicios} exercícios têm registro.
              </p>
              {feitos < totalExercicios && (
                <p className="mt-1">
                  Os demais ficam salvos sem carga — o treino será marcado como incompleto, mas
                  ainda avança sua sequência.
                </p>
              )}
            </>
          }
          textoConfirmar="Concluir"
          aoConfirmar={() => void concluir()}
          aoCancelar={() => setConfirmarFim(false)}
        />
      )}

    </div>
  );
}
