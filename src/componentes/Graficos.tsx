// Gráficos em SVG puro — sem biblioteca externa, para o bundle seguir leve e
// funcionar offline sem depender de mais nada.

export interface Ponto {
  rotulo: string;
  valor: number;
}

export function GraficoLinha({
  pontos,
  unidade = '',
  cor = '#10b981',
  altura = 160,
}: {
  pontos: Ponto[];
  unidade?: string;
  cor?: string;
  altura?: number;
}) {
  if (pontos.length === 0) return null;
  const largura = 320;
  const margem = { topo: 12, base: 26, esq: 38, dir: 10 };
  const areaL = largura - margem.esq - margem.dir;
  const areaA = altura - margem.topo - margem.base;

  const valores = pontos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const intervalo = max - min || Math.max(1, max * 0.1);
  const baixo = min - intervalo * 0.15;
  const alto = max + intervalo * 0.15;

  const x = (i: number) =>
    margem.esq + (pontos.length === 1 ? areaL / 2 : (i / (pontos.length - 1)) * areaL);
  const y = (v: number) => margem.topo + areaA - ((v - baixo) / (alto - baixo)) * areaA;

  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.valor)}`).join(' ');
  const area = `${caminho} L ${x(pontos.length - 1)} ${margem.topo + areaA} L ${x(0)} ${
    margem.topo + areaA
  } Z`;

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img">
      <line
        x1={margem.esq}
        y1={margem.topo + areaA}
        x2={largura - margem.dir}
        y2={margem.topo + areaA}
        stroke="currentColor"
        className="text-slate-300 dark:text-slate-700"
      />
      <text x={4} y={y(max) + 4} className="fill-slate-500 text-[9px]">
        {formatarNumero(max)}
        {unidade}
      </text>
      <text x={4} y={y(min) + 4} className="fill-slate-500 text-[9px]">
        {formatarNumero(min)}
        {unidade}
      </text>
      <path d={area} fill={cor} opacity={0.12} />
      <path d={caminho} fill="none" stroke={cor} strokeWidth={2.5} strokeLinecap="round" />
      {pontos.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.valor)} r={3} fill={cor} />
      ))}
      {pontos.map((p, i) =>
        i === 0 || i === pontos.length - 1 || pontos.length <= 6 ? (
          <text
            key={`r${i}`}
            x={x(i)}
            y={altura - 8}
            textAnchor={i === 0 ? 'start' : i === pontos.length - 1 ? 'end' : 'middle'}
            className="fill-slate-500 text-[9px]"
          >
            {p.rotulo}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function GraficoBarras({
  pontos,
  unidade = '',
  cor = '#0ea5e9',
  altura = 150,
}: {
  pontos: Ponto[];
  unidade?: string;
  cor?: string;
  altura?: number;
}) {
  if (pontos.length === 0) return null;
  const largura = 320;
  const margem = { topo: 14, base: 22, esq: 34, dir: 6 };
  const areaL = largura - margem.esq - margem.dir;
  const areaA = altura - margem.topo - margem.base;
  const max = Math.max(...pontos.map((p) => p.valor)) || 1;
  const passo = areaL / pontos.length;
  const larguraBarra = Math.max(4, passo * 0.62);

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img">
      <text x={2} y={margem.topo + 4} className="fill-slate-500 text-[9px]">
        {formatarNumero(max)}
        {unidade}
      </text>
      <line
        x1={margem.esq}
        y1={margem.topo + areaA}
        x2={largura - margem.dir}
        y2={margem.topo + areaA}
        stroke="currentColor"
        className="text-slate-300 dark:text-slate-700"
      />
      {pontos.map((p, i) => {
        const h = (p.valor / max) * areaA;
        return (
          <g key={i}>
            <rect
              x={margem.esq + i * passo + (passo - larguraBarra) / 2}
              y={margem.topo + areaA - h}
              width={larguraBarra}
              height={Math.max(0, h)}
              rx={2}
              fill={cor}
              opacity={p.valor ? 0.9 : 0.15}
            />
            <text
              x={margem.esq + i * passo + passo / 2}
              y={altura - 6}
              textAnchor="middle"
              className="fill-slate-500 text-[8px]"
            >
              {p.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Heatmap estilo GitHub das últimas ~15 semanas de treino. */
export function Heatmap({ dias, semanas = 15 }: { dias: Map<string, number>; semanas?: number }) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + (6 - fim.getDay())); // fecha na semana corrente
  const colunas: Date[][] = [];
  for (let s = semanas - 1; s >= 0; s--) {
    const coluna: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const data = new Date(fim);
      data.setDate(fim.getDate() - s * 7 - (6 - d));
      coluna.push(data);
    }
    colunas.push(coluna);
  }
  const cor = (n: number) => {
    if (!n) return 'fill-slate-200 dark:fill-slate-800';
    if (n === 1) return 'fill-emerald-300 dark:fill-emerald-800';
    if (n === 2) return 'fill-emerald-500 dark:fill-emerald-600';
    return 'fill-emerald-700 dark:fill-emerald-400';
  };
  const lado = 12;
  const espaco = 3;

  return (
    <svg
      viewBox={`0 0 ${colunas.length * (lado + espaco)} ${7 * (lado + espaco)}`}
      className="w-full"
      role="img"
      aria-label="Calendário de dias treinados"
    >
      {colunas.map((coluna, ci) =>
        coluna.map((data, di) => {
          const chave = data.toISOString().slice(0, 10);
          const n = data > hoje ? 0 : dias.get(chave) ?? 0;
          return (
            <rect
              key={`${ci}-${di}`}
              x={ci * (lado + espaco)}
              y={di * (lado + espaco)}
              width={lado}
              height={lado}
              rx={3}
              className={data > hoje ? 'fill-transparent' : cor(n)}
            >
              <title>{`${data.toLocaleDateString('pt-BR')} — ${n} treino(s)`}</title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}

function formatarNumero(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}k`;
  return `${Math.round(v * 10) / 10}`;
}
