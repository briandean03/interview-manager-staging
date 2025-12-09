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
import { useNavigate } from "react-router-dom"
import { format, parseISO } from "date-fns"
import PageTransition from "../components/PageTransition"
import HoverCard from '../components/HoverCard'
import DashboardSkeleton from '../components/DashboardSkeleton'

interface DashboardStats {
  totalCandidates: number
  scheduledInterviews: number
  completedInterviews: number
  pendingEvaluations: number
}

interface InterviewTrendPoint {
  monthLabel: string // "Dec 25"
  key: string        // "2025-12"
  count: number
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
  const [progressSnapshot, setProgressSnapshot] = useState({
    activeCandidates: 0,
    totalActivities: 0,
    latestActivity: null as string | null,
    topCandidates: [] as { name: string; time: string }[]
  })

  // ====== FILTER STATE ======
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [monthFilter, setMonthFilter] = useState<string>("all") // "YYYY-MM" or "all"

  const [roleOptions, setRoleOptions] = useState<string[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [monthOptions, setMonthOptions] = useState<{ value: string; label: string }[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])


  // Trend for "Interviews per Month"
  const [interviewTrend, setInterviewTrend] = useState<InterviewTrendPoint[]>([])

  const navigate = useNavigate()

  const handleActivityClick = (ev: ActivityEvent) => {
  if (!ev.candidateId) return

  switch (ev.type) {

    case "candidate_added":
      navigate(`/candidates?search=${ev.candidateId}`)
      break

    case "appointment_scheduled":
      navigate(`/booking?candidate=${ev.candidateId}&time=${ev.appointmentTime}`)
      break

    case "evaluation":
      navigate(`/results?candidate=${ev.candidateId}`)
      break

    case "system_log":
      navigate(`/progress?candidate=${ev.candidateId}`)
      break

    default:
      break
  }
}

  interface ActivityEvent {
  type: string
  label: string
  time: string | null
  color: string
  urgent?: boolean
  urgentLevel?: 'medium'
  candidateId?: string
  appointmentTime?: string
}


  useEffect(() => {
    fetchDashboardStats()
    fetchProgressSnapshot()
    fetchRecentActivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter, monthFilter])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // 1) Fetch candidate base data
      const { data: candidates } = await supabase
        .from("hrta_cd00-01_resume_extraction")
        .select("candidate_id, status, position_code, created_at")
        .order("created_at", { ascending: false })

      const allCandidates = candidates || []

      // Build role + status options from data
      const roleSet = new Set<string>()
      const statusSet = new Set<string>()
      const monthSet = new Set<string>()

      allCandidates.forEach(c => {
        if (c.position_code) roleSet.add(c.position_code)
        if (c.status) statusSet.add(c.status)
        if (c.created_at) {
          const d = new Date(c.created_at as string)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          monthSet.add(key)
        }
      })

      // 2) Fetch appointment data (for upcoming + trend)
      const { data: appointmentsRaw } = await supabase
        .from("hrta_cd00-03_appointment_info")
        .select("id, candidate_id, appointment_time")

      const allAppointments = (appointmentsRaw || []).filter(a => a.appointment_time)

      // Add months from appointments
      allAppointments.forEach(a => {
        if (!a.appointment_time) return
        const d = new Date(a.appointment_time)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        monthSet.add(key)
      })

      // Month options sorted
      const monthOptionsArr = Array.from(monthSet)
        .sort()
        .map(v => {
          const [yearStr, monthStr] = v.split("-")
          const d = new Date(Number(yearStr), Number(monthStr) - 1, 1)
          return {
            value: v,
            label: format(d, "MMM yyyy"),
          }
        })

      setRoleOptions(Array.from(roleSet).sort())
      setStatusOptions(Array.from(statusSet).sort())
      setMonthOptions(monthOptionsArr)

      // Filter helpers
      const matchesRole = (c: any) =>
        roleFilter === "all" || c.position_code === roleFilter

      const matchesStatus = (c: any) =>
        statusFilter === "all" || c.status === statusFilter

      const matchesMonthByCreated = (c: any) => {
        if (monthFilter === "all" || !c.created_at) return true
        const d = new Date(c.created_at as string)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        return key === monthFilter
      }

