import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import SetupNeeded from './components/SetupNeeded.jsx'
import { isConfigured } from './lib/supabase'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isConfigured ? (
      <AuthProvider>
        <App />
      </AuthProvider>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
)
