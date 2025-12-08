import React, { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, getSupabaseClient, testSupabaseConnection, resetSupabaseConnection } from '../lib/supabase'
import { FileText, User, Calendar, Award, TrendingUp, Star, ChevronRight, Search, Filter } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import PageTransition from "../components/PageTransition"


interface Candidate {
  candidate_id: string
  first_name: string
  last_name: string
  email: string
  mobile_num?: string
  position_code?: string
  status: string
  created_at: string
}

interface AIEvaluation {
  id: number
  candidate_id: string
  answer_index: string
  technical_eval?: number
  clarity_structure?: number
  confidence_exp?: number
  relevance?: number
  total_score?: number
  ai_textual_eval?: string
  created_at: string
}

interface Appointment {
  id: number
  candidate_id: string
  appointment_time?: string
  position_code?: string
}

const InterviewResults: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [evaluations, setEvaluations] = useState<AIEvaluation[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking')

  useEffect(() => {
    fetchCandidates()
    fetchAppointments()
  }, [])

  useEffect(() => {
    if (selectedCandidate) {
      fetchEvaluations(selectedCandidate.candidate_id)
    }
  }, [selectedCandidate])

  const fetchCandidates = async () => {
    try {
      // Check Supabase configuration first
      if (!isSupabaseConfigured()) {
        setError('Supabase not configured. Please set up your environment variables.')
        setConnectionStatus('failed')
        setLoading(false)
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Cannot connect to Supabase. Please check your project URL and ensure the project is not paused.')
        setConnectionStatus('failed')
        setLoading(false)
        return
      }

      // Test connection
      await testSupabaseConnection()
      setConnectionStatus('connected')
      setError(null)

      // Fetch all candidates first
      const { data: allCandidates, error: candidatesError } = await client
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email, mobile_num, position_code, status, created_at')
        .order('first_name', { ascending: true })

      if (candidatesError) throw candidatesError

      // Get all candidate IDs that have evaluations
      const { data: evaluationCandidates, error: evalError } = await client
        .from('hrta_sd00-03_ai_evaluations')
        .select('candidate_id')

      if (evalError) throw evalError

      // Get unique candidate IDs with evaluations
      const candidateIdsWithEvaluations = [...new Set(evaluationCandidates?.map(e => e.candidate_id) || [])]
      
      console.log('Candidate IDs with evaluations:', candidateIdsWithEvaluations)
      console.log('Number of candidates with evaluations:', candidateIdsWithEvaluations.length)

      // Filter candidates to only include those with evaluations
      const candidatesWithEvaluations = (allCandidates || []).filter(candidate => 
        candidateIdsWithEvaluations.includes(candidate.candidate_id)
      )

      console.log('Filtered candidates with evaluations:', candidatesWithEvaluations.length)
      
      setCandidates(candidatesWithEvaluations)
      
      // Log candidates with evaluation data
      if (candidatesWithEvaluations.length > 0) {
        console.log('Candidates with evaluation data:')
        candidatesWithEvaluations.forEach((candidate, index) => {
          console.log(`${index + 1}. ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.candidate_id})`)
        })
        
        // Auto-select first candidate
        setSelectedCandidate(candidatesWithEvaluations[0])
      } else {
        console.log('No candidates found with evaluation data')
        setCandidates([])
        setSelectedCandidate(null)
      }
    } catch (error) {
      console.error('Error fetching candidates:', error)
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setError('Cannot connect to Supabase. Please check your project URL and ensure the project is not paused.')
      } else {
        setError(`Error fetching candidates: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      setConnectionStatus('failed')
      setCandidates([])
      setSelectedCandidate(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchAppointments = async () => {
    try {
      if (!isSupabaseConfigured()) {
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        return
      }

      const { data, error } = await client
        .from('hrta_cd00-03_appointment_info')
        .select('id, candidate_id, appointment_time, position_code')

      if (error) throw error
      setAppointments(data || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
      // Don't set connection status here as this is a secondary fetch
    }
  }

  const fetchEvaluations = async (candidateId: string) => {
    setLoadingEvaluations(true)
    try {
      if (!isSupabaseConfigured()) {
        setEvaluations([])
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setEvaluations([])
        return
      }

      console.log('Fetching evaluations for candidate:', candidateId)
      const { data, error } = await client
        .from('hrta_sd00-03_ai_evaluations')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('answer_index', { ascending: true })

      console.log('Evaluations data:', data)
      console.log('Evaluations error:', error)
      console.log('Data length:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('First evaluation:', data[0])
      }
      
      if (error) throw error
      setEvaluations(data || [])
    } catch (error) {
      console.error('Error fetching evaluations:', error)
      setEvaluations([])
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const handleResetConnection = async () => {
    setConnectionStatus('checking')
    setError(null)
    resetSupabaseConnection()
    await fetchCandidates()
    await fetchAppointments()
  }

  const getGradeInfo = (totalScore: number) => {
    if (totalScore >= 9) {
      return { grade: 'Excellent', color: 'bg-green-100 text-green-800 border-green-200', icon: '🏆' }
    } else if (totalScore >= 7) {
      return { grade: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '⭐' }
    } else if (totalScore >= 6) {
      return { grade: 'Satisfactory', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '👍' }
    } else {
      return { grade: 'Poor', color: 'bg-red-100 text-red-800 border-red-200', icon: '⚠️' }
    }
  }

  const calculateTotals = () => {
    return evaluations.reduce(
      (totals, evaluation) => ({
        technical: totals.technical + (evaluation.technical_eval || 0),
        clarity: totals.clarity + (evaluation.clarity_structure || 0),
        confidence: totals.confidence + (evaluation.confidence_exp || 0),
        relevance: totals.relevance + (evaluation.relevance || 0),
        total: totals.total + (evaluation.total_score || 0)
      }),
      { technical: 0, clarity: 0, confidence: 0, relevance: 0, total: 0 }
    )
  }

  const getInterviewDateForCandidate = (candidateId: string) => {
    const appointment = appointments.find(apt => apt.candidate_id === candidateId)
    return appointment?.appointment_time
  }

  const totals = calculateTotals()
  const overallGrade = getGradeInfo(totals.total)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Interview Results</h1>
              <p className="text-gray-600">Comprehensive evaluation and scoring analysis</p>
            </div>
          </div>
        </div>

        {/* Connection Status and Error Display */}
        {(connectionStatus === 'failed' || error) && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-2"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800 mb-2">Database Connection Error</h3>
                <p className="text-red-700 mb-4">
                  {error || 'Unable to connect to the database. Please check your Supabase configuration.'}
                </p>
                <div className="bg-red-100 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-red-800 mb-2">To fix this issue:</h4>
                  <ol className="list-decimal list-inside text-sm text-red-700 space-y-1">
                    <li>Click the "Connect to Supabase" button in the top right corner</li>
                    <li>Enter your Supabase project URL and API key</li>
                    <li>Ensure your Supabase project is active and not paused</li>
                    <li>Check that your database tables exist and have the correct permissions</li>
                  </ol>
                </div>
                <button
                  onClick={handleResetConnection}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Reset Connection
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Candidate Gallery */}
          <div className="lg:col-span-1 space-y-6">
            {/* Candidate Details Box */}
            {selectedCandidate && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {`${selectedCandidate.first_name || ''} ${selectedCandidate.last_name || ''}`.trim() || 'Unknown'}
                    </h3>
                    <p className="text-sm text-gray-500">Candidate Details</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Position Applied
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCandidate.position_code || 'Not specified'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Interview Date
                    </label>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        const interviewDate = getInterviewDateForCandidate(selectedCandidate.candidate_id)
                        return interviewDate 
                          ? format(parseISO(interviewDate), 'MMM d, yyyy - HH:mm')
                          : 'Not scheduled'
                      })()}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Candidate ID
                    </label>
                    <p className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                      {selectedCandidate.candidate_id}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Email
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.email || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.mobile_num || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedCandidate.status === 'Hired' ? 'bg-green-100 text-green-800' :
                      selectedCandidate.status === 'Interviewed' ? 'bg-purple-100 text-purple-800' :
                      selectedCandidate.status === 'For Interview' ? 'bg-blue-100 text-blue-800' :
                      selectedCandidate.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedCandidate.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Gallery */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Candidates</h3>
                <p className="text-sm text-gray-500">{candidates.length} candidates</p>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {candidates.map((candidate) => (
                    <button
                      key={candidate.candidate_id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                        selectedCandidate?.candidate_id === candidate.candidate_id
                          ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {`${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {candidate.position_code || 'No position'}
                          </p>
                        </div>
                        <ChevronRight className={`h-4 w-4 transition-colors duration-200 ${
                          selectedCandidate?.candidate_id === candidate.candidate_id
                            ? 'text-blue-600'
                            : 'text-gray-400 group-hover:text-gray-600'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Interview Results */}
          <div className="lg:col-span-3 space-y-6">
            {/* Grading Box */}
            {selectedCandidate && evaluations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-16 h-16 rounded-full ${overallGrade.color} border-2`}>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {overallGrade.grade}
                      </h3>
                      <p className="text-gray-600">Overall Performance</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">
                      {totals.total.toFixed(1)}
                    </div>
                    <p className="text-sm text-gray-500">Total Score</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900">{totals.technical.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Technical</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900">{totals.clarity.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Clarity</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900">{totals.confidence.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Confidence</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900">{totals.relevance.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Relevance</div>
                  </div>
                </div>
              </div>
            )}

            {/* Interview Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Interview Evaluation Results</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedCandidate ? 
                        `Detailed scoring breakdown for ${selectedCandidate.first_name || ''} ${selectedCandidate.last_name || ''}`.trim()
                        : 'Select a candidate to view results'
                      }
                    </p>
                  </div>
                  {evaluations.length > 0 && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>{evaluations.length} questions evaluated</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedCandidate ? (
                loadingEvaluations ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading evaluation results...</p>
                  </div>
                ) : evaluations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                            Answer No.
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-80">
                            AI Textual Evaluation
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                            Technical
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                            Clarity
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                            Confidence
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                            Relevance
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                            Total Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {evaluations.map((evaluation, index) => (
                          <tr key={evaluation.id} className="hover:bg-gray-50 transition-colors duration-150">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                                {parseInt(evaluation.answer_index) || index + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 leading-relaxed max-w-md">
                                {evaluation.ai_textual_eval || 'No evaluation provided'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                                {evaluation.technical_eval?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                {evaluation.clarity_structure?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">
                                {evaluation.confidence_exp?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                                {evaluation.relevance?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-10 h-8 bg-gray-900 text-white rounded-full text-sm font-bold">
                                {evaluation.total_score?.toFixed(1) || '0.0'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      
                      {/* Summary Row */}
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-900">TOTALS</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-600">
                              Summary of all evaluation scores
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                              {totals.technical.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 bg-green-600 text-white rounded-full text-sm font-bold">
                              {totals.clarity.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">
                              {totals.confidence.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-10 h-8 bg-indigo-600 text-white rounded-full text-sm font-bold">
                              {totals.relevance.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-12 h-10 bg-yellow-500 text-gray-900 rounded-full text-lg font-bold">
                              {totals.total.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Award className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Evaluation Results</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                      No interview evaluation data found for this candidate. 
                      Results will appear here once the interview has been completed and evaluated.
                    </p>
                  </div>
                )
              ) : (
                <div className="p-12 text-center">
                  <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Candidate</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Choose a candidate from the gallery on the left to view their detailed interview results and evaluation scores.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  )
}

export default InterviewResults