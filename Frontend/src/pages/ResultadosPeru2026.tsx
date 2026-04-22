import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ResultadosPeru2026() {
  const navigate = useNavigate();
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate('/', { replace: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [navigate]);

  useEffect(() => {
    document.title = 'Resultados en tiempo real de las elecciones Perú 2026 | ONPE Fetcher';
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = 'Consulta los resultados en tiempo real de las elecciones presidenciales Perú 2026. Datos oficiales ONPE actualizados minuto a minuto.';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1>Resultados en tiempo real de las elecciones Perú 2026</h1>
      <img
        src="/preview.png"
        alt="Vista previa resultados elecciones Perú 2026"
        style={{ maxWidth: '100%', height: 'auto', margin: '2rem auto', borderRadius: '12px', boxShadow: '0 2px 16px #0002' }}
        loading="eager"
      />
      <p>Redirigiendo al dashboard de resultados...</p>
    </div>
  );
}
