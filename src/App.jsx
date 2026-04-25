import React, { useState, useEffect, useRef } from 'react'
import LinkStorer from './components/LinkStorer'
import Reminders from './components/Reminders'
import Timer from './components/Timer'
import { auth, googleProvider, db } from './firebase'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore'

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [prevTab, setPrevTab] = useState(0)
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const appContainerRef = useRef(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      
      // Migrate old data if no userId is set
      if (currentUser) {
        migrateExistingData(currentUser.uid);
      }
    });

    return unsubscribe;
  }, []);

  const migrateExistingData = async (uid) => {
    const collectionsToMigrate = ['saved_links', 'cart_items', 'reminders'];
    for (const colName of collectionsToMigrate) {
      try {
        const colRef = collection(db, colName);
        const q = query(colRef);
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let count = 0;
        
        snapshot.forEach((document) => {
          const data = document.data();
          if (!data.migratedToSubcollection) {
            const newDocRef = doc(db, 'users', uid, colName, document.id);
            const { userId, ...cleanData } = data; // Remove userId field as it's implied by path
            batch.set(newDocRef, cleanData);
            batch.update(doc(db, colName, document.id), { migratedToSubcollection: true });
            count++;
          }
        });
        
        if (count > 0) {
          await batch.commit();
        }
      } catch (err) {
        console.error("Migration error:", err);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  const tabs = [
    { id: 'links', label: 'Links', component: <LinkStorer collectionName="saved_links" title="Saved Links" user={user} /> },
    { id: 'cart', label: 'Cart', component: <LinkStorer collectionName="cart_items" title="Cart" user={user} /> },
    { id: 'reminders', label: 'Reminders', component: <Reminders user={user} /> },
    { id: 'timer', label: 'Timer', component: <Timer /> }
  ]

  const handleTabSwitch = (index) => {
    if (activeTab === index) return;
    setPrevTab(activeTab)
    setActiveTab(index)
  }

  useEffect(() => {
    const focusApp = () => {
      setTimeout(() => {
        if (appContainerRef.current) {
          appContainerRef.current.focus();
        }
        window.focus();
      }, 50);
    };
    
    focusApp();
    
    const visibilityListener = () => {
      if (document.visibilityState === 'visible') {
        focusApp();
      }
    };
    
    document.addEventListener("visibilitychange", visibilityListener);
    return () => document.removeEventListener("visibilitychange", visibilityListener);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key.toLowerCase() === 's') {
        const nextIndex = (activeTab + 1) % tabs.length;
        setPrevTab(activeTab);
        setActiveTab(nextIndex);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, tabs.length]);

  return (
    <div className="app-layout" ref={appContainerRef} tabIndex={-1} style={{ outline: 'none' }}>
      <header className="app-header">
        <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: '1rem', alignItems: 'center' }}>
          <h1>teno</h1>
          {user && (
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
              Logout
            </button>
          )}
        </div>
      </header>

      {loadingAuth ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
      ) : !user ? (
        <div className="auth-container" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Log in to TeNo</h2>
          <button 
            onClick={handleGoogleLogin} 
            style={{ padding: '0.5rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Sign in with Google
          </button>
          <div style={{ textAlign: 'center', margin: '0.5rem 0', color: '#666' }}>or</div>
          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }}
            />
            <button type="submit" style={{ padding: '0.5rem', background: '#2ba84a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem' }}>
              {isRegistering ? 'Create Account' : 'Log in Options'}
            </button>
            <p 
              onClick={() => setIsRegistering(!isRegistering)} 
              style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa', cursor: 'pointer', marginTop: '0.5rem', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already have an account? Log in' : 'Need an account? Register'}
            </p>
          </form>
        </div>
      ) : (
        <>
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
              let positionClass = 'slide-hidden';
              if (idx === activeTab) {
                positionClass = 'slide-active';
              } else if (idx < activeTab) {
                positionClass = 'slide-left';
              } else if (idx > activeTab) {
                positionClass = 'slide-right';
              }

              return (
                <div key={tab.id} className={`slide-pane ${positionClass}`}>
                  {React.cloneElement(tab.component, { isActive: activeTab === idx, user })}
                </div>
              )
            })}
          </main>
        </>
      )}
    </div>
  )
}

export default App
