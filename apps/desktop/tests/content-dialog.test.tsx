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
  it('shows required errors for required fields when empty', async () => {
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
      // announcement requires title + content → both must show formFieldRequired
      expect(screen.getAllByText('此项必填').length).toBeGreaterThanOrEqual(2)
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with { type, values } when form is valid', async () => {
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
    fireEvent.change(screen.getByTestId('content-dialog-sort'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('content-dialog-create-submit'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const arg = onSubmit.mock.calls[0]![0] as {
      type: string
      values: Record<string, string | number | boolean>
    }
    expect(arg.type).toBe('article')
    expect(arg.values.title).toBe('hello')
    expect(arg.values.content).toBe('world')
    expect(arg.values.sort).toBe(5)
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

  it('prefills values from row in edit mode for help-article', async () => {
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
    const statusSelect = screen.getByTestId('content-dialog-isPublished') as HTMLSelectElement
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

  // ============ 10 type field coverage ============

  it('help-category renders name (not title) and slug fields', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'help-category',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-name')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-slug')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-description')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-icon')).toBeTruthy()
    expect(screen.queryByTestId('content-dialog-title')).toBeNull()
  })

  it('doc renders title + content + category + status fields', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'doc',
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-title')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-content')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-category')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-status')).toBeTruthy()
  })

  it('advertise renders position + imageUrl as required (url kind)', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'advertise',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    const position = (await screen.findByTestId('content-dialog-position')) as HTMLInputElement
    const imageUrl = screen.getByTestId('content-dialog-imageUrl') as HTMLInputElement
    const linkUrl = screen.getByTestId('content-dialog-linkUrl') as HTMLInputElement
    expect(position.type).toBe('text')
    expect(imageUrl.type).toBe('url')
    expect(linkUrl.type).toBe('url')
    // submit empty → required errors
    fireEvent.click(screen.getByTestId('content-dialog-create-submit'))
    await waitFor(() => {
      expect(screen.getAllByText('此项必填').length).toBeGreaterThanOrEqual(2)
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('about-us renders network + phone + socialMedia + experience + description', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'about-us',
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-network')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-phone')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-socialMedia')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-experience')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-description')).toBeTruthy()
  })

  it('contact renders introduction (required) + corporateCulture', async () => {
    const onSubmit = vi.fn()
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'contact',
          onClose: () => {},
          onSubmit,
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-introduction')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-corporateCulture')).toBeTruthy()
    fireEvent.click(screen.getByTestId('content-dialog-create-submit'))
    await waitFor(() => {
      expect(screen.getByText('此项必填')).toBeTruthy()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('recommendation renders key (required) + value + description + isPublic + config type', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'recommendation',
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-key')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-value')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-description')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-isPublic')).toBeTruthy()
    // 'type' field (config 类型) shares testid with outer type select — verify by label
    expect(screen.getByText('配置类型')).toBeTruthy()
  })

  it('mobile-adapter renders same fields as recommendation', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'mobile-adapter',
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-key')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-value')).toBeTruthy()
    expect(screen.getByTestId('content-dialog-isPublic')).toBeTruthy()
  })

  it('switching type in create mode rerenders fields', async () => {
    render(
      wrap(
        createElement(ContentDialog, {
          open: true,
          mode: 'create',
          defaultType: 'announcement',
          onClose: () => {},
          onSubmit: () => {},
        }),
      ),
    )
    expect(await screen.findByTestId('content-dialog-title')).toBeTruthy()
    const typeSelect = screen.getByTestId('content-dialog-type') as HTMLSelectElement
    fireEvent.change(typeSelect, { target: { value: 'help-category' } })
    await waitFor(() => {
      expect(screen.getByTestId('content-dialog-name')).toBeTruthy()
    })
    expect(screen.queryByTestId('content-dialog-title')).toBeNull()
  })
})
