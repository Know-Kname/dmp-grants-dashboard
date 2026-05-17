/**
 * Generic clinic/lab configuration — replace with real values when deploying.
 * This is intentionally generic so the template works for any medical lab.
 */
export const clinic = {
  name: 'Your Medical Laboratory',
  address: '123 Lab Drive, Suite 100',
  city: 'Anytown',
  state: 'MI',
  zip: '48000',
  phone: '(555) 000-0000',
  fax: '(555) 000-0001',
  clia: 'XX-D0000000',
  director: 'Director, MD',
  timezone: 'America/Detroit',
} as const;