      // Filtered candidates
      const filteredCandidates = allCandidates.filter(c =>
        matchesRole(c) && matchesStatus(c) && matchesMonthByCreated(c)
      )

      const totalCandidates = filteredCandidates.length

      // Completed Interviews
      const completedInterviews =
        filteredCandidates.filter(c => c.status === "Interviewed").length || 0

      // Build candidate map for join with appointments
      const candidateMap = new Map(
        allCandidates.map(c => [c.candidate_id, c])
      )

      // Future appointments (for scheduled + trend)
      const now = new Date()
      const futureAppointments = allAppointments.filter(a => {
        const d = new Date(a.appointment_time as string)
        return d > now
      })

      // Filter appointments based on candidate filters and monthFilter (by appointment_time)
      const filteredAppointments = futureAppointments.filter(a => {
        const c = candidateMap.get(a.candidate_id)
        if (!c) return false
        if (!matchesRole(c) || !matchesStatus(c)) return false

        if (monthFilter !== "all") {
          const d = new Date(a.appointment_time as string)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          if (key !== monthFilter) return false
        }
        return true
      })

      // For scheduledInterviews we only count appointments whose candidate is NOT interviewed yet
      const resumeStatusMap = new Map(
        allCandidates.map(c => [c.candidate_id, c.status])
      )

      const scheduledInterviews = filteredAppointments.filter(a =>
        resumeStatusMap.get(a.candidate_id) !== "Interviewed"
      ).length

      // Pending evaluations
      const { data: evaluations } = await supabase
        .from("hrta_sd00-03_ai_evaluations")
        .select("candidate_id")

      const evaluatedSet = new Set((evaluations || []).map(e => e.candidate_id))
      const pendingEvaluations = Math.max(0, completedInterviews - evaluatedSet.size)

      // Build interview trend (appointments per month from filteredAppointments)
      const trendCount: Record<string, number> = {}

      filteredAppointments.forEach(a => {
        if (!a.appointment_time) return
        const d = new Date(a.appointment_time)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        trendCount[key] = (trendCount[key] || 0) + 1
      })

