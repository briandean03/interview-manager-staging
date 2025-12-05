import { useAuth } from "../context/AuthContext"
import { Navigate } from "react-router-dom"

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!session) return <Navigate to="/login" replace />

  return children
}
