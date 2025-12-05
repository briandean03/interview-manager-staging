import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { supabase } from "../lib/supabase"
import type { Session } from "@supabase/supabase-js"

interface AuthContextType {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // ------------------------------
  // 1️⃣ Handle login/logout session management
  // ------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // ------------------------------
  // 2️⃣ Automatic profile creation AFTER login (RLS-safe)
  // ------------------------------
  useEffect(() => {
    if (!session) return

    const createProfileIfMissing = async () => {
      const user = session.user

      // 1️⃣ Check if hr_users row exists
      const { data: existing, error: checkError } = await supabase
        .from("hr_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (existing) return // Profile already exists

      if (checkError) {
        console.error("Failed checking hr_users:", checkError)
        return
      }

      // 2️⃣ Extract metadata safely
      const meta = user.user_metadata || {}

      const first_name = meta.first_name?.trim() || ""
      const last_name = meta.last_name?.trim() || ""
      const phone = meta.phone?.trim() || ""
      const company_name = meta.company_name?.trim() || ""
      const company_email = user.email || ""

      // 3️⃣ Prevent invalid inserts (avoids RLS denial)
      if (!first_name || !last_name || !company_email) {
        console.warn("Metadata incomplete — skipping hr_users insert for:", user.id)
        return
      }

      // 4️⃣ Insert profile (RLS-safe because auth.uid() = user.id)
      const { error: insertError } = await supabase.from("hr_users").insert({
        id: user.id,
        first_name,
        last_name,
        phone,
        company_email,
        company_name,
      })

      if (insertError) {
        console.error("Failed to create HR profile:", insertError)
      }
    }

    createProfileIfMissing()
  }, [session])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
