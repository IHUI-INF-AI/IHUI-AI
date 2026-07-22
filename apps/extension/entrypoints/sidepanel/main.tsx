import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import SidepanelApp from './SidepanelApp'
import { I18nProvider } from '../../src/i18n'
import './globals.css'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <MemoryRouter>
        <SidepanelApp />
      </MemoryRouter>
    </I18nProvider>
  </React.StrictMode>,
)
