import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Map, Users, History, Target, Info, Code2, MessageSquare, Menu, X, Radio } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-all relative
     ${isActive
       ? 'text-[var(--c-rla)] bg-[var(--c-rla-bg)]'
       : 'text-[var(--tx3)] hover:text-[var(--tx2)]'}`;

  return (
    <>
      {/* Desktop Navbar */}
      <div className="hidden md:flex items-center border-b-2" style={{ borderColor: 'var(--border)' }}>
        <nav className="flex overflow-x-auto flex-1">
          <NavLink to="/" className={linkClass} end>
            <BarChart3 size={15} />
            Dashboard
          </NavLink>
          <NavLink to="/mapa" className={linkClass}>
            <Map size={15} />
            Mapa
          </NavLink>
          <NavLink to="/candidatos" className={linkClass}>
            <Users size={15} />
            Candidatos
          </NavLink>
          <NavLink to="/prediccion" className={linkClass}>
            <Target size={15} />
            Predicción
          </NavLink>
          <NavLink to="/historial" className={linkClass}>
            <History size={15} />
            Historial
          </NavLink>
          <NavLink to="/chat" className={linkClass}>
            <MessageSquare size={15} />
            Asistente IA
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            <Info size={15} />
            Acerca De
          </NavLink>
          <NavLink to="/API_DOCS" className={linkClass}>
            <Code2 size={15} />
            API
          </NavLink>
        </nav>
        <div className="flex-shrink-0 px-3 flex items-center">
          <a
            href="https://onlinestatus.itzgalaxy.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ItzGalaxy Server Status"
            title="ItzGalaxy Server Status"
            className="block overflow-hidden rounded"
            style={{ width: 200, height: 30 }}
          >
            <iframe
              src="https://onlinestatus.itzgalaxy.com/badge?theme=dark"
              width="220"
              height="22"
              style={{ colorScheme: 'none', border: 0, display: 'block', pointerEvents: 'none' }}
              title="ItzGalaxy Server Status"
            />
          </a>
        </div>
      </div>

      {/* Mobile Navbar */}
      <div className="md:hidden border-b-2 flex items-center justify-between px-4 py-2" style={{ borderColor: 'var(--border)' }}>
        <div className="text-[13px] font-bold text-[var(--c-rla)]">Menu</div>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--tx2)' }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <nav
          className="md:hidden flex flex-col border-b-2 animate-fade-up"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}
        >
          <NavLink
            to="/"
            className={linkClass}
            end
            onClick={() => setOpen(false)}
          >
            <BarChart3 size={15} />
            Dashboard
          </NavLink>
          <NavLink
            to="/mapa"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Map size={15} />
            Mapa
          </NavLink>
          <NavLink
            to="/candidatos"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Users size={15} />
            Candidatos
          </NavLink>
          <NavLink
            to="/prediccion"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Target size={15} />
            Predicción
          </NavLink>
          <NavLink
            to="/historial"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <History size={15} />
            Historial
          </NavLink>
          <NavLink
            to="/chat"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <MessageSquare size={15} />
            Asistente IA
          </NavLink>
          <NavLink
            to="/about"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Info size={15} />
            Acerca De
          </NavLink>
          <NavLink
            to="/API_DOCS"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Code2 size={15} />
            API
          </NavLink>
          <NavLink
            to="https://onlinestatus.itzgalaxy.com"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            <Radio size={15} />
            Server Status
          </NavLink>
        </nav>
      )}
    </>
  );
}
