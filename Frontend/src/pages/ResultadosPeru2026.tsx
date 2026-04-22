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
    const metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    metaDescription.content = 'Consulta los resultados en tiempo real de las elecciones presidenciales Perú 2026. Datos oficiales ONPE actualizados minuto a minuto.';
    document.head.appendChild(metaDescription);

    const ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.content = 'Resultados en tiempo real de las elecciones Perú 2026';
    document.head.appendChild(ogTitle);

    const ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    ogDesc.content = 'Consulta los resultados en tiempo real de las elecciones presidenciales Perú 2026. Datos oficiales ONPE actualizados minuto a minuto.';
    document.head.appendChild(ogDesc);

    const ogImg = document.createElement('meta');
    ogImg.setAttribute('property', 'og:image');
    ogImg.content = 'https://devapp.zaylar.com/preview.png';
    document.head.appendChild(ogImg);

    const ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    ogUrl.content = 'https://devapp.zaylar.com/resultados-elecciones-peru-2026';
    document.head.appendChild(ogUrl);

    const twitterCard = document.createElement('meta');
    twitterCard.setAttribute('name', 'twitter:card');
    twitterCard.content = 'summary_large_image';
    document.head.appendChild(twitterCard);

    const twitterTitle = document.createElement('meta');
    twitterTitle.setAttribute('name', 'twitter:title');
    twitterTitle.content = 'Resultados en tiempo real de las elecciones Perú 2026';
    document.head.appendChild(twitterTitle);

    const twitterDesc = document.createElement('meta');
    twitterDesc.setAttribute('name', 'twitter:description');
    twitterDesc.content = 'Consulta los resultados en tiempo real de las elecciones presidenciales Perú 2026. Datos oficiales ONPE actualizados minuto a minuto.';
    document.head.appendChild(twitterDesc);

    const twitterImg = document.createElement('meta');
    twitterImg.setAttribute('name', 'twitter:image');
    twitterImg.content = 'https://devapp.zaylar.com/preview.png';
    document.head.appendChild(twitterImg);

    return () => {
      document.head.removeChild(metaDescription);
      document.head.removeChild(ogTitle);
      document.head.removeChild(ogDesc);
      document.head.removeChild(ogImg);
      document.head.removeChild(ogUrl);
      document.head.removeChild(twitterCard);
      document.head.removeChild(twitterTitle);
      document.head.removeChild(twitterDesc);
      document.head.removeChild(twitterImg);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1>Resultados en tiempo real de las elecciones Perú 2026</h1>
      <p>Redirigiendo al dashboard de resultados...</p>
    </div>
  );
}
