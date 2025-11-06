import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Calendar, FileText, TrendingUp, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react'
import QuickActions from '../components/QuickActions'
import AppointmentCalendar from '../components/AppointmentCalendar'
import AppointmentForm from '../components/AppointmentForm'
import CandidateSearchModal from '../components/CandidateSearchModal'




interface DashboardStats {
  totalCandidates: number
  scheduledInterviews: number
  completedInterviews: number
  pendingEvaluations: number
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCandidates: 0,
    scheduledInterviews: 0,
    completedInterviews: 0,
    pendingEvaluations: 0
  })
  const [loading, setLoading] = useState(true)
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  const [showCandidateSearch, setShowCandidateSearch] = useState(false)


  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Fetch candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, status')

      if (candidatesError) throw candidatesError

      // Fetch appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .select('id, candidate_id')

      if (appointmentsError) throw appointmentsError

      // Fetch evaluations
      const { data: evaluations, error: evaluationsError } = await supabase
        .from('hrta_sd00-03_ai_evaluations')
        .select('candidate_id')

      if (evaluationsError) throw evaluationsError

      // Calculate stats
      const totalCandidates = candidates?.length || 0
      const scheduledInterviews = appointments?.length || 0
      const completedInterviews = candidates?.filter(c => c.status === 'Interviewed').length || 0
      const evaluatedCandidates = new Set(evaluations?.map(e => e.candidate_id) || []).size
      const pendingEvaluations = completedInterviews - evaluatedCandidates

      setStats({
        totalCandidates,
        scheduledInterviews,
        completedInterviews,
        pendingEvaluations: Math.max(0, pendingEvaluations)
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewAppointment = () => {
    setShowAppointmentForm(true)
  }

  const handleAppointmentSuccess = () => {
    setShowAppointmentForm(false)
    fetchDashboardStats()
  }

  const statCards = [
    {
      title: 'Total Candidates',
      value: stats.totalCandidates,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Scheduled Interviews',
      value: stats.scheduledInterviews,
      icon: Calendar,
      color: 'bg-green-500',
      change: '+8%'
    },
    {
      title: 'Completed Interviews',
      value: stats.completedInterviews,
      icon: CheckCircle,
      color: 'bg-purple-500',
      change: '+15%'
    },
    {
      title: 'Pending Evaluations',
      value: stats.pendingEvaluations,
      icon: AlertCircle,
      color: 'bg-orange-500',
      change: '-5%'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Overview of your interview management system</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm font-medium text-green-600">{card.change}</span>
                <span className="text-sm text-gray-500 ml-2">from last month</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions - Full Width */}
        <div className="mb-8">
          <QuickActions
            onNewAppointment={handleNewAppointment}
            candidateCount={stats.totalCandidates}
            appointmentCount={stats.scheduledInterviews}
          />
        </div>

        <div className="mb-8">
          <button
            onClick={() => setShowCandidateSearch(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow"
          >
            Search Candidate Answers
          </button>
        </div>


        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Recent Activity */}
          <div className="lg:col-span-1 space-y-6">
            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">New candidate application</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Interview completed</p>
                    <p className="text-xs text-gray-500">4 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Evaluation submitted</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Calendar */}
          <div className="lg:col-span-2">
            <AppointmentCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          </div>
        </div>

        {/* Appointment Form Modal */}
        <AppointmentForm
          isOpen={showAppointmentForm}
          onClose={() => setShowAppointmentForm(false)}
          onSuccess={handleAppointmentSuccess}
        />

        <CandidateSearchModal
          isOpen={showCandidateSearch}
          onClose={() => setShowCandidateSearch(false)}
        />

      </div>
    </div>

          
  )

  
}

export default Dashboard