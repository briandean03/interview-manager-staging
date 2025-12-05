import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  format, 
  addDays, 
  startOfWeek, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { 
  Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, 
  Mail, Phone, Plus, CreditCard as Edit, Trash2 
} from 'lucide-react';
import AppointmentForm from '../components/AppointmentForm';
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";


interface Candidate {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_num?: string;
  position_code: string;
  status: string;
  vote?: number;
  ai_evaluation?: string;
}

interface Appointment {
  id: number;
  candidate_id: string;
  appointment_time: string;
  position_code?: string;
  q_revision?: string;
  created_at: string;
}

interface AppointmentWithCandidate extends Appointment {
  candidate?: Candidate;
}

const InterviewBooking: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentWithCandidate[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

const [blockStart, setBlockStart] = useState("");
const [blockEnd, setBlockEnd] = useState("");
const [showBlockModal, setShowBlockModal] = useState(false);
const [blockedDates, setBlockedDates] = useState<
  { id: number; start_date: string; end_date: string | null }[]
>([]);



  // selected date (state only!)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // calendar week
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null);

  // appointment form
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCandidate | null>(null);

  // query param: ?date=2025-12-01T...
  const [searchParams] = useSearchParams();
  const selectedDateParam = searchParams.get("date");

  const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00"
];


  // Sync selected date + current week to the URL date
  useEffect(() => {
    let dateFromURL: Date;

    if (selectedDateParam) {
      try {
        const [year, month, day] = selectedDateParam.split("-").map(Number);
        const safeDate = new Date(year, month - 1, day); //no timezone shift

        if (!isNaN(safeDate.getTime())) {
          dateFromURL = safeDate;
        } else {
          dateFromURL = new Date();
        }
      } catch {
        dateFromURL = new Date();
      }
    } else {
      dateFromURL = new Date();
    }

    setSelectedDate(dateFromURL);
    setCurrentWeek(startOfWeek(dateFromURL, { weekStartsOn: 1 }));
  }, [selectedDateParam]);




  // Fetch from Supabase
  useEffect(() => {
    fetchData();
  }, []);



  const fetchData = async () => {
    try {
      // Fetch candidates
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email, mobile_num, position_code, status, vote, ai_evaluation')

      if (candidatesError) throw candidatesError

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .select('*')
        .order('appointment_time', { ascending: true })

      if (appointmentsError) throw appointmentsError

      setCandidates(candidatesData || [])
      
      // Merge appointment data with candidate data
      const appointmentsWithCandidates = (appointmentsData || []).map(appointment => ({
        ...appointment,
        candidate: candidatesData?.find(c => c.candidate_id === appointment.candidate_id)
      }))

      setAppointments(appointmentsWithCandidates)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }

    // Fetch blocked dates
    const { data: blocked, error: blockedErr } = await supabase
      .from("hrta_blocked_dates")
      .select("*")
      .order("start_date", { ascending: true });

    if (blockedErr) throw blockedErr;
    setBlockedDates(blocked || []);

  }

  

  const handleNewAppointment = () => {
    setEditingAppointment(null)
    setShowAppointmentForm(true)
  }

  const handleEditAppointment = (appointment: AppointmentWithCandidate) => {
    setEditingAppointment(appointment)
    setShowAppointmentForm(true)
  }

  const handleDeleteAppointment = async (appointmentId: number) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return

    try {
      const { error } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .delete()
        .eq('id', appointmentId)

      if (error) throw error

      // Refresh data
      await fetchData()
      setSelectedAppointment(null)
    } catch (error) {
      console.error('Error deleting appointment:', error)
      alert('Failed to delete appointment')
    }
  }

  const handleFormSuccess = () => {
    fetchData()
    setShowAppointmentForm(false)
    setEditingAppointment(null)
  }

  const getAppointmentsForTimeSlot = (date: Date, time: string) => {
    return appointments.filter(appointment => {
      if (!appointment.appointment_time) return false
      
      try {
        const appointmentDate = parseISO(appointment.appointment_time)
        const appointmentTime = format(appointmentDate, 'HH:mm')
        const appointmentHour = appointmentTime.substring(0, 2) + ':00'
        
        return isSameDay(appointmentDate, date) && appointmentHour === time
      } catch (error) {
        return false
      }
    })
  }

  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const weekDays = currentWeek ? getWeekDays(currentWeek) : [];
