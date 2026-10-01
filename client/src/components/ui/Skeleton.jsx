export default function Skeleton({ className = '', ...props }) {
  return (
    <div
      {...props}
      className={['animate-pulse rounded-xl bg-slate-700/70', className].join(' ')}
    />
  );
}
