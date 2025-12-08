import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { motion, AnimatePresence } from "framer-motion"

// 🔵 Tooltip Component (Hover Card)
const CalendarHoverCard = ({ date, appointments }: {
  date: Date
  appointments: any[]
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="
        absolute z-50 p-3 rounded-lg shadow-xl 
        bg-white border border-gray-200 text-xs 
        w-52
      "
      style={{
        top: "-8px",
        left: "50%",
        transform: "translate(-50%, -100%)",
      }}
    >
      <p className="font-semibold text-gray-900 mb-1">
        {format(date, "MMMM d, yyyy")}
      </p>

      {appointments.length === 0 ? (
        <p className="text-gray-500">No appointments</p>
      ) : (
        <div className="space-y-1">
          {appointments.map((a) => (
            <div key={a.id} className="border-b pb-1 last:pb-0 last:border-none">
              <p className="font-medium text-gray-800">
                {a.candidate?.first_name} {a.candidate?.last_name}
              </p>
              <p className="text-gray-600 text-[11px]">
                {format(parseISO(a.appointment_time), "h:mm a")}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

interface Appointment {
  id: number
  candidate_id: string
  appointment_time: string
  position_code?: string
  candidate?: {
    first_name: string
    last_name: string
    email: string
  }
}

interface AppointmentCalendarProps {
  onAppointmentSelect?: (appointment: Appointment) => void
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  onAppointmentSelect,
  selectedDate = new Date(),
  onDateSelect,
}) => {

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchAppointments()
  }, [currentMonth])

  const fetchAppointments = async () => {
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)

      const { data: appointmentsData } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .select('*')
        .gte('appointment_time', monthStart.toISOString())
        .lte('appointment_time', monthEnd.toISOString())
        .order('appointment_time', { ascending: true })

      const { data: candidatesData } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email')

      const merged = (appointmentsData || []).map((a) => ({
        ...a,
        candidate: candidatesData?.find((c) => c.candidate_id === a.candidate_id),
      }))

      setAppointments(merged)
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  const getAppointmentsForDate = (date: Date) =>
    appointments.filter((a) => {
      if (!a.appointment_time) return false
      return isSameDay(parseISO(a.appointment_time), date)
    })

  const navigateMonth = (dir: 'prev' | 'next') =>
    setCurrentMonth((p) => {
      const m = new Date(p)
      m.setMonth(p.getMonth() + (dir === 'next' ? 1 : -1))
      return m
    })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const isCurrentMonth = (d: Date) => d.getMonth() === currentMonth.getMonth()
  const isToday = (d: Date) => isSameDay(d, new Date())
  const isSelected = (d: Date) => isSameDay(d, selectedDate)

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-2 sm:p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-[2px] sm:gap-2 min-w-[420px]">

          {calendarDays.map((day) => {
            const dayAppointments = getAppointmentsForDate(day)
            const cur = isCurrentMonth(day)
            const today = isToday(day)
            const sel = isSelected(day)

            return (
              <div
                key={day.toString()}
                className="relative"
                onMouseEnter={() => setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                {/* Hover Tooltip */}
                <AnimatePresence>
                  {hoveredDate && isSameDay(hoveredDate, day) && (
                    <CalendarHoverCard date={day} appointments={dayAppointments} />
                  )}
                </AnimatePresence>

                <button
                  onClick={() => onDateSelect?.(day)}
                  className={`aspect-square p-[3px] sm:p-1 rounded-md border text-left transition relative w-full
                    ${cur ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-100 text-gray-400'}
                    ${today ? 'bg-blue-50 border-blue-200' : ''}
                    ${sel ? 'bg-blue-100 border-blue-300' : ''}
                  `}
                >
                  <div className="text-[11px] sm:text-sm font-medium leading-none">
                    {format(day, 'd')}
                  </div>

                  <div className="mt-0.5 sm:mt-1 space-y-[2px]">
                    {dayAppointments.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAppointmentSelect?.(a)
                        }}
                        className="text-[10px] sm:text-xs bg-blue-100 text-blue-800 px-1 rounded truncate hover:bg-blue-200"
                      >
                        <Clock className="inline-block h-2 w-2 mr-0.5" />
                        {format(parseISO(a.appointment_time), 'HH:mm')}
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-[10px] sm:text-xs text-gray-500 text-center">
                        +{dayAppointments.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}

export default AppointmentCalendar
