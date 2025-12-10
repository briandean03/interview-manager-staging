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
  Calendar, Clock, User, ChevronLeft, ChevronRight, 
  Mail, Phone, Plus, CreditCard as Edit, Trash2 
} from 'lucide-react';
import AppointmentForm from '../components/AppointmentForm';
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition"


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

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeek, setCurrentWeek] = useState<Date | null>(null);

  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithCandidate | null>(null);

  const [searchParams] = useSearchParams();
  const selectedDateParam = searchParams.get("date");

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "19:00", "20:00", "21:00", "22:00"
  ];

  useEffect(() => {
    let dateFromURL: Date;

    if (selectedDateParam) {
      try {
        const [year, month, day] = selectedDateParam.split("-").map(Number);
        const safeDate = new Date(year, month - 1, day);
        dateFromURL = !isNaN(safeDate.getTime()) ? safeDate : new Date();
      } catch {
        dateFromURL = new Date();
      }
    } else {
      dateFromURL = new Date();
    }

    setSelectedDate(dateFromURL);
    setCurrentWeek(startOfWeek(dateFromURL, { weekStartsOn: 1 }));
  }, [selectedDateParam]);


  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email, mobile_num, position_code, status, vote, ai_evaluation');

      if (candidatesError) throw candidatesError;

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .select('*')
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      setCandidates(candidatesData || []);

      const merged = (appointmentsData || []).map(appt => ({
        ...appt,
        candidate: candidatesData?.find(c => c.candidate_id === appt.candidate_id)
      }));

      setAppointments(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }

    // Fetch blocked dates
    const { data: blocked } = await supabase
      .from("hrta_blocked_dates")
      .select("*")
      .order("start_date", { ascending: true });

    setBlockedDates(blocked || []);
  };


  const getAppointmentsForTimeSlot = (date: Date, time: string) => {
    return appointments.filter(appt => {
      if (!appt.appointment_time) return false;

      try {
        const d = parseISO(appt.appointment_time);
        const t = format(d, 'HH:mm');
        const hour = t.substring(0, 2) + ':00';
        return isSameDay(d, date) && hour === time;
      } catch {
        return false;
      }
    });
  };


  const getWeekDays = (date: Date) =>
    Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 1 }), i));


  if (!currentWeek) return <div className="p-10 text-center">Loading...</div>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // BLOCKED LOGIC: determine if a date is blocked
  const isDateBlocked = (date: Date) => {
    return blockedDates.some(b => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      return date >= start && date <= end;
    });
  };


  const weekDays = getWeekDays(currentWeek);

 return (
  <PageTransition>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* =====================
            PAGE HEADER
        ====================== */}
        <header className="flex items-center gap-3 mb-10">
          <Calendar className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              Interview Booking
            </h1>
            <p className="text-gray-600 text-sm">
              Weekly scheduling interface for interviews
            </p>
          </div>

          <div className="ml-auto flex gap-3">
            <button
              onClick={() => {
                setEditingAppointment(null);
                setShowAppointmentForm(true);
              }}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-black/80 transition"
            >
              + New Appointment
            </button>

            <button
              onClick={() => setShowBlockModal(true)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition"
            >
              Block Dates
            </button>
          </div>
        </header>

        {/* =====================
            GRID LAYOUT
        ====================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* =====================
              LEFT PANEL: DETAILS
          ====================== */}
          <aside className="bg-white border border-gray-200 rounded-xl p-6">

            <h2 className="text-xl font-semibold mb-6">Appointment Details</h2>

            {!selectedAppointment ? (
              <div className="text-center py-16 text-gray-500">
                <Clock className="h-10 w-10 mx-auto mb-4 text-gray-300" />
                Select an appointment to view details
              </div>
            ) : (
              <div className="space-y-6">

                {/* Candidate Box */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {selectedAppointment.candidate
                      ? `${selectedAppointment.candidate.first_name} ${selectedAppointment.candidate.last_name}`
                      : "Unknown Candidate"}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex gap-2 items-center">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedAppointment.candidate?.email || "No email"}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedAppointment.candidate?.mobile_num || "No phone"}
                    </div>
                    <div className="flex gap-2 items-center">
                      <User className="h-4 w-4 text-gray-400" />
                      {selectedAppointment.candidate?.position_code}
                    </div>
                  </div>
                </div>

                {/* Time */}
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Appointment Time</p>
                  <div className="flex items-center gap-2 text-gray-700 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {format(parseISO(selectedAppointment.appointment_time), "MMM d, yyyy — HH:mm")}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-gray-200 flex gap-3">
                  <button
                    onClick={() => setShowAppointmentForm(true)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-sm hover:bg-gray-200"
                  >
                    Edit
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm("Delete appointment?")) return;

                      await supabase
                        .from("hrta_cd00-03_appointment_info")
                        .delete()
                        .eq("id", selectedAppointment.id);

                      setSelectedAppointment(null);
                      fetchData();
                    }}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </aside>

          {/* =====================
              RIGHT PANEL: CALENDAR
          ====================== */}
          <main className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">

            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold">Weekly Schedule</h2>

              <div className="flex items-center gap-4 text-sm text-gray-700">
                <button
                  onClick={() => setCurrentWeek(addDays(currentWeek!, -7))}
                  className="hover:text-black"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {format(weekDays[0], "MMM d")} — {format(weekDays[6], "MMM d, yyyy")}

                <button
                  onClick={() => setCurrentWeek(addDays(currentWeek!, 7))}
                  className="hover:text-black"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-8 text-sm font-medium text-gray-700 mb-2">
              <div className="py-2 text-center">Time</div>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2 text-center">{d}</div>
              ))}
            </div>

            {/* Date Row */}
            <div className="grid grid-cols-8 mb-6 gap-1">
              <div></div>
              {weekDays.map((day) => (
                <button
                  key={day.toString()}
                  onClick={() => {
                    if (isDateBlocked(day)) return
                    setSelectedDate(day)
                    navigate(`/booking?date=${format(day, "yyyy-MM-dd")}`)
                  }}
                  className={`
                    py-2 text-sm rounded-lg border transition
                    ${isSameDay(day, selectedDate)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-gray-300 hover:bg-gray-100"
                    }
                  `}
                >
                  {format(day, "d")}
                </button>
              ))}
            </div>

            {/* Time Slots */}
            <div className="space-y-2">
              {timeSlots.map((time) => (
                <div key={time} className="grid grid-cols-8 gap-1">

                  {/* Time Column */}
                  <div className="text-center text-sm py-3 text-gray-700">{time}</div>

                  {/* Days */}
                  {weekDays.map((day) => {
                    const slots = getAppointmentsForTimeSlot(day, time)

                    const isBlocked = isDateBlocked(day)

                    return (
                      <div
                        key={`${day}-${time}`}
                        className={`
                          min-h-[60px] p-2 rounded-lg border 
                          ${isBlocked ? 
                            "bg-gray-100 border-gray-300 text-gray-500" :
                            "bg-white border-gray-300 hover:bg-gray-50"
                          }
                        `}
                      >
                        {isBlocked ? (
                          <div className="text-xs text-center mt-3">Blocked</div>
                        ) : (
                          <div className="space-y-1">
                            {slots.slice(0, 3).map((appt) => (
                              <button
                                key={appt.id}
                                onClick={() => setSelectedAppointment(appt)}
                                className={`
                                  w-full text-xs p-1 rounded-md text-left truncate
                                  ${selectedAppointment?.id === appt.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-100 text-blue-800"
                                  }
                                `}
                              >
                                {appt.candidate
                                  ? `${appt.candidate.first_name} ${appt.candidate.last_name}`
                                  : "Unknown"}
                              </button>
                            ))}

                            {slots.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{slots.length - 3} more
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
          </main>
        </div>
      </div>

      {/* Appointment Form Modal */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={() => {
          setShowAppointmentForm(false);
          setEditingAppointment(null);
        }}
        onSuccess={fetchData}
        existingAppointment={editingAppointment}
      />

      {/* Block Dates Modal (unchanged) */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl border border-gray-200 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Block Dates</h2>

            <div className="space-y-4">
              <input type="date" onChange={(e) => setBlockStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="date" onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  if (!blockStart || !blockEnd) return alert("Select dates")

                  await supabase.from("hrta_blocked_dates").insert({
                    start_date: blockStart,
                    end_date: blockEnd
                  })

                  setShowBlockModal(false)
                  fetchData()
                }}
                className="px-4 py-2 bg-black text-white rounded-lg"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </PageTransition>
)
};

export default InterviewBooking;
