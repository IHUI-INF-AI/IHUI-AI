import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import SidepanelApp from './SidepanelApp'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import CoursePage from './pages/CoursePage'
import SettingsPage from './pages/SettingsPage'
import './style.css'

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<SidepanelApp />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="courses" element={<CoursePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
