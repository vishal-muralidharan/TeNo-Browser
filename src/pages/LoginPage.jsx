import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../firebase'

function getAuthErrorMessage(error) {
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

function isStrongPassword(pass) {
  const minLength = 8
  const hasUpper = /[A-Z]/.test(pass)
  const hasLower = /[a-z]/.test(pass)
  const hasNumber = /[0-9]/.test(pass)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass)
  return pass.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial
}

export default function LoginPage({ user, loadingAuth }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authStatus, setAuthStatus] = useState('')

  if (loadingAuth) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
  }

  if (user) {
    return <Navigate to="/app" replace />
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()

    if (!email) {
      setAuthError('Please enter your email to reset your password.')
      return
    }

    try {
      setAuthError('')
      setAuthStatus('Sending password reset email...')
      await sendPasswordResetEmail(auth, email)
      setAuthStatus(<span>Check your <strong>spam</strong> folder for the password reset link. It will be <strong>valid for 5 minutes</strong>.</span>)
    } catch (error) {
      console.error(error)
      setAuthError(getAuthErrorMessage(error))
      setAuthStatus('')
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()

    try {
      setAuthError('')
      setAuthStatus('')

      if (isRegistering) {
        if (!name.trim()) {
          setAuthError('Please enter your name.')
          return
        }

        if (password !== confirmPassword) {
          setAuthError('Passwords do not match.')
          return
        }

        if (!isStrongPassword(password)) {
          setAuthError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.')
          return
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(userCredential.user, { displayName: name })
        setAuthStatus('Registration successful.')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error) {
      console.error(error)
      setAuthError(getAuthErrorMessage(error))
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '1rem', minHeight: 'calc(100vh - 80px)' }}>
      <div className="auth-container" style={{ padding: '2rem', width: '500px', height: '500px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '2rem', left: '2rem', right: '2rem', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.7rem', marginBottom: '0.4rem', textAlign: 'center', margin: '0' }}>Welcome to TeNo</h2>
        </div>

        {isResettingPassword ? (
          <form onSubmit={handlePasswordReset} style={{ position: 'absolute', top: '100px', bottom: '2rem', left: '2rem', right: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center', flex: 1, paddingBottom: '90px' }}>
              {authError && (
                <div style={{ background: '#3b1d1d', border: '1px solid #8b3a3a', color: '#ffd7d7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {authError}
                </div>
              )}
              {authStatus && !authError && (
                <div style={{ background: '#1c2f22', border: '1px solid #2c7a4b', color: '#d8ffe7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {authStatus}
                </div>
              )}
              <div className="typing-caret-field" data-empty={!email}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                />
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontFamily: 'inherit', fontWeight: '500' }}>
                Send Reset Email
              </button>
              <p
                onClick={() => { setIsResettingPassword(false); setAuthError(''); setAuthStatus('') }}
                style={{ textAlign: 'center', fontSize: '0.95rem', color: '#aaa', cursor: 'pointer', marginTop: '1rem', textDecoration: 'underline', marginBottom: '0' }}
              >
                Back to log in
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailAuth} style={{ position: 'absolute', top: '100px', bottom: '2rem', left: '2rem', right: '2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', justifyContent: 'center', flex: 1, paddingBottom: '90px' }}>
              {authError && (
                <div style={{ background: '#3b1d1d', border: '1px solid #8b3a3a', color: '#ffd7d7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {authError}
                </div>
              )}
              {authStatus && !authError && (
                <div style={{ background: '#1c2f22', border: '1px solid #2c7a4b', color: '#d8ffe7', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {authStatus}
                </div>
              )}
              {isRegistering && (
                <div className="typing-caret-field" data-empty={!name}>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isRegistering}
                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                </div>
              )}
              <div className="typing-caret-field" data-empty={!email}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                />
              </div>
              <div className="typing-caret-field" data-empty={!password}>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                />
              </div>
              {isRegistering && (
                <div className="typing-caret-field" data-empty={!confirmPassword}>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={isRegistering}
                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontFamily: 'inherit', fontSize: '1rem' }}
                  />
                </div>
              )}
              {!isRegistering && (
                <p
                  onClick={() => { setIsResettingPassword(true); setAuthError(''); setAuthStatus('') }}
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
                  setIsRegistering(!isRegistering)
                  setAuthError('')
                  setAuthStatus('')
                  setPassword('')
                  setConfirmPassword('')
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
  )
}
