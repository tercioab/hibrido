import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { listaCorridas, segParaMinTexto } from '../dados/plano';
import {
  decorridoNaFaseSeg,
  decorridoTotalSeg,
  faseAtual as pegarFaseAtual,
  formatarHMS,
  formatarMMSS,
  progressoSessao,
  proximaFase as pegarProximaFase,
  restanteNaFaseSeg,
  type FaseCronometro,
} from '../logica/cronometro';
import { useCronometro } from '../hooks/useCronometro';
import { useSinais } from '../hooks/useSinais';
import { useWakeLock } from '../hooks/useWakeLock';
import { registrarCorrida } from '../db/repositorio';
import { AvisoDeload, Botao, Campo, Cartao, Confirmacao, Etiqueta } from '../componentes/Ui';

const CORES: Record<string, { fundo: string; texto: string; barra: string }> = {
  aquecimento: { fundo: 'bg-amber-400 dark:bg-amber-600', texto: 'text-amber-950 dark:text-amber-50', barra: 'bg-amber-700' },
  volta_calma: { fundo: 'bg-amber-300 dark:bg-amber-700', texto: 'text-amber-950 dark:text-amber-50', barra: 'bg-amber-700' },
  correr: { fundo: 'bg-emerald-500 dark:bg-emerald-600', texto: 'text-white', barra: 'bg-emerald-900' },
  livre: { fundo: 'bg-emerald-500 dark:bg-emerald-600', texto: 'text-white', barra: 'bg-emerald-900' },
  caminhar: { fundo: 'bg-sky-500 dark:bg-sky-600', texto: 'text-white', barra: 'bg-sky-900' },
};

