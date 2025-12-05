import React, { useState } from "react"
import { supabase } from "../lib/supabase"

export default function Signup() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    company_email: "",
    company_name: "",
    password: "",
  })

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // 1️⃣ Create user in Auth
    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.company_email,
      password: form.password,
    })

    if (signupError) {
      setError(signupError.message)
      return
    }

    const userId = data.user?.id

    if (!userId) {
      setError("Could not create user. Try again.")
      return
    }

    // 2️⃣ Insert profile into hr_users table
    const { error: profileError } = await supabase.from("hr_users").insert([
      {
        id: userId,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        company_email: form.company_email,
        company_name: form.company_name,
      },
    ])

    if (profileError) {
      setError(profileError.message)
      return
    }

    // 3️⃣ Success message
    setSuccess("Account created! Check your email inbox to verify your account.")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Create Your HR Account
        </h2>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="first_name"
              placeholder="First Name"
              className="border p-2 rounded w-full"
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="last_name"
              placeholder="Last Name"
              className="border p-2 rounded w-full"
              onChange={handleChange}
              required
            />
          </div>

          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            className="border p-2 rounded w-full"
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="company_email"
            placeholder="Company Email"
            className="border p-2 rounded w-full"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="company_name"
            placeholder="Company Name"
            className="border p-2 rounded w-full"
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="border p-2 rounded w-full"
            onChange={handleChange}
            required
          />

          <button className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 transition">
            Create Account
          </button>
        </form>

        <p className="text-sm text-center mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 underline">
            Login
          </a>
        </p>
      </div>
    </div>
  )
}
