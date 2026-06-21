const { app, BrowserWindow } = require('electron')
const path = require('node:path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const isDev = process.env.NODE_ENV === 'development'
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:8888'
      : `file://${path.join(__dirname, '../dist/electron/index.html')}`
  )

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow == null) createWindow()
})
