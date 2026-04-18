import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import CandidatosPage from './pages/CandidatosPage';
import HistorialPage from './pages/HistorialPage';
import PrediccionPage from './pages/PrediccionPage';
import AboutPage from './pages/AboutPage';
import APIPage from './pages/APIPage';
import UbigeoPage from './pages/UbigeoPage';
import ChatPage from './pages/ChatPage';
import NotFound from './pages/NotFound';

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

export default function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <div className="max-w-[1200px] mx-auto px-5 py-4">
        <Navbar />
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
        <div className="text-center mt-8 pt-6 pb-5 text-[10px] border-t" style={{ color: 'var(--tx0)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 flex-wrap">
            <span className="font-semibold">PIXL's ONPE Fetcher</span>
            <span>|</span>
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
            <span>|</span>
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
            <span>|</span>
            <span>Hosted On: </span>
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
      </div>
    </BrowserRouter>
  );
}
