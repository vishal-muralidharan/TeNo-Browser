import React, { useEffect, useRef, useState } from 'react'
import LinkStorer from '../components/LinkStorer'
import Reminders from '../components/Reminders'
import Timer from '../components/Timer'

export default function DashboardPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const appContainerRef = useRef(null)

  const tabs = [
    { id: 'links', label: 'Links', component: <LinkStorer collectionName="saved_links" title="Saved Links" user={user} /> },
    { id: 'cart', label: 'Cart', component: <LinkStorer collectionName="cart_items" title="Cart" user={user} /> },
    { id: 'reminders', label: 'Reminders', component: <Reminders user={user} /> },
    { id: 'timer', label: 'Timer', component: <Timer /> },
  ]

  const handleTabSwitch = (index) => {
    if (activeTab === index) return
    setActiveTab(index)
  }

  useEffect(() => {
    const focusApp = () => {
      setTimeout(() => {
        if (appContainerRef.current) {
          appContainerRef.current.focus()
        }
        window.focus()
      }, 50)
    }

    focusApp()

    const visibilityListener = () => {
      if (document.visibilityState === 'visible') {
        focusApp()
      }
    }

    document.addEventListener('visibilitychange', visibilityListener)
    return () => document.removeEventListener('visibilitychange', visibilityListener)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key.toLowerCase() === 's') {
        const nextIndex = (activeTab + 1) % tabs.length
        setActiveTab(nextIndex)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [activeTab, tabs.length])

  return (
    <div className="app-layout" ref={appContainerRef} tabIndex={-1} style={{ outline: 'none' }}>
      <header className="app-header">
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: '1rem', alignItems: 'center' }}>
          <h1>teno</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            <button onClick={() => setShowLogoutConfirm(true)} style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: 'inherit' }}>
              logout
            </button>
          </div>
        </div>
      </header>

      <nav className="top-nav">
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            className={activeTab === idx ? 'active' : ''}
            onClick={() => handleTabSwitch(idx)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-content slider-container">
        {tabs.map((tab, idx) => {
          let positionClass = 'slide-hidden'
          if (idx === activeTab) {
            positionClass = 'slide-active'
          } else if (idx < activeTab) {
            positionClass = 'slide-left'
          } else if (idx > activeTab) {
            positionClass = 'slide-right'
          }

          return (
            <div key={tab.id} className={`slide-pane ${positionClass}`}>
              {React.cloneElement(tab.component, { isActive: activeTab === idx, user })}
            </div>
          )
        })}
      </main>

      {showLogoutConfirm && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{ marginBottom: '16px' }}>Confirm Log out?</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => { onLogout(); setShowLogoutConfirm(false) }}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
