import type { CSSProperties, ReactNode } from 'react';

const srOnly: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function SeoBlock({ children }: { children: ReactNode }) {
  return (
    <section aria-hidden="true" style={srOnly}>
      {children}
    </section>
  );
}
