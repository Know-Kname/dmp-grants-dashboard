# TypeScript Rules — Detroit Memorial Park

Always enforced. No exceptions.

- **No `any`** — use explicit types, generics, or `unknown` + narrowing
- **No bare type assertions** (`as Foo`) — use type guards or Zod `.parse()`
- **Zod for all runtime validation** — user input, API responses, env vars
- **Async error handling** — every `async` function must catch or propagate errors explicitly
- **Strict null checks** — never assume values are non-null without checking
- Import types with `import type { Foo }` when the value is not used at runtime
