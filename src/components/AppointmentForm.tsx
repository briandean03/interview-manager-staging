import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, User, MapPin, Phone, Mail, Save, X, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react'
import { format, addDays, startOfDay, parseISO } from 'date-fns'
import AnimatedModal from "../components/AnimatedModal"

interface Candidate {
  candidate_id: string
  first_name: string
  last_name: string
  email: string
  mobile_num?: string
  position_code: string
  status: string
}

interface AppointmentFormData {
  candidate_id: string
  appointment_time: string
  position_code: string
  q_revision?: string
  notes?: string
}

interface AppointmentFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  selectedCandidate?: Candidate | null
  existingAppointment?: any
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedCandidate,
  existingAppointment
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [formData, setFormData] = useState<AppointmentFormData>({
    candidate_id: '',
    appointment_time: '',
    position_code: '',
    q_revision: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  // Time slots for appointment booking
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00'
  ]

  // Generate next 30 days for date selection
  const availableDates = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), i)
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'MMM d, yyyy'),
      dayName: format(date, 'EEEE')
    }
  })

  useEffect(() => {
    if (isOpen) {
      fetchCandidates()
      if (selectedCandidate) {
        setFormData(prev => ({
          ...prev,
          candidate_id: selectedCandidate.candidate_id,
          position_code: selectedCandidate.position_code || ''
        }))
      }
      if (existingAppointment) {
        const appointmentDate = existingAppointment.appointment_time 
          ? format(parseISO(existingAppointment.appointment_time), 'yyyy-MM-dd')
          : ''
        const appointmentTime = existingAppointment.appointment_time
          ? format(parseISO(existingAppointment.appointment_time), 'HH:mm')
          : ''
        
        setFormData({
          candidate_id: existingAppointment.candidate_id || '',
          appointment_time: `${appointmentDate}T${appointmentTime}`,
          position_code: existingAppointment.position_code || '',
          q_revision: existingAppointment.q_revision || '',
          notes: existingAppointment.notes || ''
        })
      }
    }
  }, [isOpen, selectedCandidate, existingAppointment])

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email, mobile_num, position_code, status')
        .in('status', ['CV Processed', 'For Interview'])
        .order('first_name', { ascending: true })

      if (error) throw error
      setCandidates(data || [])
    } catch (error) {
      console.error('Error fetching candidates:', error)
      setError('Failed to load candidates')
    }
  }

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
    setSuccess('')
  }

  const handleDateTimeChange = (date: string, time: string) => {
    if (date && time) {
      const dateTime = `${date}T${time}:00`
      setFormData(prev => ({ ...prev, appointment_time: dateTime }))
    }
  }

  const validateForm = (): boolean => {
    if (!formData.candidate_id) {
      setError('Please select a candidate')
      return false
    }
    if (!formData.appointment_time) {
      setError('Please select appointment date and time')
      return false
    }
    if (!formData.position_code) {
      setError('Please specify the position code')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const appointmentData = {
        candidate_id: formData.candidate_id,
        appointment_time: formData.appointment_time,
        position_code: formData.position_code,
        q_revision: formData.q_revision || null,
        notes: formData.notes || null
      }

      let result
      if (existingAppointment) {
        // Update existing appointment
        result = await supabase
          .from('hrta_cd00-03_appointment_info')
          .update(appointmentData)
          .eq('id', existingAppointment.id)
      } else {
        // Create new appointment
        result = await supabase
          .from('hrta_cd00-03_appointment_info')
          .insert([appointmentData])
      }

      if (result.error) throw result.error

      // Update candidate status to "For Interview"
      await supabase
        .from('hrta_cd00-01_resume_extraction')
        .update({ status: 'For Interview' })
        .eq('candidate_id', formData.candidate_id)

      setSuccess(existingAppointment ? 'Appointment updated successfully!' : 'Appointment scheduled successfully!')
      
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)

    } catch (error) {
      console.error('Error saving appointment:', error)
      setError(error instanceof Error ? error.message : 'Failed to save appointment')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      candidate_id: selectedCandidate?.candidate_id || '',
      appointment_time: '',
      position_code: selectedCandidate?.position_code || '',
      q_revision: '',
      notes: ''
    })
    setError('')
    setSuccess('')
  }

  const getCandidateName = (candidate: Candidate) => {
    return `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown'
  }

  const getSelectedDateTime = () => {
    if (!formData.appointment_time) return { date: '', time: '' }
    const [date, time] = formData.appointment_time.split('T')
    return { date, time: time?.substring(0, 5) || '' }
  }

  const { date: selectedDate, time: selectedTime } = getSelectedDateTime()

  if (!isOpen) return null

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {existingAppointment ? 'Edit Appointment' : 'Schedule Interview Appointment'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Success</h4>
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* Candidate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-1" />
              Select Candidate
            </label>
            <select
              value={formData.candidate_id}
              onChange={(e) => {
                const selectedCandidate = candidates.find(c => c.candidate_id === e.target.value)
                handleInputChange('candidate_id', e.target.value)
                if (selectedCandidate) {
                  handleInputChange('position_code', selectedCandidate.position_code || '')
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Choose a candidate...</option>
              {candidates.map(candidate => (
                <option key={candidate.candidate_id} value={candidate.candidate_id}>
                  {getCandidateName(candidate)} - {candidate.position_code} ({candidate.status})
                </option>
              ))}
            </select>
          </div>

          {/* Selected Candidate Info */}
          {formData.candidate_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              {(() => {
                const candidate = candidates.find(c => c.candidate_id === formData.candidate_id)
                if (!candidate) return null
                return (
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Candidate Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4" />
                        <span>{candidate.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>{candidate.mobile_num || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Interview Date
            </label>
            <select
              value={selectedDate}
              onChange={(e) => handleDateTimeChange(e.target.value, selectedTime)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select date...</option>
              {availableDates.map(date => (
                <option key={date.value} value={date.value}>
                  {date.label} ({date.dayName})
                </option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="inline h-4 w-4 mr-1" />
              Interview Time
            </label>
            <select
              value={selectedTime}
              onChange={(e) => handleDateTimeChange(selectedDate, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select time...</option>
              {timeSlots.map(time => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          {/* Position Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              Position Code
            </label>
            <input
              type="text"
              value={formData.position_code}
              onChange={(e) => handleInputChange('position_code', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter position code"
              required
            />
          </div>

          {/* Question Revision */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Revision (Optional)
            </label>
            <input
              type="text"
              value={formData.q_revision || ''}
              onChange={(e) => handleInputChange('q_revision', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter question revision if applicable"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any additional notes about the interview"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{existingAppointment ? 'Update Appointment' : 'Schedule Appointment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </AnimatedModal>
  )
}

export default AppointmentForm