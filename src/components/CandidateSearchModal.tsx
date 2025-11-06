import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, FolderOpen } from 'lucide-react'

interface CandidateSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Candidate {
  candidate_id: string
  first_name: string
  last_name: string
  position_code: string
  answer_vids_folder_id: string
}

const CandidateSearchModal: React.FC<CandidateSearchModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('')
  const [positionCode, setPositionCode] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)

  // ✅ Fetch all candidates with non-null answer_vids_folder_id on open
  useEffect(() => {
    if (isOpen) {
      fetchCandidatesWithVideos()
    }
  }, [isOpen])

  const fetchCandidatesWithVideos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, position_code, answer_vids_folder_id')
        .not('answer_vids_folder_id', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Error fetching candidates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, position_code, answer_vids_folder_id')
        .not('answer_vids_folder_id', 'is', null) // ✅ still ensure folder exists

      if (name.trim()) {
        query = query.ilike('first_name', `%${name}%`)
      }
      if (positionCode.trim()) {
        query = query.eq('position_code', positionCode)
      }

      const { data, error } = await query
      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Error fetching candidates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewFolder = (folderId: string) => {
    if (!folderId) {
      alert('No folder available for this candidate.')
      return
    }
    // Replace this with your actual folder viewer URL
    const baseUrl = 'www.example.com'
    window.open(`${baseUrl}${folderId}`, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Candidates with Recorded Answers</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-lg p-2"
          />
          <input
            type="text"
            placeholder="Filter by position code"
            value={positionCode}
            onChange={(e) => setPositionCode(e.target.value)}
            className="border border-gray-300 rounded-lg p-2"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Search size={18} />
          {loading ? 'Searching...' : 'Search'}
        </button>

        {/* Results */}
        <div className="mt-6 max-h-64 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 text-center py-4">Loading...</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No candidates found.</p>
          ) : (
            results.map((c) => (
              <div key={c.candidate_id} className="flex justify-between items-center border-b py-2">
                <div>
                  <p className="font-medium text-gray-800">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-sm text-gray-500">Position: {c.position_code}</p>
                </div>
                <button
                  onClick={() => handleViewFolder(c.answer_vids_folder_id)}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <FolderOpen size={18} /> View Answers
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default CandidateSearchModal
