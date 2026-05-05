import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Report from './Report.jsx'

const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/report' ? <Report /> : <App />}
  </React.StrictMode>
)
