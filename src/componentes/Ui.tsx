import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Cartao({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${className}`}
    >
      {children}
    </div>
  );
}

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sucesso';

const estilosBotao: Record<VarianteBotao, string> = {
  primario: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700',
  secundario:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  perigo: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  fantasma:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

export function Botao({
  variante = 'primario',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      {...props}
      className={`min-h-12 rounded-xl px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${estilosBotao[variante]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  rotulo,
  dica,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {rotulo}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      {dica ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{dica}</span>
      ) : null}
    </label>
  );
}

export function Etiqueta({
  children,
  cor = 'slate',
}: {
  children: ReactNode;
  cor?: 'slate' | 'verde' | 'ambar' | 'azul' | 'roxo';
}) {
  const cores = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    verde: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    ambar: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    azul: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    roxo: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cores[cor]}`}>
      {children}
    </span>
  );
}

export function Barra({ valor, cor = 'bg-emerald-500' }: { valor: number; cor?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${cor}`}
        style={{ width: `${Math.min(100, Math.max(0, valor * 100))}%` }}
      />
    </div>
  );
}

export function AvisoDeload({ tipo }: { tipo: 'corrida' | 'musculacao' }) {
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
      <strong className="font-semibold">Semana de deload.</strong>{' '}
      {tipo === 'corrida'
        ? 'O volume de corrida cai de propósito nesta semana — é recuperação planejada, não atraso.'
        : 'As metas de repetição sobem e a carga alivia de propósito nesta semana — é a recuperação que fecha a fase.'}
    </div>
  );
}

export function ModalVideo({
  url,
  titulo,
  aoFechar,
}: {
  url: string;
  titulo: string;
  aoFechar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <h3 className="text-sm font-semibold text-slate-100">{titulo}</h3>
          <button
            onClick={aoFechar}
            className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800"
            aria-label="Fechar vídeo"
          >
            ✕
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            src={url}
            title={titulo}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

export function Confirmacao({
  titulo,
  descricao,
  textoConfirmar,
  aoConfirmar,
  aoCancelar,
  perigo,
}: {
  titulo: string;
  descricao: ReactNode;
  textoConfirmar: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  perigo?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <Cartao className="w-full max-w-md">
        <h3 className="text-lg font-bold">{titulo}</h3>
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{descricao}</div>
        <div className="mt-4 flex gap-2">
          <Botao variante="secundario" className="flex-1" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao
            variante={perigo ? 'perigo' : 'primario'}
            className="flex-1"
            onClick={aoConfirmar}
          >
            {textoConfirmar}
          </Botao>
        </div>
      </Cartao>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </div>
  );
}
