import { EmptyStateProps } from './EmptyState.types';

export function EmptyState({
  icon,
  message,
  heading,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-muted-foreground text-sm">
      {icon && <div className="text-muted-foreground/80">{icon}</div>}
      {heading ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xl font-semibold tracking-tight text-foreground">{heading}</p>
          {message && <p>{message}</p>}
        </div>
      ) : (
        message && <span>{message}</span>
      )}
      {action}
    </div>
  );
}
