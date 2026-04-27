import React, { useState, useEffect, useRef } from 'react'
import LinkStorer from './components/LinkStorer'
import Reminders from './components/Reminders'
import Timer from './components/Timer'
import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore'

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [prevTab, setPrevTab] = useState(0)
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authStatus, setAuthStatus] = useState('')
  const appContainerRef = useRef(null)

  const getAuthErrorMessage = (error) => {
    if (!error) return 'Authentication failed.'
    const code = error.code || ''

    if (code === 'auth/internal-error') {
      return 'Firebase internal auth error. Check your Firebase Auth configuration and try again.'
    }

    if (code === 'auth/operation-not-allowed') return 'This sign-in method is disabled in Firebase Auth settings.'
    if (code === 'auth/invalid-credential') return 'Invalid login credentials.'
    if (code === 'auth/invalid-email') return 'Invalid email format.'
    if (code === 'auth/user-not-found') return 'No account found for this email.'
    if (code === 'auth/wrong-password') return 'Incorrect password.'

    return error.message || 'Authentication failed.'
  }

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

  const isStrongPassword = (pass) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return pass.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setAuthError('Please enter your email to reset your password.');
      return;
    }
    try {
      setAuthError('');
      setAuthStatus('Sending password reset email...');
      await sendPasswordResetEmail(auth, email);
      setAuthStatus('Password reset email sent. Check your inbox.');
    } catch (error) {
      console.error(error);
      setAuthError(getAuthErrorMessage(error));
      setAuthStatus('');
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    try {
      setAuthError('')
      setAuthStatus('')
      
      if (isRegistering) {
        if (!name.trim()) {
          setAuthError('Please enter your name.');
          return;
        }
        
        if (password !== confirmPassword) {
          setAuthError('Passwords do not match.');
          return;
        }
        
        if (!isStrongPassword(password)) {
          setAuthError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        setAuthStatus('Registration successful.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error(error);
      setAuthError(getAuthErrorMessage(error))
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              <button onClick={() => setShowLogoutConfirm(true)} style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: 'inherit' }}>
                logout
              </button>
            </div>
          )}
        </div>
      </header>

      {loadingAuth ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
      ) : !user ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '1rem', minHeight: 'calc(100vh - 80px)' }}>
          <div className="auth-container" style={{ padding: '2rem', width: '500px', height: '500px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', position: 'relative' }}>
            
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', right: '2rem', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.7rem', marginBottom: '0.4rem', textAlign: 'center', margin: '0' }}>Welcome to TeNo</h2>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', marginTop: '0.4rem' }}>
                {authError && (
                  <div style={{ background: '#3b1d1d', border: '1px solid #8b3a3a', color: '#ffd7d7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                    {authError}
                  </div>
                )}
                {authStatus && !authError && (
                  <div style={{ background: '#1c2f22', border: '1px solid #2c7a4b', color: '#d8ffe7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                    {authStatus}
                  </div>
                )}
              </div>
            </div>

            {isResettingPassword ? (
              <form onSubmit={handlePasswordReset} style={{ position: 'absolute', top: '100px', bottom: '2rem', left: '2rem', right: '2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center', flex: 1, paddingBottom: '90px' }}>
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                </div>
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit', fontWeight: '500' }}>
                    Send Reset Email
                  </button>
                  <p 
                    onClick={() => { setIsResettingPassword(false); setAuthError(''); setAuthStatus(''); }} 
                    style={{ textAlign: 'center', fontSize: '0.95rem', color: '#aaa', cursor: 'pointer', marginTop: '1rem', textDecoration: 'underline', marginBottom: '0' }}
                  >
                    Back to log in
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailAuth} style={{ position: 'absolute', top: '100px', bottom: '2rem', left: '2rem', right: '2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center', flex: 1, paddingBottom: '90px' }}>
                  {isRegistering && (
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required={isRegistering} 
                      style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                    />
                  )}
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                  {isRegistering && (
                    <input 
                      type="password" 
                      placeholder="Confirm Password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      required={isRegistering} 
                      style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                    />
                  )}
                  {!isRegistering && (
                    <p 
                      onClick={() => { setIsResettingPassword(true); setAuthError(''); setAuthStatus(''); }} 
                      style={{ textAlign: 'right', fontSize: '0.85rem', color: '#aaa', cursor: 'pointer', marginTop: '0', textDecoration: 'underline' }}
                    >
                      Forgot password?
                    </p>
                  )}
                </div>

                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#2ba84a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit', fontWeight: '500' }}>
                    {isRegistering ? 'Create Account' : 'Log in'}
                  </button>
                  <p 
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setAuthError('');
                      setAuthStatus('');
                      setPassword('');
                      setConfirmPassword('');
                    }} 
                    style={{ textAlign: 'center', fontSize: '0.95rem', color: '#aaa', cursor: 'pointer', marginTop: '1rem', textDecoration: 'underline', marginBottom: '0' }}
                  >
                    {isRegistering ? 'Already have an account? Log in' : 'Need an account? Register'}
                  </p>
                </div>
              </form>
            )}
          </div>
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

      {showLogoutConfirm && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <p style={{marginBottom: "16px"}}>Confirm Log out?</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => { handleLogout(); setShowLogoutConfirm(false); }}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
