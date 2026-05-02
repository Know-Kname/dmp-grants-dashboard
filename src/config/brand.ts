/**
 * DMP brand colors — single source of truth.
 * Hardcoded (not CSS variables) so brand-fixed elements like the
 * sidebar and login hero stay dark regardless of theme toggle.
 */

export const BRAND = {
  green: '#1a3d2b',
  greenDeep: '#0f2419',
  gold: '#c49a2c',
  goldLight: '#d4aa3c',
} as const;
