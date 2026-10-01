export default function Input({ label, error, trailing, className = '', ...props }) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-slate-200">
      {label ? <span className="font-medium text-slate-100">{label}</span> : null}
      <span className="relative block w-full">
        <input
          {...props}
          aria-invalid={Boolean(error)}
          className={[
            'w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-text placeholder:text-slate-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            trailing ? 'pr-11' : '',
            error ? 'border-red-500/70' : 'border-slate-600',
            className,
          ].join(' ')}
        />
        {trailing ? <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span> : null}
      </span>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
}
