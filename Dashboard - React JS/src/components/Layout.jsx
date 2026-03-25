import { useState, useEffect } from 'react'
import Topbar from './Topbar'

export default function Layout({ children }) {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('adminator-theme')
    if (stored === null || stored === 'dark') setDarkMode(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('adminator-theme', darkMode ? 'dark' : 'light')
    window.dispatchEvent(new CustomEvent('adminator:themeChanged', { detail: { theme: darkMode ? 'dark' : 'light' } }))
  }, [darkMode])

  return (
    <div className="layout">
      <Topbar
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(!darkMode)}
      />
      <main className="layout__content">
        {children}
      </main>
      <footer className="layout__footer">
        Copyright © 2026 Group 12. All rights reserved.
      </footer>
    </div>
  )
}
