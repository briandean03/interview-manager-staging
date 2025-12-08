import React, { useState, useEffect } from 'react';
import { Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Calendar, User, FileText } from 'lucide-react';
import { supabase, isSupabaseConfigured, testSupabaseConnection, resetSupabaseConnection } from '../lib/supabase';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import PageTransition from "../components/PageTransition"


interface ExecutionLog {
  id: string;
  created_at: string;
  current_status: string;
  candidate_id: string;
  execution_id: number;
}

interface Candidate {
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Appointment {
  id: number;
  candidate_id: string;
  appointment_time: string;
}

interface GroupedProgress {
  candidate_id: string;
  candidate_name: string;
  interview_date: string | null;
  logs: ExecutionLog[];
}

const InterviewProgress: React.FC = () => {
  const [groupedLogs, setGroupedLogs] = useState<GroupedProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const handleResetConnection = async () => {
    resetSupabaseConnection();
    await fetchData();
  };

  const fetchData = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase not configured. Please set up your environment variables.');
      setConnectionStatus('disconnected');
      setLoading(false);
      return;
    }

    try {
      // Test connection first
      await testSupabaseConnection();
      setConnectionStatus('connected');

      // Calculate 7 days ago
      const sevenDaysAgo = subDays(new Date(), 7);

      // Fetch execution logs from the last 7 days
      const { data: logsData, error: logsError } = await supabase
        .from('hrta_sd00-09_execution_log')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (logsError) {
        throw logsError;
      }

      // Filter logs to only include those from the last 7 days (additional client-side filter)
      const recentLogs = (logsData || []).filter(log => 
        log.created_at && isAfter(parseISO(log.created_at), sevenDaysAgo)
      );

      if (recentLogs.length === 0) {
        setGroupedLogs([]);
        setError(null);
        setLoading(false);
        return;
      }

      // Get unique candidate IDs from the logs
      const candidateIds = [...new Set(recentLogs.map(log => log.candidate_id).filter(Boolean))];

      // Fetch candidate information
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('hrta_cd00-01_resume_extraction')
        .select('candidate_id, first_name, last_name, email')
        .in('candidate_id', candidateIds);

      if (candidatesError) {
        throw candidatesError;
      }

      // Fetch appointment information
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('hrta_cd00-03_appointment_info')
        .select('candidate_id, appointment_time')
        .in('candidate_id', candidateIds);

      if (appointmentsError) {
        console.warn('Could not fetch appointments:', appointmentsError);
      }

      // Group logs by candidate_id
      const grouped: { [key: string]: ExecutionLog[] } = {};
      recentLogs.forEach(log => {
        if (log.candidate_id) {
          if (!grouped[log.candidate_id]) {
            grouped[log.candidate_id] = [];
          }
          grouped[log.candidate_id].push(log);
        }
      });

      // Create grouped progress data
      const groupedProgress: GroupedProgress[] = Object.keys(grouped).map(candidateId => {
        const candidate = candidatesData?.find(c => c.candidate_id === candidateId);
        const appointment = appointmentsData?.find(a => a.candidate_id === candidateId);
        
        const candidateName = candidate 
          ? `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown Candidate'
          : 'Unknown Candidate';

        // Sort logs for this candidate by created_at (newest first)
        const sortedLogs = grouped[candidateId].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
          candidate_id: candidateId,
          candidate_name: candidateName,
          interview_date: appointment?.appointment_time || null,
          logs: sortedLogs
        };
      });

      // Sort groups by most recent activity
      groupedProgress.sort((a, b) => {
        const aLatest = a.logs[0]?.created_at || '';
        const bLatest = b.logs[0]?.created_at || '';
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });

      setGroupedLogs(groupedProgress);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Error fetching data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'finished':
      case 'done':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in-progress':
      case 'running':
      case 'active':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'finished':
      case 'done':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
      case 'running':
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (id: string) => {
  setOpenGroups(prev => ({
    ...prev,
    [id]: !prev[id]
  }));
};



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Progress Monitor</h1>
          <p className="text-gray-600">Track the status and progress of ongoing interviews (Last 7 days)</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="font-medium text-gray-900">
                  Database Connection: {connectionStatus === 'connected' ? 'Connected' : 
                                      connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
                </span>
              </div>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500 mt-1" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800 mb-2">Database Connection Error</h3>
                <p className="text-red-700 mb-4">{error}</p>
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

        {/* Summary Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center space-x-3 mb-4">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Active Candidates</h2>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {groupedLogs.length}
              </div>
              <p className="text-gray-500">With recent activity</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Total Activities</h2>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {groupedLogs.reduce((total, group) => total + group.logs.length, 0)}
              </div>
              <p className="text-gray-500">In the last 7 days</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Calendar className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Scheduled Interviews</h2>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {groupedLogs.filter(group => group.interview_date).length}
              </div>
              <p className="text-gray-500">With appointments</p>
            </div>
          </div>
        </div>

        {/* Grouped Progress Timeline */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Progress Timeline by Candidate</h2>
            </div>
          </div>
          
          <div className="p-6">
  {groupedLogs.length > 0 ? (
    <div className="space-y-8">
      {groupedLogs.map((group) => (
        <div key={group.candidate_id} className="border border-gray-200 rounded-lg overflow-hidden">

          {/* Group Header */}
          <div
            onClick={() => toggleGroup(group.candidate_id)}
            className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition flex justify-between items-center"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {group.candidate_name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  {group.interview_date ? (
                    <span className="flex flex-wrap items-center space-x-1 text-gray-700">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        Interview:&nbsp;
                        {format(parseISO(group.interview_date), 'MMM d, yyyy - HH:mm')}
                      </span>
                    </span>
                  ) : (
                    'No interview scheduled'
                  )}
                </p>
              </div>
            </div>

            {/* Arrow icon */}
            <svg
              className={`w-5 h-5 text-gray-600 transform transition ${
                openGroups[group.candidate_id] ? 'rotate-180' : 'rotate-0'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Group Activities */}
          {openGroups[group.candidate_id] && (
            <div className="divide-y divide-gray-200">
              {group.logs.map((log, index) => (
                <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 sm:gap-4 flex-wrap">
                    <div className="flex-shrink-0 mt-1">{getStatusIcon(log.current_status)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(log.current_status)}`}
                          >
                            {log.current_status || 'Unknown Status'}
                          </span>
                          {index === 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              Latest
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span>{format(parseISO(log.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>{format(parseISO(log.created_at), 'HH:mm')}</span>
                          </div>
                        </div>
                      </div>

                      {log.execution_id && (
                        <p className="text-xs sm:text-sm text-gray-600 break-all">
                          Execution ID: {log.execution_id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  ) : (
    <div className="text-center py-12">
      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h3>
      <p className="text-gray-500">No progress logs found for the last 7 days.</p>
    </div>
  )}
</div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}


export default InterviewProgress;