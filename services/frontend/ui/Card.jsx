import { cn } from './cn';

export function Card({ as: Comp = 'div', className, padding = 'md', interactive = false, children, ...props }) {
  const pad = padding === 'lg' ? 'p-card-lg' : 'p-card';

  return (
    <Comp
      className={cn(
        'rounded-card border border-soc-border bg-soc-card shadow-card',
        interactive ? 'transition-colors hover:bg-white/3' : null,
        pad,
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function CardHeader({ className, title, right, subtitle }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        {title ? <div className="truncate text-ui-base font-semibold text-soc-text">{title}</div> : null}
        {subtitle ? <div className="truncate text-ui-xs text-soc-muted">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardMuted({ as: Comp = 'div', className, children, ...props }) {
  return (
    <Comp className={cn('rounded-card border border-soc-border bg-black/10 p-card', className)} {...props}>
      {children}
    </Comp>
  );
}
