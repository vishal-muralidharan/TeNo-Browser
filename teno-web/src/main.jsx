import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './ThemeContext.jsx'
import { FeatureFlagProvider } from './FeatureFlagContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <FeatureFlagProvider>
        <App />
      </FeatureFlagProvider>
    </ThemeProvider>
  </React.StrictMode>,
)