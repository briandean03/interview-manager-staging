export interface Candidate {
  candidate_id: string
  first_name: string
  last_name: string
  email: string
  mobile_num?: string | null
  status: string
  years_experience?: string | null
  position_code?: string | null
  availability?: string | null
  asking_salary?: string | null
  visa_status?: string | null
  skills?: string | null
  education_qaulifiation?: string | null
  experience?: string | null
  honors_and_awards?: string | null
  languages?: string | null
  driving_license?: string | null
  nationality?: string | null
  qualifications?: string | null
  ai_evaluation?: string | null
  vote?: number | null
  application_date?: string | null
  created_at: string
  date_interviewed?: string | null
}
