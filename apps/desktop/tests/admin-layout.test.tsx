import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '../src/i18n'
import AdminLayout from '../src/components/admin/AdminLayout'
import AdminGuard from '../src/components/admin/AdminGuard'

function wrapAdminShell(path = '/admin') {
  return createElement(
    I18nProvider,
    null,
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/admin',
          element: createElement(
            AdminGuard,
            { user: { id: 'u1', roleId: 1 } as never },
            createElement(AdminLayout, null),
          ),
        }),
        createElement(Route, { path: '/', element: createElement('div', null, 'home') }),
      ),
    ),
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the shell with brand and 5 nav items', () => {
    render(wrapAdminShell())
    expect(screen.getByTestId('admin-shell')).toBeTruthy()
    expect(screen.getByText('IHUI')).toBeTruthy()
    expect(screen.getByTestId('admin-nav-dashboard')).toBeTruthy()
    expect(screen.getByTestId('admin-nav-users')).toBeTruthy()
    expect(screen.getByTestId('admin-nav-content')).toBeTruthy()
    expect(screen.getByTestId('admin-nav-orders')).toBeTruthy()
    expect(screen.getByTestId('admin-nav-settings')).toBeTruthy()
  })

  it('renders theme toggle button', () => {
    render(wrapAdminShell())
    expect(screen.getByTestId('admin-theme-toggle')).toBeTruthy()
  })
})

describe('AdminGuard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders children when user is admin', () => {
    render(
      createElement(
        I18nProvider,
        null,
        createElement(
          MemoryRouter,
          null,
          createElement(
            AdminGuard,
            { user: { id: 'u1', roleId: 1 } as never },
            createElement('div', { 'data-testid': 'protected' }, 'protected-content'),
          ),
        ),
      ),
    )
    expect(screen.getByTestId('protected')).toBeTruthy()
  })

  it('renders forbidden message when user is not admin', () => {
    render(
      createElement(
        I18nProvider,
        null,
        createElement(
          MemoryRouter,
          null,
          createElement(
            AdminGuard,
            { user: { id: 'u1', roleId: 0 } as never },
            createElement('div', { 'data-testid': 'protected' }, 'protected-content'),
          ),
        ),
      ),
    )
    expect(screen.getByTestId('admin-forbidden')).toBeTruthy()
  })

  it('renders forbidden message when user is null', () => {
    render(
      createElement(
        I18nProvider,
        null,
        createElement(
          MemoryRouter,
          null,
          createElement(
            AdminGuard,
            { user: null },
            createElement('div', { 'data-testid': 'protected' }, 'protected-content'),
          ),
        ),
      ),
    )
    expect(screen.getByTestId('admin-forbidden')).toBeTruthy()
  })
})

// Suppress unused import warning from vi in case future tests need it.
void vi
