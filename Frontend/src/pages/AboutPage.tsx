import { useEffect, useState } from 'react';
import { GitBranch, ExternalLink, Users2, Wrench, Server } from 'lucide-react';
import SeoBlock from '../components/SeoBlock';

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export default function AboutPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/PixlGalaxy/Pixls_ONPE_Fetcher/contributors',
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch contributors');
        const data = await response.json();
        setContributors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar colaboradores');
        console.error('Error fetching contributors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  const stack = {
    frontend: [
      { name: 'React', version: '19.2.4' },
      { name: 'TypeScript', version: '6.0.2' },
      { name: 'Vite', version: '8.0.4' },
      { name: 'React Router', version: '7.14.1' },
      { name: 'Tailwind CSS', version: '4.2.2' },
      { name: 'Lucide Icons', version: '1.8.0' },
      { name: 'D3-geo', version: '3.1.1' },
      { name: 'Lightweight Charts', version: '4.2.3' },
    ],
    backend: [
      { name: 'Python', version: '3.x' },
      { name: 'FastAPI', version: '-' },
      { name: 'Uvicorn', version: '-' },
      { name: 'APScheduler', version: '-' },
    ],
    devops: [
      { name: 'Docker', version: '-' },
      { name: 'Nginx', version: '-' },
    ],
  };

  return (
    <div className="min-h-screen py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--tx1)' }}>
          Acerca de PIXL's ONPE Fetcher
        </h1>
        <p className="text-lg mb-6" style={{ color: 'var(--tx2)' }}>
          Una WebApp para visualizar y analizar datos electorales en tiempo real.
        </p>
      </div>

      {/* Colaboración Section */}
      <div
        className="rounded-lg p-8 mb-12 border"
        style={{
          backgroundColor: 'var(--bg-alt)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <GitBranch size={24} style={{ color: 'var(--c-rla)' }} />
          <h2 className="text-2xl font-bold" style={{ color: 'var(--tx1)' }}>
            ¿Quieres colaborar?
          </h2>
        </div>
        <p className="mb-4" style={{ color: 'var(--tx2)' }}>
          Este proyecto es de código abierto y buscamos colaboradores apasionados por la democracia electoral. 
          Si tienes ideas, mejoras o quieres ayudar, ¡nos encantaría tenerte en el equipo!
        </p>
        <a
          href="https://github.com/PixlGalaxy/Pixls_ONPE_Fetcher"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--c-rla)',
            color: 'var(--bg)',
          }}
        >
          <GitBranch size={18} />
          Ver Repositorio
          <ExternalLink size={16} />
        </a>
      </div>

      {/* Developers Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Users2 size={28} />
          Desarrolladores y Colaboradores
        </h2>

        {loading && (
          <div className="text-center py-12" style={{ color: 'var(--tx2)' }}>
            Cargando colaboradores...
          </div>
        )}

        {error && (
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: '#fee',
              color: '#c33',
            }}
          >
            No se pudieron cargar los colaboradores: {error}
          </div>
        )}

        {!loading && !error && contributors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contributors.map((contributor) => (
              <a
                key={contributor.login}
                href={contributor.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-4 rounded-lg border transition-all hover:scale-105"
                style={{
                  backgroundColor: 'var(--bg-alt)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h3
                      className="font-semibold group-hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--c-rla)' }}
                    >
                      {contributor.login}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--tx2)' }}>
                      {contributor.contributions} contribuciones
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Tech Stack Section */}
      <div>
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Wrench size={28} />
          Stack
        </h2>

        {/* Frontend Stack */}
        <div className="mb-8">
          <h3
            className="text-xl font-semibold mb-4 pb-2 border-b"
            style={{
              color: 'var(--c-rla)',
              borderColor: 'var(--border)',
            }}
          >
            Frontend
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stack.frontend.map((tech) => (
              <div
                key={tech.name}
                className="p-3 rounded-lg border text-center"
                style={{
                  backgroundColor: 'var(--bg-alt)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: 'var(--tx1)' }}>
                  {tech.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--tx2)' }}>
                  {tech.version}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Backend Stack */}
        <div className="mb-8">
          <h3
            className="text-xl font-semibold mb-4 pb-2 border-b"
            style={{
              color: 'var(--c-rla)',
              borderColor: 'var(--border)',
            }}
          >
            Backend
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stack.backend.map((tech) => (
              <div
                key={tech.name}
                className="p-3 rounded-lg border text-center"
                style={{
                  backgroundColor: 'var(--bg-alt)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: 'var(--tx1)' }}>
                  {tech.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--tx2)' }}>
                  {tech.version}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DevOps Stack */}
        <div>
          <h3
            className="text-xl font-semibold mb-4 pb-2 border-b"
            style={{
              color: 'var(--c-rla)',
              borderColor: 'var(--border)',
            }}
          >
            DevOps & Infraestructura
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stack.devops.map((tech) => (
              <div
                key={tech.name}
                className="p-3 rounded-lg border text-center"
                style={{
                  backgroundColor: 'var(--bg-alt)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: 'var(--tx1)' }}>
                  {tech.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--tx2)' }}>
                  {tech.version}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hosting Section */}
      <div
        className="rounded-lg p-8 mt-12 border"
        style={{
          backgroundColor: 'var(--bg-alt)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Server size={24} style={{ color: 'var(--c-rla)' }} />
          <h2 className="text-2xl font-bold" style={{ color: 'var(--tx1)' }}>
            Infraestructura
          </h2>
        </div>
        <p className="mb-2" style={{ color: 'var(--tx2)' }}>
          Este proyecto está hosteado en{' '}
          <a
            href="https://itzgalaxy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:opacity-80 transition-opacity"
            style={{ color: 'var(--c-rla)' }}
          >
            ItzGalaxy Web Services
          </a>{' '}
          en{' '}
          <a
            href="https://itzgalaxy.com/about"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:opacity-80 transition-opacity"
            style={{ color: 'var(--c-rla)' }}
          >
            Zaylar Server
          </a>
        </p>
      </div>
      <SeoBlock>
        <h1>Acerca de PIXL's ONPE Fetcher</h1>
        <p>
          PIXL's ONPE Fetcher es una plataforma de código abierto para visualizar en tiempo real los
          resultados de las elecciones presidenciales Perú 2026. Desarrollada para ofrecer
          transparencia y acceso a los datos oficiales de la ONPE de manera clara y actualizada.
        </p>
        <h2>Tecnología y equipo</h2>
        <ul>
          <li>Datos en tiempo real de la ONPE oficial</li>
          <li>Código abierto disponible en GitHub</li>
          <li>Desarrollado por la comunidad peruana</li>
          <li>Actualizaciones automáticas de la ONPE</li>
        </ul>
      </SeoBlock>
    </div>
  );
}
