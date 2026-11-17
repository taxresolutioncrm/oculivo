/** Oculivo's independent release manifest. This version becomes public only on deployment. */
export const release = {
  product: 'Oculivo',
  version: '3.0.1',
  releasedAt: 'Pending production deployment',
  title: 'Live Workspace & Team Chat Recovery',
  notes: [
    'Formal semantic versioning begins with this release baseline',
    'Production release history is now tracked inside Oculivo',
    'Release notes dialog added with body-level portal layering',
    'Real dashboard workspace cards now link to operational modules using existing permissions and live practice counts',
    'Team Chat reloads channels and messages and clears stale policy errors after successful refresh'
  ]
} as const
