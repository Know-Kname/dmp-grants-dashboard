# React Rules — Detroit Memorial Park

Always enforced. No exceptions.

- **Functional components only** — no class components, no `React.Component`
- **Hooks at top level** — never inside conditions, loops, or nested functions
- **`useEffect` deps** — must be complete and correct; use `useCallback`/`useMemo` to stabilize references
- **List keys** — always stable unique IDs, never array index
- **No direct DOM manipulation** — use refs (`useRef`) or React state
- **Memoize expensive ops** — `useMemo` for heavy calculations, `useCallback` for callbacks passed as props
- Tailwind class order: layout → sizing → spacing → border → text → color → state
