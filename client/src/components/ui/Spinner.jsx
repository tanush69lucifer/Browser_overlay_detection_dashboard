export default function Spinner({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-3',
  };

  return (
    <span
      className={[
        'inline-block animate-spin rounded-full border-t-transparent border-r-transparent border-b-transparent border-l-white',
        sizeMap[size] || sizeMap.md,
        className,
      ].join(' ')}
      aria-label="Loading"
      role="status"
    />
  );
}
