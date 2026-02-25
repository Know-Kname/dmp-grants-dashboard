# Figma to Code Workflow

## Overview

This document describes the design-to-code workflow for the DMP Cemetery Management application.

## Design Token Pipeline

```
Figma Variables → Token Extraction → tailwind.config.js → CSS Classes → React Components
```

## Setup

### Prerequisites

1. **Figma Access Token**: Generate at https://www.figma.com/developers/api#access-tokens
2. **Figma File ID**: Found in the Figma file URL
3. Set environment variables:
   ```
   FIGMA_ACCESS_TOKEN=your-token
   FIGMA_FILE_ID=your-file-id
   ```

### Token Extraction Tool

We use design token extraction to keep the codebase in sync with Figma:

```bash
# Sync tokens from Figma (when configured)
npm run tokens:sync
```

The automated GitHub Action (`.github/workflows/design-tokens.yml`) runs weekdays at 8am UTC.

## Component Implementation Workflow

### 1. Designer Creates Component in Figma

- Uses design system variables for colors, spacing, typography
- Documents component states (default, hover, focus, disabled)
- Notes responsive behavior and breakpoints

### 2. Developer Reviews Design

Before implementing:
- [ ] Analyze component structure
- [ ] Identify required design tokens
- [ ] Check if similar components exist in `src/components/ui.tsx`
- [ ] Note interactive states and animations
- [ ] Check accessibility requirements

### 3. Developer Implements Component

```tsx
// Use design tokens from Tailwind, not hardcoded values
import { type ReactNode } from 'react';

interface ComponentProps {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export const Component = ({ variant = 'primary', children }: ComponentProps) => {
  return (
    <div className="bg-primary-500 text-white p-4 rounded-lg shadow-md">
      {children}
    </div>
  );
};
```

### 4. Design QA via Preview Deployment

1. Push code and create PR
2. Vercel generates preview deployment URL
3. Share preview URL with designer
4. Designer compares side-by-side with Figma
5. Feedback added as PR comments
6. Iterate until approved

### 5. Merge with Design Approval

PR checklist for UI changes:
- [ ] Figma link included in PR description
- [ ] Design tokens used (no hardcoded values)
- [ ] All component states implemented
- [ ] Responsive behavior verified
- [ ] Accessibility tested
- [ ] Designer approved via PR review

## Design Token Mapping

### Colors

| Figma Variable | Tailwind Class | CSS Variable |
|----------------|----------------|-------------|
| Primary/500 | `bg-primary-500` | `--color-primary-500` |
| Neutral/100 | `bg-gray-100` | `--color-gray-100` |

### Spacing

| Figma Value | Tailwind Class |
|-------------|----------------|
| 4px | `p-1`, `m-1`, `gap-1` |
| 8px | `p-2`, `m-2`, `gap-2` |
| 16px | `p-4`, `m-4`, `gap-4` |
| 24px | `p-6`, `m-6`, `gap-6` |
| 32px | `p-8`, `m-8`, `gap-8` |

### Typography

| Figma Style | Tailwind Classes |
|-------------|-----------------|
| Heading 1 | `text-3xl font-bold` |
| Heading 2 | `text-2xl font-semibold` |
| Body | `text-base` |
| Caption | `text-sm text-gray-500` |

## Figma MCP Integration

The Figma MCP server is configured for direct access from Cursor:

```
Use the Figma MCP to extract design specifications from [file/frame].
```

Capabilities:
- Read design variables and tokens
- Extract component hierarchy
- Access frame content
- View design system documentation

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Colors don't match | Verify token mapping in `tailwind.config.js` |
| Font looks different | Check web font is loaded correctly |
| Spacing is off | Compare Figma auto-layout values to Tailwind scale |
| Missing component | Check `src/components/ui.tsx` for existing patterns |
