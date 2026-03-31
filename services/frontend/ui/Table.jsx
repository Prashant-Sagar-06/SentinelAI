import { cn } from './cn';

export function Table({ className, children, minWidth = 920 }) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-left text-ui-base', className)}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children }) {
  return <thead className={cn('bg-black/10', className)}>{children}</thead>;
}

export function TBody({ className, children }) {
  return <tbody className={cn('', className)}>{children}</tbody>;
}

export function TR({ className, children, ...props }) {
  return (
    <tr
      className={cn('border-t border-soc-border hover:bg-white/3', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, ...props }) {
  return (
    <th className={cn('px-4 py-row text-ui-xs font-semibold text-soc-muted', className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ className, children, ...props }) {
  return (
    <td className={cn('px-4 py-row text-soc-text', className)} {...props}>
      {children}
    </td>
  );
}
