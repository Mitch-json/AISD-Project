import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const menuItems = [
  { to: '/dashboard', icon: 'ti-panel', label: 'Dashboard' },
  { to: '/charts', icon: 'ti-stats-up', label: 'Charts', badge: 'NEW' },
  {
    label: 'Tables',
    icon: 'ti-layout',
    children: [
      { to: '/datatable', label: 'Data Table', badge: 'NEW' },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const [openMenus, setOpenMenus] = useState({})

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <a href="/dashboard" className="sidebar__logo-link">
          <span className="sidebar__logo-icon">A</span>
          {!collapsed && <span className="sidebar__logo-text">Adminator</span>}
        </a>
        <button className="sidebar__toggle" onClick={onToggle} aria-label="Toggle sidebar">
          <i className={`ti-${collapsed ? 'view-list' : 'close'}`} />
        </button>
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar__menu">
          {menuItems.map((item) =>
            item.children ? (
              <li key={item.label} className={`sidebar__item sidebar__item--has-children${openMenus[item.label] ? ' open' : ''}`}>
                <button className="sidebar__link sidebar__link--parent" onClick={() => toggleMenu(item.label)}>
                  <i className={`sidebar__icon ${item.icon}`} />
                  {!collapsed && <span className="sidebar__label">{item.label}</span>}
                  {!collapsed && <i className={`sidebar__arrow ti-angle-${openMenus[item.label] ? 'up' : 'down'}`} />}
                </button>
                {openMenus[item.label] && !collapsed && (
                  <ul className="sidebar__submenu">
                    {item.children.map((child) => (
                      <li key={child.to} className="sidebar__subitem">
                        <NavLink to={child.to} className={({ isActive }) => `sidebar__sublink${isActive ? ' active' : ''}`}>
                          {child.label}
                          {child.badge && <span className="sidebar__badge">{child.badge}</span>}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <li key={item.to} className="sidebar__item">
                <NavLink to={item.to} className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}>
                  <i className={`sidebar__icon ${item.icon}`} />
                  {!collapsed && <span className="sidebar__label">{item.label}</span>}
                  {!collapsed && item.badge && <span className="sidebar__badge">{item.badge}</span>}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>

      {!collapsed && (
        <div className="sidebar__footer">
          <span>© 2026 Adminator</span>
        </div>
      )}
    </div>
  )
}
