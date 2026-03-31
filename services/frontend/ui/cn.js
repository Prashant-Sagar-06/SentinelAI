export function cn(...xs) {
  return xs.flat(Infinity).filter(Boolean).join(' ');
}
