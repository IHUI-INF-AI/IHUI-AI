import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (
    msg.includes('The above error occurred') ||
    msg.includes('Consider adding an error boundary') ||
    msg.includes('Uncaught [Error:')
  ) {
    return
  }
  console.warn(...args)
})

beforeEach(() => {
  resetAsyncStorageMock()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

export { render }
