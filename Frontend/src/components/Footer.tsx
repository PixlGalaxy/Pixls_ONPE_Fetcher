import { ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      className="mt-8 pt-6 pb-4 px-4 border-t text-center text-[11px]"
      style={{ borderColor: 'var(--border)', color: 'var(--tx3)' }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
        <span>ONPE Fetcher | Desarrollado por</span>
        <a
          href="https://github.com/PixlGalaxy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--c-rla)' }}
        > PixlGalaxy
          <ExternalLink size={10} />
        </a>
      </div>
    </footer>
  );
}
