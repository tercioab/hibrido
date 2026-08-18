# Prompt para o Claude Code — App "Time Híbrido Tracker"

> Como usar: crie uma pasta de projeto, coloque este arquivo e o `plano_time_hibrido.json`
> dentro dela, abra o Claude Code nessa pasta e cole o texto abaixo (a partir de "## Contexto")
> como seu primeiro prompt.

---

## Contexto

Tenho um programa de treino híbrido de 12 semanas (corrida 3km + musculação 4x/semana) chamado
"Time Híbrido", extraído de um PDF. Todos os dados já estão estruturados no arquivo
`plano_time_hibrido.json` (na raiz deste projeto). Quero que você construa um aplicativo web
pessoal (PWA, mobile-first) que eu vou usar na academia e durante as corridas para seguir esse
plano, sem precisar abrir o PDF.

Leia `plano_time_hibrido.json` inteiro antes de começar a codar. Ele contém:

- `meta`: nome do programa, objetivo, fases (Base/Consolidação/Alvo), semanas de cada fase.
- `zonas_fc`: descrição das zonas de frequência cardíaca Z1–Z5 (% da FCmáx).
- `corrida`: array com as 12 semanas do plano de corrida. Cada semana tem 3 sessões
  (`sessoes`), cada uma com aquecimento (5min Z1), N repetições de correr/caminhar em
  segundos e zona, e volta à calma (5min Z1). A sessão 3 da semana 12 é diferente: é a
  "prova alvo" — 3km contínuos, sem intervalos (`prova_final: true`, `corrida_continua`).
- `musculacao`: array com as 12 semanas de musculação. Cada semana tem 4 treinos (A, B, C, D),
  cada um com uma lista de exercícios: nome, bloco, tipo de bloco (meta de repetição, pirâmide,
  bi-set, dropset, tabata), séries, repetições (pode ser um número, um esquema tipo
  "15-12-10-8" ou "6+12", ou `null` para dropset/mobilidade), descanso sugerido, e o **link do
  vídeo do YouTube daquele exercício específico**.
- `videos_orientacao`: vídeos gerais de boas-vindas e explicação de como ler a planilha.
- `ferramentas_originais_referencia`: só para contexto — as calculadoras de FCmáx e 1RM
  originais eram um chatbot externo; você vai implementar o equivalente **dentro do app**
  (fórmulas abaixo).

**Importante sobre o formato dos dados**: os textos e nomes estão em português, com acentos.
Preserve a codificação UTF-8 em todo o app.

---

## Objetivo do app

Um app pessoal, uso individual (sem login/multi-usuário), que resolve 3 problemas que eu tenho
hoje com a planilha em PDF:

1. **Corrida por intervalos**: preciso de um cronômetro que me diga exatamente quando correr e
   quando caminhar, na zona certa, sem eu ter que ficar olhando pro PDF ou fazendo conta de
   cabeça.
2. **Progresso por sequência, não por dia da semana**: a planilha original organiza a corrida em
   "3ª feira / 5ª feira / Sábado". Isso não me serve — eu quero treinar quando der. O app deve
   sempre saber **qual é a minha próxima sessão** (de corrida e de musculação, cada uma com sua
   própria sequência independente) baseado no que eu já completei, não no dia real da semana.
3. **Acompanhamento de carga na musculação**: preciso registrar o peso que uso em cada exercício,
   ver o vídeo explicativo de cada um, e enxergar minha evolução ao longo das 12 semanas.

---

## Stack técnica recomendada

- **React + Vite + TypeScript + Tailwind CSS**.
- **PWA** (manifest + service worker) para eu poder "adicionar à tela inicial" do celular e usar
  offline na academia/rua (conectividade ruim é comum nesses lugares).
- **Persistência 100% local** (IndexedDB, ex. via `idb` ou `Dexie.js` — não localStorage puro,
  porque o histórico de cargas ao longo de 12 semanas pode crescer). Não precisa de backend nem
  autenticação.
- **Botão de exportar/importar backup** (JSON) dos meus dados de progresso — como tudo é local,
  preciso de uma forma de não perder o histórico se trocar de celular ou limpar o cache.