export default function TelaCorrida() {
  const { indice } = useParams();
  const navegar = useNavigate();
  const { config, zonas, atualizar, progresso } = useApp();

  const item = listaCorridas[Number(indice)];
  const sessao = item?.sessao;

  const { preparar, sinalizarFase } = useSinais({
    som: config.somAtivo,
    vibracao: config.vibracaoAtiva,
  });

  const [terminou, setTerminou] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [distancia, setDistancia] = useState(sessao?.prova_final ? '3' : '');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const manual = useRef(false);

  const aoTrocarFase = useMemo(
    () => (fase: FaseCronometro) => sinalizarFase(fase.tipo),
    [sinalizarFase],
  );
  const aoConcluir = useMemo(
    () => () => {
      if (!manual.current) sinalizarFase('fim');
      setTerminou(true);
    },
    [sinalizarFase],
  );

  const { estado, iniciar, alternarPausa, pular, encerrar } = useCronometro(
    sessao ?? listaCorridas[0].sessao,
    aoTrocarFase,
    aoConcluir,
  );

  const wake = useWakeLock(config.manterTelaAcesa && estado.rodando && !terminou);

  if (!item || !sessao) {
    return (
      <div className="p-6">
        <p>Sessão não encontrada.</p>
        <Botao className="mt-4" onClick={() => navegar('/')}>
          Voltar
        </Botao>
      </div>
    );
  }

  const fase = pegarFaseAtual(estado);
  const proxima = pegarProximaFase(estado);
  const restante = restanteNaFaseSeg(estado);
  const cores = CORES[fase?.tipo ?? 'aquecimento'];
  const zona = zonas.find((z) => z.zona === fase?.zona);
  const jaComecou = estado.rodando || estado.decorridoTotalMs > 0;
  const eProva = sessao.prova_final;

  async function salvar() {
    setSalvando(true);
    const km = Number(distancia.replace(',', '.'));
    await registrarCorrida({
      indiceSequencial: item.indiceSequencial,
      semana: item.semana,
      ordemNaSemana: item.ordemNaSemana,
      dataHora: new Date().toISOString(),
      duracaoTotalSeg: decorridoTotalSeg(estado),
      completoAteOFim: !manual.current,
      distanciaKm: Number.isFinite(km) && km > 0 ? km : undefined,
      provaFinal: sessao.prova_final,
      tipoIntervalo: sessao.tipo_intervalo,
      observacoes: observacoes.trim() || undefined,
    });
    await atualizar();
    navegar('/', { replace: true });
  }

  // ------------------------------------------------------------------ fim ---
  if (terminou) {
    const eProvaConcluida = eProva && !manual.current;
    return (
      <div className="px-4 py-8">
        <div className="mx-auto max-w-md space-y-4">
          {eProvaConcluida ? (
            <div className="rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 p-6 text-center text-amber-950 shadow">
              <p className="text-5xl">🏆</p>
              <h1 className="mt-2 text-2xl font-black">3 KM CONCLUÍDOS!</h1>
              <p className="mt-1 text-sm font-medium">
                Essa era a meta do programa inteiro. Você chegou lá.
              </p>
            </div>
          ) : (
            <h1 className="text-2xl font-bold">
              {manual.current ? 'Sessão encerrada' : 'Sessão concluída! 👏'}
            </h1>
          )}

          <Cartao>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Tempo total</span>
              <span className="tabular text-3xl font-bold">
                {formatarHMS(decorridoTotalSeg(estado))}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Semana {item.semana} · sessão {item.ordemNaSemana} · {item.resumo}
            </p>
            {manual.current && (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Marcada como interrompida — ainda conta como feita e avança sua sequência.
              </p>
            )}
          </Cartao>

          <Cartao className="space-y-3">
            <Campo
              rotulo="Distância percorrida em km (opcional)"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              placeholder="Ex.: 3.12"
              dica="Se você conferiu no relógio ou em outro app, registre aqui."
            />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Observações (opcional)
              </span>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Como foi? Calor, cansaço, ritmo…"
              />
            </label>
          </Cartao>

          <Botao className="w-full" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar e voltar'}
          </Botao>
          <Botao variante="fantasma" className="w-full" onClick={() => navegar('/')}>
            Descartar sessão
          </Botao>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------- em curso ---
  return (
    <div className={`flex min-h-screen flex-col ${cores.fundo} ${cores.texto} transition-colors`}>
      <div className="pt-segura flex items-center justify-between px-4 pt-3">
        <button
          onClick={() => (jaComecou ? setConfirmarSaida(true) : navegar('/'))}
          className="rounded-lg px-2 py-1 text-sm font-semibold opacity-80"
        >
          ← Sair
        </button>
        <span className="text-sm font-semibold opacity-90">
          Semana {item.semana} · sessão {item.ordemNaSemana}/3
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {fase?.intervalo && (
          <p className="text-lg font-bold uppercase tracking-widest opacity-80">
            Intervalo {fase.intervalo.numero} de {fase.intervalo.total}
          </p>
        )}
        <h1 className="mt-1 text-5xl font-black uppercase tracking-tight sm:text-6xl">
          {fase?.rotulo}
        </h1>

        <p className="tabular mt-4 text-7xl font-black sm:text-8xl">
          {restante === null
            ? formatarHMS(decorridoNaFaseSeg(estado))
            : formatarMMSS(restante)}
        </p>
        {restante === null && (
          <p className="mt-1 text-sm font-semibold opacity-80">
            corrida livre — toque em “concluir etapa” ao completar os{' '}
            {sessao.corrida_continua?.distancia_km ?? 3}km
          </p>
        )}

        <div className="mt-4 rounded-full bg-black/15 px-4 py-2 text-sm font-bold">
          {fase?.zona} · {zona ? `${Math.round(zona.percentualMin * 100)}–${Math.round(zona.percentualMax * 100)}% FCmáx · ${zona.min}–${zona.max} bpm` : ''}
        </div>

        {!estado.rodando && !jaComecou && (
          <Botao
            className="mt-8 w-full max-w-xs bg-black/85 text-white shadow-lg hover:bg-black"
            onClick={() => {
              preparar();
              sinalizarFase('aquecimento');
              iniciar();
            }}
          >
            ▶ Começar
          </Botao>
        )}

        {!estado.rodando && jaComecou && (
          <p className="mt-6 text-lg font-bold uppercase tracking-widest opacity-80">Pausado</p>
        )}
      </div>

      <div className="px-4">
        <p className="mb-1 text-xs font-semibold opacity-80">
          {proxima
            ? `A seguir: ${proxima.rotulo.toLowerCase()}${
                proxima.duracaoSeg ? ` ${segParaMinTexto(proxima.duracaoSeg)}` : ''
              }`
            : 'Última etapa da sessão'}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
          <div
            className={`h-full ${cores.barra} transition-[width] duration-300`}
            style={{ width: `${progressoSessao(estado) * 100}%` }}
          />
        </div>
        <p className="mt-1 flex justify-between text-xs font-medium opacity-80">
          <span>total {formatarHMS(decorridoTotalSeg(estado))}</span>
          <span>previsto ~{formatarMMSS(item.duracaoPrevistaSeg)}</span>
        </p>
      </div>

      <div className="pb-segura mt-4 grid grid-cols-3 gap-2 px-4 pb-4">
        <Botao
          variante="secundario"
          className="bg-black/35 text-white ring-1 ring-white/25 hover:bg-black/45"
          onClick={alternarPausa}
          disabled={!jaComecou && !estado.rodando}
        >
          {estado.rodando ? '⏸ Pausar' : '▶ Retomar'}
        </Botao>
        <Botao
          variante="secundario"
          className="bg-black/35 text-white ring-1 ring-white/25 hover:bg-black/45"
          onClick={pular}
        >
          {restante === null ? '✓ Concluir etapa' : '⏭ Pular fase'}
        </Botao>
        <Botao
          variante="perigo"
          onClick={() => {
            manual.current = true;
            encerrar();
          }}
        >
          ⏹ Encerrar
        </Botao>
      </div>

      {(item.deload || !wake.suportado) && (
        <div className="px-4 pb-4 text-xs">
          {item.deload && (
            <div className="mb-2">
              <AvisoDeload tipo="corrida" />
            </div>
          )}
          {!wake.suportado && config.manterTelaAcesa && (
            <p className="rounded-xl bg-black/20 p-2 font-medium">
              Este navegador não mantém a tela acesa sozinho — desative o bloqueio automático do
              celular antes de começar, ou deixe o app em primeiro plano.
            </p>
          )}
        </div>
      )}

      {progresso.corridaProximoIndice !== item.indiceSequencial && (
        <div className="px-4 pb-4">
          <Etiqueta cor="ambar">
            Você abriu uma sessão fora da sequência — salvar não vai avançar seu progresso.
          </Etiqueta>
        </div>
      )}

      {confirmarSaida && (
        <Confirmacao
          titulo="Sair sem salvar?"
          descricao="O tempo já corrido nesta sessão será perdido. Para registrar mesmo assim, use “Encerrar”."
          textoConfirmar="Sair sem salvar"
          perigo
          aoConfirmar={() => navegar('/')}
          aoCancelar={() => setConfirmarSaida(false)}
        />
      )}
    </div>
  );
}
