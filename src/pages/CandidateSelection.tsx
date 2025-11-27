import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseConnection } from '../lib/supabase'
import { Search, ListFilter as Filter, ChevronDown, Users, Save, X, CreditCard as Edit3, RefreshCw, User, Mail, Phone, MapPin, Calendar, Award, Briefcase, Globe, Car, Languages, GraduationCap, Clock, DollarSign, ChevronRight, Plus } from 'lucide-react'
import AppointmentForm from '../components/AppointmentForm'
import { Candidate } from "../lib/Candidate"


const CandidateSelection: React.FC = () => {
  // Remove console.log to prevent constant logging
  
  // State declarations - no duplicates
  const [candidates, setCandidates] = useState<Candidate[]>([]) 
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [positionFilter, setPositionFilter] = useState<string>('all')
  const [editingField, setEditingField] = useState<string>('')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking')
  const [createdFilter, setCreatedFilter] = useState<string>('all')
  const [positions, setPositions] = useState<{ code: string; name: string }[]>([]);
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);

  // Mapping for created filter labels
  const createdFilterLabels: Record<string, string> = {
  today: "Today",
  "7days": "Last 7 Days",
  "30days": "Last 30 Days",
  thismonth: "This Month",
  lastmonth: "Last Month",
};

  // Appointment form state
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  
  // Use ref to prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const selectedCandidateRef = useRef<Candidate | null>(null) // Add ref for selectedCandidate

  // Memoized fetch function to prevent recreation on every render
  const fetchCandidates = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('Fetch already in progress, skipping...')
      return
    }

    isFetchingRef.current = true
    setConnectionStatus('checking')
    setError('')
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal
    
    try {
      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured.\n\nTo get started:\n1. Click "Connect to Supabase" in the top right corner\n2. Follow the setup instructions\n3. Your database connection will be configured automatically')
        setConnectionStatus('failed')
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Failed to initialize Supabase client.\n\nPlease click "Connect to Supabase" in the top right to set up your database connection.')
        setConnectionStatus('failed')
        return
      }
      
      console.log('Attempting to connect to Supabase...')
      setConnectionStatus('connected')
      
      // Check if request was aborted
      if (signal.aborted) {
        throw new Error('Request was cancelled')
      }
      
      let data, fetchError
      try {
        const result = await client
          .from('hrta_cd00-01_resume_extraction')
          .select('*')
          .order('created_at', { ascending: false })
        
        data = result.data
        fetchError = result.error
      } catch (networkError) {
        // Handle network-level errors (Failed to fetch, etc.)
        throw new Error(`Network connection failed: ${networkError instanceof Error ? networkError.message : 'Unknown network error'}`)
      }


      if (fetchError) throw fetchError
      
      // Check if request was aborted after fetch
      if (signal.aborted) {
        return
      }
      
      setCandidates(data || [])
      if (data && data.length > 0 && !selectedCandidateRef.current) {
        setSelectedCandidate(data[0])
        selectedCandidateRef.current = data[0]
      }

      // Fetch Position Names (position_code + position_name)
      const { data: positionRows, error: positionError } = await client
        .from("hrta_sd00-01_position_codes")
        .select("position_code, position_name")
        .order("position_name", { ascending: true });

      if (positionError) {
        console.error("Position fetch error:", positionError);
      } else {
        setPositions(
          positionRows?.map(row => ({
            code: row.position_code,
            name: row.position_name || row.position_code
          })) || []
        );
      }

      
      console.log('Successfully loaded candidates:', data?.length || 0)
    } catch (error) {
      // Don't handle aborted requests as errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      console.error('Connection error:', error)
      setConnectionStatus('failed')
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NAME_NOT_RESOLVED') || error.message.includes('NetworkError')) {
          setError(`Cannot connect to Supabase database.

This usually means:
• Supabase is not configured yet
• The Supabase project URL is incorrect
• The Supabase project is paused or deleted

To fix this:
1. Click "Connect to Supabase" in the top right corner
2. Follow the setup instructions to connect your database
3. The connection will be configured automatically`)
        } else {
          setError(`Database error: ${error.message}`)
        }
      } else {
        setError('Unknown error occurred')
      }
    } finally {
      setLoading(false)
      isFetchingRef.current = false
      abortControllerRef.current = null
    }
  }, []) // Remove selectedCandidate dependency to prevent unnecessary re-renders

  // Update ref when selectedCandidate changes
  useEffect(() => {
    selectedCandidateRef.current = selectedCandidate
  }, [selectedCandidate])
  
  // Remove debug useEffect to prevent constant logging
  useEffect(() => {
    // Add a small delay to prevent blocking the initial render
    const timer = setTimeout(() => {
      // Only run once on mount
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true
        fetchCandidates()
      }
    }, 100) // Small delay to let the UI render first
    
    // Cleanup function
    return () => {
      clearTimeout(timer)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, []) // Empty dependency array - runs only once

  // Separate handlers for retry operations
  const handleRetry = useCallback(async () => {
    hasInitializedRef.current = false
    isFetchingRef.current = false
    setLoading(true)
    setError('')
    setConnectionStatus('checking')
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Small delay to prevent rapid retries
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    hasInitializedRef.current = true
    await fetchCandidates()
  }, [fetchCandidates])

    const getCvPreviewUrl = (url: string | null) => {
    if (!url) return null;

    // If Google Drive link → convert to preview link
    if (url.includes("drive.google.com")) {
      const match = url.match(/\/d\/(.*?)\//);
      if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    // For SharePoint or any direct PDF → use as is
    return url;
  };

useEffect(() => {
  if (selectedCandidate?.cv_filename) {
    const previewUrl = getCvPreviewUrl(selectedCandidate.cv_filename);
    setCvUrl(previewUrl);
  } else {
    setCvUrl(null);
  }
}, [selectedCandidate]);





  const handleResetConnection = useCallback(async () => {
    hasInitializedRef.current = false
    isFetchingRef.current = false
    setLoading(true)
    setError('')
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    try {
      resetSupabaseConnection()
      await new Promise(resolve => setTimeout(resolve, 1000))
      hasInitializedRef.current = true
      await fetchCandidates()
    } catch (error) {
      console.error('Error resetting connection:', error)
      setError('Failed to reset connection')
      setLoading(false)
    }
  }, [fetchCandidates])



  // Memoized filtered candidates to prevent unnecessary recalculations
const filteredCandidates = React.useMemo(() => {
  return candidates.filter(candidate => {

    
    const searchLower = searchTerm.toLowerCase()

    // SEARCH filter
    const matchesSearch =
      candidate.first_name?.toLowerCase().includes(searchLower) ||
      candidate.last_name?.toLowerCase().includes(searchLower) ||
      candidate.email?.toLowerCase().includes(searchLower) ||
      candidate.position_code?.toLowerCase().includes(searchLower)

    // STATUS filter
    const matchesStatus =
      statusFilter === 'all' || candidate.status === statusFilter

    // POSITION filter
    const matchesPosition =
      positionFilter === 'all' || candidate.position_code === positionFilter

    // DATE filter
    let matchesCreated = true
    if (createdFilter !== 'all') {
      const created = new Date(candidate.created_at)
      const now = new Date()

      if (createdFilter === 'today') {
        const today = new Date()
        today.setHours(0,0,0,0)
        matchesCreated = created >= today
      }

      if (createdFilter === '7days') {
        const cutoff = new Date()
        cutoff.setDate(now.getDate() - 7)
        matchesCreated = created >= cutoff
      }

      if (createdFilter === '30days') {
        const cutoff = new Date()
        cutoff.setDate(now.getDate() - 30)
        matchesCreated = created >= cutoff
      }

      if (createdFilter === 'thismonth') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1)
        matchesCreated = created >= first
      }

      if (createdFilter === 'lastmonth') {
        const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endLast = new Date(now.getFullYear(), now.getMonth(), 0)
        matchesCreated = created >= firstLast && created <= endLast
      }
    }

    return matchesSearch && matchesStatus && matchesPosition && matchesCreated
  })
}, [candidates, searchTerm, statusFilter, positionFilter, createdFilter])


// Extract unique statuses EXCEPT video statuses
const uniqueStatuses = React.useMemo(() => {
  return [...new Set(
    candidates
      .map(c => c.status)
      .filter(status =>
        status &&
        !status.toLowerCase().includes("answer video to")
      )
  )].sort((a, b) => a.localeCompare(b));
}, [candidates]);




  const startEdit = useCallback((field: string, currentValue: any) => {
    if (!selectedCandidate) return
    setEditingField(field)
    setEditValue(currentValue?.toString() || '')
  }, [selectedCandidate])

  const cancelEdit = useCallback(() => {
    setEditingField('')
    setEditValue('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingField || !selectedCandidate) return

    setSaving(true)

    try {
      let updateValue: any = editValue.trim()
      
      if (editingField === 'vote') {
        updateValue = updateValue ? parseFloat(updateValue) : null
        if (updateValue !== null && (updateValue < 0 || updateValue > 10)) {
          alert('Vote must be between 0 and 10')
          return
        }
      } else if (editingField === 'email') {
        if (updateValue && !updateValue.includes('@')) {
          alert('Please enter a valid email address')
          return
        }
      }
      
      if (updateValue === '' && ['mobile_num', 'availability', 'asking_salary'].includes(editingField)) {
        updateValue = null
      }

      const client = getSupabaseClient()
      if (!client) throw new Error('Supabase client not available')

      const { error } = await client
        .from('hrta_cd00-01_resume_extraction')
        .update({ [editingField]: updateValue })
        .eq('candidate_id', selectedCandidate.candidate_id)

      if (error) throw error

      

      // Update local state
      const updatedCandidate = { ...selectedCandidate, [editingField]: updateValue }
      setSelectedCandidate(updatedCandidate)
      setCandidates(prev => prev.map(candidate => 
        candidate.candidate_id === selectedCandidate.candidate_id
          ? updatedCandidate
          : candidate
      ))

      setEditingField('')
      setEditValue('')
    } catch (error) {
      console.error('Error saving changes:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to save changes: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }, [editingField, selectedCandidate, editValue])

    const handleMoveToForInterview = useCallback(async () => {
    if (!selectedCandidate) return

    setSaving(true)

    try {
      const client = getSupabaseClient()
      if (!client) throw new Error('Supabase client not available')

      const newStatus = 'For Interview'

      const { error } = await client
        .from('hrta_cd00-01_resume_extraction')
        .update({ status: newStatus })
        .eq('candidate_id', selectedCandidate.candidate_id)

      if (error) throw error

      // Update UI immediately
      const updatedCandidate = { ...selectedCandidate, status: newStatus }
      setSelectedCandidate(updatedCandidate)
      setCandidates(prev =>
        prev.map(c =>
          c.candidate_id === selectedCandidate.candidate_id ? updatedCandidate : c
        )
      )
    } catch (error) {
      console.error('Error updating status to For Interview:', error)
      const msg = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to change status: ${msg}`)
    } finally {
      setSaving(false)
    }
  }, [selectedCandidate, setCandidates])


  const handleScheduleInterview = () => {
    if (selectedCandidate) {
      setShowAppointmentForm(true)
    }
  }

  const handleAppointmentSuccess = () => {
    setShowAppointmentForm(false)
    // Optionally refresh candidate data to update status
    fetchCandidates()
  }

  const getCandidateName = useCallback((candidate: Candidate) => {
    const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()
    return fullName || 'Unknown Candidate'
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'CV Processed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'For Interview':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Interviewed':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Hired':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Interview Manager</h2>
            <p className="text-gray-600 mb-6">
              This is a comprehensive interview management system for tracking candidates, scheduling interviews, and managing results.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">
                🔗 Database Setup Required
              </p>
              <p className="text-sm text-blue-700">
                To get started, click the "Connect to Supabase" button in the top right corner to set up your database connection.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Testing Supabase connection...</p>
        </div>
      </div>
    )
  }

  const EditableField = ({
  label,
  field,
  value,
  type = "text"
}: {
  label: string;
  field: string;
  value: any;
  type?: string;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

    {editingField === field ? (
      <div className="flex items-center space-x-2">
        <input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
        <button onClick={saveEdit} disabled={saving} className="p-2 text-green-600 hover:bg-green-50 rounded">
          <Save className="h-4 w-4" />
        </button>
        <button onClick={cancelEdit} className="p-2 text-red-600 hover:bg-red-50 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : (
      <div
        onClick={() => startEdit(field, value)}
        className="group cursor-pointer  rounded-lg p-3 border border-gray-200 relative"
      >
        <div className="text-sm text-gray-900">{value || "Not provided"}</div>
        <Edit3 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-3 right-3" />
      </div>
    )}
  </div>
);


    return (
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="mx-auto w-full max-w-screen-xl px-3 sm:px-5 md:px-8 py-4 sm:py-6">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Candidate Selection</h1>
              <p className="text-gray-600">Browse and manage candidate applications</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search candidates..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>

              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                >
                  <option value="all">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos.code} value={pos.code}>{pos.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              value={createdFilter}
              onChange={(e) => setCreatedFilter(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thismonth">This Month</option>
              <option value="lastmonth">Last Month</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          {/* Active Filters — Linear Style */}
            <div className="mt-4 flex flex-wrap items-center gap-2">

              {/* Helper function style */}
              {searchTerm && (
                <div className="
                  flex items-center gap-2 px-3 py-1.5 
                  rounded-xl border border-gray-300 bg-white shadow-sm
                  text-xs font-medium text-gray-700
                ">
                  <span className="opacity-80">Search:</span>
                  <span className="font-semibold text-gray-900">{searchTerm}</span>

                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {statusFilter !== "all" && (
                <div className="
                  flex items-center gap-2 px-3 py-1.5 
                  rounded-xl border border-gray-300 bg-white shadow-sm
                  text-xs font-medium text-gray-700
                ">
                  <span className="opacity-80">Status:</span>
                  <span className="font-semibold text-gray-900">{statusFilter}</span>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {positionFilter !== "all" && (
                <div className="
                  flex items-center gap-2 px-3 py-1.5 
                  rounded-xl border border-gray-300 bg-white shadow-sm
                  text-xs font-medium text-gray-700
                ">
                  <span className="opacity-80">Position:</span>
                  <span className="font-semibold text-gray-900">
                    {positions.find((p) => p.code === positionFilter)?.name || positionFilter}
                  </span>


                  <button
                    onClick={() => setPositionFilter('all')}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {createdFilter !== "all" && (
                <div className="
                  flex items-center gap-2 px-3 py-1.5 
                  rounded-xl border border-gray-300 bg-white shadow-sm
                  text-xs font-medium text-gray-700
                ">
                  <span className="opacity-80">Date:</span>
                  <span className="font-semibold text-gray-900">
                    {createdFilterLabels[createdFilter] || createdFilter}
                  </span>


                  <button
                    onClick={() => setCreatedFilter('all')}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* CLEAR ALL — Linear minimal button */}
              {(searchTerm || statusFilter !== "all" || positionFilter !== "all" || createdFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setPositionFilter('all');
                    setCreatedFilter('all');
                  }}
                  className="
                    ml-1 px-3 py-1.5 rounded-xl border border-transparent
                    text-xs font-medium text-gray-500 hover:text-gray-700
                    hover:bg-gray-100 transition
                  "
                >
                  Clear All
                </button>
              )}

            </div>


            
            <div className="mt-4">
              <p className="text-gray-600">
                Showing {filteredCandidates.length} of {candidates.length} candidates
              </p>
            </div>
          </div>
        </div>

        {/* Two Panel Layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Panel - Candidate Gallery */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col max-h-[75vh]">
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Candidates</h3>
              <p className="text-sm text-gray-500">{filteredCandidates.length} candidates</p>
            </div>

            <div className="flex-1 overflow-y-scroll scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {filteredCandidates.length > 0 ? (
                <div className="p-2 space-y-1">
                  {filteredCandidates.map((candidate) => (
                    <button
                      key={candidate.candidate_id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`w-full text-left p-4 rounded-lg transition-all duration-200 group ${
                        selectedCandidate?.candidate_id === candidate.candidate_id
                          ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                          : 'border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {getCandidateName(candidate)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {candidate.position_code || 'No position'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(candidate.status)}`}>
                            {candidate.status}
                          </span>
                          {candidate.vote !== null && candidate.vote !== undefined && (
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                              {typeof candidate.vote === 'number' ? candidate.vote.toFixed(1) : candidate.vote}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                  <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Candidate Details */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col max-h-[75vh]">
            {selectedCandidate ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    {/* Left side: candidate name */}
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-7 w-7 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight line-clamp-2">
                          {getCandidateName(selectedCandidate)}
                        </h2>
                        <p className="text-sm text-gray-600 truncate">
                          {selectedCandidate.position_code || 'No position specified'}
                        </p>
                      </div>
                    </div>
                      {/* Status Pill */}
  <span
    className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getStatusColor(selectedCandidate.status)}`}
  >
    {selectedCandidate.status}
  </span>

{/* Premium Action Bar */}
<div className="
  flex flex-col sm:flex-row sm:items-center sm:space-x-4 
  space-y-3 sm:space-y-0
  bg-white/60 backdrop-blur-md 
  px-4 py-3 rounded-xl 
  border border-gray-200 shadow-sm
">

  {/* Preview CV */}
  {selectedCandidate.cv_filename && (
    <button
      onClick={() => setShowCvModal(true)}
      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm text-xs sm:text-sm font-medium"
    >
      <Briefcase className="h-4 w-4 mr-2" />
      Preview CV
    </button>

  )}

  {/* Move to For Interview */}
  {selectedCandidate.status === "CV Processed" && (
        <button
      onClick={handleMoveToForInterview}
      disabled={saving}
      className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm disabled:opacity-60 text-xs sm:text-sm font-medium"
    >
      <Calendar className="h-4 w-4 mr-2" />
      {saving ? "Updating..." : "Move to Interview"}
    </button>

  )}

  {/* Schedule + Vote */}
  {selectedCandidate.vote !== null && selectedCandidate.vote !== undefined && (
    <div className="flex items-center space-x-3">

      {/* Schedule */}
      <button
        onClick={handleScheduleInterview}
        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm text-xs sm:text-sm font-medium"
      >
        <Calendar className="h-4 w-4 mr-2" />
        Schedule
      </button>


      {/* Vote */}
      <span className="
        inline-flex items-center space-x-1 px-3 py-1.5 
        bg-yellow-50 border border-yellow-200 
        text-yellow-700 font-semibold text-sm rounded-lg shadow-sm
      ">
        <Award className="h-4 w-4 text-yellow-600" />
        <span>
          {typeof selectedCandidate.vote === "number"
            ? selectedCandidate.vote.toFixed(1)
            : selectedCandidate.vote}
        </span>
      </span>

    </div>
  )}

</div>


                  </div>

                </div>

                {/* Details Content */}
                <div className="flex-1 overflow-y-auto p-6">
                 

                  {/* Date Interviewed Display */}
                  {selectedCandidate.date_interviewed && (
                    <div className="mb-6">
                      <div className="flex items-center space-x-2 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 inline-flex">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Interviewed on:</span>
                        <span className="text-gray-900 font-semibold">
                          {new Date(selectedCandidate.date_interviewed).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                   

                    
                    {/* Contact Information */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                          <Mail className="h-5 w-5 text-blue-600" />
                          <span>Contact Information</span>
                        </h3>
                        <div className="space-y-4">
                          {/* Email */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            {editingField === 'email' ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="email"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  autoFocus
                                />
                                <button onClick={saveEdit} disabled={saving} className="p-2 text-green-600 hover:bg-green-50 rounded">
                                  <Save className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEdit} className="p-2 text-red-600 hover:bg-red-50 rounded">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                className="group cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-200 relative"
                                onClick={() => startEdit('email', selectedCandidate.email)}
                              >
                                <div className="text-sm text-gray-900">
                                  {selectedCandidate.email || 'Not provided'}
                                </div>
                                <Edit3 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-3 right-3" />
                              </div>
                            )}
                          </div>

                          {/* Phone */}
                          <div>
                            <EditableField
                                label="Phone Number"
                                field="mobile_num"
                                value={selectedCandidate.mobile_num}
                              />
                          </div>

                          {/* Nationality */}
                          <div>
                            <EditableField
                                label="Nationality"
                                field="nationality"
                                value={selectedCandidate.nationality}
                              />

                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                          <Briefcase className="h-5 w-5 text-blue-600" />
                          <span>Professional Details</span>
                        </h3>
                        <div className="space-y-4">

                          <div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Position Applied
                              </label>

                              {editingField === "position_code" ? (
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                  >
                                    <option value="">Select Position</option>

                                    {positions.map((p) => (
                                      <option key={p.code} value={p.code}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>

                                  <button
                                    onClick={cancelEdit}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() =>
                                    startEdit("position_code", selectedCandidate.position_code)
                                  }
                                  className="group cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-200 relative"
                                >
                                  <div className="text-sm text-gray-900">
                                    {positions.find((p) => p.code === selectedCandidate.position_code)?.name ||
                                      "Not specified"}
                                  </div>

                                  <Edit3 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-3 right-3" />
                                </div>
                              )}
                            </div>


                          </div>

                          <div>
                            <EditableField
                                  label="Years of Experience"
                                  field="years_experience"
                                  value={selectedCandidate.years_experience}
                                />

                          </div>

                          <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Evaluation Score
                    </label>

                    {editingField === "vote" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit("vote", selectedCandidate.vote)}
                        className="group cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-200 relative"
                      >
                        <div className="text-sm text-gray-900">
                          {selectedCandidate.vote !== null && selectedCandidate.vote !== undefined
                            ? `${typeof selectedCandidate.vote === "number"
                                ? selectedCandidate.vote.toFixed(1)
                                : selectedCandidate.vote
                              } / 10`
                            : "Not evaluated"}
                        </div>
                        <Edit3 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-3 right-3" />
                      </div>
                    )}
                  </div>

                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <User className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Select a Candidate</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Choose a candidate from the gallery on the left to view their detailed information.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        

        {/* Appointment Form Modal */}
        <AppointmentForm
          isOpen={showAppointmentForm}
          onClose={() => setShowAppointmentForm(false)}
          onSuccess={handleAppointmentSuccess}
          selectedCandidate={selectedCandidate}
        />

        {/* === CV MODAL === */}
        {showCvModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white w-[90%] max-w-3xl rounded-xl shadow-2xl overflow-hidden animate-fadeIn relative">

              {/* Close Button */}
              <button
                onClick={() => setShowCvModal(false)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Header */}
              <div className="p-5 border-b border-gray-200 flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  CV Preview – {getCandidateName(selectedCandidate!)}
                </h2>
              </div>

              {/* CV Iframe */}
              <div className="h-[550px]">
                <iframe
                  src={cvUrl || ""}
                  className="w-full h-full"
                  allow="autoplay"
                />
              </div>

              {/* Footer */}
              <div className="p-5 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() =>
                    window.open(selectedCandidate!.cv_filename!, "_blank")
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Download CV
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default CandidateSelection