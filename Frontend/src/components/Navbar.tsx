import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Map, Users, History, Target, Menu, X } from 'lucide-react';

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
      <nav className="hidden md:flex border-b-2 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
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
      </nav>

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
        </nav>
      )}
    </>
  );
}