- Carregue `plano_time_hibrido.json` como dado estático "seed" (não editável pelo usuário) que
  fica junto do app; os dados que o app grava (progresso, pesos, sessões concluídas) ficam
  separados, no IndexedDB.
- Mobile-first, mas usável também em desktop. Botões grandes, fácil de tocar durante o treino
  (mão suada, sem querer errar o toque).

---

## Modelo de dados de progresso (o que o app precisa gravar)

Além do `plano_time_hibrido.json` (somente leitura), defina algo como:

```ts
// Ponteiro de progresso — cada trilha (corrida/musculação) avança independentemente
interface Progresso {
  corridaProximoIndice: number;      // índice sequencial 0..35 dentro do array achatado de sessões de corrida
  musculacaoProximoIndice: number;   // índice sequencial 0..47 dentro do array achatado de treinos (A,B,C,D x 12 semanas)
}

interface SessaoCorridaConcluida {
  id: string;
  indiceSequencial: number;
  semana: number;
  ordemNaSemana: number;
  dataHora: string;               // ISO
  duracaoTotalSeg: number;
  completoAteOFim: boolean;       // permite marcar treino interrompido
  distanciaKm?: number;           // opcional, principalmente pra prova final
  observacoes?: string;
}

interface SerieRegistrada {
  numeroSerie: number;
  pesoKg: number | null;
  repeticoesFeitas: number | null;
}

interface ExercicioRegistrado {
  exercicioId: string;   // semana+treino+bloco+nome, determinístico
  nome: string;
  series: SerieRegistrada[];
}

interface TreinoMuscConcluido {
  id: string;
  indiceSequencial: number;
  semana: number;
  letraTreino: "A" | "B" | "C" | "D";
  dataHora: string;
  exercicios: ExercicioRegistrado[];
  observacoes?: string;
}

interface ConfiguracoesUsuario {
  nome?: string;
  idade: number;                       // necessário pro cálculo de FCmáx
  fcRepouso?: number;                  // opcional, habilita fórmula de Karvonen
  pesoCorporalKg?: number;
  metodoFcMax: "tanaka" | "220-idade" | "karvonen";
}

interface RegistroPesoCorporal {
  data: string;
  pesoKg: number;
}
```

"Achatar" `corrida` (12 semanas × 3 sessões = 36) e `musculacao` (12 semanas × 4 treinos = 48)
em listas sequenciais únicas, na ordem natural do JSON (semana 1→12, dentro da semana na ordem
que já vem). O "próximo treino" é sempre `lista[progresso.indice]`. Ao concluir, incrementa o
índice. Isso implementa exatamente o requisito de "pegar de onde parei" em vez de depender do
dia da semana real.

---

## Telas e funcionalidades

### 1. Onboarding (primeira vez que abre o app)
- Nome (opcional), idade (obrigatório, usado no cálculo de FCmáx), peso corporal atual
  (opcional), frequência cardíaca de repouso (opcional).
- Mostrar rapidamente o vídeo de boas-vindas (`videos_orientacao.video_boas_vindas`) e o aviso
  de responsabilidade que está em `meta.aviso` / `meta.cref_responsavel`.
- Ao final, calcular e mostrar a FCmáx e as zonas Z1–Z5 em BPM (ver fórmulas abaixo).

### 2. Dashboard / Início
- Card "Fase atual" (Base / Consolidação / Alvo) com a semana atual dentro da fase (ex.
  "Semana 6 de 12 — Etapa Consolidação").
