// Botão de ação destrutiva com confirmação na própria página (o claude.ai bloqueia window.confirm).

import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  onConfirm: () => void;
  children: ReactNode;
  /** Texto do segundo clique. */
  confirmLabel?: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

export function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirmar?', className = 'icon-btn', title, ...rest }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`${className} ${armed ? 'confirm-armed' : ''}`}
      title={armed ? 'Clique de novo para confirmar' : title}
      aria-label={armed ? `${rest['aria-label'] ?? title ?? ''}: clique de novo para confirmar` : rest['aria-label']}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
