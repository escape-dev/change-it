import { AlertTriangle, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface NoticeProps {
  tone?: 'error' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}

const TONES = {
  error: {
    wrapper: 'border-rose-400/25 bg-rose-400/[0.07]',
    icon: 'text-rose-300',
    title: 'text-rose-200',
    body: 'text-rose-100/70',
    Icon: AlertTriangle,
  },
  warning: {
    wrapper: 'border-amber-400/25 bg-amber-400/[0.06]',
    icon: 'text-amber-300',
    title: 'text-amber-200',
    body: 'text-amber-100/70',
    Icon: AlertTriangle,
  },
  info: {
    wrapper: 'border-white/10 bg-white/[0.03]',
    icon: 'text-slate-400',
    title: 'text-slate-200',
    body: 'text-slate-400',
    Icon: Info,
  },
};

export function Notice({ tone = 'error', title, children, onDismiss }: NoticeProps) {
  const styles = TONES[tone];
  const Icon = styles.Icon;

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${styles.wrapper}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {title && <p className={`font-semibold ${styles.title}`}>{title}</p>}
        <div className={styles.body}>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="rounded p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
