import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  listAdminContent: vi.fn(),
  createAdminContent: vi.fn(),
  updateAdminContent: vi.fn(),
  deleteAdminContent: vi.fn(),
}))

vi.mock('../src/lib/api/admin-content', () => ({
  CONTENT_TYPES: [
    'announcement',
    'help-article',
    'help-category',
    'doc',
    'article',
    'advertise',
    'about-us',
    'contact',
    'recommendation',
    'mobile-adapter',
  ],
  listAdminContent: mocks.listAdminContent,
  createAdminContent: mocks.createAdminContent,
  updateAdminContent: mocks.updateAdminContent,
  deleteAdminContent: mocks.deleteAdminContent,
}))

vi.mock('../src/components/admin/ContentDialog', () => ({
  ContentDialog: ({
    open,
    mode,
    onSubmit,
    onClose,
  }: {
    open: boolean
    mode: 'create' | 'edit'
    onSubmit: (v: { type: string; values: Record<string, string | number | boolean> }) => void
    onClose: () => void
  }) => {
    if (!open) return null
    const stubValues = {
      type: 'announcement',
      values: {
        title: 'Stub Title',
        content: 'Stub content body',
        isPublished: true,
        sortOrder: 7,
      },
    }
    return createElement(
      'div',
      { 'data-testid': `content-dialog-stub-${mode}` },
      createElement(
        'button',
        {
          'data-testid': `content-dialog-stub-${mode}-submit`,
          onClick: () => onSubmit(stubValues),
        },
        'submit',
      ),
      createElement(
        'button',
        { 'data-testid': `content-dialog-stub-${mode}-close`, onClick: onClose },
        'close',
      ),
    )
  },
}))

import AdminContent from '../src/pages/admin/AdminContent'

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, ui)
}

const SAMPLE_ROWS = [
  {
    id: 'a-1',
    title: '系统维护通知',
    content: '今晚 22:00 - 23:00 系统维护,期间服务暂停。',
    isPublished: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a-2',
    title: '春节活动',
    content: '春节期间充值双倍。',
    isPublished: false,
    sortOrder: 2,
    createdAt: '2026-02-01T00:00:00Z',
  },
]

const ALL_TYPES = [
  'announcement',
  'help-article',
  'help-category',
  'doc',
  'article',
  'advertise',
  'about-us',
  'contact',
  'recommendation',
  'mobile-adapter',
] as const

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.listAdminContent.mockResolvedValue({
    success: true,
    data: {
      list: SAMPLE_ROWS,
      total: SAMPLE_ROWS.length,
      page: 1,
      pageSize: 20,
      type: 'announcement',
    },
  })
})

describe('AdminContent', () => {
  it('renders all 10 tabs and lists rows for the default tab', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    for (const tp of ALL_TYPES) {
      expect(screen.getByTestId(`admin-content-tab-${tp}`)).toBeTruthy()
    }
    expect(screen.getByText('系统维护通知')).toBeTruthy()
    expect(screen.getByText('春节活动')).toBeTruthy()
  })

  it('opens the create dialog with create-mode stub', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-create'))
    expect(screen.getByTestId('content-dialog-stub-create')).toBeTruthy()
  })

  it('submits createAdminContent with body from form values and reloads', async () => {
    mocks.createAdminContent.mockResolvedValue({
      success: true,
      data: { item: SAMPLE_ROWS[0], type: 'announcement' },
    })
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-create'))
    await waitFor(() => expect(screen.getByTestId('content-dialog-stub-create')).toBeTruthy())
    fireEvent.click(screen.getByTestId('content-dialog-stub-create-submit'))
    await waitFor(() => expect(mocks.createAdminContent).toHaveBeenCalled())
    expect(mocks.createAdminContent).toHaveBeenCalledWith(
      'announcement',
      expect.objectContaining({
        title: 'Stub Title',
        content: 'Stub content body',
        isPublished: true,
        sortOrder: 7,
      }),
    )
    await waitFor(() => expect(mocks.listAdminContent.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('opens edit dialog when clicking edit on a row', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content-row-a-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-edit-a-1'))
    expect(screen.getByTestId('content-dialog-stub-edit')).toBeTruthy()
  })

  it('submits updateAdminContent when edit dialog confirms', async () => {
    mocks.updateAdminContent.mockResolvedValue({
      success: true,
      data: { item: SAMPLE_ROWS[0], type: 'announcement' },
    })
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content-row-a-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-edit-a-1'))
    await waitFor(() => expect(screen.getByTestId('content-dialog-stub-edit')).toBeTruthy())
    fireEvent.click(screen.getByTestId('content-dialog-stub-edit-submit'))
    await waitFor(() =>
      expect(mocks.updateAdminContent).toHaveBeenCalledWith(
        'announcement',
        'a-1',
        expect.objectContaining({ title: 'Stub Title' }),
      ),
    )
  })

  it('confirms and deletes content when clicking delete', async () => {
    mocks.deleteAdminContent.mockResolvedValue({
      success: true,
      data: { id: 'a-1', deleted: true, type: 'announcement' },
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content-row-a-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-delete-a-1'))
    await waitFor(() =>
      expect(mocks.deleteAdminContent).toHaveBeenCalledWith('announcement', 'a-1'),
    )
    confirmSpy.mockRestore()
  })

  it('does not call deleteAdminContent when user cancels the confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content-row-a-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-delete-a-1'))
    expect(mocks.deleteAdminContent).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('refetches when switching tabs', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('announcement', expect.anything()),
    )
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-help-article'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('help-article', expect.anything()),
    )
  })

  it('shows an action error when create fails', async () => {
    mocks.createAdminContent.mockResolvedValue({ success: false, error: '权限不足' })
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-content-create'))
    await waitFor(() => expect(screen.getByTestId('content-dialog-stub-create')).toBeTruthy())
    fireEvent.click(screen.getByTestId('content-dialog-stub-create-submit'))
    await waitFor(() =>
      expect(screen.getByTestId('admin-content-action-error').textContent).toContain('权限不足'),
    )
  })

  // ============ 10 type tab coverage ============

  it('switches to help-category tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-help-category'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('help-category', expect.anything()),
    )
  })

  it('switches to doc tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-doc'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('doc', expect.anything()),
    )
  })

  it('switches to about-us tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-about-us'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('about-us', expect.anything()),
    )
  })

  it('switches to contact tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-contact'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('contact', expect.anything()),
    )
  })

  it('switches to recommendation tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-recommendation'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('recommendation', expect.anything()),
    )
  })

  it('switches to mobile-adapter tab and refetches with that type', async () => {
    render(wrap(createElement(AdminContent)))
    await waitFor(() => expect(screen.getByTestId('admin-content')).toBeTruthy())
    mocks.listAdminContent.mockClear()
    fireEvent.click(screen.getByTestId('admin-content-tab-mobile-adapter'))
    await waitFor(() =>
      expect(mocks.listAdminContent).toHaveBeenCalledWith('mobile-adapter', expect.anything()),
    )
  })
})
