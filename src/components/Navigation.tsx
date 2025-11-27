import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Users,
  Calendar,
  ChartBar as BarChart3,
  FileText,
  UserCheck,
  Shield,
  Home
} from 'lucide-react'

const Navigation: React.FC = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/candidates', icon: Users, label: 'Candidates' },
    { path: '/booking', icon: Calendar, label: 'Interview Booking' },
    { path: '/progress', icon: BarChart3, label: 'Progress Monitor' },
    { path: '/results', icon: FileText, label: 'Interview Results' },
    { path: '/security', icon: Shield, label: 'Security Settings' },
  ]

  return (
    <nav className="
      sticky top-0 z-50
      bg-white/80 backdrop-blur-lg
      shadow-sm border-b border-gray-200 
      w-full
    ">
      <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Brand + Navigation */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4">
          
          {/* Brand */}
          <div className="flex items-center gap-2 mb-2 sm:mb-0">
            <UserCheck className="h-7 w-7 text-blue-600" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">
              Interview Manager
            </h1>
          </div>

          {/* Nav Items */}
          <div className="flex overflow-x-auto sm:overflow-visible no-scrollbar gap-3 sm:gap-5 md:gap-6 pb-1 sm:pb-0">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium 
                  transition-all duration-200 whitespace-nowrap
                  ${
                    location.pathname === path
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Hide scrollbar */}
      <style>
        {`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>
    </nav>
  )
}

export default Navigation
