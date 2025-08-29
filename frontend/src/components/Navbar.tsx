'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Navbar } from '@sume/ui'
import { useAuth } from '@/contexts/AuthContext'

interface NavbarProps {
  favoritesCount?: number
}

export default function NavbarComponent({ favoritesCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const { user, logout, isAuthenticated, loading } = useAuth()

  const isActive = (path: string) => pathname === path

  // Always show Home, conditionally show Browse and Favorites
  const getMenuItems = () => {
    const baseItems = [
      { 
        label: "Home", 
        href: "/",
      }
    ]

    // Only add Browse and Favorites when authenticated
    if (isAuthenticated) {
      baseItems.push(
        { 
          label: "Browse", 
          href: "/browse",
        },
        { 
          label: `Favorites${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`, 
          href: "/favorites",
        }
      )
    }

    return baseItems
  }

  // Get the right-side actions based on auth state
  const getAuthActions = () => {
    if (loading) {
      return (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      )
    }

    if (isAuthenticated && user) {
      return (
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-slate-700 text-sm font-medium">
              {user.username}
            </span>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-md"
          >
            Logout
          </button>
        </div>
      )
    }
    return (
      <Link 
        href="/login" 
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-md transform hover:scale-[1.02]"
      >
        Login
      </Link>
    )
  }

const Logoele=()=>{
    return(
      <span className="flex items-center gap-3">
  {/* Fancy Logo Icon */}
  <div className="relative">
    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 rounded-xl shadow-lg">
      <svg 
        className="w-6 h-6 text-white" 
        fill="currentColor" 
        viewBox="0 0 24 24"
      >
        <path d="M4 2v20l8-4 8 4V2H4zm2 2h12v14.5l-6-3-6 3V4z"/>
        <circle cx="12" cy="9" r="2" fill="currentColor"/>
      </svg>
    </div>
    {/* Decorative dot */}
    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-sm"></div>
  </div>
  
  {/* Fancy Text Logo */}
  <div className="flex flex-col">
    <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
      BookQuest
    </span>
    <span className="text-xs text-gray-500 font-medium tracking-widest -mt-1">
      DISCOVER
    </span>
  </div>
</span>

    )
  }
  return (
    <div>
      <Navbar
        className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50"
        logo={<Logoele/>}
        menuItems={getMenuItems()}
      >
      
      <div className="absolute top-0 right-0 h-full flex items-center pr-4 z-10">
        {getAuthActions()}
      </div>
      </Navbar>
    </div>
  )
}
