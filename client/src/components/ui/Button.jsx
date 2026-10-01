import Spinner from './Spinner';

const variants = {
  primary: 'bg-primary text-white shadow-lg shadow-primary/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
  ghost: 'border border-slate-600 bg-slate-800/50 text-text hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-60',
  danger: 'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60',
};

export default function Button({ children, variant = 'primary', loading = false, className = '', disabled, ...props }) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/60',
        variants[variant] || variants.primary,
        className,
      ].join(' ')}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
