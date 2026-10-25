import { describe, it, expect, vi } from 'vitest'
vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})
