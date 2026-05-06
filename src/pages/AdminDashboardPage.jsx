import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ activeUsers: 0, totalLinks: 0, databaseQuota: '0%' })
  const [flags, setFlags] = useState({ links: true, cart: true, reminders: true, timer: true })

  useEffect(() => {
    const unsubStats = onSnapshot(doc(db, 'platform_stats', 'daily_metrics'), (snap) => {
      if (snap.exists()) setStats(snap.data())
    })

    const unsubFlags = onSnapshot(doc(db, 'system_config', 'feature_flags'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setFlags((prev) => ({ ...prev, ...data }))
      }
    })

    return () => {
      unsubStats()
      unsubFlags()
    }
  }, [])

  const toggleFlag = async (key) => {
    const newValue = !flags[key]
    setFlags((prev) => ({ ...prev, [key]: newValue }))
    try {
      await setDoc(doc(db, 'system_config', 'feature_flags'), { [key]: newValue }, { merge: true })
    } catch (error) {
      console.error('Failed to update flag:', error)
      setFlags((prev) => ({ ...prev, [key]: !newValue }))
    }
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-brand">
          <h1>teno_admin</h1>
          <span className="admin-badge">System Control</span>
        </div>
        <button type="button" className="admin-btn-outline" onClick={() => navigate('/app')}>
          Exit Admin
        </button>
      </header>

      <main className="admin-main">
        <section className="admin-section">
          <h2>System Health</h2>
          <div className="admin-grid">
            <div className="stat-card">
              <span className="stat-label">Active Users</span>
              <span className="stat-value">{stats.activeUsers || 0}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Links</span>
              <span className="stat-value">{stats.totalLinks || 0}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Database Quota</span>
              <span className="stat-value">{stats.databaseQuota || '0%'}</span>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <h2>System Config (Kill Switches)</h2>
          <div className="admin-list">
            {['links', 'cart', 'reminders', 'timer'].map((moduleKey) => (
              <div className="config-row" key={moduleKey}>
                <div className="config-info">
                  <span className="config-title">{moduleKey} module</span>
                  <span className="config-desc">Enable or disable access across the entire app</span>
                </div>
                <button
                  type="button"
                  className={`admin-toggle ${flags[moduleKey] !== false ? 'active' : ''}`}
                  onClick={() => toggleFlag(moduleKey)}
                >
                  <div className="admin-toggle-knob" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
