import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

const createSupabaseClient = () => {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://unynvfttpzhjhcdzwspr.supabase.co'

  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueW52ZnR0cHpoamhjZHp3c3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjE4NjAsImV4cCI6MjA3MDIzNzg2MH0.rcmn4R6tIxbg6ome9_kY3Y7jsVc289DeM84Eugw36Io'

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // This client is guaranteed non-null
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

export const resetSupabaseConnection = () => {
  console.log('Resetting Supabase connection...')

  if (supabaseInstance) {
    try {
      supabaseInstance.removeAllChannels()
    } catch (error) {
      console.warn('Error closing existing channels:', error)
    }
  }

  supabaseInstance = createSupabaseClient()
  return supabaseInstance
}

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient()
  }
  return supabaseInstance
}

export const supabase = getSupabaseClient()

export const isSupabaseConfigured = () => {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://unynvfttpzhjhcdzwspr.supabase.co'
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return !!(url && key && url.includes('supabase.co'))
}

// RESTORED FUNCTION — required by DatabaseStatus, InterviewProgress, InterviewResults
export const testSupabaseConnection = async () => {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error(
      'Supabase client not configured. Please set up your Supabase connection.'
    )
  }

  try {
    const { data, error } = await client
      .from('hrta_cd00-01_resume_extraction')
      .select('candidate_id')
      .limit(1)

    if (error) {
      console.error('Supabase query error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('Supabase connection test successful')
    return true
  } catch (error) {
    console.error('Supabase connection test failed:', error)
    throw error
  }
}
