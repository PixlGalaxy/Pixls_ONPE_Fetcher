import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import CandidatosPage from './pages/CandidatosPage';
import HistorialPage from './pages/HistorialPage';
import PrediccionPage from './pages/PrediccionPage';
import AboutPage from './pages/AboutPage';
import APIPage from './pages/APIPage';
import UbigeoPage from './pages/UbigeoPage';
import NotFound from './pages/NotFound';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/mapa': 'Mapa',
  '/candidatos': 'Candidatos',
  '/prediccion': 'Predicción',
  '/historial': 'Historial',
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
          <Route path="/API_DOCS" element={<APIPage />} />
          <Route path="/ubigeo" element={<UbigeoPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <div className="text-center mt-8 pt-6 pb-5 text-[10px] border-t" style={{ color: 'var(--tx3)', borderColor: 'var(--border)' }}>
          <div>ONPE Fetcher | Desarrollado por {' '}
            <a
              href="https://github.com/PixlGalaxy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
              style={{ color: 'var(--c-rla)' }}
            >
              PixlGalaxy
            </a>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