- Card "Próxima sessão de corrida" com resumo (ex. "Intervalado 1:2 — 6x correr 60s / caminhar
  120s") e botão "Iniciar corrida".
- Card "Próximo treino de musculação" com resumo (ex. "Treino B — Costas e Tríceps, 7
  exercícios") e botão "Iniciar treino".
- Indicador de progresso geral: X de 36 corridas concluídas, Y de 48 treinos concluídos.
- Pequeno gráfico/streak de dias treinados nas últimas semanas (motivacional).

### 3. Cronômetro de corrida (o "conômetro especial" pedido)
Ao abrir a próxima sessão de corrida, montar automaticamente a sequência de fases a partir dos
dados da sessão (`aquecimento` → repetir `repeticoes` vezes [`correr` → `caminhar`] →
`volta_calma`). Para a sessão de prova final (`prova_final: true`), o fluxo é diferente (ver
abaixo).

Tela do cronômetro:
- Fase atual em destaque bem grande: **AQUECER**, **CORRER** ou **CAMINHAR** (cores diferentes
  por fase — sugiro verde para correr, azul para caminhar, amarelo para aquecer/volta à calma).
- Contagem regressiva em MM:SS da fase atual.
- Zona alvo da fase atual (ex. "Z3 · 70–79% FCmáx · 130–148 bpm", calculado a partir da FCmáx do
  usuário).
- Indicador "intervalo 3 de 7" durante o bloco principal.
- Barra de progresso da sessão inteira.
- Próxima fase (preview pequeno, tipo "a seguir: caminhar 90s").
- Vibração do celular (Vibration API) + som simples ao trocar de fase (ex. 2 bips ao entrar em
  "correr", 1 bip ao entrar em "caminhar"). Tem que funcionar com a tela bloqueada/apagada, então
  use Wake Lock API para manter a tela acesa durante a corrida (ou pelo menos avise o usuário
  disso).
- Botões: pausar/retomar, pular fase, encerrar sessão.
- Ao terminar (ou encerrar manualmente), salvar `SessaoCorridaConcluida` e avançar
  `corridaProximoIndice`.

**Sessão de prova final (semana 12, domingo)**: em vez do timer de intervalos, mostrar um
cronômetro simples: 5 min de aquecimento (Z1) → cronômetro correndo livre marcando o tempo
enquanto o usuário corre os 3km (com campo pra digitar a distância percorrida se quiser
conferir no relógio/app de corrida dele) → 5 min de volta à calma. Ao final, pedir pra
confirmar/editar o tempo total e mostrar uma tela de celebração (é a meta do programa!).

### 4. Treino de musculação
Lista dos exercícios do treino do dia (sequencial, não por letra fixa), cada um em um "card"
expansível:
- Nome do exercício, bloco (nº e tipo, ex. "Bloco 05 — Pirâmide"), série×repetição alvo (ex.
  "4×12" ou "4× 15-12-10-8" ou "4× dropset").
- Descanso sugerido entre séries (`descanso_sugerido`) com um mini-timer de descanso
  (contagem regressiva) que o usuário pode iniciar tocando um botão depois de cada série.
- Botão/thumbnail "▶ Ver vídeo" que abre o `video` do exercício (embutido em modal com
  `<iframe>` do YouTube, ou abre em nova aba — prefira modal embutido pra não sair do fluxo do
  treino).
- Campos para registrar, por série: peso (kg) e repetições feitas. Pré-preencher o peso com o
  último peso usado nesse mesmo exercício (buscar no histórico), como sugestão editável.
- Botão "sugerir carga" que usa a fórmula de 1RM (abaixo) sobre o último registro desse
  exercício pra sugerir um peso de trabalho pra hoje, considerando a meta de repetições da
  semana atual.
- Ao concluir todos os exercícios (ou parte, com opção de sair e continuar depois), salvar
  `TreinoMuscConcluido` e avançar `musculacaoProximoIndice`.

Trate exercícios de bi-set (dois nomes vindos do mesmo bloco, ex. "Cadeira Abdutora" +
"Panturrilha em pé") como dois cards adjacentes com uma indicação visual de que são feitos em
sequência sem descanso entre eles.

### 5. Histórico e evolução
- Por exercício: gráfico de peso ao longo do tempo (todas as sessões em que ele apareceu),
  volume total (séries × reps × peso) por semana.
- Por corrida: histórico de sessões (duração, tipo de intervalo, data), e destaque pra prova
  final quando for concluída.
- Peso corporal ao longo do tempo (gráfico simples), se o usuário registrar.
- Calendário/heatmap de dias treinados (motivacional, estilo GitHub contributions).

### 6. Calculadoras (substituem as ferramentas externas do PDF)
Tela (ou seção nas configurações) com:

**Calculadora de FCmáx e zonas**, usando a idade cadastrada:
- Fórmula padrão: `FCmax = 208 - (0.7 * idade)` (fórmula de Tanaka, mais precisa que 220-idade).
  Oferecer também a opção clássica `220 - idade` como alternativa.
- Se o usuário informar FC de repouso, oferecer o método de Karvonen para calcular as zonas
  (mais preciso): `FC_zona = ((FCmax - FCrepouso) * %intensidade) + FCrepouso`.
- Mostrar tabela Z1–Z5 em BPM baseada em `zonas_fc` do JSON (as porcentagens já estão lá).

**Calculadora de 1RM (repetição máxima)**:
- Fórmula de Epley: `1RM = peso * (1 + repeticoes / 30)`.
- Mostrar também Brzycki como alternativa: `1RM = peso * 36 / (37 - repeticoes)`.
- A partir do 1RM calculado, mostrar uma tabelinha de % de carga sugerida (ex. 60%, 70%, 80%,
  90% do 1RM) pra ajudar a escolher peso em exercícios com meta de repetição diferente.
- Essa calculadora deve poder ser usada tanto isoladamente (o usuário digita peso e reps de
  qualquer exercício) quanto automaticamente dentro da tela de treino (botão "sugerir carga"
  mencionado acima).

### 7. Configurações
- Editar idade, peso corporal, FC de repouso, método de cálculo de FCmáx preferido.
- Exportar backup (baixa um `.json` com todo o progresso).
- Importar backup.
- Botão "resetar progresso" (com confirmação clara, dupla checagem — é uma ação destrutiva).
- Link pros vídeos de orientação geral (`videos_orientacao`).
- Aviso de responsabilidade (`meta.aviso`, `meta.cref_responsavel`) sempre acessível.

---

## Funcionalidades extras que acho que vão te ajudar (inclua também)

1. **Modo "hoje é dia de quê"**: como corrida e musculação avançam em sequências
   independentes, no dashboard deixe claro que são duas trilhas separadas — a pessoa pode fazer
   3 corridas numa semana e só 1 treino de musculação, sem travar uma na outra.
2. **Alertas de deload**: quando a próxima sessão pertencer a uma semana marcada como final de
   fase com queda no volume/repetição em relação à semana anterior (ex. semana 4, 8), mostrar um
   aviso tipo "essa semana é de deload — o volume cai de propósito, é normal, faz parte da
   recuperação".
3. **Confirmação de progressão de carga**: se, ao registrar uma série, o usuário bater a meta de
   repetições em todas as séries, sugerir no fim do exercício "você completou todas as reps —
   considere subir a carga na próxima sessão" (progressão dupla simples, sem precisar de nada
   automático além de um aviso).
4. **PWA instalável** com ícone e nome "Time Híbrido" (ou o nome que preferir), splash screen,
   funciona offline depois do primeiro carregamento.
5. **Modo escuro** (provável uso de manhã cedo ou à noite).

---

## O que NÃO fazer

- Não crie sistema de login/conta/servidor — é um app pessoal, uso local.
- Não tente geolocalizar/mapear a corrida (GPS de rota) — está fora de escopo; o cronômetro de
  intervalos é o que importa aqui, não um app de mapeamento tipo Strava.
- Não invente exercícios, pesos ou vídeos que não estejam em `plano_time_hibrido.json` — use os
  dados exatamente como estão lá.
- Não trave o app supondo que hoje é um dia específico da semana — a lógica é 100% sequencial,
  conforme explicado acima.

---

## Entregável

Estrutura de projeto Vite padrão, rodável com `npm install && npm run dev`. Pode organizar os
componentes como achar melhor, mas separe claramente: camada de dados (leitura do JSON seed +
IndexedDB), lógica do cronômetro (idealmente isolada/testável, já que é a parte mais sensível a
bugs de tempo), e telas/UI.

Comece confirmando que leu `plano_time_hibrido.json`, me mostre um resumo rápido de como você
entendeu a estrutura de dados, depois monte o projeto.
