export default function Topbar({ darkMode, onDarkModeToggle }) {
  return (
    <header className="topbar">

      {/* ── Brand — upper left ─────────────────────────────────────────────── */}
      <div className="topbar__left">
        <a href="/dashboard" className="topbar__brand">
          <span className="topbar__brand-icon">⚡</span>
          <span className="topbar__brand-name">Group 12</span>
        </a>
      </div>

      {/* ── Right: theme toggle only ───────────────────────────────────────── */}
      <div className="topbar__right">
        <div
          className="topbar__theme-toggle"
          onClick={onDarkModeToggle}
          role="button"
          tabIndex={0}
          aria-label="Toggle dark mode"
          onKeyDown={e => e.key === 'Enter' && onDarkModeToggle()}
        >
          <span className={`topbar__theme-label${!darkMode ? ' active' : ''}`}>
            <i className="ti-shine" aria-hidden="true" />
            <span>Light</span>
          </span>
          <div className={`topbar__toggle-pill${darkMode ? ' dark' : ''}`}>
            <div className="topbar__toggle-knob" />
          </div>
          <span className={`topbar__theme-label${darkMode ? ' active' : ''}`}>
            <span>Dark</span>
            <i className="ti-eye" aria-hidden="true" />
          </span>
        </div>
      </div>

    </header>
  )
}
