/** Oculivo's independent release manifest. This version becomes public only on deployment. */
export const release = {
  product: 'Oculivo',
  version: '3.0.1',
  releasedAt: 'Pending production deployment',
  title: 'Bilingual Communications Notifications',
  notes: [
    'Existing inbox bell is enhanced with exact practice-scoped email/SMS unread counts and a mobile-safe bilingual notification sheet',
    'No second notification bell, unauthorized practice data or unverified phone event delivery is introduced',
    'Formal semantic versioning begins with this release baseline',
    'Production release history is now tracked inside Oculivo',
    'Release notes dialog added with body-level portal layering'
  ]
} as const
