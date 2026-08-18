import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './hooks/useApp';
import Onboarding from './telas/Onboarding';
import Dashboard from './telas/Dashboard';
import TelaCorrida from './telas/TelaCorrida';
import TelaTreino from './telas/TelaTreino';
import Historico from './telas/Historico';
import Calculadoras from './telas/Calculadoras';
import Configuracoes from './telas/Configuracoes';

const abas = [
  { para: '/', rotulo: 'Início', icone: '🏠' },
  { para: '/historico', rotulo: 'Histórico', icone: '📈' },
  { para: '/calculadoras', rotulo: 'Cálculos', icone: '🧮' },
  { para: '/configuracoes', rotulo: 'Ajustes', icone: '⚙️' },
];

export default function App() {
  const { carregando, config } = useApp();
  const local = useLocation();
  const emSessao = local.pathname.startsWith('/corrida') || local.pathname.startsWith('/treino');

  if (carregando) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Carregando seu plano…
      </div>
    );
  }

  if (!config.onboardingConcluido) return <Onboarding />;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <main className={`flex-1 ${emSessao ? '' : 'px-4 pt-4 pb-28'}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/corrida/:indice" element={<TelaCorrida />} />
          <Route path="/treino/:indice" element={<TelaTreino />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/calculadoras" element={<Calculadoras />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!emSessao && (
        <nav className="pb-segura fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-2xl justify-around border-t border-slate-200 bg-white/95 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          {abas.map((aba) => (
            <NavLink
              key={aba.para}
              to={aba.para}
              end={aba.para === '/'}
              className={({ isActive }) =>
                `flex min-w-20 flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <span className="text-xl leading-none">{aba.icone}</span>
              {aba.rotulo}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
