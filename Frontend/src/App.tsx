import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Navbar from './components/Navbar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapPage = lazy(() => import('./pages/MapPage'));
const CandidatosPage = lazy(() => import('./pages/CandidatosPage'));
const HistorialPage = lazy(() => import('./pages/HistorialPage'));
const PrediccionPage = lazy(() => import('./pages/PrediccionPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const APIPage = lazy(() => import('./pages/APIPage'));
const UbigeoPage = lazy(() => import('./pages/UbigeoPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/mapa': 'Mapa',
  '/candidatos': 'Candidatos',
  '/prediccion': 'Predicción',
  '/historial': 'Historial',
  '/chat': 'Asistente IA',
  '/about': 'Acerca de',
  '/API_DOCS': 'API Documentation',
  '/ubigeo': 'Códigos UBIGEO',
};

function TitleUpdater() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = PAGE_TITLES[pathname] ?? 'ONPE Fetcher';
    document.title = `${page} | ONPE Fetcher`;
  }, [pathname]);
  return null;
}

function Footer() {
  const { pathname } = useLocation();
  if (pathname === '/chat') return null;
  return (
    <div className="text-center mt-8 pt-6 pb-5 text-[10px] border-t" style={{ color: 'var(--tx0)', borderColor: 'var(--border)' }}>
      <div className="font-semibold mb-1.5">PIXL's ONPE Fetcher</div>
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1">
        <span>Developed By</span>
        <a
          href="https://github.com/PixlGalaxy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--c-rla)' }}
        >
          PixlGalaxy
          <ExternalLink size={10} />
        </a>
        <span className="opacity-30 hidden sm:inline">|</span>
        <span>© 2026</span>
        <a
          href="https://fabriziogamboa.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--c-rla)' }}
        >
          Fabrizio Gamboa
          <ExternalLink size={10} />
        </a>
        <span className="opacity-30 hidden sm:inline">|</span>
        <span>Hosted On:</span>
        <a
          href="https://itzgalaxy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--c-rla)' }}
        >
          ItzGalaxy.com
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <div className="max-w-[1200px] mx-auto px-5 py-4">
        <Navbar />
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/candidatos" element={<CandidatosPage />} />
            <Route path="/prediccion" element={<PrediccionPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/historial" element={<HistorialPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/API_DOCS" element={<APIPage />} />
            <Route path="/ubigeo" element={<UbigeoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
