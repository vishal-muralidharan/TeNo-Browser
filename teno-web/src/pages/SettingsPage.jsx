import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useTheme } from '../ThemeContext'
import { getUiConfig } from '../utils/uiConfig'
import { useFeatureFlags } from '../FeatureFlagContext'

const normalizeLabel = (value) => (value || '').trim().toLowerCase()
const getDisplayName = (item) => item.nickname || item.title || item.url || 'untitled'
const getItemClickCount = (item) => Number(item.clickCount || 0)

const countUniqueLabels = (items) => {
  const labels = new Set()
  items.forEach((item) => {
    const label = normalizeLabel(item.label)
    if (label) labels.add(label)
  })
  return labels.size
}

export default function SettingsPage({
  user,
  savedLinks = [],
  cartItems = [],
  reminders = [],
  onLogout,
}) {
  const navigate = useNavigate()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const allItems = [...savedLinks, ...cartItems]
  
  const { theme, styleMode, setTheme, setStyleMode } = useTheme()
  const ui = getUiConfig(styleMode)
  const { isEnabled } = useFeatureFlags()

  const getToggleContainerStyle = () => ({
    display: 'flex',
    gap: styleMode === 'modern' ? '4px' : '0',
    backgroundColor: styleMode === 'modern' ? 'var(--bg-surface-hover)' : 'transparent',
    padding: styleMode === 'modern' ? '4px' : '0',
    borderRadius: styleMode === 'modern' ? '24px' : '0',
    border: styleMode === 'minimal' ? '1px solid var(--border-color)' : 'none',
    width: '100%',
    overflow: 'hidden'
  });

  const getToggleBtnStyle = (isActive, isLast = false) => ({
    flex: 1,
    padding: '8px 16px',
    border: 'none',
    borderRight: styleMode === 'minimal' && !isLast ? '1px solid var(--border-color)' : 'none',
    backgroundColor: isActive 
      ? (styleMode === 'modern' ? 'var(--bg-surface)' : 'var(--text-primary)') 
      : 'transparent',
    color: isActive 
      ? (styleMode === 'modern' ? 'var(--text-primary)' : 'var(--bg-app)') 
      : 'var(--text-muted)',
    borderRadius: styleMode === 'modern' ? '20px' : '0',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    transition: 'all 0.2s ease',
    boxShadow: isActive && styleMode === 'modern' ? 'var(--shadow-card)' : 'none',
    fontFamily: 'inherit',
    fontSize: '0.9rem'
  });

  const labelStats = allItems.reduce((accumulator, item) => {
    const label = normalizeLabel(item.label)
    if (!label) return accumulator

    const nextCount = getItemClickCount(item)
    const current = accumulator.get(label) || { label, clickCount: 0 }
    accumulator.set(label, {
      label,
      clickCount: current.clickCount + nextCount,
    })
    return accumulator
  }, new Map())

  const labelStatList = [...labelStats.values()].sort((a, b) => b.clickCount - a.clickCount || a.label.localeCompare(b.label))
  const sortedSavedLinks = [...savedLinks].sort((a, b) => {
    const clickA = Number(a.clickCount || 0)
    const clickB = Number(b.clickCount || 0)
    if (clickA !== clickB) return clickB - clickA

    return getDisplayName(a).localeCompare(getDisplayName(b))
  })
  const topClickedLink = [...allItems].sort((a, b) => getItemClickCount(b) - getItemClickCount(a))[0] || null
  const topClickedLabel = labelStatList[0] || null
  const totalClicks = allItems.reduce((sum, item) => sum + getItemClickCount(item), 0)
  const topClickedLinkCount = topClickedLink ? getItemClickCount(topClickedLink) : 0
  const topClickedLabelCount = topClickedLabel ? topClickedLabel.clickCount : 0

  const handlePasswordChange = async (event) => {
    event.preventDefault()

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('fill in all password fields.')
      setPasswordStatus('')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('new passwords do not match.')
      setPasswordStatus('')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('new password must be at least 8 characters long.')
      setPasswordStatus('')
      return
    }

    if (!user?.email) {
      setPasswordError('current account email is unavailable.')
      setPasswordStatus('')
      return
    }

    try {
      setIsSavingPassword(true)
      setPasswordError('')
      setPasswordStatus('')

      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)

      setPasswordStatus('password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (error) {
      console.error(error)
      setPasswordError(error?.code === 'auth/wrong-password' ? 'current password is incorrect.' : (error?.message || 'failed to update password.'))
      setPasswordStatus('')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const openPasswordModal = () => {
    setPasswordError('')
    setPasswordStatus('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setIsPasswordModalOpen(true)
  }

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false)
    setPasswordError('')
    setPasswordStatus('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
  }

  return (
    <div className="app-layout settings-layout">
      <header className="app-header">
        <div className="brand">
          <h1 className="brand-logo-text" onClick={() => navigate('/app')} style={{ cursor: 'pointer' }}>{ui.logo}</h1>
          <div className="topbar-actions">
              <button type="button" className="topbar-action-btn" onClick={() => navigate('/app')}>
                {ui.icons.back} {ui.nav.back}
              </button>
              <button type="button" className="topbar-action-btn" onClick={onLogout}>
                {ui.icons.logout} {ui.nav.logout}
              </button>
            </div>
        </div>
      </header>

      <main className="settings-page">
        <div className="settings-shell">
        <section className="settings-grid">
          <article className="settings-card">
            <h3>{ui.settings.appearance}</h3>
            <div className="settings-kv" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px', borderBottom: 'none' }}>
              <div style={{ width: '100%' }}>
                <span style={{ marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>{ui.settings.themeLabel}</span>
                <div style={getToggleContainerStyle()}>
                  <button
                    type="button"
                    style={getToggleBtnStyle(theme === 'dark')}
                    onClick={() => setTheme('dark')}
                  >
                    {ui.settings.themeDark}
                  </button>
                  <button
                    type="button"
                    style={getToggleBtnStyle(theme === 'light', true)}
                    onClick={() => setTheme('light')}
                  >
                    {ui.settings.themeLight}
                  </button>
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <span style={{ marginBottom: '8px', display: 'block', color: 'var(--text-muted)' }}>{ui.settings.styleModeLabel}</span>
                <div style={getToggleContainerStyle()}>
                  <button
                    type="button"
                    style={getToggleBtnStyle(styleMode === 'minimal')}
                    onClick={() => setStyleMode('minimal')}
                  >
                    {ui.settings.styleMinimal}
                  </button>
                  <button
                    type="button"
                    style={getToggleBtnStyle(styleMode === 'modern', true)}
                    onClick={() => setStyleMode('modern')}
                  >
                    {ui.settings.styleModern}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="settings-card">
            <h3>{ui.settings.account}</h3>
            <div className="settings-kv">
              <span>email</span>
              <strong>{user?.email || 'unknown'}</strong>
            </div>
            <div className="settings-kv">
              <span>full name</span>
              <strong>{user?.displayName || 'unknown'}</strong>
            </div>
            {isEnabled('changePassword') && (
              <button type="button" className="settings-password-trigger" onClick={openPasswordModal}>{ui.settings.changePassword}</button>
            )}
          </article>



          <article className="settings-card">
            <h3>{ui.settings.summary}</h3>
            {isEnabled('links') && <div className="settings-kv"><span>saved links</span><strong>{savedLinks.length}</strong></div>}
            {isEnabled('cart') && <div className="settings-kv"><span>cart links</span><strong>{cartItems.length}</strong></div>}
            {isEnabled('reminders') && <div className="settings-kv"><span>reminders</span><strong>{reminders.length}</strong></div>}
            <div className="settings-kv"><span>unique labels</span><strong>{countUniqueLabels(allItems)}</strong></div>
            <div className="settings-kv"><span>total clicks</span><strong>{totalClicks}</strong></div>
          </article>
        </section>

      {isEnabled('clickStats') && (
        <section className="settings-card settings-wide-card" style={{ marginTop: '24px' }}>
          <h3>{ui.settings.clickStats}</h3>
          <div className="settings-stats-grid">
            <div className="settings-stat-box">
              <span>max clicked link:</span>{' '}
              <strong>{topClickedLinkCount > 0 ? `${getDisplayName(topClickedLink)} (${topClickedLinkCount})` : 'none'}</strong>
            </div>
            <div className="settings-stat-box">
              <span>max clicked label:</span>{' '}
              <strong>{topClickedLabelCount > 0 ? `${topClickedLabel.label} (${topClickedLabelCount})` : 'none'}</strong>
            </div>
          </div>

          {isEnabled('links') && (
            <div className="settings-list-group">
              <h4>saved links</h4>
              {sortedSavedLinks.length === 0 ? (
                <p className="settings-empty">no saved links yet.</p>
              ) : (
                sortedSavedLinks.map((item) => (
                  <div key={item.id} className="settings-list-row">
                    <span>{`${getDisplayName(item)}${item.label ? ` (${item.label})` : ''}`}</span>
                    <strong>{getItemClickCount(item)}</strong>
                  </div>
                ))
              )}
            </div>
          )}

          {isEnabled('cart') && (
            <div className="settings-list-group">
              <h4>cart items</h4>
              {cartItems.length === 0 ? (
                <p className="settings-empty">no cart items yet.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="settings-list-row">
                    <span>{getDisplayName(item)}</span>
                    <strong>{getItemClickCount(item)}</strong>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="settings-list-group">
            <h4>label totals</h4>
            {labelStatList.length === 0 ? (
              <p className="settings-empty">no label clicks yet.</p>
            ) : (
              labelStatList.map((item) => (
                <div key={item.label} className="settings-list-row">
                  <span>{item.label}</span>
                  <strong>{item.clickCount}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      )}
        </div>
      </main>

      {isPasswordModalOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal settings-password-modal">
            <p style={{ marginBottom: '16px' }}>change password</p>
            <form onSubmit={handlePasswordChange} className="input-group">
              <input
                type="password"
                placeholder="current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
              <input
                type="password"
                placeholder="new password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="confirm new password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              {passwordError && <p className="settings-feedback settings-feedback-error">{passwordError}</p>}
              {passwordStatus && <p className="settings-feedback settings-feedback-success">{passwordStatus}</p>}
              <div className="modal-actions" style={{ marginTop: '4px' }}>
                <button type="button" onClick={closePasswordModal}>cancel</button>
                <button type="submit" className="btn-primary" disabled={isSavingPassword}>{isSavingPassword ? 'saving...' : 'save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
