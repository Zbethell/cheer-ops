import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Report from './Report.jsx'
import Expenses from './Expenses.jsx'
import ExpenseStatus from './ExpenseStatus.jsx'
import ContainerView from './ContainerView.jsx'

const path = window.location.pathname;

function Root() {
  if (path === '/report') return <Report />;
  if (path === '/expenses') return <Expenses />;
  if (path === '/expenses-status') return <ExpenseStatus />;
  if (path.startsWith('/container/')) return <ContainerView />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
