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
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import PageTransition from "../components/PageTransition"
import HoverCard from '../components/HoverCard'
import DashboardSkeleton from '../components/DashboardSkeleton'





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
  const navigate = useNavigate();
  const [progressSnapshot, setProgressSnapshot] = useState({
  activeCandidates: 0,
  totalActivities: 0,
  latestActivity: null as string | null,
  topCandidates: [] as { name: string; time: string }[]
});


  useEffect(() => {
    fetchDashboardStats();
    fetchProgressSnapshot();
  }, [])

  const fetchDashboardStats = async () => {
  try {
    // 1. Total candidates
    const { data: candidates } = await supabase
      .from("hrta_cd00-01_resume_extraction")
      .select("candidate_id, status")
      .order("created_at", { ascending: false })

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
const fetchProgressSnapshot = async () => {
  try {
    // Get logs (last 7 days, latest first)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: logs } = await supabase
      .from("hrta_sd00-09_execution_log")
      .select("id, created_at, candidate_id, current_status")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (!logs || logs.length === 0) return;

    // Find unique candidate IDs
    const candidateIds = [...new Set(logs.map(l => l.candidate_id))];

    // Get candidate names
    const { data: candidates } = await supabase
      .from("hrta_cd00-01_resume_extraction")
      .select("candidate_id, first_name, last_name")
      .in("candidate_id", candidateIds);

    // Combine logs + names
    const nameMap = new Map(
      candidates?.map(c => [c.candidate_id, `${c.first_name} ${c.last_name}`]) || []
    );

    // Build grouped list by candidate
    const grouped = candidateIds.map(id => {
      const candidateLogs = logs.filter(l => l.candidate_id === id);
      return {
        name: nameMap.get(id) || "Unknown",
        latestTime: candidateLogs[0]?.created_at || null
      };
    });

    // Sort by recent activity
    grouped.sort((a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime());

    setProgressSnapshot({
      activeCandidates: candidateIds.length,
      totalActivities: logs.length,
      latestActivity: logs[0].created_at,
      topCandidates: grouped.slice(0, 3).map(g => ({
        name: g.name,
        time: g.latestTime
      }))
    });

  } catch (err) {
    console.error("Error fetching progress snapshot:", err);
  }
};



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
          <PageTransition>
            <div className="min-h-screen bg-gray-50 px-4 py-6">
              <DashboardSkeleton />
            </div>
          </PageTransition>
        );
      }


  return (
    <PageTransition>
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
          <HoverCard>
          <QuickActions
            onNewAppointment={handleNewAppointment}
            candidateCount={stats.totalCandidates}
            appointmentCount={stats.scheduledInterviews}
          />
          </HoverCard>
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

                {/* Interview Progress Snapshot */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Interview Progress Snapshot
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <p className="text-sm text-gray-600">Active Candidates</p>
              <p className="text-2xl font-bold text-gray-900">
                {progressSnapshot.activeCandidates}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">
                {progressSnapshot.totalActivities}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Latest Activity</p>
              <p className="text-sm font-medium text-gray-800">
                {progressSnapshot.latestActivity
                  ? new Date(progressSnapshot.latestActivity).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {progressSnapshot.topCandidates.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-medium text-gray-900 truncate">{c.name}</span>
                <span className="text-gray-500">
                  {new Date(c.time).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => (window.location.href = "/progress")}
            className="mt-4 text-blue-600 text-sm font-medium hover:underline"
          >
            View full monitor →
          </button>
        </div>

        {/* Calendar + Recent Activity */}
        <section className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 order-1">
            
            <AppointmentCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                const localDate = format(date, "yyyy-MM-dd");
                navigate(`/booking?date=${localDate}`);
              }}
            />
            
          </div>

          {/* Recent Activity */}
          <aside className="order-2 lg:order-none space-y-4">
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <HoverCard>
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
              </HoverCard>
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
    </PageTransition>
  )

}

export default Dashboard
