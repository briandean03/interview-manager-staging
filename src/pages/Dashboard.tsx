import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Users,
  Calendar,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
} from 'lucide-react'
import QuickActions from '../components/QuickActions'
import AppointmentCalendar from '../components/AppointmentCalendar'
import AppointmentForm from '../components/AppointmentForm'
import CandidateSearchModal from '../components/CandidateSearchModal'
import { Candidate } from "../lib/Candidate"


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
    pendingEvaluations: 0,
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
    // 1. Total candidates
    const { data: candidates } = await supabase
      .from("hrta_cd00-01_resume_extraction")
      .select("candidate_id, status")

    const totalCandidates = candidates?.length || 0

    // 2. Completed Interviews
    const completedInterviews =
      candidates?.filter(c => c.status === "Interviewed").length || 0

    // 3. Scheduled Interviews (upcoming only)
    const { data: upcoming } = await supabase
      .from("hrta_cd00-03_appointment_info")
      .select("candidate_id, appointment_time")
      .not("appointment_time", "is", null)

      // Filter by future only
    const futureAppointments = (upcoming || []).filter(x =>
      x.appointment_time && new Date(x.appointment_time) > new Date()
    )
    // Fetch candidate statuses
    const { data: resumeRows } = await supabase
      .from("hrta_cd00-01_resume_extraction")
      .select("candidate_id, status")
      .in("candidate_id", futureAppointments.map(a => a.candidate_id))

    // Build map
    const statusMap = new Map(
      resumeRows?.map(r => [r.candidate_id, r.status]) || []
    )

    // Count only NOT interviewed
    const scheduledInterviews = futureAppointments.filter(a =>
      statusMap.get(a.candidate_id) !== "Interviewed"
    ).length


    

    // 4. Pending evaluations
    const { data: evaluations } = await supabase
      .from("hrta_sd00-03_ai_evaluations")
      .select("candidate_id")

    const evaluatedSet = new Set(evaluations?.map(e => e.candidate_id) || [])
    const pendingEvaluations = Math.max(0, completedInterviews - evaluatedSet.size)

    // Update dashboard
    setStats({
      totalCandidates,
      scheduledInterviews,
      completedInterviews,
      pendingEvaluations,
    })

  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
  } finally {
    setLoading(false)
  }
}



  const handleNewAppointment = () => setShowAppointmentForm(true)
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
      change: '+12%',
    },
    {
      title: 'Scheduled Interviews',
      value: stats.scheduledInterviews,
      icon: Calendar,
      color: 'bg-green-500',
      change: '+8%',
    },
    {
      title: 'Completed Interviews',
      value: stats.completedInterviews,
      icon: CheckCircle,
      color: 'bg-purple-500',
      change: '+15%',
    },
    {
      title: 'Pending Evaluations',
      value: stats.pendingEvaluations,
      icon: AlertCircle,
      color: 'bg-orange-500',
      change: '-5%',
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Compact, centered container */}
      <div className="mx-auto w-full max-w-screen-xl px-3 sm:px-5 md:px-8 py-4 sm:py-6">

        {/* Header */}
        <header className="mb-4 sm:mb-6 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Overview of your interview management system
          </p>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-7">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] sm:text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`${card.color} p-2 rounded-lg`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-[11px] sm:text-sm">
                <span className="font-medium text-green-600">{card.change}</span>
                <span className="text-gray-500 ml-1">from last month</span>
              </div>
            </div>
          ))}
        </section>

        {/* Quick Actions */}
        <section className="mb-5 sm:mb-7">
          <QuickActions
            onNewAppointment={handleNewAppointment}
            candidateCount={stats.totalCandidates}
            appointmentCount={stats.scheduledInterviews}
          />
        </section>

        {/* Search Button */}
        <section className="mb-5 sm:mb-7 flex justify-center sm:justify-start">
          <button
            onClick={() => setShowCandidateSearch(true)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg shadow-md transition text-sm font-medium"
          >
            Search Candidate Answers
          </button>
        </section>

        {/* Calendar + Recent Activity */}
        <section className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 order-1">
            <AppointmentCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          </div>

          {/* Recent Activity */}
          <aside className="order-2 lg:order-none space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { color: 'bg-blue-500', title: 'New candidate application', time: '2 hours ago' },
                  { color: 'bg-green-500', title: 'Interview completed', time: '4 hours ago' },
                  { color: 'bg-purple-500', title: 'Evaluation submitted', time: '1 day ago' },
                ].map((act, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <div className={`w-2 h-2 ${act.color} rounded-full mt-1.5`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{act.title}</p>
                      <p className="text-xs text-gray-500">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {/* Modals */}
        <AppointmentForm
          isOpen={showAppointmentForm}
          onClose={() => setShowAppointmentForm(false)}
          onSuccess={handleAppointmentSuccess}
          className="w-full max-w-md mx-auto"
        />
        <CandidateSearchModal
          isOpen={showCandidateSearch}
          onClose={() => setShowCandidateSearch(false)}
          className="w-full max-w-md mx-auto"
        />
      </div>
    </div>
  )
}

export default Dashboard
