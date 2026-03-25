import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Charts from './pages/Charts'
import DataTable from './pages/DataTable'
import './Styles/adminator.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/datatable" element={<DataTable />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
