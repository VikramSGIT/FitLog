import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './components/ThemeProvider'

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider />
    </React.StrictMode>
  )
}

