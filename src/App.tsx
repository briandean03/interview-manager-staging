import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Navigation from './components/Navigation'
import Dashboard from './pages/Dashboard'
import CandidateSelection from './pages/CandidateSelection'
import InterviewBooking from './pages/InterviewBooking'
import InterviewProgress from './pages/InterviewProgress'
import InterviewResults from './pages/InterviewResults'
import SecuritySettings from './pages/SecuritySettings'
import Login from './pages/Login'
import Signup from "./pages/Signup"


import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'

function App() {
  const { session } = useAuth()

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">

        {/* Show navigation only when logged in */}
        {session && <Navigation />}

        <Routes>
          {/* PUBLIC ROUTE */}
          <Route path="/login" element={<Login />} />

        { /* Sign Up Route */ }
          <Route path="/signup" element={<Signup />} />


          {/* PROTECTED ROUTES */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/candidates"
            element={
              <ProtectedRoute>
                <CandidateSelection />
              </ProtectedRoute>
            }
          />

          <Route
            path="/booking"
            element={
              <ProtectedRoute>
                <InterviewBooking />
              </ProtectedRoute>
            }
          />

          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <InterviewProgress />
              </ProtectedRoute>
            }
          />

          <Route
            path="/results"
            element={
              <ProtectedRoute>
                <InterviewResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <SecuritySettings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
