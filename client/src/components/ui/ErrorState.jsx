import Button from './Button';

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center">
      <p className="text-lg font-semibold text-red-200">Unable to load this screen</p>
      <p className="mt-2 text-sm text-red-100/90">{message}</p>
      {onRetry ? (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
