import { useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { plano, urlEmbedYoutube } from '../dados/plano';
import {
  ajustarIndiceCorrida,
  ajustarIndiceMusculacao,
  exportarBackup,
  importarBackup,
  resetarProgresso,
  validarBackup,
} from '../db/repositorio';
import { Botao, Campo, Cartao, Confirmacao, ModalVideo } from '../componentes/Ui';
import type { ConfiguracoesUsuario } from '../dados/tipos';

export default function Configuracoes() {
  const { config, salvarConfig, atualizar, progresso, totalCorridas, totalTreinos } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmarReset, setConfirmarReset] = useState<0 | 1 | 2>(0);
  const [video, setVideo] = useState<{ url: string; titulo: string } | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  function aviso(texto: string) {
    setMsg(texto);
    window.setTimeout(() => setMsg(null), 4000);
  }

  async function baixarBackup() {
    const backup = await exportarBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-hibrido-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    aviso('Backup exportado.');
  }

  async function carregarBackup(arquivo: File) {
    try {
      const dados = JSON.parse(await arquivo.text());
      if (!validarBackup(dados)) {
        aviso('Arquivo não parece um backup do Time Híbrido.');
        return;
      }
      await importarBackup(dados);
      await atualizar();
      aviso(
        `Backup importado: ${dados.corridas.length} corridas e ${dados.treinos.length} treinos.`,
      );
    } catch {
      aviso('Não consegui ler esse arquivo.');
    }
  }

  const temas: [ConfiguracoesUsuario['tema'], string][] = [
    ['sistema', 'Sistema'],
    ['claro', 'Claro'],
    ['escuro', 'Escuro'],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {msg && (
        <div className="rounded-xl bg-emerald-100 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
          {msg}
        </div>
      )}

      <Cartao className="space-y-3">
        <h2 className="font-bold">Seus dados</h2>
        <Campo
          rotulo="Nome"
          value={config.nome ?? ''}
          onChange={(e) => void salvarConfig({ nome: e.target.value || undefined })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo
            rotulo="Idade"
            type="number"
            inputMode="numeric"
            value={config.idade}
            onChange={(e) => void salvarConfig({ idade: Number(e.target.value) || config.idade })}
          />
          <Campo
            rotulo="FC repouso (bpm)"
            type="number"
            inputMode="numeric"
            value={config.fcRepouso ?? ''}
            onChange={(e) =>
              void salvarConfig({ fcRepouso: Number(e.target.value) || undefined })
            }
          />
        </div>
        <Campo
          rotulo="Peso corporal (kg)"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={config.pesoCorporalKg ?? ''}
          onChange={(e) =>
            void salvarConfig({ pesoCorporalKg: Number(e.target.value) || undefined })
          }
          dica="Para registrar a evolução ao longo do tempo, use a aba Histórico › Peso corporal."
        />
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Fórmula da FCmáx
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => void salvarConfig({ metodoFcMax: 'tanaka' })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
                config.metodoFcMax === 'tanaka'
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'ring-slate-300 dark:ring-slate-700'
              }`}
            >
              Tanaka
            </button>
            <button
              onClick={() => void salvarConfig({ metodoFcMax: '220-idade' })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
                config.metodoFcMax === '220-idade'
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'ring-slate-300 dark:ring-slate-700'
              }`}
            >
              220 − idade
            </button>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={config.usarKarvonen}
            disabled={!config.fcRepouso}
            onChange={(e) => void salvarConfig({ usarKarvonen: e.target.checked })}
            className="h-5 w-5 rounded accent-emerald-600"
          />
          <span className={config.fcRepouso ? '' : 'text-slate-400'}>
            Calcular zonas por Karvonen (precisa da FC de repouso)
          </span>
        </label>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-bold">Durante o treino</h2>
        {(
          [
            ['manterTelaAcesa', 'Manter a tela acesa na corrida'],
            ['somAtivo', 'Bipes na troca de fase'],
            ['vibracaoAtiva', 'Vibração na troca de fase'],
          ] as [keyof ConfiguracoesUsuario, string][]
        ).map(([chave, rotulo]) => (
          <label key={chave} className="flex items-center justify-between gap-3 text-sm">
            <span>{rotulo}</span>
            <input
              type="checkbox"
              checked={Boolean(config[chave])}
              onChange={(e) => void salvarConfig({ [chave]: e.target.checked })}
              className="h-6 w-6 rounded accent-emerald-600"
            />
          </label>
        ))}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Tema
          </span>
          <div className="flex gap-2">
            {temas.map(([valor, rotulo]) => (
              <button
                key={valor}
                onClick={() => void salvarConfig({ tema: valor })}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
                  config.tema === valor
                    ? 'bg-emerald-600 text-white ring-emerald-600'
                    : 'ring-slate-300 dark:ring-slate-700'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-bold">Progresso</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Corrida: {progresso.corridaProximoIndice}/{totalCorridas} · Musculação:{' '}
          {progresso.musculacaoProximoIndice}/{totalTreinos}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Se registrou algo por engano, dá para voltar uma posição em cada trilha sem apagar o
          histórico.
        </p>
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            className="flex-1 text-sm"
            disabled={progresso.corridaProximoIndice === 0}
            onClick={async () => {
              await ajustarIndiceCorrida(progresso.corridaProximoIndice - 1);
              await atualizar();
              aviso('Voltei uma corrida.');
            }}
          >
            ← Corrida
          </Botao>
          <Botao
            variante="secundario"
            className="flex-1 text-sm"
            disabled={progresso.musculacaoProximoIndice === 0}
            onClick={async () => {
              await ajustarIndiceMusculacao(progresso.musculacaoProximoIndice - 1);
              await atualizar();
              aviso('Voltei um treino.');
            }}
          >
            ← Musculação
          </Botao>
        </div>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-bold">Backup</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Tudo fica só neste aparelho. Exporte de vez em quando para não perder o histórico se
          trocar de celular ou limpar os dados do navegador.
        </p>
        <Botao className="w-full" onClick={() => void baixarBackup()}>
          ⬇ Exportar backup (.json)
        </Botao>
        <Botao variante="secundario" className="w-full" onClick={() => arquivoRef.current?.click()}>
          ⬆ Importar backup
        </Botao>
        <input
          ref={arquivoRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void carregarBackup(arquivo);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Importar <strong>substitui</strong> os dados atuais deste aparelho.
        </p>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-bold">Vídeos de orientação</h2>
        {[
          ['Boas-vindas', plano.videos_orientacao.video_boas_vindas],
          ['Como ler a planilha de corrida', plano.videos_orientacao.video_como_ler_planilha_corrida],
          ['Como ler o treino de musculação', plano.videos_orientacao.video_como_ler_treino_musculacao],
        ].map(([titulo, url]) => (
          <Botao
            key={url}
            variante="secundario"
            className="w-full text-sm"
            onClick={() => setVideo({ url: urlEmbedYoutube(url), titulo })}
          >
            ▶ {titulo}
          </Botao>
        ))}
      </Cartao>

      <Cartao className="bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
        <h2 className="font-bold text-amber-900 dark:text-amber-200">Aviso de responsabilidade</h2>
        <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{plano.meta.aviso}</p>
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          {plano.meta.cref_responsavel} · {plano.meta.programa} · {plano.meta.nivel}
        </p>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-bold text-red-700 dark:text-red-400">Zona de perigo</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Apaga todo o histórico de corridas, treinos e pesos, e volta as duas trilhas para a
          semana 1. Suas configurações são mantidas.
        </p>
        <Botao variante="perigo" className="w-full" onClick={() => setConfirmarReset(1)}>
          Resetar progresso
        </Botao>
      </Cartao>

      {video && (
        <ModalVideo url={video.url} titulo={video.titulo} aoFechar={() => setVideo(null)} />
      )}

      {confirmarReset === 1 && (
        <Confirmacao
          titulo="Resetar todo o progresso?"
          descricao="Isso apaga o histórico das 12 semanas e não tem desfazer. Exporte um backup antes se tiver dúvida."
          textoConfirmar="Continuar"
          perigo
          aoConfirmar={() => setConfirmarReset(2)}
          aoCancelar={() => setConfirmarReset(0)}
        />
      )}
      {confirmarReset === 2 && (
        <Confirmacao
          titulo="Tem certeza mesmo?"
          descricao="Última confirmação: corridas, treinos, cargas e pesos serão apagados deste aparelho."
          textoConfirmar="Sim, apagar tudo"
          perigo
          aoConfirmar={async () => {
            await resetarProgresso();
            await atualizar();
            setConfirmarReset(0);
            aviso('Progresso resetado.');
          }}
          aoCancelar={() => setConfirmarReset(0)}
        />
      )}
    </div>
  );
}
