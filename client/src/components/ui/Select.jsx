export default function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-slate-200">
      {label ? <span className="font-medium text-slate-100">{label}</span> : null}
      <select
        {...props}
        aria-invalid={Boolean(error)}
        className={[
          'rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          error ? 'border-red-500/70' : 'border-slate-600',
          className,
        ].join(' ')}
      >
        {options.map((option) => (
          <option key={option.value ?? option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
}
