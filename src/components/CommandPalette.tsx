/**
 * Ctrl/Cmd+K command palette: fuzzy navigation to every page, quick actions,
 * and record search over data React Query has already cached — customers,
 * vendors, grants, burials, and work orders — with zero extra network calls.
 * Selecting a record deep-links to its page with `?q=` so the page's search
 * filter picks it up.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search, CornerDownLeft, Moon, Sun } from 'lucide-react';
import { navItemsFor } from '../config/nav';
import { fuzzyScore } from '../lib/fuzzy';
import { queryKeys } from '../lib/query';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { m, AnimatePresence, EASE_LUX } from '../lib/motion';
import type { Burial, Customer, Grant, Vendor, WorkOrder } from '../types';

interface PaletteItem {
  id: string;
  group: 'Pages' | 'Actions' | 'Records';
  label: string;
  detail?: string;
  icon?: React.ReactNode;
  run: () => void;
  /** Extra text the fuzzy matcher may hit (e.g. description, entity type). */
  keywords?: string;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  // The palette is a second way into every page, so it has to respect the same
  // role filter the sidebar does — otherwise ⌘K is a bypass for the nav.
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Wait for the entrance frame before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    if (!isOpen) return [];
    const go = (path: string) => () => {
      onClose();
      navigate(path);
    };

    const pages: PaletteItem[] = navItemsFor(role).map((n) => ({
      id: `page:${n.path}`,
      group: 'Pages',
      label: n.label,
      detail: n.description,
      icon: <n.icon size={16} />,
      keywords: n.description,
      run: go(n.path),
    }));

    const actions: PaletteItem[] = [
      {
        id: 'action:theme',
        group: 'Actions',
        label: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        icon: resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
        keywords: 'theme dark light appearance',
        run: () => {
          setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
          onClose();
        },
      },
    ];

    // Records — read straight from the query cache; empty until a page has
    // loaded them (or a background prefetch has run). That's the honest deal:
    // zero network cost.
    const records: PaletteItem[] = [];
    const goRecord = (path: string, search: string) => () => {
      onClose();
      navigate(`${path}?q=${encodeURIComponent(search)}`);
    };
    const customers = queryClient.getQueryData<Customer[]>(queryKeys.customers.list());
    customers?.forEach((c) => {
      const name = `${c.firstName} ${c.lastName}`;
      records.push({
        id: `customer:${c.id}`,
        group: 'Records',
        label: name,
        detail: 'Customer',
        keywords: `customer ${c.email ?? ''}`,
        run: goRecord('/customers', name),
      });
    });
    const vendors = queryClient.getQueryData<Vendor[]>(queryKeys.vendors.list());
    vendors?.forEach((v) => {
      records.push({
        id: `vendor:${v.id}`,
        group: 'Records',
        label: v.name,
        detail: 'Vendor',
        keywords: 'vendor supplier',
        run: goRecord('/vendors', v.name),
      });
    });
    const grants = queryClient.getQueryData<Grant[]>(queryKeys.grants.list());
    grants?.forEach((g) => {
      records.push({
        id: `grant:${g.id}`,
        group: 'Records',
        label: g.title,
        detail: `Grant · ${g.source}`,
        keywords: `grant ${g.source}`,
        run: goRecord('/grants', g.title),
      });
    });
    const burials = queryClient.getQueryData<Burial[]>(queryKeys.burials.list());
    burials?.forEach((b) => {
      const name = `${b.deceasedFirstName} ${b.deceasedLastName}`;
      records.push({
        id: `burial:${b.id}`,
        group: 'Records',
        label: name,
        detail: `Burial · ${b.plotLocation}`,
        keywords: 'burial deceased',
        run: goRecord('/burials', name),
      });
    });
    const workOrders = queryClient.getQueryData<WorkOrder[]>(queryKeys.workOrders.list());
    workOrders?.forEach((w) => {
      records.push({
        id: `wo:${w.id}`,
        group: 'Records',
        label: w.title,
        detail: `Work order · ${w.status.replace('_', ' ')}`,
        keywords: 'work order task',
        run: goRecord('/work-orders', w.title),
      });
    });

    return [...pages, ...actions, ...records];
  }, [isOpen, navigate, onClose, queryClient, resolvedTheme, setTheme]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Empty query: show pages and actions only — dumping every record is noise.
      return items.filter((i) => i.group !== 'Records');
    }
    return items
      .map((item) => {
        const score = fuzzyScore(query, `${item.label} ${item.keywords ?? ''}`);
        return score === null ? null : { item, score };
      })
      .filter((r): r is { item: PaletteItem; score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.item);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    // Keep the active row visible while arrowing through
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[activeIndex]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let lastGroup: string | null = null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh] px-4" onKeyDown={onKeyDown}>
          <m.div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: EASE_LUX }}
            className="relative w-full max-w-xl bg-card text-card-foreground rounded-xl shadow-xl border border-border overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search size={16} className="text-foreground-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, records, actions…"
                className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
                aria-label="Search commands"
              />
              <kbd className="hidden sm:block text-[10px] text-foreground-subtle border border-border rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
              {results.length === 0 && (
                <p className="px-4 py-8 text-sm text-foreground-muted text-center">
                  No matches. Records appear here once their page has loaded.
                </p>
              )}
              {results.map((item, i) => {
                const showHeader = item.group !== lastGroup;
                lastGroup = item.group;
                const active = i === activeIndex;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle">
                        {item.group}
                      </p>
                    )}
                    <button
                      data-index={i}
                      onClick={item.run}
                      onMouseMove={() => setActiveIndex(i)}
                      className={`relative w-full flex items-center gap-3 px-4 py-2.5 text-left min-h-0 ${
                        active ? 'text-foreground' : 'text-foreground-muted'
                      }`}
                    >
                      {active && (
                        <m.span
                          layoutId="palette-active"
                          className="absolute inset-x-2 inset-y-0 rounded-lg bg-accent"
                          transition={{ duration: 0.15, ease: EASE_LUX }}
                        />
                      )}
                      <span className="relative shrink-0 text-foreground-muted">{item.icon ?? <CornerDownLeft size={14} className="opacity-0" />}</span>
                      <span className="relative flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{item.label}</span>
                        {item.detail && (
                          <span className="block text-xs text-foreground-subtle truncate">{item.detail}</span>
                        )}
                      </span>
                      {active && <CornerDownLeft size={13} className="relative text-foreground-subtle shrink-0" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
