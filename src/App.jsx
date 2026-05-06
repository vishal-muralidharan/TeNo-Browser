import React, { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, getDocs, writeBatch, doc, onSnapshot, addDoc, deleteDoc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { auth, db } from './firebase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import { setupTypingCaret } from '../sm/typingCaret'

const TAB_INDEX = {
  links: 0,
  cart: 1,
  reminders: 2,
  timer: 3,
}

const normalizeText = (value) => (value || '').trim().toLowerCase()

const toTimestamp = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value === 'number') return value
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

const sortLinks = (items) => [...items].sort((a, b) => {
  if (a.isFavorite && !b.isFavorite) return -1
  if (!a.isFavorite && b.isFavorite) return 1
  return toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
})

const sortCartItems = (items) => [...items].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt))
const sortReminders = (items) => [...items].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))

const formatTimerMs = (ms) => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hundredths = Math.floor((Math.max(0, ms) % 1000) / 10)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}

function App() {
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState(TAB_INDEX.links)
  const [terminalVisible, setTerminalVisible] = useState(false)
  const [linksFormToken, setLinksFormToken] = useState(0)
  const [cartFormToken, setCartFormToken] = useState(0)
  const [savedLinks, setSavedLinks] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [reminders, setReminders] = useState([])
  const [favoritesRowCount, setFavoritesRowCount] = useState(2)

  const [timerState, setTimerState] = useState('idle')
  const [timerMode, setTimerMode] = useState('stopwatch')
  const [timerStartTime, setTimerStartTime] = useState(null)
  const [timerAccumulatedMs, setTimerAccumulatedMs] = useState(0)
  const [timerTargetDuration, setTimerTargetDuration] = useState(0)
  const [timerInputMinutes, setTimerInputMinutes] = useState(0)
  const [timerDisplayMs, setTimerDisplayMs] = useState(0)

  const [systemFlags, setSystemFlags] = useState({})
  const [adminLoginVisible, setAdminLoginVisible] = useState(false)
  const [isAdminView, setIsAdminView] = useState(false)

  useEffect(() => {
    const unsubFlags = onSnapshot(doc(db, 'system_config', 'feature_flags'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemFlags(snapshot.data() || {})
      }
    })
    return unsubFlags
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setLoadingAuth(false)

      if (currentUser) {
        migrateExistingData(currentUser.uid)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => setupTypingCaret(), [])

  useEffect(() => {
    if (!user) {
      setFavoritesRowCount(2)
      return undefined
    }

    const settingsRef = doc(db, 'users', user.uid, 'settings', 'ui')
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      const nextValue = Number(snapshot.data()?.favoritesRowCount)
      const clampedValue = Number.isFinite(nextValue) ? Math.max(1, Math.min(3, Math.floor(nextValue))) : 2
      setFavoritesRowCount(clampedValue)
    })

    return unsubSettings
  }, [user])

  useEffect(() => {
    if (!user) {
      setSavedLinks([])
      setCartItems([])
      setReminders([])
      return undefined
    }

    const unsubLinks = onSnapshot(query(collection(db, 'users', user.uid, 'saved_links')), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setSavedLinks(sortLinks(data))
    })

    const unsubCart = onSnapshot(query(collection(db, 'users', user.uid, 'cart_items')), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setCartItems(sortCartItems(data))
    })

    const unsubReminders = onSnapshot(query(collection(db, 'users', user.uid, 'reminders')), (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      setReminders(sortReminders(data))
    })

    return () => {
      unsubLinks()
      unsubCart()
      unsubReminders()
    }
  }, [user])

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now()
      let calcAccumulated = timerAccumulatedMs

      if (timerState === 'running' && timerStartTime) {
        calcAccumulated += now - timerStartTime
      }

      if (timerMode === 'countdown') {
        const remaining = timerTargetDuration - calcAccumulated
        if (remaining <= 0 && timerState === 'running') {
          setTimerDisplayMs(0)
          setTimerState('idle')
          setTimerMode('stopwatch')
          setTimerAccumulatedMs(0)
          setTimerStartTime(null)
          setTimerTargetDuration(0)
          return
        }

        setTimerDisplayMs(Math.max(0, remaining))
        return
      }

      setTimerDisplayMs(calcAccumulated)
    }

    updateTimer()
    const intervalId = setInterval(updateTimer, 40)
    return () => clearInterval(intervalId)
  }, [timerState, timerMode, timerStartTime, timerAccumulatedMs, timerTargetDuration])

  const migrateExistingData = async (uid) => {
    const collectionsToMigrate = ['saved_links', 'cart_items', 'reminders']

    for (const colName of collectionsToMigrate) {
      try {
        const snapshot = await getDocs(query(collection(db, colName)))
        const batch = writeBatch(db)
        let count = 0

        snapshot.forEach((document) => {
          const data = document.data()
          if (!data.migratedToSubcollection) {
            const newDocRef = doc(db, 'users', uid, colName, document.id)
            const { userId, ...cleanData } = data
            batch.set(newDocRef, cleanData)
            batch.update(doc(db, colName, document.id), { migratedToSubcollection: true })
            count++
          }
        })

        if (count > 0) {
          await batch.commit()
        }
      } catch (error) {
        console.error('Migration error:', error)
      }
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setIsAdminView(false)
    } catch (error) {
      console.error(error)
    }
  }

  const handleAdminAuth = (password) => {
    if (password === 'admin') {
      setAdminLoginVisible(false)
      setIsAdminView(true)
    } else {
      alert('Invalid admin credentials')
    }
  }

  const requestOpenLinksForm = () => setLinksFormToken((value) => value + 1)
  const requestOpenCartForm = () => setCartFormToken((value) => value + 1)

  const recordLinkOpen = async ({ collectionName, link }) => {
    if (!user || !collectionName || !link?.id) return

    try {
      await updateDoc(doc(db, 'users', user.uid, collectionName, link.id), {
        clickCount: increment(1),
        lastClickedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to record link open:', error)
    }
  }

  const updateFavoritesRowCount = async (nextValue) => {
    const parsedValue = Math.max(1, Math.min(3, Number(nextValue) || 2))
    setFavoritesRowCount(parsedValue)

    if (!user) return { ok: false, message: 'no active user.' }

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'ui'), { favoritesRowCount: parsedValue }, { merge: true })
      return { ok: true, message: 'settings saved.' }
    } catch (error) {
      console.error('Failed to save settings:', error)
      return { ok: false, message: 'failed to save settings.' }
    }
  }

  const addReminder = async (text) => {
    const cleanText = text.trim()
    if (!user || !cleanText) {
      return { ok: false, message: 'reminder text is required.' }
    }

    await addDoc(collection(db, 'users', user.uid, 'reminders'), {
      text: cleanText,
      label: '',
      createdAt: new Date().toISOString(),
    })

    return { ok: true, message: 'reminder added.' }
  }

  const deleteReminderByIndex = async (index) => {
    if (!user) return { ok: false, message: 'no active user.' }

    const reminder = reminders[index]
    if (!reminder) {
      return { ok: false, message: `reminder not found at index ${index}.` }
    }

    await deleteDoc(doc(db, 'users', user.uid, 'reminders', reminder.id))
    return { ok: true, message: `reminder ${index} completed.` }
  }

  const deleteAllReminders = async () => {
    if (!user) return { ok: false, message: 'no active user.' }

    const batch = writeBatch(db)
    reminders.forEach((reminder) => {
      batch.delete(doc(db, 'users', user.uid, 'reminders', reminder.id))
    })
    await batch.commit()
    return { ok: true, message: '\\o/ BOOM' }
  }

  const deleteLinkByNickname = async (nickname) => {
    if (!user) return { ok: false, message: 'no active user.' }

    const target = savedLinks.find((item) => normalizeText(item.nickname) === normalizeText(nickname))
    if (!target) {
      return { ok: false, message: `link not found: ${nickname}` }
    }

    await deleteDoc(doc(db, 'users', user.uid, 'saved_links', target.id))
    return { ok: true, message: `deleted link: ${target.nickname}` }
  }

  const deleteCartItemByNickname = async (nickname) => {
    if (!user) return { ok: false, message: 'no active user.' }

    const target = cartItems.find((item) => normalizeText(item.title || item.nickname) === normalizeText(nickname))
    if (!target) {
      return { ok: false, message: `cart item not found: ${nickname}` }
    }

    await deleteDoc(doc(db, 'users', user.uid, 'cart_items', target.id))
    return { ok: true, message: `deleted cart item: ${target.title || target.nickname}` }
  }

  const startTimerCountdown = (minutes) => {
    const parsedMinutes = Number(minutes)
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      return { ok: false, message: 'invalid timer value.' }
    }

    const now = Date.now()
    const targetDuration = parsedMinutes * 60 * 1000
    setTimerMode('countdown')
    setTimerState('running')
    setTimerStartTime(now)
    setTimerAccumulatedMs(0)
    setTimerTargetDuration(targetDuration)
    setTimerInputMinutes(0)
    setTimerDisplayMs(targetDuration)

    return { ok: true, message: `timer started for ${parsedMinutes} minute${parsedMinutes === 1 ? '' : 's'}.` }
  }

  const stopTimer = () => {
    setTimerState('idle')
    setTimerMode('stopwatch')
    setTimerAccumulatedMs(0)
    setTimerStartTime(null)
    setTimerTargetDuration(0)
    setTimerInputMinutes(0)
    setTimerDisplayMs(0)
    return { ok: true, message: 'timer stopped.' }
  }

  const handleTimerStart = () => {
    const now = Date.now()

    if (timerState === 'idle') {
      const minutes = Number(timerInputMinutes)
      if (minutes > 0) {
        setTimerMode('countdown')
        setTimerTargetDuration(minutes * 60 * 1000)
      } else {
        setTimerMode('stopwatch')
        setTimerTargetDuration(0)
      }

      setTimerAccumulatedMs(0)
      setTimerInputMinutes(0)
    }

    setTimerState('running')
    setTimerStartTime(now)
  }

  const handleTimerPause = () => {
    if (timerState !== 'running' || !timerStartTime) return

    const now = Date.now()
    const elapsed = now - timerStartTime
    setTimerAccumulatedMs((value) => value + elapsed)
    setTimerState('paused')
    setTimerStartTime(null)
  }

  const handleTimerStop = () => {
    stopTimer()
  }

  const getTimerStatus = () => {
    if (timerState === 'idle') {
      return 'timer inactive.'
    }

    return `${timerMode} ${timerState}: ${formatTimerMs(timerDisplayMs)}`
  }

  if (loadingAuth) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/app' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage user={user} loadingAuth={loadingAuth} />} />
        <Route
          path="/app"
          element={
            user ? (
              <DashboardPage
                user={user}
                onLogout={handleLogout}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                terminalVisible={terminalVisible}
                setTerminalVisible={setTerminalVisible}
                savedLinks={savedLinks}
                cartItems={cartItems}
                reminders={reminders}
                favoritesRowCount={favoritesRowCount}
                linksFormToken={linksFormToken}
                cartFormToken={cartFormToken}
                requestOpenLinksForm={requestOpenLinksForm}
                requestOpenCartForm={requestOpenCartForm}
                deleteLinkByNickname={deleteLinkByNickname}
                deleteCartItemByNickname={deleteCartItemByNickname}
                addReminder={addReminder}
                deleteReminderByIndex={deleteReminderByIndex}
                deleteAllReminders={deleteAllReminders}
                recordLinkOpen={recordLinkOpen}
                systemFlags={systemFlags}
                onAdminTrigger={() => setAdminLoginVisible(true)}
                timerApi={{
                  timerState,
                  timerMode,
                  timerDisplayMs,
                  timerInputMinutes,
                  setTimerInputMinutes,
                  handleTimerStart,
                  handleTimerPause,
                  handleTimerStop,
                  startTimerCountdown,
                  stopTimer,
                  getTimerStatus,
                  formatTimerMs,
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            user ? (
              <SettingsPage
                user={user}
                savedLinks={savedLinks}
                cartItems={cartItems}
                reminders={reminders}
                favoritesRowCount={favoritesRowCount}
                onFavoritesRowCountChange={updateFavoritesRowCount}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<Navigate to={user ? '/app' : '/login'} replace />} />
      </Routes>

      {adminLoginVisible && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{ marginBottom: '16px' }}>admin authorization</p>
            <input 
               type="password" 
               id="admin-pwd"
               className="admin-pw-input"
               placeholder="password..." 
               onKeyDown={(e) => { if(e.key === 'Enter') {
                 if (e.target.value === 'admin') {
                   setAdminLoginVisible(false)
                   window.location.href = '/admin'
                 } else {
                   alert('Invalid admin credentials')
                 }
               }}}
               autoFocus 
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setAdminLoginVisible(false)}>abort</button>
              <button type="button" className="btn-primary" onClick={() => {
                const v = document.getElementById('admin-pwd')?.value;
                if (v === 'admin') {
                  setAdminLoginVisible(false)
                  window.location.href = '/admin'
                } else alert('Invalid admin credentials')
              }}>enter</button>
            </div>
          </div>
        </div>
      )}
    </BrowserRouter>
  )
}

export default App
