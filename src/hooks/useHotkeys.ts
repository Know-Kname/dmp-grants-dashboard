import { useEffect, useRef } from 'react';

/**
 * Global keyboard shortcuts. Keys are combo strings: 'mod+k' means Ctrl+K
 * (Windows/Linux) or Cmd+K (macOS). Non-modifier combos are ignored while
 * focus is inside an input, textarea, select, or contenteditable.
 */
export function useHotkeys(bindings: Record<string, () => void>) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const combo = `${mod ? 'mod+' : ''}${e.key.toLowerCase()}`;
      const handler = bindingsRef.current[combo];
      if (!handler) return;
      if (!mod) {
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      }
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
