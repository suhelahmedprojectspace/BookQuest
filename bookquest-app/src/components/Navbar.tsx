'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface NavbarProps {
  favoritesCount?: number
}

export default function NavbarComponent({ favoritesCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const { user, logout, isAuthenticated, loading } = useAuth()
  
  // ✅ SSR Protection - Prevents hydration mismatch
  const [mounted, setMounted] = useState(false)
  // ✅ Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  const isActive = (path: string) => pathname === path

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Get menu items based on auth state
  const getMenuItems = () => {
    const baseItems = [
      { 
        label: "Home", 
        href: "/",
        key: "home",
        icon: "🏠"
      }
    ]

    // Only add authenticated routes when user is confirmed authenticated
    if (mounted && isAuthenticated) {
      baseItems.push(
        { 
          label: "Browse", 
          href: "/browse",
          key: "browse",
          icon: "📖"
        },
        { 
          label: `Favorites${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`, 
          href: "/favorites",
          key: "favorites",
          icon: "❤️"
        }
      )
    }

    return baseItems
  }

  // ✅ Safe auth actions - prevents hydration mismatch
  const getAuthActions = () => {
    // Show skeleton loading while mounting or auth loading
    if (!mounted || loading) {
      return (
        <div className="flex items-center space-x-3">
          <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
      )
    }

    // User is authenticated
    if (isAuthenticated && user) {
      return (
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg">
              {user.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">
              {user.username}
            </span>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-md transform hover:scale-[1.02]"
          >
            Logout
          </button>
        </div>
      )
    }

    // User is not authenticated
    return (
      <Link 
        href="/login" 
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-md transform hover:scale-[1.02]"
      >
        Login
      </Link>
    )
  }

  // ✅ Logo component - moved inside to avoid hydration issues
  const LogoElement = () => (
    <Link href="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
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
    </Link>
  )

  // ✅ Animated Hamburger Icon Component
  const HamburgerIcon = () => (
    <div className="relative w-6 h-6">
      <span
        className={`block absolute h-0.5 w-6 bg-current transform transition duration-300 ease-in-out ${
          isMobileMenuOpen ? 'rotate-45 translate-y-2' : '-translate-y-1.5'
        }`}
      />
      <span
        className={`block absolute h-0.5 w-6 bg-current transform transition duration-300 ease-in-out ${
          isMobileMenuOpen ? 'opacity-0' : 'translate-y-0'
        }`}
      />
      <span
        className={`block absolute h-0.5 w-6 bg-current transform transition duration-300 ease-in-out ${
          isMobileMenuOpen ? '-rotate-45 -translate-y-2' : 'translate-y-1.5'
        }`}
      />
    </div>
  )

  return (
    <>
      <header className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            
            {/* Logo Section */}
            <div className="flex-shrink-0">
              <LogoElement />
            </div>

            {/* Desktop Navigation Menu */}
            <nav className="hidden md:block">
              <div className="flex items-center space-x-8">
                {getMenuItems().map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`relative px-3 py-2 font-medium transition-all duration-300 group ${
                      isActive(item.href)
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    <span className="relative z-10">{item.label}</span>
                    {/* Animated underline */}
                    <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300 ${
                      isActive(item.href) ? 'w-full' : 'w-0 group-hover:w-full'
                    }`} />
                  </Link>
                ))}
              </div>
            </nav>

            {/* Desktop Auth Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {getAuthActions()}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-4">
              {/* Mobile Auth Actions */}
              <div className="flex items-center">
                {!mounted || loading ? (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                ) : isAuthenticated && user ? (
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg">
                    {user.username?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                ) : null}
              </div>
              
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200"
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                <HamburgerIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ✅ Super Cool Mobile Menu */}
      <div className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200/50 dark:border-slate-800/50 shadow-2xl z-50 transform transition-all duration-300 ease-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Mobile Menu Content */}
        <div className="flex flex-col h-full">
          
          {/* User Info Section (if authenticated) */}
          {mounted && isAuthenticated && user && (
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-lg">
                  {user.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">
                    {user.username}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Welcome back!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 py-6">
            <div className="space-y-2 px-4">
              {getMenuItems().map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <span className="text-xl mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </nav>

          {/* Auth Actions Section */}
          <div className="p-6 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
            {!mounted || loading ? (
              <div className="w-full h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
            ) : isAuthenticated && user ? (
              <button
                onClick={() => {
                  logout()
                  setIsMobileMenuOpen(false)
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                🚪 Logout
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-center py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
              >
                🔑 Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
