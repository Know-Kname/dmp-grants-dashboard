/**
 * RIP Cemetery Management — Operator Configuration
 * Customize this file with your cemetery's information.
 * All values here are safe to commit (no secrets).
 */

export const COMPANY = {
  // Basic Information
  name: 'Your Cemetery Name',
  shortName: 'Your Cemetery',
  abbreviation: 'YC',
  tagline: 'Serving Families Since [Year]',
  established: 2024,

  // Contact Information
  phone: {
    main: '(555) 000-0000',
  },

  email: {
    general: 'info@yourcemetery.com',
    support: 'support@yourcemetery.com',
  },

  website: 'https://yourcemetery.com',

  // Locations — add or remove entries to match your properties
  locations: {
    main: {
      name: 'Main Cemetery',
      address: '123 Cemetery Lane',
      city: 'Your City',
      state: 'MI',
      zip: '00000',
      phone: '(555) 000-0000',
      fullAddress: '123 Cemetery Lane, Your City, MI 00000',
      coordinates: { lat: 42.0, lng: -83.0 },
    },
  },

  // Business Hours
  hours: {
    weekday: { open: '9:00 AM', close: '5:00 PM' },
    saturday: { open: '10:00 AM', close: '3:00 PM' },
    sunday: 'Closed',
  },

  // Description
  description: 'A professional cemetery management platform for independent cemetery operators.',

  // Services
  services: [
    'Full-Service Burials',
    'Cremation Services',
    'Pre-Need Planning',
    'At-Need Services',
    'Memorialization',
    'Grief Counseling',
    'Veteran Services',
    'Monument Sales',
  ],

  // Legal
  legal: {
    copyright: `© ${new Date().getFullYear()} Your Cemetery Name`,
    allRightsReserved: 'All rights reserved.',
  },

  // Social Media
  social: {
    facebook: null,
    instagram: null,
    linkedin: null,
  },

  // System Info
  system: {
    name: 'RIP Cemetery Management',
    version: '1.0.0',
    buildDate: '2026',
  },
} as const;

// Type exports for TypeScript
export type Location = typeof COMPANY.locations[keyof typeof COMPANY.locations];
export type LocationKey = keyof typeof COMPANY.locations;
