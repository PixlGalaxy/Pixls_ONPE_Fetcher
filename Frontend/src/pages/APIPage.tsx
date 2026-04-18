import { Copy, CheckCircle2, Zap, Terminal, Database, MessageSquare, Package, ChevronDown, MapPin } from 'lucide-react';
import { useState } from 'react';
import SeoBlock from '../components/SeoBlock';
import { Link } from 'react-router-dom';
import { API_BASE } from '../types/election';

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  examplePath: string;
  params?: string;
  details?: string[];
  responseExample?: string;
}

export default function APIPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const baseUrl = `${window.location.origin}${API_BASE}`;

  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const endpoints: Endpoint[] = [
    {
      method: 'GET',
      path: '/status',
      description: 'Obtiene el estado actual del servidor y metadatos de las elecciones',
      examplePath: '/status',
      details: [
        'Devuelve el estado del scheduler y metadatos de cada elección monitoreada.',
        'Incluye last_actas_pct, last_snapshot_time y snapshot_count por elección.',
        'Útil para verificar si el servidor está activo y cuándo fue la última actualización.',
      ],
      responseExample: `{
  "api": "ONPE Election Data API",
  "version": "1.0.0",
  "status": "running",
  "last_full_fetch": "2026-04-17T20:00:00Z",
  "elections": {
    "presidential": {
      "last_actas_pct": 93.409,
      "last_snapshot_time": "2026-04-17T...",
      "snapshot_count": 117
    }
  }
}`,
    },
    {
      method: 'GET',
      path: '/elections',
      description: 'Obtiene la lista de elecciones disponibles con sus etiquetas e IDs de ONPE',
      examplePath: '/elections',
      details: [
        'Devuelve todas las elecciones configuradas con su label y election_id de ONPE.',
        'Claves disponibles: presidential (Fórmula Presidencial, ID 10), senate_national (Cámara de Senadores Nacional, ID 15), parlamento_andino (Parlamento Andino, ID 12).',
      ],
      responseExample: `{
  "presidential": {
    "label": "Fórmula Presidencial",
    "election_id": 10
  },
  "senate_national": {
    "label": "Cámara de Senadores – DEU",
    "election_id": 15
  },
  "parlamento_andino": {
    "label": "Parlamento Andino",
    "election_id": 12
  }
}`,
    },
    {
      method: 'GET',
      path: '/elections/{election_key}',
      description: 'Obtiene datos actuales de una elección específica',
      examplePath: '/elections/presidential',
      params: 'election_key: presidential, senate_national, parlamento_andino',
      details: [
        'Retorna el snapshot más reciente con actas contabilizadas, participación ciudadana y lista de candidatos rankeados.',
        'Campos de actas: actas_contabilizadas_pct, actas_contabilizadas, actas_total, actas_pendientes, actas_enviadas_jee, total_votes_cast, total_valid_votes, citizen_participation_pct.',
        'Cada candidato incluye: rank, candidate_id, name, party, votes, percentage.',
      ],
      responseExample: `{
  "election": "presidential",
  "label": "Fórmula Presidencial",
  "scope": "national",
  "snapshot_time": "2026-04-17T...",
  "actas": {
    "actas_contabilizadas_pct": 93.409,
    "actas_contabilizadas": 86652,
    "actas_total": 92766,
    "total_votes_cast": 18897939,
    "citizen_participation_pct": 69.159
  },
  "candidates": [
    { "rank": 1, "name": "...", "party": "...", "votes": 2686992, "percentage": 17.056 }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/elections/{election_key}/history',
      description: 'Obtiene el historial completo de snapshots de una elección',
      examplePath: '/elections/presidential/history',
      params: 'election_key: presidential, senate_national, parlamento_andino',
      details: [
        'Retorna todos los snapshots históricos guardados. Solo se guarda un nuevo snapshot cuando cambia el porcentaje de actas contabilizadas.',
        'Cada snapshot tiene la misma estructura que /elections/{election_key}.',
        'Útil para graficar la evolución de los resultados a lo largo del conteo.',
      ],
      responseExample: `{
  "election": "presidential",
  "snapshots": [
    { "snapshot_time": "...", "actas": { "actas_contabilizadas_pct": 76.444, ... }, "candidates": [...] },
    { "snapshot_time": "...", "actas": { "actas_contabilizadas_pct": 77.918, ... }, "candidates": [...] }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/elections/{election_key}/timeline',
      description: 'Obtiene la línea de tiempo consolidada para gráficos',
      examplePath: '/elections/presidential/timeline',
      params: 'election_key: presidential, senate_national, parlamento_andino',
      details: [
        'Formato optimizado para gráficos. Rastrea los top 5 candidatos con claves cortas (ej: "fuji", "rla", "nieto").',
        'Cada corte (cut) incluye: timestamp, actas_pct, contabilizadas, votos_emitidos y porcentajes por candidato.',
        'Incluye candidate_info con el mapeo de claves cortas a nombre completo y partido.',
        'Actualmente solo disponible para la elección presidencial.',
      ],
      responseExample: `{
  "total_actas": 92766,
  "candidate_info": {
    "fuji": { "name": "KEIKO SOFIA FUJIMORI HIGUCHI", "party": "FUERZA POPULAR" },
    "rla": { "name": "...", "party": "RENOVACIÓN POPULAR" }
  },
  "cuts": [
    { "ts": "...", "actas_pct": 76.444, "candidates": { "fuji": 16.88, "rla": 12.741 } }
  ]
}`,
    },
    {
      method: 'GET',
      path: '/geographic/regions',
      description: 'Obtiene datos de todas las regiones (departamentos)',
      examplePath: '/geographic/regions',
      params: 'Query opcional: ?election=presidential (default: presidential)',
      details: [
        'Retorna un objeto con todas las regiones indexadas por código UBIGEO.',
        'Cada región contiene actas y candidatos con la misma estructura que el endpoint nacional.',
        'Los 25 departamentos disponibles son:',
        '010000 Amazonas, 020000 Áncash, 030000 Apurímac, 040000 Arequipa, 050000 Ayacucho,',
        '060000 Cajamarca, 070000 Cusco, 080000 Huancavelica, 090000 Huánuco, 100000 Ica,',
        '110000 Junín, 120000 La Libertad, 130000 Lambayeque, 140000 Lima, 150000 Loreto,',
        '160000 Madre de Dios, 170000 Moquegua, 180000 Pasco, 190000 Piura, 200000 Puno,',
        '210000 San Martín, 220000 Tacna, 230000 Tumbes, 240000 Callao, 250000 Ucayali.',
      ],
      responseExample: `{
  "election": "presidential",
  "regions": {
    "010000": { "scope": "region:010000:AMAZONAS", "actas": {...}, "candidates": [...] },
    "140000": { "scope": "region:140000:LIMA", "actas": {...}, "candidates": [...] }
  }
}`,
    },
    {
      method: 'GET',
      path: '/geographic/regions/{ubigeo}',
      description: 'Obtiene datos de una región específica',
      examplePath: '/geographic/regions/080000',
      params: 'ubigeo: código UBIGEO de 6 dígitos (ej: 140000 para Lima)',
      details: [
        'Retorna el snapshot de una sola región con actas y candidatos.',
        'El campo scope indica la región: "region:{ubigeo}:{NOMBRE}".',
        'Formato UBIGEO: {departamento}0000 (ej: 040000 para Arequipa, 200000 para Puno).',
        'Query opcional: ?election=presidential (default).',
      ],
    },
    {
      method: 'GET',
      path: '/geographic/provinces/{ubigeo}',
      description: 'Obtiene datos de provincias dentro de una región',
      examplePath: '/geographic/provinces/080000',
      params: 'ubigeo: código UBIGEO de región (ej: 080000 para Huancavelica)',
      details: [
        'Retorna datos a nivel de provincia para la región indicada.',
        'Los datos se obtienen bajo demanda de ONPE y se cachean. Si ONPE no responde puede retornar 502.',
        'El UBIGEO de provincia tiene dígitos intermedios no cero (ej: 080100, 080200).',
        'Ejemplo para Lima (140000): provincias como 140100 (Lima), 140200 (Barranca), 140300 (Cajatambo), etc.',
        'Query opcional: ?election=presidential (default).',
      ],
    },
    {
      method: 'GET',
      path: '/geographic/districts/{ubigeo}',
      description: 'Obtiene datos de distritos dentro de una provincia',
      examplePath: '/geographic/districts/080100',
      params: 'ubigeo: código UBIGEO de provincia (ej: 080100 para Huancavelica ciudad)',
      details: [
        'Retorna datos a nivel de distrito para la provincia indicada.',
        'Los datos se obtienen bajo demanda de ONPE y se cachean.',
        'El UBIGEO de distrito usa los 6 dígitos completos (ej: 080101, 080102).',
        'El UBIGEO de entrada debe ser de provincia (4 dígitos significativos, ej: 140100 para Lima Metropolitana).',
        'Query opcional: ?election=presidential (default).',
      ],
    },
    {
      method: 'GET',
      path: '/geographic/abroad',
      description: 'Obtiene datos de votación en el extranjero',
      examplePath: '/geographic/abroad',
      params: 'Query opcional: ?election=presidential (default: presidential)',
      details: [
        'Retorna los resultados de votación de peruanos en el extranjero.',
        'Solo disponible para la elección presidencial (election_id 14 en ONPE).',
        'Los candidatos pueden tener candidate_id y name vacíos — se identifican solo por party.',
        'Misma estructura de respuesta que otros endpoints geográficos.',
      ],
    },
    {
      method: 'GET',
      path: '/predictions',
      description: 'Obtiene predicciones electorales basadas en simulación Monte Carlo',
      examplePath: '/predictions',
      details: [
        'Ejecuta 100,000 simulaciones Monte Carlo usando datos regionales de actas restantes.',
        'Solo disponible para la elección presidencial.',
        'Cada candidato incluye: current_votes, current_pct, predicted_votes, predicted_pct.',
        'Intervalos de confianza: p5, p25, p50, p75, p95 (votos y porcentaje).',
        'Incluye probabilidades de ranking (ej: probabilidad de quedar 1ro, 2do, etc).',
        'Métricas de tendencia: slope (pendiente), momentum y volatility.',
      ],
      responseExample: `{
  "prediction_time": "2026-04-17T...",
  "national_actas_pct": 93.409,
  "simulation": {
    "candidates": {
      "10001088": {
        "name": "KEIKO SOFIA FUJIMORI HIGUCHI",
        "current_pct": 17.056,
        "predicted_pct": 17.162,
        "confidence_interval": { "p5_pct": 16.494, "p95_pct": 17.83 },
        "rank_probabilities": { "1": 1.0 },
        "trend": { "slope": 0.011, "momentum": -0.011, "volatility": 0.051 }
      }
    }
  }
}`,
    },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3" style={{ color: 'var(--tx1)' }}>
          API Documentation
        </h1>
        <p className="text-lg mb-6" style={{ color: 'var(--tx2)' }}>
          Accede a los datos electorales en tiempo real a través de nuestra API
        </p>
      </div>

      {/* Getting Started Section */}
      <div
        className="rounded-lg p-8 mb-12 border"
        style={{
          backgroundColor: 'var(--bg-alt)',
          borderColor: 'var(--border)',
        }}
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Zap size={28} style={{ color: 'var(--c-rla)' }} />
          Primeros Pasos
        </h2>
        <div className="space-y-4" style={{ color: 'var(--tx2)' }}>
          <p>
            La API de PIXL's ONPE Fetcher proporciona acceso a datos electorales peruanos en tiempo real, incluyendo resultados, historial, análisis geográficos y predicciones.
          </p>
          <p>
            <span className="font-semibold">Base URL:</span> <code style={{ color: 'var(--c-rla)' }}>{baseUrl}</code>
          </p>
          <p>
            <span className="font-semibold">Protocolo:</span> REST over HTTPS
          </p>
          <p>
            <span className="font-semibold">Formato:</span> JSON
          </p>
          <p>
            <span className="font-semibold">Autenticación:</span> No requerida
          </p>
        </div>
      </div>

      {/* Examples Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Terminal size={28} style={{ color: 'var(--c-rla)' }} />
          Ejemplos de Uso
        </h2>

        <div
          className="rounded-lg p-6 mb-6 border"
          style={{
            backgroundColor: 'var(--bg-alt)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--c-rla)' }}>
            JavaScript / Fetch API
          </h3>
          <div className="relative">
            <pre
              className="p-4 rounded bg-black text-white overflow-x-auto text-sm"
              style={{ fontSize: '0.875rem' }}
            >
{`// Obtener datos presidenciales
fetch('${baseUrl}/elections/presidential')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

// Obtener historial
fetch('${baseUrl}/elections/presidential/history')
  .then(res => res.json())
  .then(data => console.log(data));`}
            </pre>
            <button
              onClick={() =>
                copyToClipboard(
                  `fetch('${baseUrl}/elections/presidential')\n  .then(res => res.json())\n  .then(data => console.log(data))`
                )
              }
              className="absolute top-2 right-2 p-2 rounded hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'var(--c-rla)', color: 'var(--bg)' }}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        <div
          className="rounded-lg p-6 border"
          style={{
            backgroundColor: 'var(--bg-alt)',
            borderColor: 'var(--border)',
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--c-rla)' }}>
            Python / Requests
          </h3>
          <div className="relative">
            <pre
              className="p-4 rounded bg-black text-white overflow-x-auto text-sm"
              style={{ fontSize: '0.875rem' }}
            >
{`import requests

# Obtener datos presidenciales
response = requests.get('${baseUrl}/elections/presidential')
data = response.json()
print(data)

# Obtener datos geográficos
regions = requests.get('${baseUrl}/geographic/regions').json()
print(regions)`}
            </pre>
            <button
              onClick={() =>
                copyToClipboard(
                  `import requests\n\nresponse = requests.get('${baseUrl}/elections/presidential')\ndata = response.json()`
                )
              }
              className="absolute top-2 right-2 p-2 rounded hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'var(--c-rla)', color: 'var(--bg)' }}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Endpoints Section */}
      <div>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Database size={28} style={{ color: 'var(--c-rla)' }} />
          Endpoints Disponibles
        </h2>

        <div className="space-y-4">
          {endpoints.map((endpoint, idx) => (
            <div
              key={idx}
              className="rounded-lg border overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-alt)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="px-3 py-1 rounded font-semibold text-sm text-white"
                    style={{
                      backgroundColor: endpoint.method === 'GET' ? '#3b82f6' : '#10b981',
                    }}
                  >
                    {endpoint.method}
                  </div>
                  <div className="flex-1">
                    <code
                      className="text-sm font-mono"
                      style={{ color: 'var(--c-rla)' }}
                    >
                      {endpoint.path}
                    </code>
                  </div>
                </div>

                <p className="mb-4" style={{ color: 'var(--tx2)' }}>
                  {endpoint.description}
                </p>

                <div
                  className="p-3 rounded mb-4 border"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="text-xs mb-2" style={{ color: 'var(--tx3)' }}>
                    Ejemplo:
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className="text-xs flex-1 overflow-x-auto"
                      style={{ color: 'var(--c-rla)' }}
                    >
                      {`${baseUrl}${endpoint.examplePath}`}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}${endpoint.examplePath}`)}
                      className="p-1.5 rounded hover:opacity-80 transition-opacity flex-shrink-0"
                      style={{ backgroundColor: 'var(--c-rla)', color: 'var(--bg)' }}
                    >
                      {copied === `${baseUrl}${endpoint.examplePath}` ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {endpoint.params && (
                  <div style={{ color: 'var(--tx3)', fontSize: '0.875rem' }}>
                    <span className="font-semibold">Parámetros:</span> {endpoint.params}
                  </div>
                )}

                {endpoint.details && (
                  <button
                    onClick={() => toggleExpanded(idx)}
                    className="mt-4 flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                    style={{ color: 'var(--c-rla)' }}
                  >
                    <ChevronDown
                      size={18}
                      className="transition-transform duration-200"
                      style={{ transform: expanded[idx] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                    {expanded[idx] ? 'Ocultar detalles' : 'Ver detalles'}
                  </button>
                )}
              </div>

              {endpoint.details && expanded[idx] && (
                <div
                  className="px-6 pb-6 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="pt-4 space-y-2">
                    {endpoint.details.map((detail, dIdx) => (
                      <p key={dIdx} className="text-sm" style={{ color: 'var(--tx2)' }}>
                        {detail}
                      </p>
                    ))}
                  </div>
                  {endpoint.responseExample && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--tx3)' }}>
                        Respuesta ejemplo:
                      </div>
                      <pre
                        className="p-4 rounded bg-black text-white overflow-x-auto"
                        style={{ fontSize: '0.8rem' }}
                      >
                        {endpoint.responseExample}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Response Format Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <Package size={28} style={{ color: 'var(--c-rla)' }} />
          Formato de Respuesta
        </h2>

        <div
          className="rounded-lg p-6 border"
          style={{
            backgroundColor: 'var(--bg-alt)',
            borderColor: 'var(--border)',
          }}
        >
          <p className="mb-4" style={{ color: 'var(--tx2)' }}>
            Todas las respuestas están en formato JSON:
          </p>
          <pre
            className="p-4 rounded bg-black text-white overflow-x-auto"
            style={{ fontSize: '0.875rem' }}
          >
{`{
  "percentage": 82.45,
  "actas_contabilizadas": 15230,
  "actas_totales": 18500,
  "candidates": [
    {
      "name": "Candidato A",
      "votes": 2500000,
      "percentage": 35.2
    },
    {
      "name": "Candidato B",
      "votes": 1800000,
      "percentage": 25.3
    }
  ],
  "timestamp": "2026-04-17T20:34:20Z"
}`}
          </pre>
        </div>
      </div>

      {/* UBIGEO Reference Button */}
      <div
        className="rounded-lg p-8 mt-12 border text-center"
        style={{
          backgroundColor: 'var(--bg-alt)',
          borderColor: 'var(--border)',
        }}
      >
        <h2 className="text-2xl font-bold mb-3 flex items-center justify-center gap-2" style={{ color: 'var(--tx1)' }}>
          <MapPin size={28} style={{ color: 'var(--c-rla)' }} />
          Códigos UBIGEO
        </h2>
        <p className="mb-6" style={{ color: 'var(--tx2)' }}>
          Consulta la lista completa de códigos UBIGEO de los 25 departamentos y sus provincias para usar con los endpoints geográficos.
        </p>
        <Link
          to="/ubigeo"
          className="inline-block px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--c-rla)',
            color: 'var(--bg)',
          }}
        >
          Ver todos los UBIGEO
        </Link>
      </div>

      {/* Support Section */}
      <div
        className="rounded-lg p-8 mt-12 border"
        style={{
          backgroundColor: 'var(--bg-alt)',
          borderColor: 'var(--border)',
        }}
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--tx1)' }}>
          <MessageSquare size={28} style={{ color: 'var(--c-rla)' }} />
          ¿Preguntas o Problemas?
        </h2>
        <p style={{ color: 'var(--tx2)' }} className="mb-4">
          Si encuentras problemas con la API o tienes sugerencias, abre un issue en nuestro repo de GitHub:
        </p>
        <a
          href="https://github.com/PixlGalaxy/Pixls_ONPE_Fetcher/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 rounded-lg font-semibold transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--c-rla)',
            color: 'var(--bg)',
          }}
        >
          Reportar un Problema
        </a>
      </div>
      <SeoBlock>
        <h1>API Pública de Resultados ONPE 2026</h1>
        <p>
          Accede a los datos oficiales de las elecciones presidenciales Perú 2026 mediante nuestra
          API REST gratuita. Integra el conteo de votos ONPE en tiempo real en tus propias
          aplicaciones y proyectos de análisis electoral.
        </p>
        <h2>Endpoints disponibles en la API electoral</h2>
        <ul>
          <li>Resultados generales de la elección presidencial</li>
          <li>Datos por candidato y partido político</li>
          <li>Resultados desagregados por ubigeo y región</li>
          <li>Historial y snapshots del escrutinio ONPE</li>
        </ul>
      </SeoBlock>
    </div>
  );
}
