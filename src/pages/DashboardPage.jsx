import React, { useEffect, useRef, useState } from 'react'
import LinkStorer from '../components/LinkStorer'
import Reminders from '../components/Reminders'
import Timer from '../components/Timer'
import Terminal from '../components/Terminal'

export default function DashboardPage({
  user,
  onLogout,
  activeTab,
  setActiveTab,
  terminalVisible,
  setTerminalVisible,
  savedLinks,
  cartItems,
  reminders,
  linksFormToken,
  cartFormToken,
  requestOpenLinksForm,
  requestOpenCartForm,
  deleteLinkByNickname,
  deleteCartItemByNickname,
  addReminder,
  deleteReminderByIndex,
  deleteAllReminders,
  timerApi,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const appContainerRef = useRef(null)

  const tabs = [
    { id: 'links', label: 'Links', component: <LinkStorer collectionName="saved_links" title="Saved Links" user={user} openFormSignal={linksFormToken} /> },
    { id: 'cart', label: 'Cart', component: <LinkStorer collectionName="cart_items" title="Cart" user={user} openFormSignal={cartFormToken} /> },
    { id: 'reminders', label: 'Reminders', component: <Reminders user={user} /> },
    { id: 'timer', label: 'Timer', component: <Timer {...timerApi} /> },
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
    const handleGlobalKeyDown = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return

      if (event.key.toLowerCase() === 's') {
        const nextIndex = (activeTab + 1) % tabs.length
        setActiveTab(nextIndex)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [activeTab, tabs.length, setActiveTab])

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

      <main className="main-content slider-container" style={{ paddingBottom: terminalVisible ? '30vh' : '1rem' }}>
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

      {terminalVisible ? (
        <Terminal
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onExit={() => setTerminalVisible(false)}
          savedLinks={savedLinks}
          cartItems={cartItems}
          reminders={reminders}
          requestOpenLinksForm={requestOpenLinksForm}
          requestOpenCartForm={requestOpenCartForm}
          deleteLinkByNickname={deleteLinkByNickname}
          deleteCartItemByNickname={deleteCartItemByNickname}
          addReminder={addReminder}
          deleteReminderByIndex={deleteReminderByIndex}
          deleteAllReminders={deleteAllReminders}
          timerApi={timerApi}
        />
      ) : (
        <button
          type="button"
          className="terminal-reopen-bar"
          onClick={() => setTerminalVisible(true)}
        >
          $_ terminal hidden. type to reopen.
        </button>
      )}

      {showLogoutConfirm && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{ marginBottom: '16px' }}>confirm log out?</p>
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
