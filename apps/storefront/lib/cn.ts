import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard `cn` helper — clsx for conditional joins + tailwind-merge to
// drop conflicting utility classes (last wins) so component variants
// can override defaults safely.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
