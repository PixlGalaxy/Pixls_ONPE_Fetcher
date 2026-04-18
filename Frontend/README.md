# Frontend

React 19 + TypeScript single-page application built with Vite. It displays live Peruvian election results, geographic breakdowns, probabilistic predictions, and an AI chat interface.

## Structure

```
Frontend/
├── index.html                  # HTML entry point (SEO meta, OG tags)
├── vite.config.ts              # Build config, Tailwind plugin, /api proxy
├── .env.example                # Environment variable template
├── public/
│   ├── favicon.svg
│   ├── Galaxy-Zombie.png       # Project logo
│   ├── peru-departamentos.geojson  # GeoJSON for the map layer
│   ├── partidos/               # Party logo images (00000001.jpg ...)
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.tsx                # React root, mounts <App />
    ├── App.tsx                 # Router, layout, document title management
    ├── index.css               # Global styles and CSS custom properties
    ├── types/
    │   └── election.ts         # Shared TypeScript interfaces, candidate colors, party visuals
    ├── hooks/
    │   └── useElectionData.ts  # Data fetching and polling hook
    ├── components/
    │   ├── Navbar.tsx
    │   ├── CandidateCard.tsx
    │   ├── ElectionMap.tsx     # D3-geo choropleth map
    │   ├── DiffEvolutionChart.tsx
    │   ├── TimelineChart.tsx
    │   └── SeoBlock.tsx
    └── pages/
        ├── Dashboard.tsx       # Home — overview of all elections
        ├── MapPage.tsx         # Interactive geographic map
        ├── CandidatosPage.tsx  # Candidate list and vote shares
        ├── PrediccionPage.tsx  # Monte Carlo prediction results
        ├── HistorialPage.tsx   # Historical snapshot browser
        ├── ChatPage.tsx        # AI assistant (Bit)
        ├── APIPage.tsx         # API reference documentation
        ├── UbigeoPage.tsx      # UBIGEO code lookup
        ├── AboutPage.tsx       # Project information
        └── NotFound.tsx        # 404 fallback
```

## Routes

| Path         | Page              |
|--------------|-------------------|
| `/`          | Dashboard         |
| `/mapa`      | Electoral map     |
| `/candidatos`| Candidates        |
| `/prediccion`| Predictions       |
| `/historial` | History           |
| `/chat`      | AI chat (Bit)     |
| `/API_DOCS`  | API documentation |
| `/ubigeo`    | UBIGEO reference  |
| `/about`     | About             |

## Key Dependencies

| Package            | Purpose                              |
|--------------------|--------------------------------------|
| `react` 19         | UI framework                         |
| `react-router-dom` 7 | Client-side routing               |
| `tailwindcss` 4    | Utility-first CSS                    |
| `recharts`         | Chart components                     |
| `d3-geo`           | Geographic projections for the map   |
| `react-markdown`   | Renders markdown in the chat page    |
| `lucide-react`     | Icon set                             |

## Environment Variables

Copy `.env.example` to `.env.local` and adjust as needed:

```
VITE_API_BASE=/api
VITE_API_TARGET=http://localhost:8000
```

`VITE_API_BASE` is the prefix used by the app for all API calls. In development, Vite proxies it to `VITE_API_TARGET`. In production, Nginx handles the proxy.

## Development

```bash
npm install
npm run dev 
npm run build  
```
