import Button from './Button';

export default function EmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-900/50 p-6 text-center">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {hint ? <p className="text-sm text-slate-300">{hint}</p> : null}
        </div>
        {onAction && actionLabel ? (
          <Button variant="ghost" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
