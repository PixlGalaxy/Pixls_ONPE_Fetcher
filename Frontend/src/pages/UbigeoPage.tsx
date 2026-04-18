import { MapPin, Search, ChevronDown, ArrowLeft } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

interface Province {
  ubigeo: string;
  name: string;
}

interface Department {
  ubigeo: string;
  name: string;
  provinces: Province[];
}

const DEPARTMENTS: Department[] = [
  {
    ubigeo: '010000', name: 'Amazonas',
    provinces: [
      { ubigeo: '010100', name: 'Chachapoyas' }, { ubigeo: '010200', name: 'Bagua' },
      { ubigeo: '010300', name: 'Bongará' }, { ubigeo: '010400', name: 'Condorcanqui' },
      { ubigeo: '010500', name: 'Luya' }, { ubigeo: '010600', name: 'Rodríguez de Mendoza' },
      { ubigeo: '010700', name: 'Utcubamba' },
    ],
  },
  {
    ubigeo: '020000', name: 'Áncash',
    provinces: [
      { ubigeo: '020100', name: 'Huaraz' }, { ubigeo: '020200', name: 'Aija' },
      { ubigeo: '020300', name: 'Antonio Raymondi' }, { ubigeo: '020400', name: 'Asunción' },
      { ubigeo: '020500', name: 'Bolognesi' }, { ubigeo: '020600', name: 'Carhuaz' },
      { ubigeo: '020700', name: 'Carlos F. Fitzcarrald' }, { ubigeo: '020800', name: 'Casma' },
      { ubigeo: '020900', name: 'Corongo' }, { ubigeo: '021000', name: 'Huari' },
      { ubigeo: '021100', name: 'Huarmey' }, { ubigeo: '021200', name: 'Huaylas' },
      { ubigeo: '021300', name: 'Mariscal Luzuriaga' }, { ubigeo: '021400', name: 'Ocros' },
      { ubigeo: '021500', name: 'Pallasca' }, { ubigeo: '021600', name: 'Pomabamba' },
      { ubigeo: '021700', name: 'Recuay' }, { ubigeo: '021800', name: 'Santa' },
      { ubigeo: '021900', name: 'Sihuas' }, { ubigeo: '022000', name: 'Yungay' },
    ],
  },
  {
    ubigeo: '030000', name: 'Apurímac',
    provinces: [
      { ubigeo: '030100', name: 'Abancay' }, { ubigeo: '030200', name: 'Andahuaylas' },
      { ubigeo: '030300', name: 'Antabamba' }, { ubigeo: '030400', name: 'Aymaraes' },
      { ubigeo: '030500', name: 'Cotabambas' }, { ubigeo: '030600', name: 'Chincheros' },
      { ubigeo: '030700', name: 'Grau' },
    ],
  },
  {
    ubigeo: '040000', name: 'Arequipa',
    provinces: [
      { ubigeo: '040100', name: 'Arequipa' }, { ubigeo: '040200', name: 'Camaná' },
      { ubigeo: '040300', name: 'Caravelí' }, { ubigeo: '040400', name: 'Castilla' },
      { ubigeo: '040500', name: 'Caylloma' }, { ubigeo: '040600', name: 'Condesuyos' },
      { ubigeo: '040700', name: 'Islay' }, { ubigeo: '040800', name: 'La Unión' },
    ],
  },
  {
    ubigeo: '050000', name: 'Ayacucho',
    provinces: [
      { ubigeo: '050100', name: 'Huamanga' }, { ubigeo: '050200', name: 'Cangallo' },
      { ubigeo: '050300', name: 'Huanca Sancos' }, { ubigeo: '050400', name: 'Huanta' },
      { ubigeo: '050500', name: 'La Mar' }, { ubigeo: '050600', name: 'Lucanas' },
      { ubigeo: '050700', name: 'Parinacochas' }, { ubigeo: '050800', name: 'Páucar del Sara Sara' },
      { ubigeo: '050900', name: 'Sucre' }, { ubigeo: '051000', name: 'Víctor Fajardo' },
      { ubigeo: '051100', name: 'Vilcas Huamán' },
    ],
  },
  {
    ubigeo: '060000', name: 'Cajamarca',
    provinces: [
      { ubigeo: '060100', name: 'Cajamarca' }, { ubigeo: '060200', name: 'Cajabamba' },
      { ubigeo: '060300', name: 'Celendín' }, { ubigeo: '060400', name: 'Chota' },
      { ubigeo: '060500', name: 'Contumazá' }, { ubigeo: '060600', name: 'Cutervo' },
      { ubigeo: '060700', name: 'Hualgayoc' }, { ubigeo: '060800', name: 'Jaén' },
      { ubigeo: '060900', name: 'San Ignacio' }, { ubigeo: '061000', name: 'San Marcos' },
      { ubigeo: '061100', name: 'San Miguel' }, { ubigeo: '061200', name: 'San Pablo' },
      { ubigeo: '061300', name: 'Santa Cruz' },
    ],
  },
  {
    ubigeo: '070000', name: 'Cusco',
    provinces: [
      { ubigeo: '070100', name: 'Cusco' }, { ubigeo: '070200', name: 'Acomayo' },
      { ubigeo: '070300', name: 'Anta' }, { ubigeo: '070400', name: 'Calca' },
      { ubigeo: '070500', name: 'Canas' }, { ubigeo: '070600', name: 'Canchis' },
      { ubigeo: '070700', name: 'Chumbivilcas' }, { ubigeo: '070800', name: 'Espinar' },
      { ubigeo: '070900', name: 'La Convención' }, { ubigeo: '071000', name: 'Paruro' },
      { ubigeo: '071100', name: 'Paucartambo' }, { ubigeo: '071200', name: 'Quispicanchi' },
      { ubigeo: '071300', name: 'Urubamba' },
    ],
  },
  {
    ubigeo: '080000', name: 'Huancavelica',
    provinces: [
      { ubigeo: '080100', name: 'Huancavelica' }, { ubigeo: '080200', name: 'Acobamba' },
      { ubigeo: '080300', name: 'Angaraes' }, { ubigeo: '080400', name: 'Castrovirreyna' },
      { ubigeo: '080500', name: 'Churcampa' }, { ubigeo: '080600', name: 'Huaytará' },
      { ubigeo: '080700', name: 'Tayacaja' },
    ],
  },
  {
    ubigeo: '090000', name: 'Huánuco',
    provinces: [
      { ubigeo: '090100', name: 'Huánuco' }, { ubigeo: '090200', name: 'Ambo' },
      { ubigeo: '090300', name: 'Dos de Mayo' }, { ubigeo: '090400', name: 'Huacaybamba' },
      { ubigeo: '090500', name: 'Huamalíes' }, { ubigeo: '090600', name: 'Leoncio Prado' },
      { ubigeo: '090700', name: 'Marañón' }, { ubigeo: '090800', name: 'Pachitea' },
      { ubigeo: '090900', name: 'Puerto Inca' }, { ubigeo: '091000', name: 'Lauricocha' },
      { ubigeo: '091100', name: 'Yarowilca' },
    ],
  },
  {
    ubigeo: '100000', name: 'Ica',
    provinces: [
      { ubigeo: '100100', name: 'Ica' }, { ubigeo: '100200', name: 'Chincha' },
      { ubigeo: '100300', name: 'Nasca' }, { ubigeo: '100400', name: 'Palpa' },
      { ubigeo: '100500', name: 'Pisco' },
    ],
  },
  {
    ubigeo: '110000', name: 'Junín',
    provinces: [
      { ubigeo: '110100', name: 'Huancayo' }, { ubigeo: '110200', name: 'Concepción' },
      { ubigeo: '110300', name: 'Chanchamayo' }, { ubigeo: '110400', name: 'Jauja' },
      { ubigeo: '110500', name: 'Junín' }, { ubigeo: '110600', name: 'Satipo' },
      { ubigeo: '110700', name: 'Tarma' }, { ubigeo: '110800', name: 'Yauli' },
      { ubigeo: '110900', name: 'Chupaca' },
    ],
  },
  {
    ubigeo: '120000', name: 'La Libertad',
    provinces: [
      { ubigeo: '120100', name: 'Trujillo' }, { ubigeo: '120200', name: 'Ascope' },
      { ubigeo: '120300', name: 'Bolívar' }, { ubigeo: '120400', name: 'Chepén' },
      { ubigeo: '120500', name: 'Julcán' }, { ubigeo: '120600', name: 'Otuzco' },
      { ubigeo: '120700', name: 'Pacasmayo' }, { ubigeo: '120800', name: 'Pataz' },
      { ubigeo: '120900', name: 'Sánchez Carrión' }, { ubigeo: '121000', name: 'Santiago de Chuco' },
      { ubigeo: '121100', name: 'Gran Chimú' }, { ubigeo: '121200', name: 'Virú' },
    ],
  },
  {
    ubigeo: '130000', name: 'Lambayeque',
    provinces: [
      { ubigeo: '130100', name: 'Chiclayo' }, { ubigeo: '130200', name: 'Ferreñafe' },
      { ubigeo: '130300', name: 'Lambayeque' },
    ],
  },
  {
    ubigeo: '140000', name: 'Lima',
    provinces: [
      { ubigeo: '140100', name: 'Lima' }, { ubigeo: '140200', name: 'Barranca' },
      { ubigeo: '140300', name: 'Cajatambo' }, { ubigeo: '140400', name: 'Canta' },
      { ubigeo: '140500', name: 'Cañete' }, { ubigeo: '140600', name: 'Huaral' },
      { ubigeo: '140700', name: 'Huarochirí' }, { ubigeo: '140800', name: 'Huaura' },
      { ubigeo: '140900', name: 'Oyón' }, { ubigeo: '141000', name: 'Yauyos' },
    ],
  },
  {
    ubigeo: '150000', name: 'Loreto',
    provinces: [
      { ubigeo: '150100', name: 'Maynas' }, { ubigeo: '150200', name: 'Alto Amazonas' },
      { ubigeo: '150300', name: 'Loreto' }, { ubigeo: '150400', name: 'Mariscal Ramón Castilla' },
      { ubigeo: '150500', name: 'Requena' }, { ubigeo: '150600', name: 'Ucayali' },
      { ubigeo: '150700', name: 'Datem del Marañón' }, { ubigeo: '150800', name: 'Putumayo' },
    ],
  },
  {
    ubigeo: '160000', name: 'Madre de Dios',
    provinces: [
      { ubigeo: '160100', name: 'Tambopata' }, { ubigeo: '160200', name: 'Manu' },
      { ubigeo: '160300', name: 'Tahuamanu' },
    ],
  },
  {
    ubigeo: '170000', name: 'Moquegua',
    provinces: [
      { ubigeo: '170100', name: 'Mariscal Nieto' }, { ubigeo: '170200', name: 'General Sánchez Cerro' },
      { ubigeo: '170300', name: 'Ilo' },
    ],
  },
  {
    ubigeo: '180000', name: 'Pasco',
    provinces: [
      { ubigeo: '180100', name: 'Pasco' }, { ubigeo: '180200', name: 'Daniel A. Carrión' },
      { ubigeo: '180300', name: 'Oxapampa' },
    ],
  },
  {
    ubigeo: '190000', name: 'Piura',
    provinces: [
      { ubigeo: '190100', name: 'Piura' }, { ubigeo: '190200', name: 'Ayabaca' },
      { ubigeo: '190300', name: 'Huancabamba' }, { ubigeo: '190400', name: 'Morropón' },
      { ubigeo: '190500', name: 'Paita' }, { ubigeo: '190600', name: 'Sullana' },
      { ubigeo: '190700', name: 'Talara' }, { ubigeo: '190800', name: 'Sechura' },
    ],
  },
  {
    ubigeo: '200000', name: 'Puno',
    provinces: [
      { ubigeo: '200100', name: 'Puno' }, { ubigeo: '200200', name: 'Azángaro' },
      { ubigeo: '200300', name: 'Carabaya' }, { ubigeo: '200400', name: 'Chucuito' },
      { ubigeo: '200500', name: 'El Collao' }, { ubigeo: '200600', name: 'Huancané' },
      { ubigeo: '200700', name: 'Lampa' }, { ubigeo: '200800', name: 'Melgar' },
      { ubigeo: '200900', name: 'Moho' }, { ubigeo: '201000', name: 'San Antonio de Putina' },
      { ubigeo: '201100', name: 'San Román' }, { ubigeo: '201200', name: 'Sandia' },
      { ubigeo: '201300', name: 'Yunguyo' },
    ],
  },
  {
    ubigeo: '210000', name: 'San Martín',
    provinces: [
      { ubigeo: '210100', name: 'Moyobamba' }, { ubigeo: '210200', name: 'Bellavista' },
      { ubigeo: '210300', name: 'El Dorado' }, { ubigeo: '210400', name: 'Huallaga' },
      { ubigeo: '210500', name: 'Lamas' }, { ubigeo: '210600', name: 'Mariscal Cáceres' },
      { ubigeo: '210700', name: 'Picota' }, { ubigeo: '210800', name: 'Rioja' },
      { ubigeo: '210900', name: 'San Martín' }, { ubigeo: '211000', name: 'Tocache' },
    ],
  },
  {
    ubigeo: '220000', name: 'Tacna',
    provinces: [
      { ubigeo: '220100', name: 'Tacna' }, { ubigeo: '220200', name: 'Candarave' },
      { ubigeo: '220300', name: 'Jorge Basadre' }, { ubigeo: '220400', name: 'Tarata' },
    ],
  },
  {
    ubigeo: '230000', name: 'Tumbes',
    provinces: [
      { ubigeo: '230100', name: 'Tumbes' }, { ubigeo: '230200', name: 'Contralmirante Villar' },
      { ubigeo: '230300', name: 'Zarumilla' },
    ],
  },
  {
    ubigeo: '240000', name: 'Callao',
    provinces: [
      { ubigeo: '240100', name: 'Callao' },
    ],
  },
  {
    ubigeo: '250000', name: 'Ucayali',
    provinces: [
      { ubigeo: '250100', name: 'Coronel Portillo' }, { ubigeo: '250200', name: 'Atalaya' },
      { ubigeo: '250300', name: 'Padre Abad' }, { ubigeo: '250400', name: 'Purús' },
    ],
  },
];

