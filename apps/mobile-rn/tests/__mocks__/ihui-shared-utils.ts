// Stub for @ihui/shared/utils - vitest mock
// Re-exports the utility functions defined in ihui-shared.ts (base fallback).

// All utility functions are already exported from ihui-shared.ts as fallbacks:
// formatDate, formatDateByTemplate, formatDateOnly, formatShortDateTime,
// formatShortDate, formatShortDateWithYear, formatTimeOnly, formatTokenValue,
// formatShortDuration, formatFileSize, formatDuration, getRoleLabel, formatRelativeTime

// Re-export them explicitly so @ihui/shared/utils imports work too.
export {
  formatDate,
  formatDateByTemplate,
  formatDateOnly,
  formatShortDateTime,
  formatShortDate,
  formatShortDateWithYear,
  formatTimeOnly,
  formatTokenValue,
  formatShortDuration,
  formatFileSize,
  formatDuration,
  getRoleLabel,
  formatRelativeTime,
} from './ihui-shared'
