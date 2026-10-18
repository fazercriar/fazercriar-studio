import { Cloud, Home as HomeIcon, Library as LibraryIcon, Settings as SettingsIcon } from 'lucide-react';
import { getModel } from '../models/registry';
import { AppProvider, useApp } from './AppState';
import { Logo } from './components/Logo';
import { useRoute } from './router';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Studio } from './pages/Studio';
import { SettingsPage } from './pages/SettingsPage';
import { FrameEditor } from './pages/FrameEditor';

function Header({ section }: { section: string }) {
  const { sync } = useApp();
  const link = (hash: string, id: string, label: string, Icon: typeof HomeIcon) => (
    <a href={hash} className={`nav-link ${section === id ? 'active' : ''}`}>
      <Icon size={16} />
      <span>{label}</span>
    </a>
  );
  return (
    <header className="header">
      <a href="#/" className="header-brand" aria-label="Início">
        <Logo size={24} />
        <span className="header-product">Studio</span>
      </a>
      <nav className="nav">
        {sync === 'cloud' && (
          <span className="sync-chip" title="Configurações, projetos e molduras ficam salvos na sua conta e aparecem em qualquer aparelho">
            <Cloud size={14} />
            <span>Sincronizado</span>
          </span>
        )}
        {link('#/', 'inicio', 'Início', HomeIcon)}
        {link('#/biblioteca', 'biblioteca', 'Biblioteca', LibraryIcon)}
        {link('#/config', 'config', 'Configurações', SettingsIcon)}
      </nav>
    </header>
  );
}

function Routes() {
  const { ready, loadError } = useApp();
  const { path, query } = useRoute();
  const section = path[0] === 'estudio' || path[0] === 'biblioteca' ? 'biblioteca' : path[0] === 'config' || path[0] === 'molduras' ? 'config' : 'inicio';
  const fullHeight = path[0] === 'estudio' || path[0] === 'molduras';

  let page: React.ReactNode;
  if (loadError) page = <div className="page"><p className="notice error">{loadError}</p></div>;
  else if (!ready) page = <div className="loading"><div className="spinner" /> Carregando fontes…</div>;
  else if (path[0] === 'estudio' && path[1] && getModel(path[1])) {
    const projeto = query.get('projeto') ?? undefined;
    const initial = Object.fromEntries([...query.entries()].filter(([k]) => k !== 'projeto'));
    page = <Studio key={`${path[1]}:${projeto ?? ''}:${query.toString()}`} modelId={path[1]} projectId={projeto} initialParams={initial} />;
  } else if (path[0] === 'molduras') {
    const editId = path[1] === 'editar' ? path[2] : undefined;
    page = <FrameEditor key={editId ?? 'nova'} editId={editId} />;
  } else if (path[0] === 'biblioteca' || path[0] === 'estudio') page = <Library />;
  else if (path[0] === 'config') page = <SettingsPage />;
  else page = <Home />;

  return (
    <div className={`app ${fullHeight ? 'app-studio' : ''}`}>
      <Header section={section} />
      {page}
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Routes />
    </AppProvider>
  );
}
