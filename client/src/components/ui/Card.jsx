export default function Card({ children, className = '', ...props }) {
  return (
    <div
      {...props}
      className={[
        'rounded-2xl border border-slate-700/80 bg-surface/80 p-4 shadow-xl shadow-slate-950/20 backdrop-blur-sm',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