export default function UbigeoPage() {
  const [search, setSearch] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  const toggleDept = (ubigeo: string) => {
    setExpandedDepts((prev) => ({ ...prev, [ubigeo]: !prev[ubigeo] }));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return DEPARTMENTS;
    const q = search.toLowerCase().trim();
    return DEPARTMENTS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.ubigeo.includes(q) ||
        d.provinces.some((p) => p.name.toLowerCase().includes(q) || p.ubigeo.includes(q))
    );
  }, [search]);

  const totalProvinces = DEPARTMENTS.reduce((sum, d) => sum + d.provinces.length, 0);

  return (
    <div className="min-h-screen py-8">
      <div className="mb-8">
        <Link
          to="/API_DOCS"
          className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--c-rla)' }}
        >
          <ArrowLeft size={16} />
          Volver a la Documentacion de la API
        </Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3" style={{ color: 'var(--tx1)' }}>
          <MapPin size={36} />
          Códigos UBIGEO del Perú
        </h1>
        <p className="text-lg mb-2" style={{ color: 'var(--tx2)' }}>
          Referencia completa de códigos UBIGEO para usar con la API
        </p>
        <p className="text-sm" style={{ color: 'var(--tx3)' }}>
          {DEPARTMENTS.length} departamentos &middot; {totalProvinces} provincias
        </p>
      </div>

      {/* Format explanation */}
      <div
        className="rounded-lg p-6 mb-8 border"
        style={{ backgroundColor: 'var(--bg-alt)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--tx1)' }}>
          Formato UBIGEO
        </h2>
        <div className="space-y-2 text-sm" style={{ color: 'var(--tx2)' }}>
          <p>
            <code style={{ color: 'var(--c-rla)' }}>XX0000</code> — Departamento (ej: <code style={{ color: 'var(--c-rla)' }}>140000</code> = Lima)
          </p>
          <p>
            <code style={{ color: 'var(--c-rla)' }}>XXYY00</code> — Provincia (ej: <code style={{ color: 'var(--c-rla)' }}>140100</code> = Lima ciudad)
          </p>
          <p>
            <code style={{ color: 'var(--c-rla)' }}>XXYYZZ</code> — Distrito (ej: <code style={{ color: 'var(--c-rla)' }}>140101</code> = Lima distrito)
          </p>
        </div>
        <div className="mt-4 text-sm" style={{ color: 'var(--tx3)' }}>
          Usa estos códigos en los endpoints: <code style={{ color: 'var(--c-rla)' }}>/geographic/regions/&#123;ubigeo&#125;</code>, <code style={{ color: 'var(--c-rla)' }}>/geographic/provinces/&#123;ubigeo&#125;</code>, <code style={{ color: 'var(--c-rla)' }}>/geographic/districts/&#123;ubigeo&#125;</code>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--tx3)' }}
        />
        <input
          type="text"
          placeholder="Buscar por nombre o código UBIGEO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-alt)',
            borderColor: 'var(--border)',
            color: 'var(--tx1)',
          }}
        />
      </div>

      {/* Departments list */}
      <div className="space-y-3">
        {filtered.map((dept) => {
          const isExpanded = expandedDepts[dept.ubigeo];
          const matchingProvinces = search.trim()
            ? dept.provinces.filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase().trim()) ||
                  p.ubigeo.includes(search.trim())
              )
            : dept.provinces;

          return (
            <div
              key={dept.ubigeo}
              className="rounded-lg border overflow-hidden"
              style={{ backgroundColor: 'var(--bg-alt)', borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => toggleDept(dept.ubigeo)}
                className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:opacity-90"
              >
                <code
                  className="text-sm font-mono font-bold px-2 py-1 rounded"
                  style={{ backgroundColor: 'var(--bg)', color: 'var(--c-rla)' }}
                >
                  {dept.ubigeo}
                </code>
                <span className="flex-1 font-semibold" style={{ color: 'var(--tx1)' }}>
                  {dept.name}
                </span>
                <span className="text-xs" style={{ color: 'var(--tx3)' }}>
                  {dept.provinces.length} {dept.provinces.length === 1 ? 'provincia' : 'provincias'}
                </span>
                <ChevronDown
                  size={18}
                  className="transition-transform duration-200"
                  style={{
                    color: 'var(--tx3)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {isExpanded && (
                <div
                  className="border-t px-4 pb-4"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
                    {(search.trim() && matchingProvinces.length > 0 ? matchingProvinces : dept.provinces).map((prov) => (
                      <div
                        key={prov.ubigeo}
                        className="flex items-center gap-3 p-2 rounded text-sm"
                        style={{ backgroundColor: 'var(--bg)' }}
                      >
                        <code
                          className="font-mono text-xs"
                          style={{ color: 'var(--c-rla)' }}
                        >
                          {prov.ubigeo}
                        </code>
                        <span style={{ color: 'var(--tx2)' }}>{prov.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--tx3)' }}>
            No se encontraron resultados para "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
