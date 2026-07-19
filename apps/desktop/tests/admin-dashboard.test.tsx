import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../src/i18n'
import AdminDashboard from '../src/pages/admin/AdminDashboard'

vi.mock('@ihui/api-client', () => ({
  getAdminStats: vi.fn(async () => ({
    success: true,
    data: {
      totalUsers: 1234,
      totalProjects: 56,
      todayRevenue: 789.5,
      activeSessions: 12,
      totalUsersChange: 10,
      totalProjectsChange: 2,
      todayRevenueChange: -3,
      activeSessionsChange: 5,
    },
  })),
}))

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, createElement(MemoryRouter, null, ui))
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows loading then renders 4 stat cards', async () => {
    render(wrap(createElement(AdminDashboard)))
    expect(screen.getByTestId('admin-dashboard-loading')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeTruthy())
    expect(screen.getByText('用户总数')).toBeTruthy()
    expect(screen.getByText('项目总数')).toBeTruthy()
    expect(screen.getByText('今日收入(元)')).toBeTruthy()
    expect(screen.getByText('当前在线会话')).toBeTruthy()
  })

  it('refresh button re-invokes getAdminStats', async () => {
    const { getAdminStats } = await import('@ihui/api-client')
    render(wrap(createElement(AdminDashboard)))
    await waitFor(() => expect(screen.getByTestId('admin-dashboard')).toBeTruthy())
    expect((getAdminStats as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    fireEvent.click(screen.getByTestId('admin-dashboard-refresh'))
    await waitFor(() => expect((getAdminStats as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2))
  })
})
