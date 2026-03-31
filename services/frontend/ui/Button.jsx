import { motion } from 'framer-motion';
import Link from 'next/link';

import { cn } from './cn';
import { Spinner } from './Loader';

const VARIANTS = {
  default: 'border-soc-border bg-black/20 text-soc-text hover:bg-black/30 active:bg-black/40',
  primary: 'border-soc-info/40 bg-soc-info/15 text-soc-text hover:bg-soc-info/20 active:bg-soc-info/25',
  danger: 'border-soc-critical/40 bg-soc-critical/15 text-soc-text hover:bg-soc-critical/20 active:bg-soc-critical/25',
  ghost: 'border-transparent bg-transparent text-soc-text hover:bg-white/6 active:bg-white/10',
};

const SIZES = {
  sm: 'h-9 px-3 text-ui-sm rounded-control',
  md: 'h-10 px-3 text-ui-base rounded-control',
  lg: 'h-11 px-4 text-ui-base rounded-control',
};

export function Button({
  asChild,
  className,
  variant = 'default',
  size = 'md',
  loading,
  disabled,
  children,
  ...props
}) {
  const Comp = asChild ? motion.span : motion.button;

  return (
    <Comp
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? <Spinner className="text-soc-text" /> : null}
      {children}
    </Comp>
  );
}

export function ButtonLink({ href, className, variant = 'default', size = 'md', children, ...props }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 border font-medium transition-colors',
        SIZES[size],
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
