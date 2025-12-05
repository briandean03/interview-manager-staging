import React, { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError("Invalid email or password")
      return
    }

    window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded-lg shadow-md w-full max-w-sm">

        <h2 className="text-2xl font-semibold mb-4 text-center">
          Interview Manager Login
        </h2>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <form onSubmit={handleLogin} className="space-y-4">

          <input
            type="email"
            placeholder="Company Email"
            className="border p-2 rounded w-full"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="border p-2 rounded w-full"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700"
          >
            Login
          </button>

        <p className="text-sm text-center mt-4">
            Don’t have an account?{" "}
            <a href="/signup" className="text-blue-600 underline">
                Create one
            </a>
            </p>

        </form>
      </div>
    </div>
  )
}
