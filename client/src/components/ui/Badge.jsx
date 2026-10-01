const severityStyles = {
  HIGH: {
    icon: '⚠',
    className: 'border-red-500/50 bg-red-500/10 text-red-200',
  },
  MED: {
    icon: '•',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  },
  MEDIUM: {
    icon: '•',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  },
  LOW: {
    icon: '✓',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  },
  NONE: {
    icon: '✓',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  },
  default: {
    icon: '•',
    className: 'border-slate-500/50 bg-slate-500/10 text-slate-200',
  },
};

export default function Badge({ children, tone = 'default', className = '' }) {
  const resolved = severityStyles[tone] || severityStyles.default;
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide',
        resolved.className,
        className,
      ].join(' ')}
    >
      <span aria-hidden="true">{resolved.icon}</span>
      <span>{children || tone}</span>
    </span>
  );
}
