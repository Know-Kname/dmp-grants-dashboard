# 11 — Design System

> **TL;DR:** The app uses a custom design system built on Tailwind CSS with CSS custom properties. DMP brand colors (forest green `#1a3d2b`, gold `#c49a2c`) live as hardcoded constants in `Layout.tsx` — not CSS variables — because the sidebar must stay dark regardless of light/dark mode. All other UI uses semantic Tailwind tokens that automatically adapt to the current theme.

---

## Table of Contents
- [Design philosophy](#design-philosophy)
- [DMP brand colors](#dmp-brand-colors)
- [The two-layer color system](#the-two-layer-color-system)
- [How to use colors in components](#how-to-use-colors-in-components)
- [Dark mode implementation](#dark-mode-implementation)
- [The sidebar exception](#the-sidebar-exception)
- [Component library (ui.tsx)](#component-library-uitsx)
- [Typography](#typography)
- [Spacing and sizing](#spacing-and-sizing)
- [Animation tokens](#animation-tokens)
- [Status colors](#status-colors)
- [The cn() utility](#the-cn-utility)
- [Charts and data visualization](#charts-and-data-visualization)
- [Responsive design patterns](#responsive-design-patterns)
- [Adding a new component](#adding-a-new-component)

---

## Design philosophy

The DMP CMS follows these principles:

1. **Dignified and professional** — This is a cemetery management tool. The design should feel calm, trustworthy, and serious. No playful animations, no bright startup colors.

2. **Functional over decorative** — Staff use this app all day. Every design decision must justify itself in terms of usability (contrast, readability, click target size).

3. **Branded but not overwhelming** — DMP forest green and gold appear in the sidebar, logo, and accents. The main content area stays neutral (white/light gray in light mode, slate in dark mode) so the data is the focus.

4. **Works on iPad** — The primary device at cemetery offices is an iPad. The minimum touch target size is 44px (set as `--touch-target-min: 44px`). Table layouts collapse to cards on small screens.

---

## DMP brand colors

These are the official Detroit Memorial Park colors. They appear in the sidebar and are never used as generic UI colors (they're too specific to work as "primary" everywhere).

| Name | Hex | HSL | Usage |
|---|---|---|---|
| **DMP Forest Green** | `#1a3d2b` | ~145° 40% 17% | Sidebar background, login hero overlay |
| **DMP Gold** | `#c49a2c` | ~42° 62% 47% | Sidebar active indicator, gold accents, anniversary card |
| Dark green (deeper) | `#0f2419` | ~145° 47% 10% | Sidebar hover state, gradient backgrounds |
| Light gold | `#d4aa3c` | ~42° 62% 53% | Gold hover state |

**Where these constants live:** `src/components/Layout.tsx` at the very top:

```tsx
const DMP_GREEN = '#1a3d2b';
const DMP_GOLD = '#c49a2c';
```

**Important:** These are used as **inline styles** on the sidebar and mobile nav, not as CSS variables or Tailwind classes. This is intentional — see [The sidebar exception](#the-sidebar-exception) below.

---

## The two-layer color system

The design system uses two layers of color abstraction.

### Layer 1: Primitives (raw color scales)

Defined in `src/styles/index.css` as CSS custom properties. These are fixed values that never change between light and dark mode:

```css
/* Slate — the neutral palette */
--slate-50: 210 40% 98%;
--slate-100: 210 40% 96%;
/* ... through --slate-950 */

/* Primary — deep teal/blue */
--primary-50: 199 89% 97%;
/* ... through --primary-950 */

/* Plus: success (emerald), warning (amber), danger (rose), info (cyan) */
```

These are pure color values. You should rarely use them directly.

### Layer 2: Semantic tokens (purpose-driven names)

Also in `src/styles/index.css`, these reference the primitives and change between light/dark mode:

```css
:root {
  /* Light mode */
  --background: 0 0% 100%;          /* white */
  --foreground: var(--slate-900);   /* near-black text */
  --card: 0 0% 100%;
  --border: var(--slate-200);
  --primary: var(--primary-600);
}

.dark {
  /* Dark mode — same token names, different values */
  --background: var(--slate-950);   /* near-black */
  --foreground: var(--slate-50);    /* near-white text */
  --card: var(--slate-900);
  --border: var(--slate-800);
  --primary: var(--primary-500);
}
```

When you use `bg-background` in a component, it automatically shows white in light mode and near-black in dark mode. You write the class once; the theme does the work.

**All semantic tokens:**

| Token | Light value | Dark value | Use for |
|---|---|---|---|
| `background` | white | slate-950 | Page background |
| `background-subtle` | slate-50 | slate-900 | Section backgrounds, hover states |
| `background-muted` | slate-100 | slate-800 | Disabled inputs, empty states |
| `background-elevated` | white | slate-900 | Modals, dropdowns (above page level) |
| `foreground` | slate-900 | slate-50 | Primary text |
| `foreground-muted` | slate-500 | slate-400 | Secondary text, placeholders |
| `foreground-subtle` | slate-400 | slate-500 | Tertiary text, timestamps |
| `card` | white | slate-900 | Card/panel backgrounds |
| `card-foreground` | slate-900 | slate-50 | Text inside cards |
| `border` | slate-200 | slate-800 | Default borders |
| `border-hover` | slate-300 | slate-700 | Borders on hover |
| `border-focus` | primary-500 | primary-500 | Focus rings |
| `primary` | primary-600 | primary-500 | Buttons, links, active indicators |
| `primary-hover` | primary-700 | primary-400 | Button hover state |
| `primary-foreground` | white | slate-950 | Text on primary backgrounds |
| `secondary` | slate-100 | slate-800 | Secondary buttons, tags |
| `destructive` | danger-600 | danger-500 | Delete buttons, error states |

---

## How to use colors in components

### Using semantic tokens (preferred)

```tsx
// Background and text
<div className="bg-background text-foreground">

// Card
<div className="bg-card text-card-foreground border border-border rounded-lg">

// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary-hover">

// Muted text
<p className="text-foreground-muted text-sm">

// Input
<input className="bg-input border border-border focus:border-border-focus">
```

### Using the component library (better)

Instead of building from scratch, use the pre-built components in `src/components/ui.tsx` — they already apply the right tokens:

```tsx
import { Button, Card, Input } from '../components/ui'

<Button variant="primary">Save</Button>
<Card><CardBody>content here</CardBody></Card>
<Input label="First name" placeholder="Enter name..." />
```

### What NOT to do

```tsx
// Bad — hardcoded color, breaks dark mode:
<div className="bg-white text-gray-900">

// Bad — Tailwind built-in (not connected to our token system):
<div className="bg-blue-500">

// Bad — inline style for a semantic color:
<div style={{ backgroundColor: 'white' }}>
```

---

## Dark mode implementation

Dark mode is toggled by adding/removing the `dark` class on the `<html>` element. The toggle button lives in `src/components/Layout.tsx` (in the topbar area).

```tsx
// How the toggle works conceptually:
document.documentElement.classList.toggle('dark')
```

Tailwind's `darkMode: 'class'` config (in `tailwind.config.js:7`) means Tailwind generates dark-variant classes when the `dark` class is present on `<html>`. Our CSS custom properties (in `src/styles/index.css`) do the rest — the semantic tokens change value inside `.dark {}`.

**The result:** any component using semantic tokens automatically supports dark mode. No per-component dark: variants needed.

---

## The sidebar exception

The sidebar breaks the standard theming system. Here's why and how.

**The problem:** CSS custom property tokens like `--background` change between light and dark mode. If the sidebar used `bg-sidebar` (which points to `--sidebar`), it would show as white in light mode — the exact opposite of the DMP branded look we want.

**The solution:** The sidebar uses hardcoded inline styles that are always dark green, regardless of the theme class:

```tsx
// src/components/Layout.tsx
const DMP_GREEN = '#1a3d2b';
const DMP_GOLD = '#c49a2c';

// Sidebar element:
<aside style={{ backgroundColor: DMP_GREEN }}>

// Active nav item gold bar:
<span style={{ backgroundColor: DMP_GOLD }} />

// Navigation item text (always light, since background is dark):
<span style={{ color: '#fff' }}>
```

**Why inline styles instead of CSS variables?** If we added `--dmp-green: #1a3d2b` to `:root` and used it, it would still change in `.dark {}` if we set a dark-mode variant. Inline styles can't be overridden by CSS class rules (highest specificity short of `!important`), so the sidebar color is guaranteed to stay dark green regardless of the theme.

**Where CSS variables ARE used in the sidebar:** The sidebar item hover state uses `rgba(255,255,255,0.1)` (white at 10% opacity) — this works whether the background is green or any other dark color.

---

## Component library (ui.tsx)

All reusable components live in `src/components/ui.tsx`. Here is the complete inventory:

### Button

```tsx
<Button
  variant="primary" | "secondary" | "outline" | "ghost" | "destructive"
  size="sm" | "md" | "lg"
  disabled={false}
  isLoading={false}   // shows spinner, disables interaction
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  onClick={() => {}}
>
  Label
</Button>
```

Variants:
- `primary` — DMP primary blue, white text, filled
- `secondary` — subtle background, secondary foreground
- `outline` — transparent with border
- `ghost` — transparent, shows background on hover
- `destructive` — red background for delete/dangerous actions

### Alert

```tsx
<Alert
  title="Error title"
  message="Descriptive error message"
  details="Optional stack trace or extra info"
  variant="error" | "warning" | "success" | "info"
  onDismiss={() => setError(null)}   // omit for non-dismissible
/>
```

### Card / CardHeader / CardBody / CardFooter

```tsx
<Card hoverable padding="none" | "sm" | "md" | "lg">
  <CardHeader>Title section</CardHeader>
  <CardBody>Main content</CardBody>
  <CardFooter>Actions</CardFooter>
</Card>
```

`hoverable` adds a subtle shadow and background shift on hover — use for clickable cards.

### Badge

```tsx
<Badge
  variant="primary" | "secondary" | "success" | "warning" | "danger" | "info" | "neutral"
  size="sm" | "md"
  dot={true}   // shows a colored dot instead of text
>
  Status text
</Badge>
```

Used extensively in work order status (Pending, In Progress, Completed) and burial status.

### Modal

```tsx
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Modal title"
  description="Optional subtitle"
  size="sm" | "md" | "lg" | "xl"
  footer={<><Button>Cancel</Button><Button variant="primary">Save</Button></>}
>
  Modal content here
</Modal>
```

Renders in a React portal over all other content. Press Escape or click outside to close.

### Input / Select / Textarea

```tsx
<Input
  label="Field label"
  error="Validation error message"
  hint="Helper text below the input"
  icon={<SearchIcon />}   // optional leading icon
  id="field-id"           // auto-generated if omitted
  type="text"             // or any HTML input type
  {...otherInputProps}
/>

<Select
  label="Choose option"
  options={[{ value: 'a', label: 'Option A' }]}
  placeholder="Select..."
  error="..."
/>

<Textarea
  label="Notes"
  error="..."
  hint="Max 500 characters"
  rows={4}
/>
```

All three handle the label + error + hint pattern. The `id` prop connects the label to the input for accessibility; if omitted, a `useId()` hook generates one automatically.

### EmptyState

```tsx
<EmptyState
  icon={<FolderOpen />}
  title="No burials found"
  description="Add a burial record to get started."
  action={<Button onClick={...}>Add Burial</Button>}
/>
```

Used when a table or list has no data to display.

### LoadingSpinner / Skeleton

```tsx
<LoadingSpinner size="sm" | "md" | "lg" />

<Skeleton className="h-4 w-32" />   // use like a div placeholder
```

`Skeleton` uses a CSS animation shimmer. Compose them to match the shape of the loading content.

### Avatar

```tsx
<Avatar
  src="/profile.jpg"   // optional — shows initials if missing
  alt="User Name"
  fallback="UN"        // initials shown when image missing/fails
  size="sm" | "md" | "lg" | "xl"
/>
```

### Tooltip

```tsx
<Tooltip content="This action cannot be undone">
  <Button variant="destructive">Delete</Button>
</Tooltip>
```

Shows on hover. The `content` is the tooltip text; `children` is the element that triggers it.

---

## Typography

The app uses the system font stack (no custom font loaded):

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
  'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
  'Helvetica Neue', sans-serif;
```

This means: on Mac it's San Francisco, on Windows it's Segoe UI, on Linux it's Roboto/Ubuntu. This avoids a font download, which matters for a frequently-used internal tool.

**Text size scale (Tailwind defaults):**

| Class | Size | Use for |
|---|---|---|
| `text-xs` | 12px | Timestamps, metadata, badge labels |
| `text-sm` | 14px | Table rows, secondary content, form hints |
| `text-base` | 16px | Body text, input values |
| `text-lg` | 18px | Card titles, section headers |
| `text-xl` | 20px | Page section headings |
| `text-2xl` | 24px | Page titles |
| `text-3xl` | 30px | Dashboard stat numbers |

**Font weights:**

| Class | Weight | Use for |
|---|---|---|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Labels, emphasized text |
| `font-semibold` | 600 | Card titles, column headers |
| `font-bold` | 700 | Page titles, stat numbers |

---

## Spacing and sizing

The app uses Tailwind's default 4px-base spacing scale. Custom spacing tokens are defined but rarely used directly:

```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */
```

In practice, use Tailwind's `p-`, `m-`, `gap-` classes directly. The custom tokens exist for reference in design conversations.

**Border radius:**

| CSS Variable | Value | Tailwind class |
|---|---|---|
| `--radius-sm` | 4px | `rounded-sm` |
| `--radius-md` | 8px | `rounded` or `rounded-md` |
| `--radius-lg` | 12px | `rounded-lg` |
| `--radius-xl` | 16px | `rounded-xl` |

**Minimum touch target:** All interactive elements (buttons, links, form controls) have `min-height: var(--touch-target-min)` = 44px. This is enforced in `src/styles/index.css:297` and ensures the app is usable on touchscreens without accidentally tapping the wrong thing.

---

## Animation tokens

Three animation durations are available:

| Variable | Value | Tailwind class | Use for |
|---|---|---|---|
| `--transition-fast` | 150ms | `duration-fast` | Hover states, color changes |
| `--transition-base` | 200ms | `duration-DEFAULT` | Modal opens, accordion |
| `--transition-slow` | 300ms | `duration-slow` | Page transitions |

Predefined animations (use as `animate-*` classes):

- `animate-fade-in` — opacity 0 → 1
- `animate-slide-up` — translateY(8px) + opacity 0 → normal
- `animate-scale-in` — scale(0.95) + opacity 0 → normal

```tsx
<div className="animate-fade-in">
  This fades in when it mounts.
</div>
```

---

## Status colors

Used in badges and status indicators across work orders, burials, contracts:

| Status | CSS Token | Hex (approx) | Tailwind |
|---|---|---|---|
| Pending | `--status-pending` → warning-500 | #F59E0B amber | `text-warning` `bg-warning-50` |
| In Progress | `--status-in-progress` → info-500 | #06B6D4 cyan | `text-info` `bg-info-50` |
| Completed | `--status-completed` → success-500 | #10B981 emerald | `text-success` `bg-success-50` |
| Cancelled | `--status-cancelled` → slate-400 | #94A3B8 slate | `text-slate-400` `bg-slate-50` |

When showing a status badge:

```tsx
const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

<Badge variant={statusVariant[workOrder.status]}>
  {workOrder.status.replace('_', ' ')}
</Badge>
```

---

## The cn() utility

`cn()` is a helper that merges Tailwind class names intelligently. It's used everywhere in the component library.

```tsx
import { cn } from '../lib/utils'   // or wherever it's defined

// Basic usage — merge conditional classes:
<div className={cn(
  "base-class another-class",
  isActive && "active-class",
  isDisabled && "opacity-50 cursor-not-allowed",
  className  // pass through user-provided className prop
)}>
```

**Why not just use template literals?**

Template literals can't deduplicate conflicting Tailwind classes. If you do:
```tsx
className={`bg-blue-500 ${isError ? 'bg-red-500' : ''}`}
```
Both `bg-blue-500` and `bg-red-500` end up in the class string. Tailwind applies whichever appears last in its generated CSS (which may not be the last in your string). `cn()` uses `clsx` + `tailwind-merge` under the hood to resolve conflicts correctly — the last class wins.

---

## Charts and data visualization

The Financial page and Dashboard use [Recharts](https://recharts.org) for charts. Key patterns used in the codebase:

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--foreground-muted))' }} />
    <YAxis tick={{ fill: 'hsl(var(--foreground-muted))' }} />
    <Tooltip
      contentStyle={{
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '8px',
      }}
    />
    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**DMP color convention for charts:**
- Primary series: `hsl(var(--primary))` — adapts to light/dark
- Secondary series: `hsl(var(--success-500))`
- Tertiary series: `hsl(var(--warning-500))`
- Grid lines: `hsl(var(--border))` — adapts to light/dark
- Axis labels: `hsl(var(--foreground-muted))`

---

## Responsive design patterns

### Breakpoints (Tailwind defaults)

| Prefix | Min-width | Typical device |
|---|---|---|
| (none) | 0px | Mobile portrait |
| `sm:` | 640px | Mobile landscape |
| `md:` | 768px | iPad portrait |
| `lg:` | 1024px | iPad landscape / small desktop |
| `xl:` | 1280px | Desktop |

### Sidebar behavior

- **Desktop (lg+):** Sidebar is always visible as a fixed left panel
- **Mobile/tablet:** Sidebar is hidden; hamburger menu in topbar opens it as a slide-in overlay

### Table to card collapse

On pages with data tables, small screens show cards instead of rows:

```tsx
{/* Hidden on mobile, shown on desktop */}
<table className="hidden lg:table">

{/* Shown on mobile, hidden on desktop */}
<div className="lg:hidden space-y-3">
  {items.map(item => <MobileCard key={item.id} item={item} />)}
</div>
```

### Grid layouts

The Dashboard stats row:
```tsx
{/* 2 columns on mobile, 4 on desktop */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

---

## Adding a new component

1. **Check if a similar component already exists in `ui.tsx`** — prefer extending an existing component over creating a new one.

2. **Write the component in `src/components/ui.tsx`** (for truly reusable components) or inline in the page file (for one-off layouts):

```tsx
interface MyComponentProps {
  title: string
  variant?: 'default' | 'compact'
  className?: string
}

export function MyComponent({ title, variant = 'default', className }: MyComponentProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-lg",
      variant === 'compact' ? "p-2" : "p-4",
      className
    )}>
      <h3 className="font-semibold text-card-foreground">{title}</h3>
    </div>
  )
}
```

3. **Use semantic tokens** — `bg-card`, `text-card-foreground`, `border-border`. Not raw values.

4. **Accept a `className` prop** and pass it to the root element via `cn()`. This lets callers add spacing/layout classes without needing to override internals.

5. **Add a `children` prop for content slots** — avoid props that accept long JSX subtrees. Use children + slots instead.

---

← [10 Troubleshooting](10-troubleshooting.md) | Next: [12 Roadmap](12-roadmap.md) →
