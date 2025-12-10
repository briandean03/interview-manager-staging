import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient, isSupabaseConfigured, resetSupabaseConnection } from '../lib/supabase'
import { Search, ListFilter as Filter, ChevronDown, Users, Save, X, CreditCard as Edit3, RefreshCw, User, Mail, Phone, MapPin, Calendar, Award, Briefcase, Globe, Car, Languages, GraduationCap, Clock, DollarSign, ChevronRight, Plus } from 'lucide-react'
import AppointmentForm from '../components/AppointmentForm'
import { Candidate } from "../lib/Candidate"
import PageTransition from "../components/PageTransition"
import HoverCard from '../components/HoverCard'
import { useSearchParams } from "react-router-dom";



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
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get("search"); // candidate_id


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
/** ---------------------------------------------
 * 1) Initialize + Fetch candidates on first load
 * --------------------------------------------- */
useEffect(() => {
  const timer = setTimeout(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchCandidates();
    }
  }, 100);

  return () => {
    clearTimeout(timer);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);

/** ---------------------------------------------------------
 * 2) Keep selectedCandidateRef updated when state changes
 * --------------------------------------------------------- */
useEffect(() => {
  selectedCandidateRef.current = selectedCandidate;
}, [selectedCandidate]);

/** ------------------------------------------------------------
 * 3) If URL contains ?search=<id>, auto-select that candidate
 * ------------------------------------------------------------ */
useEffect(() => {
  if (!searchId || candidates.length === 0) return;

  const match = candidates.find(c => c.candidate_id === searchId);
  if (match) {
    setSelectedCandidate(match);
    selectedCandidateRef.current = match;
  }
}, [searchId, candidates]);

/** ------------------------------------------------------------
 * 4) After selecting from URL, scroll candidate into view
 * ------------------------------------------------------------ */
