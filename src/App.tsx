import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Navigation from './components/Navigation'
import Dashboard from './pages/Dashboard'
import CandidateSelection from './pages/CandidateSelection'
import InterviewBooking from './pages/InterviewBooking'
import InterviewProgress from './pages/InterviewProgress'
import InterviewResults from './pages/InterviewResults'
import SecuritySettings from './pages/SecuritySettings'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">

        <Navigation />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/candidates" element={<CandidateSelection />} />
          <Route path="/booking" element={<InterviewBooking />} />
          <Route path="/progress" element={<InterviewProgress />} />
          <Route path="/results" element={<InterviewResults />} />
          <Route path="/security" element={<SecuritySettings />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
