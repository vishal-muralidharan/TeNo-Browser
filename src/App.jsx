import React, { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore'
import { auth, db } from './firebase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

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

  const migrateExistingData = async (uid) => {
    const collectionsToMigrate = ['saved_links', 'cart_items', 'reminders']

    for (const colName of collectionsToMigrate) {
      try {
        const colRef = collection(db, colName)
        const q = query(colRef)
        const snapshot = await getDocs(q)

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
      } catch (err) {
        console.error('Migration error:', err)
      }
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/app' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage user={user} loadingAuth={loadingAuth} />} />
        <Route
          path="/app"
          element={
            loadingAuth ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
            ) : user ? (
              <DashboardPage user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={user ? '/app' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
