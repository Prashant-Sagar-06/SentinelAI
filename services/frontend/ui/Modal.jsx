import { AnimatePresence, motion } from 'framer-motion';

import { cn } from './cn';

export function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 h-full w-full bg-black/70" onClick={onClose} />
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ModalPanel({ className, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn('relative mx-auto mt-16 w-[min(1040px,calc(100%-2rem))]', className)}
    >
      {children}
    </motion.div>
  );
}
