import { cn } from './cn';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-control border border-soc-border bg-black/20 px-3 text-ui-base text-soc-text placeholder:text-soc-muted outline-none',
        'focus:border-soc-info/60 focus:shadow-focus',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-control border border-soc-border bg-black/20 px-3 text-ui-base text-soc-text outline-none',
        'focus:border-soc-info/60 focus:shadow-focus',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
