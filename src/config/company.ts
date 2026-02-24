/**
 * Detroit Memorial Park - Company Configuration
 * Real company information for the cemetery management system
 */

export const COMPANY = {
  // Basic Information
  name: "Detroit Memorial Park Association, Inc.",
  shortName: "Detroit Memorial Park",
  abbreviation: "DMP",
  tagline: "Preserving Memories Since 1925",
  established: 1925,

  // Contact Information
  phone: {
    main: "(586) 751-1313",
    eastCemetery: "(586) 751-1313",
    westCemetery: "(313) 533-1302",
    gracelawn: "(810) 785-7890",
  },

  email: {
    general: "info@detroitmemorialpark.org",
    support: "support@detroitmemorialpark.org",
  },

  website: "https://detroitmemorialpark.org",

  // Locations
  locations: {
    east: {
      name: "Detroit Memorial Park East",
      address: "4280 E. Thirteen Mile Rd",
      city: "Warren",
      state: "MI",
      zip: "48092",
      phone: "(586) 751-1313",
      fullAddress: "4280 E. Thirteen Mile Rd, Warren, MI 48092",
      coordinates: { lat: 42.5167, lng: -83.0167 },
    },
    west: {
      name: "Detroit Memorial Park West",
      address: "25062 Plymouth Road",
      city: "Redford",
      state: "MI",
      zip: "48239",
      phone: "(313) 533-1302",
      fullAddress: "25062 Plymouth Road, Redford, MI 48239",
      coordinates: { lat: 42.3833, lng: -83.3 },
    },
    gracelawn: {
      name: "Gracelawn Cemetery",
      address: "5710 N. Saginaw Street",
      city: "Flint",
      state: "MI",
      zip: "48505",
      phone: "(810) 785-7890",
      fullAddress: "5710 N. Saginaw Street, Flint, MI 48505",
      coordinates: { lat: 43.05, lng: -83.6833 },
    },
  },

  // Business Hours
  hours: {
    weekday: { open: "9:00 AM", close: "5:00 PM" },
    saturday: { open: "10:00 AM", close: "3:00 PM" },
    sunday: "Closed",
  },

  // Description
  description:
    "Detroit Memorial Park Association operates three cemetery locations across Michigan, spanning over 170 acres. Recognized by the State of Michigan as an Official Historic Site, we feature specialized sections for family estates, veterans, children, and notable figures.",

  // Services
  services: [
    "Full-Service Burials",
    "Cremation Services",
    "Pre-Need Planning",
    "At-Need Services",
    "Memorialization",
    "Grief Counseling",
    "Veteran Services",
    "Monument Sales",
  ],

  // Legal
  legal: {
    copyright: `© ${new Date().getFullYear()} Detroit Memorial Park Association, Inc.`,
    allRightsReserved: "All rights reserved.",
  },

  // Social Media (placeholders - update with real links if available)
  social: {
    facebook: "https://facebook.com/detroitmemorialpark",
    instagram: null,
    linkedin: null,
  },

  // System Info
  system: {
    name: "Cemetery Management System",
    version: "1.0.0",
    buildDate: "2026",
  },
} as const;

// Type exports for TypeScript
export type Location =
  (typeof COMPANY.locations)[keyof typeof COMPANY.locations];
export type LocationKey = keyof typeof COMPANY.locations;
