import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DebugTokenTest from './DebugTokenTest.jsx'

const isDebugMode = window.location.hash === '#debug';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDebugMode ? <DebugTokenTest /> : <App />}
  </StrictMode>,
)
