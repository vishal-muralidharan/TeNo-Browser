import React from 'react'
import { useNavigate } from 'react-router-dom'

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
  favoritesRowCount = 2,
  onFavoritesRowCountChange,
  onLogout,
}) {
  const navigate = useNavigate()
  const allItems = [...savedLinks, ...cartItems]

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
  const topClickedLink = [...allItems].sort((a, b) => getItemClickCount(b) - getItemClickCount(a))[0] || null
  const topClickedLabel = labelStatList[0] || null
  const totalClicks = allItems.reduce((sum, item) => sum + getItemClickCount(item), 0)
  const topClickedLinkCount = topClickedLink ? getItemClickCount(topClickedLink) : 0
  const topClickedLabelCount = topClickedLabel ? topClickedLabel.clickCount : 0

  return (
    <div className="app-layout settings-layout">
      <header className="app-header">
        <div className="brand">
          <h1>teno</h1>
          <div className="topbar-actions">
            <button type="button" className="topbar-action-btn" onClick={() => navigate('/app')}>back</button>
            <button type="button" className="topbar-action-btn" onClick={onLogout}>logout</button>
          </div>
        </div>
      </header>

      <main className="settings-page">
        <div className="settings-shell">
        <section className="settings-grid">
          <article className="settings-card">
            <h3>account</h3>
            <div className="settings-kv">
              <span>email</span>
              <strong>{user?.email || 'unknown'}</strong>
            </div>
          </article>

          <article className="settings-card">
            <h3>layout</h3>
            <div className="settings-kv settings-kv-stack">
              <span>rows below favourites</span>
              <div className="settings-inline-row">
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={favoritesRowCount}
                  onChange={(event) => onFavoritesRowCountChange?.(event.target.value)}
                />
                <small>applies to the favourites grid.</small>
              </div>
            </div>
          </article>

          <article className="settings-card">
            <h3>summary</h3>
            <div className="settings-kv"><span>saved links</span><strong>{savedLinks.length}</strong></div>
            <div className="settings-kv"><span>cart links</span><strong>{cartItems.length}</strong></div>
            <div className="settings-kv"><span>reminders</span><strong>{reminders.length}</strong></div>
            <div className="settings-kv"><span>unique labels</span><strong>{countUniqueLabels(allItems)}</strong></div>
            <div className="settings-kv"><span>total clicks</span><strong>{totalClicks}</strong></div>
          </article>
        </section>

        <section className="settings-card settings-wide-card">
          <h3>click stats</h3>
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

          <div className="settings-list-group">
            <h4>saved links</h4>
            {savedLinks.length === 0 ? (
              <p className="settings-empty">no saved links yet.</p>
            ) : (
              savedLinks.map((item) => (
                <div key={item.id} className="settings-list-row">
                  <span>{getDisplayName(item)}</span>
                  <strong>{getItemClickCount(item)}</strong>
                </div>
              ))
            )}
          </div>

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
        </div>
      </main>
    </div>
  )
}