if (!currentWeek) {
  return <div className="p-10 text-center">Loading calendar...</div>;
}


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const isDateBlocked = (date: Date) => {
  return blockedDates.some(b => {
    const start = new Date(b.start_date);
    const end = new Date(b.end_date);
    return date >= start && date <= end;
  });
};


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Interview Booking</h1>
              <p className="text-gray-600">Monitor scheduled interview appointments</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={handleNewAppointment}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>New Appointment</span>
              </button>
              <button
                  onClick={() => setShowBlockModal(true)}
                  className="ml-3 flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Block Dates</span>
                </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Appointment Details Panel */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Appointment Details</h2>
            
            {selectedAppointment ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">
                    {selectedAppointment.candidate ? 
                      `${selectedAppointment.candidate.first_name || ''} ${selectedAppointment.candidate.last_name || ''}`.trim() || 'Unknown Candidate'
                      : 'Unknown Candidate'
                    }
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{selectedAppointment.candidate?.email || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{selectedAppointment.candidate?.mobile_num || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>{selectedAppointment.candidate?.position_code || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Appointment Time
                    </label>
                    <div className="flex items-center space-x-2 text-sm text-gray-900">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>
                        {selectedAppointment.appointment_time ? 
                          format(parseISO(selectedAppointment.appointment_time), 'MMM d, yyyy - HH:mm')
                          : 'Not scheduled'
                        }
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI CV Evaluation
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedAppointment.candidate?.vote || 'Not evaluated'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Revision
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedAppointment.q_revision || 'Not specified'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <div className="text-sm text-gray-900">
                      {selectedAppointment.candidate?.status || 'Unknown'}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleEditAppointment(selectedAppointment)}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">Select an appointment to view details</p>
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Weekly Schedule</h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-gray-600">
                  {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
                </span>
                <button
                  onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Week Header */}
            <div className="grid grid-cols-8 gap-2 mb-4">
              <div className="text-center text-sm font-medium text-gray-500 py-2">Time</div>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-8 gap-2 mb-4">
              <div></div>
              {weekDays.map(day => (
                <button
                  key={day.toString()}
                   onClick={() => {
                    if (isDateBlocked(day)) return;  // Prevent clicking
                    setSelectedDate(day);
                    navigate(`/booking?date=${format(day, "yyyy-MM-dd")}`);
                  }}
                  className={`p-2 text-center rounded-lg border transition-colors duration-200 ${
                  isDateBlocked(day)
                    ? "bg-red-100 border-red-300 text-red-700 cursor-not-allowed"
                    : isSameDay(day, selectedDate)
                    ? "bg-blue-600 text-white border-blue-600"
                    : day.getDay() === 0 || day.getDay() === 6
                    ? "bg-gray-100 text-gray-400 border-gray-200"
                    : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                }`}

                

                >
                  <div className="text-sm font-medium">{format(day, 'd')}</div>
                </button>
              ))}
            </div>

            {/* Time Slots Grid */}
            <div className="space-y-2">
              {timeSlots.map(time => (
                <div key={time} className="grid grid-cols-8 gap-2">
                  <div className="flex items-center justify-center text-sm font-medium text-gray-600 py-4">
                    {time}
                  </div>
                  {weekDays.map(day => {
                    const dayAppointments = getAppointmentsForTimeSlot(day, time)
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    
                    return (
                      <div
                        key={`${day.toString()}-${time}`}
                        className={`min-h-[60px] border rounded-lg p-2 ${
                          isDateBlocked(day)
                            ? "bg-red-50 border-red-200 text-red-500 cursor-not-allowed"
                            : isWeekend
                            ? "bg-gray-50 border-gray-200"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {/* If the entire day is blocked */}
                        {isDateBlocked(day) ? (
                          <div className="text-xs font-medium text-center">Blocked</div>
                        ) : (
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 3).map((appointment, index) => (
                              <button
                                key={appointment.id}
                                onClick={() => setSelectedAppointment(appointment)}
                                className={`w-full text-xs p-1 rounded text-left transition-colors duration-200 ${
                                  selectedAppointment?.id === appointment.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                }`}
                              >
                                <div className="truncate font-medium">
                                  {appointment.candidate
                                    ? `${appointment.candidate.first_name || ""} ${
                                        appointment.candidate.last_name || ""
                                      }`
                                    : "Unknown"}
                                </div>
                                <div className="truncate text-xs opacity-75">
                                  {appointment.appointment_time
                                    ? format(parseISO(appointment.appointment_time), "HH:mm")
                                    : "No time"}
                                </div>
                              </button>
                            ))}

                            {dayAppointments.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayAppointments.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Form Modal */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={() => {
          setShowAppointmentForm(false)
          setEditingAppointment(null)
        }}
        onSuccess={handleFormSuccess}
        existingAppointment={editingAppointment}
      />
{/* Block Dates Modal */}
{showBlockModal && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">Block Dates</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            onChange={e => setBlockStart(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">End Date</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            onChange={e => setBlockEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <button
          onClick={() => setShowBlockModal(false)}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Cancel
        </button>

        <button
          onClick={async () => {
            if (!blockStart || !blockEnd) {
              alert("Please choose start and end dates");
              return;
            }

            const { error } = await supabase.from("hrta_blocked_dates").insert({
              start_date: blockStart,
              end_date: blockEnd,
            });

            if (error) alert(error.message);
            else {
              fetchData();
              setShowBlockModal(false);
            }
          }}
          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
        >
          Block Dates
        </button>
      </div>
    </div>
  </div>
)}
      
    </div>
  )

  
}

export default InterviewBooking