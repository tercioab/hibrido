# Time Híbrido Tracker

App pessoal (PWA, mobile-first) para seguir o programa **Time Híbrido — 12 semanas**
(corrida 3km + musculação 4×/semana) sem abrir o PDF.

```bash
npm install
npm run dev      # http://localhost:5173
```

Outros comandos: `npm test` (motor do cronômetro e calculadoras), `npm run build`,
`npm run preview`, `npm run sync:plano` (recopia o JSON da raiz para `src/dados/`).

## Como funciona

**Duas trilhas independentes e sequenciais.** As 12 semanas de corrida viram uma lista
achatada de 36 sessões e as de musculação, uma lista de 48 treinos. O progresso é um par de
ponteiros (`corridaProximoIndice`, `musculacaoProximoIndice`): o próximo treino é sempre
`lista[indice]` e só avança quando você conclui. Nada depende do dia real da semana — os
rótulos "3ª feira / Sábado" do PDF ficaram só como dado de origem.

**Dados.** `plano_time_hibrido.json` é seed somente-leitura, empacotado com o app (uma cópia
fica em `src/dados/` para o Vite incluir no bundle; use `npm run sync:plano` se editar o da
raiz). Tudo que o app grava — progresso, cargas, sessões, pesos — vive no IndexedDB via Dexie,
sem backend e sem login. Em Ajustes há exportar/importar backup `.json` e reset com dupla
confirmação.

## Estrutura

```
src/
  dados/      plano.ts (seed + listas achatadas + helpers), tipos.ts, plano_time_hibrido.json
  db/         db.ts (schema Dexie), repositorio.ts (CRUD, backup, reset)
  logica/     cronometro.ts (motor puro, testado), calculos.ts (FCmáx/zonas/1RM), *.test.ts
  hooks/      useCronometro, useApp (contexto), useWakeLock, useSinais (bip + vibração)
  componentes/ Ui.tsx, Graficos.tsx (SVG puro), TimerDescanso.tsx
  telas/      Onboarding, Dashboard, TelaCorrida, TelaTreino, Historico, Calculadoras, Configuracoes
```

### Cronômetro de corrida

`src/logica/cronometro.ts` não conhece React nem DOM: monta as fases da sessão
(`aquecimento → N × [correr, caminhar] → volta_calma`) e recalcula tudo a partir de
timestamps. Por isso não acumula deriva e atravessa várias fases de uma vez quando o
navegador congela o timer com a tela apagada — há testes cobrindo exatamente esses casos.
A prova final (semana 12) vira uma fase **livre**, cronometrando para cima até você tocar em
"concluir etapa", com celebração e registro de tempo/distância no fim.

Durante a sessão: fase em destaque com cor própria (verde correr, azul caminhar, âmbar
aquecer/volta à calma), zona alvo já convertida em bpm, "intervalo 3 de 7", barra da sessão
inteira, prévia da próxima fase, bipes (WebAudio) e vibração na troca, Wake Lock para a tela
não apagar — com aviso quando o navegador não suporta.

### Musculação

Cada exercício é um card com bloco/tipo, série×repetição (pirâmide "15-12-10-8" expandida por
série, "6+12" e dropset tratados à parte), vídeo do YouTube em modal, mini-timer de descanso,
e campos de peso/reps por série. O peso vem pré-preenchido com o último usado naquele
exercício; "Sugerir carga" estima o 1RM (Epley) do último registro e devolve o peso para a
meta de repetições de hoje. Ao bater todas as metas, o app sugere subir a carga. Bi-sets
(dois exercícios no mesmo bloco) aparecem agrupados com marca visual. O que você digita é
salvo como rascunho automaticamente, então dá para sair e continuar depois.

### Deload

Detectado dos dados, não fixado no código: na corrida quando o volume semanal cai mais de 10%
(semanas 4 e 8) e na musculação quando as metas de repetição sobem de volta — o que significa
carga mais leve — ao fim de cada fase (semanas 4, 8 e 12).

### Calculadoras

FCmáx por Tanaka (`208 − 0,7×idade`) ou clássica (`220 − idade`); zonas Z1–Z5 em bpm com os
percentuais do próprio JSON, opcionalmente por Karvonen se você informar a FC de repouso.
1RM por Epley e Brzycki, com tabela de 60–95% arredondada em 2,5 kg.

## Aviso

Conteúdo informativo, não substitui acompanhamento presencial. Programa de responsabilidade
técnica CREF-SC 025279 — o aviso completo fica sempre acessível em Ajustes.
# hibrido
