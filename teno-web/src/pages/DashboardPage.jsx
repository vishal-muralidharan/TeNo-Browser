import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LinkStorer from '../components/LinkStorer'
import Reminders from '../components/Reminders'
import Timer from '../components/Timer'
import Terminal from '../components/Terminal'
import { useTheme } from '../ThemeContext'
import { getUiConfig } from '../utils/uiConfig'
import ConfirmModal from '../components/ConfirmModal'
import { useFeatureFlags } from '../FeatureFlagContext'

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
  favoritesRowCount,
  linksFormToken,
  cartFormToken,
  requestOpenLinksForm,
  requestOpenCartForm,
  deleteLinkByNickname,
  deleteCartItemByNickname,
  addReminder,
  deleteReminderByIndex,
  deleteAllReminders,
  recordLinkOpen,
  timerApi,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(280)
  const appContainerRef = useRef(null)
  const navigate = useNavigate()
  const { styleMode } = useTheme()
  const ui = getUiConfig(styleMode)
  const { isEnabled } = useFeatureFlags()

  const tabs = [
    isEnabled('links')     && { id: 'links',     label: ui.tabs.links,     component: <LinkStorer collectionName="saved_links" title="Saved Links" user={user} openFormSignal={linksFormToken} onLinkOpen={recordLinkOpen} /> },
    isEnabled('cart')      && { id: 'cart',      label: ui.tabs.cart,      component: <LinkStorer collectionName="cart_items" title="Cart" user={user} openFormSignal={cartFormToken} onLinkOpen={recordLinkOpen} /> },
    isEnabled('reminders') && { id: 'reminders', label: ui.tabs.reminders, component: <Reminders user={user} /> },
    isEnabled('timer')     && { id: 'timer',     label: ui.tabs.timer,     component: <Timer {...timerApi} /> },
  ].filter(Boolean)

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

  useEffect(() => {
    if (!terminalVisible) return undefined

    const handleOutsideTerminalClick = (event) => {
      if (event.target.closest('.terminal-shell')) return
      setTerminalVisible(false)
    }

    document.addEventListener('pointerdown', handleOutsideTerminalClick)
    return () => document.removeEventListener('pointerdown', handleOutsideTerminalClick)
  }, [terminalVisible, setTerminalVisible])

  return (
    <div
      className={`app-layout ${terminalVisible ? 'terminal-open' : ''}`}
      ref={appContainerRef}
      tabIndex={-1}
      style={{ outline: 'none', '--terminal-active-height': `${terminalHeight}px` }}
    >
      <header className="app-header">
        <div className="brand">
          <h1 className="brand-logo-text" onClick={() => { navigate('/app'); setActiveTab(0); }} style={{ cursor: 'pointer' }}>
            {ui.logo}
          </h1>
          <div className="topbar-actions">
            {isEnabled('settings') && (
              <button type="button" className="topbar-action-btn" onClick={() => navigate('/settings')}>
                {ui.icons.settings} {ui.nav.settings}
              </button>
            )}
            <button type="button" className="topbar-action-btn" onClick={() => setShowLogoutConfirm(true)}>
              {ui.icons.logout} {ui.nav.logout}
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
              {React.cloneElement(tab.component, {
                isActive: activeTab === idx,
                user,
                terminalVisible,
                terminalHeight,
              })}
            </div>
          )
        })}
      </main>

      {terminalVisible ? <div className="terminal-spacer" style={{ height: `${terminalHeight}px` }} aria-hidden="true" /> : null}

      {isEnabled('terminal') && (
        terminalVisible ? (
          <div className="terminal-layer">
            <Terminal
              user={user}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onExit={() => setTerminalVisible(false)}
              onHeightChange={setTerminalHeight}
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
              onLinkOpen={recordLinkOpen}
              timerApi={timerApi}
            />
          </div>
        ) : (
          <button
            type="button"
            className="terminal-reopen-bar"
            onClick={() => setTerminalVisible(true)}
          >
            {ui.terminal.reopenBar}
          </button>
        )
      )}

      {showLogoutConfirm && (
        <ConfirmModal
          message={ui.confirm.logout.message}
          confirmLabel={ui.confirm.logout.confirm}
          cancelLabel={ui.confirm.logout.cancel}
          onConfirm={() => { onLogout(); setShowLogoutConfirm(false) }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  )
}
