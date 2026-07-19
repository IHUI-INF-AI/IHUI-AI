import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'
import { ContentDialog } from '../src/components/admin/ContentDialog'

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, ui)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ContentDialog', () => {
  it('shows required errors when title and content are empty', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'announcement',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    fireEvent.click(await screen.findByTestId('content-dialog-create-submit'))
    await waitFor(() => {
      expect(screen.getByText('请输入标题')).toBeTruthy()
      expect(screen.getByText('请输入内容')).toBeTruthy()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with the form values when valid', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'article',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    fireEvent.change(await screen.findByTestId('content-dialog-title'), {
      target: { value: 'hello' },
    })
    fireEvent.change(screen.getByTestId('content-dialog-content'), { target: { value: 'world' } })
    fireEvent.change(screen.getByTestId('content-dialog-sortOrder'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('content-dialog-create-submit'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const arg = onSubmit.mock.calls[0]![0] as {
      type: string
      title: string
      content: string
      sortOrder: number
    }
    expect(arg.type).toBe('article')
    expect(arg.title).toBe('hello')
    expect(arg.content).toBe('world')
    expect(arg.sortOrder).toBe(5)
  })

  it('disables the type select in edit mode', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'edit',
          defaultType: 'announcement',
          row: { id: 'x', title: 'old', content: 'body' },
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    const select = (await screen.findByTestId('content-dialog-type')) as HTMLSelectElement
    expect(select.disabled).toBe(true)
  })

  it('prefills values from row in edit mode', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'edit',
          defaultType: 'help-article',
          row: {
            id: 'h-1',
            title: 'existing',
            content: 'existing body',
            isPublished: true,
            sortOrder: 9,
          },
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    const titleInput = (await screen.findByTestId('content-dialog-title')) as HTMLInputElement
    const contentArea = screen.getByTestId('content-dialog-content') as HTMLTextAreaElement
    const sortInput = screen.getByTestId('content-dialog-sortOrder') as HTMLInputElement
    expect(titleInput.value).toBe('existing')
    expect(contentArea.value).toBe('existing body')
    expect(sortInput.value).toBe('9')
    const statusSelect = screen.getByTestId('content-dialog-status') as HTMLSelectElement
    expect(statusSelect.value).toBe('1')
  })

  it('does not render when closed', () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: false,
          mode: 'create',
          defaultType: 'announcement',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    expect(screen.queryByTestId('content-dialog-create-submit')).toBeNull()
  })
})
