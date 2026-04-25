import React, { useState } from 'react';
import { googleProvider, auth } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
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
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card-container" style={{ maxWidth: '400px', margin: '40px auto' }}>
      <h2 style={{ marginBottom: '20px' }}>terminal // auth</h2>
      {error && <p style={{ color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '10px' }}>{error}</p>}
      
      <form onSubmit={handleEmailAuth}>
        <input 
          type="email" 
          placeholder="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mono-input"
          required 
        />
        <input 
          type="password" 
          placeholder="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mono-input"
          required 
        />
        <button type="submit" className="submit-btn" style={{ width: '100%', marginBottom: '15px' }}>
          {isRegistering ? 'register user' : 'initiate login'}
        </button>
      </form>

      <button onClick={() => setIsRegistering(!isRegistering)} style={{ width: '100%', marginBottom: '15px', color: 'var(--text-secondary)' }}>
        [ {isRegistering ? 'switch to login' : 'switch to register'} ]
      </button>

      <div style={{ textAlign: 'center', marginBottom: '15px', color: 'var(--border)' }}>--- or ---</div>

      <button onClick={handleGoogleLogin} className="mono-input" style={{ width: '100%', borderStyle: 'dashed' }}>
        login via google
      </button>

      <div style={{ marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <strong>important:</strong> please configure the firebase config in src/firebase.js for web endpoints. side-panel extensions and desktop websites use distinct origin controls.
      </div>
    </div>
  );
}

export default Login;