useEffect(() => {
  if (!searchId) return;

  const el = document.getElementById(`cand-${searchId}`);
  if (el) {
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}, [searchId, candidates]);

/** ------------------------------------------------------------
 * 5) Update CV preview when selectedCandidate changes
 * ------------------------------------------------------------ */
useEffect(() => {
  if (selectedCandidate?.cv_filename) {
    const previewUrl = getCvPreviewUrl(selectedCandidate.cv_filename);
    setCvUrl(previewUrl);
  } else {
    setCvUrl(null);
  }
}, [selectedCandidate]);


     // Empty dependency array - runs only once

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


     // ...keep all your imports, state, hooks, helpers, EditableField, etc. as-is above

return (
  <PageTransition>
    <div className="h-screen flex bg-gray-50">

      

      {/* LEFT SIDEBAR — CANDIDATE LIST */}
      <aside className="w-[28%] border-r bg-white overflow-y-auto">
        {/* SIDEBAR HEADER + FILTERS */}
<div className="px-4 py-4 sticky top-0 bg-white border-b z-10 space-y-4">

  {/* Title */}
  <div>
    <h2 className="text-lg font-semibold">Candidates</h2>
    <p className="text-sm text-gray-500">{filteredCandidates.length} total</p>
  </div>

  {/* FILTER BAR */}
  <div className="flex flex-col space-y-3">

    {/* SEARCH */}
    <div className="relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder="Search candidates…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-9 py-2 text-sm border border-gray-300 rounded-lg bg-white
                   hover:border-gray-400 focus:ring-1 focus:ring-black/20 focus:border-black/40"
      />
    </div>

    {/* FILTER DROPDOWNS */}
    <div className="grid grid-cols-2 gap-2">

      {/* STATUS FILTER */}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                   hover:border-gray-400 focus:ring-1 focus:ring-black/20 focus:border-black/40"
      >
        <option value="all">All Status</option>
        {uniqueStatuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      {/* POSITION FILTER */}
      <select
        value={positionFilter}
        onChange={(e) => setPositionFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white
                   hover:border-gray-400 focus:ring-1 focus:ring-black/20 focus:border-black/40"
      >
        <option value="all">All Positions</option>
        {positions.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </select>

      {/* DATE FILTER */}
      <select
        value={createdFilter}
        onChange={(e) => setCreatedFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white col-span-2
                   hover:border-gray-400 focus:ring-1 focus:ring-black/20 focus:border-black/40"
      >
        <option value="all">All Dates</option>
        <option value="today">Today</option>
        <option value="7days">Last 7 Days</option>
        <option value="30days">Last 30 Days</option>
        <option value="thismonth">This Month</option>
        <option value="lastmonth">Last Month</option>
      </select>

    </div>
  </div>
</div>

        <div className="px-2 py-3 space-y-1">
          {filteredCandidates.map((candidate) => {
            const isActive = selectedCandidate?.candidate_id === candidate.candidate_id;

            return (
              <div
                key={candidate.candidate_id}
                id={`cand-${candidate.candidate_id}`}
                onClick={() => setSelectedCandidate(candidate)}
                className={`p-3 rounded-md cursor-pointer transition
                  ${isActive ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-50"}`}
              >
                <p className="font-medium truncate">{getCandidateName(candidate)}</p>
                <p className="text-xs text-gray-500 truncate">{candidate.position_code}</p>

                {candidate.vote !== null && (
                  <p className="text-xs text-gray-400">Score: {candidate.vote.toFixed(1)}</p>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* RIGHT SIDE — DETAILS PANEL */}
      <main className="flex-1 overflow-y-auto px-10 py-8">

        {/* Empty state */}
        {!selectedCandidate && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <User className="h-14 w-14 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Select a candidate</p>
              <p className="text-sm">Choose someone from the list to view details</p>
            </div>
          </div>
        )}

        {selectedCandidate && (
          <>
            {/* HEADER */}
            <section className="mb-10 pb-6 border-b">
              <h1 className="text-3xl font-semibold tracking-tight">
                {getCandidateName(selectedCandidate)}
              </h1>

              <p className="text-gray-600 mt-1">
                {selectedCandidate.position_code || "No position specified"}
              </p>

              <div className="mt-3 flex gap-3">

                {/* Status Badge */}
                <span className={`px-3 py-1 text-xs rounded-full border ${getStatusColor(selectedCandidate.status)}`}>
                  {selectedCandidate.status}
                </span>

                {/* Preview CV */}
                {selectedCandidate.cv_filename && (
                  <button
                    onClick={() => setShowCvModal(true)}
                    className="text-sm px-4 py-2 bg-black text-white rounded-md hover:bg-black/80 transition"
                  >
                    Preview CV
                  </button>
                )}

                {/* Move to Interview */}
                {selectedCandidate.status === "CV Processed" && (
                  <button
                    onClick={handleMoveToForInterview}
                    className="text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Move to Interview
                  </button>
                )}
              </div>
            </section>

            {/* CONTACT INFORMATION */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

              <div className="space-y-4">
                <EditableField
                  label="Email"
                  field="email"
                  value={selectedCandidate.email}
                />

                <EditableField
                  label="Phone Number"
                  field="mobile_num"
                  value={selectedCandidate.mobile_num}
                />

                <EditableField
                  label="Nationality"
                  field="nationality"
                  value={selectedCandidate.nationality}
                />
              </div>
            </section>

            {/* PROFESSIONAL INFO */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4">Professional Details</h2>

              <div className="space-y-4">

                <EditableField
                  label="Position Applied"
                  field="position_code"
                  value={
                    positions.find((p) => p.code === selectedCandidate.position_code)?.name ||
                    selectedCandidate.position_code
                  }
                />

                <EditableField
                  label="Years of Experience"
                  field="years_experience"
                  value={selectedCandidate.years_experience}
                />

                <EditableField
                  label="AI Score"
                  field="vote"
                  value={selectedCandidate.vote}
                />
              </div>
            </section>
          </>
        )}
      </main>
    </div>

    {/* Appointment Form */}
    <AppointmentForm
      isOpen={showAppointmentForm}
      onClose={() => setShowAppointmentForm(false)}
      onSuccess={handleAppointmentSuccess}
      selectedCandidate={selectedCandidate}
    />

    {/* CV Modal */}
    {showCvModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
        <div className="bg-white rounded-xl w-[80%] max-w-3xl shadow-xl relative">
          <button
            className="absolute top-3 right-3 text-gray-600 hover:text-black"
            onClick={() => setShowCvModal(false)}
          >
            <X className="h-6 w-6" />
          </button>

          <div className="p-5 border-b">
            <h3 className="text-xl font-semibold">CV Preview</h3>
          </div>

          <iframe src={cvUrl || ""} className="w-full h-[550px]" />
        </div>
      </div>
    )}
  </PageTransition>
);
}

export default CandidateSelection