      const trendPoints: InterviewTrendPoint[] = Object.entries(trendCount)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([key, count]) => {
          const [yearStr, monthStr] = key.split("-")
          const d = new Date(Number(yearStr), Number(monthStr) - 1, 1)
          return {
            key,
            monthLabel: format(d, "MMM yy"),
            count,
          }
        })

      setInterviewTrend(trendPoints)

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

  const fetchRecentActivity = async () => {
  try {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const sinceIso = since.toISOString()

    // 1) Recent candidates
    const { data: recentCandidates } = await supabase
      .from("hrta_cd00-01_resume_extraction")
      .select("candidate_id, first_name, last_name, created_at")
      .gte("created_at", sinceIso)

    // 2) Recent appointments
    const { data: recentAppointments } = await supabase
      .from("hrta_cd00-03_appointment_info")
      .select("candidate_id, appointment_time, created_at")

    // 3) Execution logs
    const { data: logs } = await supabase
      .from("hrta_sd00-09_execution_log")
      .select("candidate_id, created_at, current_status")
      .gte("created_at", sinceIso)

    // 4) AI evaluations
    const { data: evaluations } = await supabase
      .from("hrta_sd00-03_ai_evaluations")
      .select("candidate_id, created_at")
      .gte("created_at", sinceIso)

    const events: ActivityEvent[] = []

    // Candidate added events
    recentCandidates?.forEach(c => {
      events.push({
        type: "candidate_added",
        label: `New candidate: ${c.first_name} ${c.last_name}`,
        time: c.created_at,
        color: "bg-blue-500",
        candidateId: c.candidate_id
      })
    })

    // Appointment events
    recentAppointments?.forEach(a => {
      events.push({
        type: "appointment_scheduled",
        label: `Interview scheduled for ${a.candidate_id}`,
        time: a.created_at || a.appointment_time,
        color: "bg-green-500",
        appointmentTime: a.appointment_time
      })
    })

    // AI evaluation events
    evaluations?.forEach(ev => {
      events.push({
        type: "evaluation",
        label: `Evaluation completed for ${ev.candidate_id}`,
        time: ev.created_at,
        color: "bg-purple-500",
        candidateId: ev.candidate_id
      })
    })

    // Execution logs events
    logs?.forEach(l => {
      events.push({
        type: "system_log",
        label: `System updated "${l.current_status}" for ${l.candidate_id}`,
        time: l.created_at,
        color: "bg-gray-500",
        candidateId: l.candidate_id
      })
    })

    // ---------- URGENCY: Only interviews happening in next 2 hours ----------
    events.forEach(ev => {
      if (ev.type !== "appointment_scheduled") return

      const now = new Date()
      const apptTime = new Date(ev.time!)

      const diffMinutes = (apptTime.getTime() - now.getTime()) / (1000 * 60)

      // Interview is upcoming AND within 120 minutes
      if (diffMinutes > 0 && diffMinutes <= 120) {
        ev.urgent = true
        ev.urgentLevel = "medium"
        ev.label += " — happening soon"
        ev.color = "bg-orange-500"
      }
    })


    // Sort by time DESC
    const sorted = events
      .sort((a, b) => new Date(b.time!).getTime() - new Date(a.time!).getTime())
      .slice(0, 15)

    setActivityFeed(sorted)
  } catch (err) {
    console.error("Error fetching activity feed:", err)
  }
  
}


  const fetchProgressSnapshot = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: logs } = await supabase
        .from("hrta_sd00-09_execution_log")
        .select("id, created_at, candidate_id, current_status")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })

      if (!logs || logs.length === 0) {
        setProgressSnapshot({
          activeCandidates: 0,
          totalActivities: 0,
          latestActivity: null,
          topCandidates: [],
        })
        return
      }

      const candidateIds = [...new Set(logs.map(l => l.candidate_id))]

      const { data: candidates } = await supabase
        .from("hrta_cd00-01_resume_extraction")
        .select("candidate_id, first_name, last_name, status, position_code")
        .in("candidate_id", candidateIds)

      const candidateMap = new Map(
        (candidates || []).map(c => [c.candidate_id, c])
      )

      // Apply role/status filters to snapshot too
      const matchesRole = (c: any) =>
        roleFilter === "all" || c.position_code === roleFilter

      const matchesStatus = (c: any) =>
        statusFilter === "all" || c.status === statusFilter

      const filteredLogs = logs.filter(l => {
        const c = candidateMap.get(l.candidate_id)
        if (!c) return false
        return matchesRole(c) && matchesStatus(c)
      })

      if (filteredLogs.length === 0) {
        setProgressSnapshot({
          activeCandidates: 0,
          totalActivities: 0,
          latestActivity: null,
          topCandidates: [],
        })
        return
      }

      const filteredCandidateIds = [...new Set(filteredLogs.map(l => l.candidate_id))]

      const nameMap = new Map(
        (candidates || []).map(c => [
          c.candidate_id,
          `${c.first_name} ${c.last_name}`,
        ])
      )

      const grouped = filteredCandidateIds.map(id => {
        const candidateLogs = filteredLogs.filter(l => l.candidate_id === id)
        return {
          name: nameMap.get(id) || "Unknown",
          latestTime: candidateLogs[0]?.created_at || null,
        }
      })

      grouped.sort(
        (a, b) =>
          new Date(b.latestTime || "").getTime() -
          new Date(a.latestTime || "").getTime()
      )

      setProgressSnapshot({
        activeCandidates: filteredCandidateIds.length,
        totalActivities: filteredLogs.length,
        latestActivity: filteredLogs[0].created_at,
        topCandidates: grouped.slice(0, 3).map(g => ({
          name: g.name,
          time: g.latestTime as string,
        })),
      })
    } catch (err) {
      console.error("Error fetching progress snapshot:", err)
    }
  }

  const handleNewAppointment = () => setShowAppointmentForm(true)

  const handleAppointmentSuccess = () => {
    setShowAppointmentForm(false)
    fetchDashboardStats()
    fetchProgressSnapshot()
  }

  const statCards = [
    {
      title: 'Total Candidates',
      value: stats.totalCandidates,
      icon: Users,
      color: 'bg-blue-500',
      
    },
    {
      title: 'Scheduled Interviews',
      value: stats.scheduledInterviews,
      icon: Calendar,
      color: 'bg-green-500',
      
    },
    {
      title: 'Completed Interviews',
      value: stats.completedInterviews,
      icon: CheckCircle,
      color: 'bg-purple-500',
      
    },
    {
      title: 'Pending Evaluations',
      value: stats.pendingEvaluations,
      icon: AlertCircle,
      color: 'bg-orange-500',
      
    },
  ]

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gray-50 px-4 py-6">
          <DashboardSkeleton />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="mx-auto w-full max-w-screen-xl px-3 sm:px-5 md:px-8 py-4 sm:py-6">
          {/* PAGE HEADER */}
          <header className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600">
                  Overview of your interview management system
                </p>
              </div>

              {/* Filters: Role, Month, Status */}
              <div className="flex flex-wrap gap-2">
                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                >
                  <option value="all">All Roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                {/* Month Filter */}
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                >
                  <option value="all">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                >
                  <option value="all">All Status</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          {/* KPI CARDS */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-7">
            {statCards.map((card, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] sm:text-sm font-medium text-gray-600">
                      {card.title}
                    </p>
                    <p className="text-xl sm:text-3xl font-bold text-gray-900">
                      {card.value}
                    </p>
                  </div>
                  <div className={`${card.color} p-2 rounded-lg`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="mt-2 flex items-center text-[11px] sm:text-sm">
                  <span className="font-medium text-green-600">{card.change}</span>
                </div>
              </div>
            ))}
          </section>

          {/* QUICK ACTIONS ROW (3 compact cards via QuickActions) */}
          <section className="mb-5 sm:mb-7">
            <HoverCard>
              <QuickActions
                onNewAppointment={handleNewAppointment}
                candidateCount={stats.totalCandidates}
                appointmentCount={stats.scheduledInterviews}
              />
            </HoverCard>
          </section>

          {/* OVERVIEW ROW: Mini Graph + Snapshot */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">

            {/* Mini Graph: Interviews per Month */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:col-span-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                Interviews per Month
              </h3>
              {interviewTrend.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming interviews for the selected filters.</p>
              ) : (
                <div className="flex items-end gap-3 h-40">
                  {interviewTrend.map((point) => {
                    const max = Math.max(...interviewTrend.map(p => p.count))
                    const height = max > 0 ? (point.count / max) * 100 : 0
                    return (
                      <div key={point.key} className="flex flex-col items-center flex-1">
                        <div
                          className="w-full bg-blue-100 rounded-t-md"
                          style={{ height: `${height || 4}%` }}
                        >
                          <div className="w-full h-full bg-blue-500 rounded-t-md" />
                        </div>
                        <span className="mt-1 text-[11px] text-gray-600">
                          {point.monthLabel}
                        </span>
                        <span className="text-[11px] text-gray-800 font-medium">
                          {point.count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Interview Progress Snapshot */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
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
                  <p className="text-sm text-gray-600">Total Actions</p>
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
                onClick={() => navigate("/progress")}
                className="mt-4 text-blue-600 text-sm font-medium hover:underline"
              >
                View full monitor →
              </button>
            </div>
          </section>

          {/* BOTTOM SECTION: Recent Activity + Calendar */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Recent Activity (left) */}
            <aside className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
                  Recent Activity
                </h3>
                <HoverCard>
                  <div className="space-y-3">
                    {activityFeed.length === 0 && (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}

             {activityFeed.map((act, i) => (
  <div
    key={i}
    onClick={() => handleActivityClick(act)}
    className="flex items-start space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded-md transition"
  >
    {/* Dot */}
    <div
      className={`w-2.5 h-2.5 rounded-full mt-1.5 
        ${act.color} 
        ${act.urgent ? "animate-pulse" : ""}`}
    />

    {/* Text block */}
    <div className="flex flex-col">
      <p className="text-sm font-medium text-gray-900">
        {act.label}
        {act.urgent && (
          <span className="ml-2 text-[10px] font-semibold text-orange-600">
            — SOON
          </span>
        )}
      </p>

      <p className="text-xs text-gray-500">
        {act.time ? new Date(act.time).toLocaleString() : ""}
      </p>
    </div>
  </div>
))}


                  </div>
                </HoverCard>
              </div>
            </aside>

            {/* Calendar (right) */}
            <div className="lg:col-span-2">
              <AppointmentCalendar
                selectedDate={selectedDate}
                onDateSelect={(date) => {
                  setSelectedDate(date)
                  const localDate = format(date, "yyyy-MM-dd")
                  navigate(`/booking?date=${localDate}`)
                }}
              />
            </div>
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
