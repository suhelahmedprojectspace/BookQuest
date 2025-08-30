'use client'
import { useState, useEffect } from 'react'
import BookCard from '@/components/BookCard'
import Modal from '@/components/Modal'

interface Book {
  title: string
  author: string
  rating: number
  image: string
  similarity?: number
  genre?: string | {
    name: string,
    value: string,
  }
  method?: string
}

interface BookDetails {
  title: string
  authors: string[]
  description: string
  averageRating?: number
  ratingsCount?: number
  pageCount?: number
  publishedDate?: string
  publisher?: string
  imageLinks?: { thumbnail?: string }
  categories?: string[]
  language?: string
  isbn?: string
  previewLink?: string
  infoLink?: string
  source?: string
  error?: string
}

// ✅ Backend data interfaces based on your console logs
interface GenreData {
  count: number
  name: string
  popularity: number
}

interface AuthorData {
  average_rating: number
  book_count: number
  genres: string[]
  name: string
}

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [favorites, setFavorites] = useState<Book[]>([])
  const [userRating, setUserRating] = useState(0)
  
  console.log("books ka data", books);
  console.log(bookDetails);

  const API_BASE_URL = 'https://bookquest-f7t2.onrender.com'
  
  // Enhanced filter state with genre support
  const [filters, setFilters] = useState({
    minRating: 0,
    maxRating: 10,
    genre: 'all',
    author: ''
  })
  
  // Advanced search options - Updated types for your backend structure
  const [searchMode, setSearchMode] = useState<'title' | 'genre' | 'author' | 'hybrid'>('title')
  const [availableGenres, setAvailableGenres] = useState<GenreData[]>([])
  const [availableAuthors, setAvailableAuthors] = useState<AuthorData[]>([])
  const [userPreferences, setUserPreferences] = useState<{[key: string]: number}>({})
  
  const [showFilters, setShowFilters] = useState(false)
  console.log('author', availableAuthors);
  console.log('genres', availableGenres)

  const suggestions = ['Harry Potter', 'The Alchemist', '1984', 'To Kill a Mockingbird', 'Pride and Prejudice', 'The Great Gatsby']

  // Safe favorites helper - always returns an array
  const getSafeFavorites = (): Book[] => {
    return Array.isArray(favorites) ? favorites : []
  }

  // ✅ BULLETPROOF Safe rendering helper - COMPLETE FIX for your backend structure
  const safeRenderValue = (value: unknown): string => {
    try {
      if (value === null || value === undefined) return '0'
      if (typeof value === 'number') return String(value)
      if (typeof value === 'string') return value
      if (Array.isArray(value)) return String(value.length)
      if (typeof value === 'object' && value !== null) {
        // Handle your specific backend patterns
        if ('count' in value && typeof value.count === 'number') return String(value.count)
        if ('name' in value && typeof value.name === 'string') return value.name
        if ('popularity' in value && typeof value.popularity === 'number') return String(value.popularity)
        if ('book_count' in value && typeof value.book_count === 'number') return String(value.book_count)
        if ('average_rating' in value && typeof value.average_rating === 'number') return String(value.average_rating)
        
        // Fallback to object key count
        return String(Object.keys(value).length)
      }
      return '0'
    } catch (error) {
      console.error('Error rendering value:', error, value)
      return '0'
    }
  }

  // ✅ SAFE Select Options Renderer - Handles your backend object structure
  const renderSelectOptions = (items: (GenreData | AuthorData | string)[], prefix: string = 'option') => {
    return items.map((item, index) => {
      let value: string
      let label: string
      
      if (typeof item === 'object' && item !== null) {
        // Handle GenreData and AuthorData objects
        value = item.name || `${prefix}-${index}`
        label = item.name || `Option ${index + 1}`
      } else {
        value = String(item)
        label = String(item)
      }
      
      return (
        <option key={`${prefix}-${index}-${value}`} value={value}>
          {label}
        </option>
      )
    })
  }

  // ✅ SAFE debug function - won't crash if objects are passed
  const debugApiResponse = (label: string, data: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${label}:`, {
        type: typeof data,
        isArray: Array.isArray(data),
        value: data,
        rendered: safeRenderValue(data)
      })
    }
  }

  // ✅ Extract genre names for display and filtering
  const getGenreNames = (): string[] => {
    return availableGenres.map(genre => 
      typeof genre === 'object' && genre.name ? genre.name : String(genre)
    )
  }

  // ✅ Extract author names for display and filtering  
  const getAuthorNames = (): string[] => {
    return availableAuthors.map(author => 
      typeof author === 'object' && author.name ? author.name : String(author)
    )
  }

  // Fetch available genres and authors - FIXED for your backend structure
  const fetchGenresAndAuthors = async () => {
    try {
      const [genresRes, authorsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/genres`),
        fetch(`${API_BASE_URL}/api/authors`)
      ])
      
      if (genresRes.ok) {
        const genresData = await genresRes.json()
        debugApiResponse('Genres API', genresData)
        
        // ✅ SAFE extraction based on your backend structure
        if (Array.isArray(genresData)) {
          setAvailableGenres(genresData)
        } else if (genresData && typeof genresData === 'object' && Array.isArray(genresData.genres)) {
          setAvailableGenres(genresData.genres)
        } else if (genresData && typeof genresData === 'object' && Array.isArray(genresData.data)) {
          setAvailableGenres(genresData.data)
        } else {
          setAvailableGenres([])
        }
      }
      
      if (authorsRes.ok) {
        const authorsData = await authorsRes.json()
        debugApiResponse('Authors API', authorsData)
        
        // ✅ SAFE extraction based on your backend structure
        if (Array.isArray(authorsData)) {
          setAvailableAuthors(authorsData)
        } else if (authorsData && typeof authorsData === 'object' && Array.isArray(authorsData.authors)) {
          setAvailableAuthors(authorsData.authors)
        } else if (authorsData && typeof authorsData === 'object' && Array.isArray(authorsData.data)) {
          setAvailableAuthors(authorsData.data)
        } else {
          setAvailableAuthors([])
        }
      }
    } catch (error) {
      console.error('Error fetching genres/authors:', error)
      setAvailableGenres([])
      setAvailableAuthors([])
    }
  }

  // Handle component mounting for SSR/CSR compatibility
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    console.log('🔄 Component mounted, initializing...')
    
    // ✅ SAFE localStorage access
    if (typeof window !== 'undefined') {
      const recent = localStorage.getItem('recentSearches')
      if (recent) {
        try {
          const parsedRecent = JSON.parse(recent)
          setSearchHistory(Array.isArray(parsedRecent) ? parsedRecent : [])
        } catch {
          setSearchHistory([])
        }
      }

      // Load user preferences
      const preferences = localStorage.getItem('userPreferences')
      if (preferences) {
        try {
          const parsedPreferences = JSON.parse(preferences)
          setUserPreferences(parsedPreferences || {})
        } catch {
          setUserPreferences({})
        }
      }

      const urlParams = new URLSearchParams(window.location.search)
      const searchParam = urlParams.get('search')
      if (searchParam) {
        setQuery(searchParam)
        setTimeout(() => performSearch(searchParam), 100)
      }
    }

    fetchFavorites()
    fetchGenresAndAuthors()
    testBackendConnection()
  }, [mounted])

  // Test backend connection - FIXED
  const testBackendConnection = async () => {
    console.log('🧪 Testing backend connection...')
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Backend health check passed:', data)
        debugApiResponse('Backend Health', data)
      } else {
        console.error('❌ Backend health check failed:', response.status)
      }
    } catch (error) {
      console.error('❌ Backend connection failed:', error)
      setError('Cannot connect to server. Please check your connection.')
    }
  }

  // Enhanced fetchFavorites with proper error handling - FIXED
  const fetchFavorites = async () => {
    console.log('❤️ Fetching favorites...')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}/api/favorites`, { headers })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Favorites response:', data)
        debugApiResponse('Favorites API', data)
        
        // ✅ SAFE favorites handling
        if (Array.isArray(data)) {
          setFavorites(data)
        } else if (data && typeof data === 'object' && Array.isArray(data.favorites)) {
          setFavorites(data.favorites)
        } else {
          console.warn('⚠️ Favorites API returned non-array:', data)
          setFavorites([])
        }
      } else if (response.status === 401) {
        console.log('ℹ️ User not authenticated, skipping favorites')
        setFavorites([])
      } else {
        console.error('❌ Failed to fetch favorites:', response.status)
        setFavorites([])
      }
    } catch (err) {
      console.error('❌ Error fetching favorites:', err)
      setFavorites([])
    }
  }

  const addToHistory = (search: string) => {
    const updated = [search, ...searchHistory.filter(h => h !== search)].slice(0, 5)
    setSearchHistory(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentSearches', JSON.stringify(updated))
    }
  }

  // Enhanced search function with multiple modes - FIXED
  const performSearch = async (searchQuery: string, mode: string = searchMode) => {
    if (!searchQuery?.trim()) {
      console.log('❌ Empty search query')
      return
    }
    
    console.log(`🔍 Starting ${mode} search for:`, searchQuery)
    
    setLoading(true)
    setError('')
    addToHistory(searchQuery.trim())
    
    try {
      let url = ''
      let requestOptions: RequestInit = { method: 'GET' }
      
      // Choose API endpoint based on search mode - ALL FIXED
      switch (mode) {
        case 'genre':
          url = `${API_BASE_URL}/api/recommend/genre/${encodeURIComponent(searchQuery)}`
          break
          
        case 'author':
          url = `${API_BASE_URL}/api/recommend/author/${encodeURIComponent(searchQuery)}`
          break
          
        case 'hybrid':
          url = `${API_BASE_URL}/api/recommend/hybrid`
          requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              book_title: searchQuery,
              genre: filters.genre !== 'all' ? filters.genre : '',
              author: filters.author,
              user_preferences: userPreferences
            })
          }
          break
          
        default: // title search
          url = `${API_BASE_URL}/api/recommend?q=${encodeURIComponent(searchQuery)}`
      }
      
      console.log('📡 Making request to:', url)
      
      const response = await fetch(url, requestOptions)
      console.log('📊 Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ Raw API response:', data)
      debugApiResponse('Search API', data)
      
      // ✅ SAFE extraction of recommendations
      let recommendations: Book[] = []
      if (data && typeof data === 'object') {
        if (Array.isArray(data.recommendations)) {
          recommendations = data.recommendations
        } else if (Array.isArray(data)) {
          recommendations = data
        } else if (data.data && Array.isArray(data.data)) {
          recommendations = data.data
        }
      }
      
      if (recommendations.length > 0) {
        console.log('🔍 Applying filters...')
        
        // Apply filters
        let filteredBooks = recommendations.filter((book: Book) => {
          const meetsRating = book.rating >= filters.minRating && book.rating <= filters.maxRating
          const meetsAuthor = !filters.author || book.author.toLowerCase().includes(filters.author.toLowerCase())
          
          // Safe genre checking
          let meetsGenre = filters.genre === 'all'
          if (!meetsGenre && book.genre) {
            const genreString = typeof book.genre === 'object' ? book.genre.name || book.genre.value : book.genre
            meetsGenre = genreString?.toLowerCase().includes(filters.genre.toLowerCase()) || false
          }
          
          return meetsRating && meetsAuthor && meetsGenre
        })
        
        console.log('📚 Filtered books:', filteredBooks)
        
        // If no books pass filters, show all books instead of empty list
        if (filteredBooks.length === 0 && recommendations.length > 0) {
          console.log('⚠️ Filters removed all books, showing unfiltered results')
          filteredBooks = recommendations
          setError('Your current filters were too restrictive. Showing all results.')
        } else {
          setError('')
        }
        
        setBooks(filteredBooks)
        
      } else {
        console.error('❌ No recommendations found:', data)
        setError('No books found for your search.')
        setBooks([])
      }
    } catch (err: unknown) {
      console.error('❌ Fetch error:', err)
      setError('Failed to connect to server. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const searchBooks = () => {
    console.log('🚀 Search button clicked, query:', query, 'mode:', searchMode)
    performSearch(query, searchMode)
  }

  // Quick genre search - Updated to handle object structure
  const searchByGenre = (genre: string | GenreData) => {
    const genreName = typeof genre === 'object' ? genre.name : genre
    setQuery(genreName)
    setSearchMode('genre')
    performSearch(genreName, 'genre')
  }

  // Quick author search - Updated to handle object structure
  const searchByAuthor = (author: string | AuthorData) => {
    const authorName = typeof author === 'object' ? author.name : author
    setQuery(authorName)
    setSearchMode('author')
    performSearch(authorName, 'author')
  }

  // Add to user preferences
  const addToPreferences = (book: Book, rating: number) => {
    const newPreferences = { ...userPreferences, [book.title]: rating }
    setUserPreferences(newPreferences)
    if (typeof window !== 'undefined') {
      localStorage.setItem('userPreferences', JSON.stringify(newPreferences))
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setSearchMode('title')
    performSearch(suggestion, 'title')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchBooks()
    }
  }

  // Enhanced toggleFavorite with proper authentication and safety checks - FIXED
  const toggleFavorite = async (book: Book) => {
    const safeFavorites = getSafeFavorites()
    const isFavorite = safeFavorites.some(fav => fav.title === book.title)
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      
      if (!token) {
        setError('Please login to manage favorites')
        return
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
      
      if (isFavorite) {
        const response = await fetch(`${API_BASE_URL}/api/favorites?title=${encodeURIComponent(book.title)}`, {
          method: 'DELETE',
          headers
        })
        
        if (response.ok) {
          setFavorites(safeFavorites.filter(fav => fav.title !== book.title))
        } else {
          throw new Error('Failed to remove favorite')
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify(book)
        })
        
        if (response.ok) {
          setFavorites([...safeFavorites, book])
        } else {
          throw new Error('Failed to add favorite')
        }
      }
    } catch (err) {
      console.error('Error updating favorites:', err)
      setError('Failed to update favorites. Please try again.')
    }
  }

  // Rate book function - FIXED
  const rateBook = async (book: Book, rating: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      
      if (!token) {
        setError('Please login to rate books')
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/rate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: book.title, rating })
      })
      
      if (response.ok) {
        setUserRating(rating)
        addToPreferences(book, rating)
      } else {
        throw new Error('Failed to rate book')
      }
    } catch (err) {
      console.error('Error rating book:', err)
      setError('Failed to rate book. Please try again.')
    }
  }

  // Open book details function - FIXED
  const openBookDetails = async (book: Book) => {
    setSelectedBook(book)
    setModalLoading(true)
    setBookDetails(null)
    setUserRating(0)

    try {
      const response = await fetch(`${API_BASE_URL}/api/book/${encodeURIComponent(book.title)}`)
      const data = await response.json()
      
      if (response.ok) {
        setBookDetails(data)
      }
    } catch (err) {
      console.error('Error fetching book details:', err)
    } finally {
      setModalLoading(false)
    }
  }

  const closeModal = () => {
    setSelectedBook(null)
    setBookDetails(null)
    setUserRating(0)
  }

  const exportToPDF = () => {
    if (typeof window === 'undefined') return // SSR guard
    
    const content = books.map((book, i) => 
      `${i+1}. ${book.title} by ${book.author} (Rating: ${book.rating}) [${book.method || 'content'}]`
    ).join('\n')
    
    const blob = new Blob([`My Book Recommendations\n\n${content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'book-recommendations.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setFilters({
      minRating: 0,
      maxRating: 10,
      genre: 'all',
      author: ''
    })
  }

  const safeFavorites = getSafeFavorites()

  // Show loading until component is mounted (SSR protection)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      
      {/* Enhanced Elegant Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-blue-200/40 to-indigo-300/40 dark:from-blue-800/30 dark:to-indigo-900/40 rounded-full mix-blend-multiply blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-purple-200/40 to-pink-300/40 dark:from-purple-800/30 dark:to-pink-900/40 rounded-full mix-blend-multiply blur-3xl animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-indigo-200/30 to-blue-300/30 dark:from-indigo-800/20 dark:to-blue-900/30 rounded-full mix-blend-multiply blur-2xl animate-pulse-slow"></div>
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="min-h-screen flex flex-col justify-center py-12 sm:py-16 lg:py-20">
            
            {/* Main Hero Content */}
            <div className="text-center max-w-5xl mx-auto">
              
              {/* Brand Logo/Icon */}
              <div className="mb-8 flex justify-center">
                
              </div>

              {/* Main Heading */}
              <div className="mb-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight">
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-400 dark:via-purple-400 dark:to-blue-400 mb-2">
                    BookQuest
                  </span>
                  <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-slate-700 dark:text-slate-300 mt-4">
                    Discover Your Literary Journey
                  </span>
                </h1>
              </div>

              {/* Decorative Element */}
              <div className="flex justify-center mb-8">
                <div className="flex items-center space-x-2">
                  <div className="w-12 sm:w-16 h-0.5 bg-gradient-to-r from-transparent to-indigo-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
                  <div className="w-16 sm:w-24 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse animation-delay-1000"></div>
                  <div className="w-12 sm:w-16 h-0.5 bg-gradient-to-r from-purple-500 to-transparent rounded-full"></div>
                </div>
              </div>
              
              {/* Subtitle and Description */}
              <div className="max-w-4xl mx-auto mb-12">
                <p className="text-lg sm:text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                  Where artificial intelligence meets literary passion
                </p>
                
                <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto px-4">
                  Experience the future of book discovery with our intelligent recommendation engine. 
                  Using advanced machine learning, collaborative filtering, and deep genre analysis, 
                  we curate personalized reading experiences that evolve with your literary taste.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12 max-w-4xl mx-auto px-4">
                <div className="group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl blur opacity-50 group-hover:opacity-70 transition-opacity"></div>
                    <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-indigo-300/50 dark:hover:border-indigo-500/30 transition-all duration-300">
                      <div className="text-2xl sm:text-3xl mb-3">🎯</div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white mb-2">Smart Recommendations</h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">AI-powered suggestions tailored to your unique reading preferences</p>
                    </div>
                  </div>
                </div>
                
                <div className="group">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl blur opacity-50 group-hover:opacity-70 transition-opacity"></div>
                    <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-purple-300/50 dark:hover:border-purple-500/30 transition-all duration-300">
                      <div className="text-2xl sm:text-3xl mb-3">🌟</div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white mb-2">Diverse Discovery</h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Explore vast libraries across genres, authors, and literary styles</p>
                    </div>
                  </div>
                </div>
                
                <div className="group sm:col-span-1 col-span-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl blur opacity-50 group-hover:opacity-70 transition-opacity"></div>
                    <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:border-emerald-300/50 dark:hover:border-emerald-500/30 transition-all duration-300">
                      <div className="text-2xl sm:text-3xl mb-3">📖</div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white mb-2">Personal Library</h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Build and manage your reading journey with favorites and ratings</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ BULLETPROOF Stats Bar - COMPLETELY FIXED */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-12 max-w-4xl mx-auto px-4">
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 mb-2">270K+</div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">Books</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
                        {safeRenderValue(availableGenres)}+
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">Genres</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 mb-2">
                        {safeRenderValue(userPreferences)}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">Rated</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30 rounded-2xl blur opacity-40"></div>
                    <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-orange-600 mb-2">
                        {safeRenderValue(safeFavorites)}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">Favorites</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                  <svg className="w-4 h-4 mr-2 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Free to use
                </div>
                <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                  <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  AI-powered
                </div>
                <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                  <svg className="w-4 h-4 mr-2 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Personalized
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search Section */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl blur opacity-50"></div>
            <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-6 shadow-lg">
              
              {/* Search Mode Tabs */}
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {[
                  { key: 'title', label: 'By Title', icon: '📚' },
                  { key: 'genre', label: 'By Genre', icon: '🎭' },
                  { key: 'author', label: 'By Author', icon: '✍️' },
                  { key: 'hybrid', label: 'Smart Search', icon: '🤖' }
                ].map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => setSearchMode(mode.key as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      searchMode === mode.key
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                    }`}
                  >
                    <span className="mr-1">{mode.icon}</span>
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  {/* Dynamic input based on search mode */}
                  {searchMode === 'genre' ? (
                    <select
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 text-base bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                      disabled={loading}
                    >
                      <option value="">Select a genre...</option>
                      {renderSelectOptions(availableGenres, 'genre')}
                    </select>
                  ) : searchMode === 'author' ? (
                    <select
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 text-base bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                      disabled={loading}
                    >
                      <option value="">Select an author...</option>
                      {renderSelectOptions(availableAuthors.slice(0, 100), 'author')}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full pl-12 pr-4 py-3 text-base bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                      placeholder={
                        searchMode === 'hybrid' 
                          ? 'Enter any book, genre, or author for smart recommendations...'
                          : 'Enter a book title...'
                      }
                      disabled={loading}
                    />
                  )}
                </div>
                
                <button
                  onClick={searchBooks}
                  disabled={loading || !query.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-indigo-500/30"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Searching...</span>
                    </div>
                  ) : (
                    'Find Books'
                  )}
                </button>
              </div>

              {/* Advanced Filters Toggle */}
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="group inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300 text-sm font-medium"
                >
                  <svg className={`h-4 w-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showFilters ? 'Hide' : 'Show'} Filters
                </button>
              </div>

              {/* Enhanced Advanced Filters */}
              <div className={`transition-all duration-500 overflow-hidden ${showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-slate-100/70 dark:bg-slate-700/70 rounded-xl p-4 border border-slate-200/50 dark:border-slate-600/50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-slate-800 dark:text-white font-semibold flex items-center gap-2">
                      <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      Advanced Filters
                    </h3>
                    <button
                      onClick={clearFilters}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 text-sm font-medium block mb-2">Minimum Rating</label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={filters.minRating}
                        onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex items-center justify-center mt-2">
                        <span className="text-yellow-500 text-lg">★</span>
                        <span className="text-slate-800 dark:text-white ml-1 font-medium">{filters.minRating}+</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 text-sm font-medium block mb-2">Maximum Rating</label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={filters.maxRating}
                        onChange={(e) => setFilters({...filters, maxRating: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex items-center justify-center mt-2">
                        <span className="text-yellow-500 text-lg">★</span>
                        <span className="text-slate-800 dark:text-white ml-1 font-medium">{filters.maxRating}</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 text-sm font-medium block mb-2">Filter by Genre</label>
                      <select
                        value={filters.genre}
                        onChange={(e) => setFilters({...filters, genre: e.target.value})}
                        className="w-full p-3 bg-white dark:bg-slate-600 text-slate-800 dark:text-white rounded-lg border border-slate-300 dark:border-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">All Genres</option>
                        {renderSelectOptions(availableGenres.slice(0, 20), 'filter-genre')}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-slate-700 dark:text-slate-300 text-sm font-medium block mb-2">Author Contains</label>
                      <input
                        type="text"
                        placeholder="Author name..."
                        value={filters.author}
                        onChange={(e) => setFilters({...filters, author: e.target.value})}
                        className="w-full p-3 bg-white dark:bg-slate-600 text-slate-800 dark:text-white rounded-lg border border-slate-300 dark:border-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder-slate-500 dark:placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Genre Buttons */}
          {availableGenres.length > 0 && (
            <div className="mb-6">
              <h4 className="text-center text-slate-600 dark:text-slate-400 text-sm font-medium mb-3">Popular Genres:</h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableGenres.slice(0, 8).map((genre, index) => {
                  const genreName = typeof genre === 'object' ? genre.name : String(genre)
                  return (
                    <button
                      key={`quick-genre-${index}`}
                      onClick={() => searchByGenre(genre)}
                      className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-sm rounded-full transition-all duration-300 font-medium border border-emerald-300/50 dark:border-emerald-600/50"
                    >
                      🎭 {genreName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Export Button */}
          {books.length > 0 && (
            <div className="text-center mb-6">
              <button
                onClick={exportToPDF}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-emerald-500/30"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Recommendations
              </button>
            </div>
          )}
          
          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            <span className="text-slate-600 dark:text-slate-400 text-sm font-medium mr-2">Try:</span>
            {suggestions.map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 bg-white/70 dark:bg-slate-700/70 hover:bg-indigo-100/70 dark:hover:bg-indigo-700/30 text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm rounded-full transition-all duration-300 font-medium border border-slate-300/50 dark:border-slate-600/50 hover:border-indigo-300/50 dark:hover:border-indigo-500/50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Recent Searches */}
          {searchHistory.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-medium mr-2">Recent:</span>
              {searchHistory.map((search, index) => (
                <button 
                  key={`recent-${index}`}
                  onClick={() => handleSuggestionClick(search)}
                  className="px-3 py-1.5 bg-slate-100/70 dark:bg-slate-700/70 hover:bg-slate-200/70 dark:hover:bg-slate-600/70 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 text-sm rounded-full transition-all duration-300 border border-slate-300/50 dark:border-slate-600/50"
                >
                  {search}
                </button>
              ))}
            </div>
          )}
          
          {error && (
            <div className="mt-6 p-4 bg-red-100/70 dark:bg-red-900/20 border border-red-300/50 dark:border-red-500/50 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-center font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="container mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="group">
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 animate-pulse">
                  <div className="w-full h-48 bg-slate-300/50 dark:bg-slate-700/50 rounded-xl mb-4"></div>
                  <div className="h-4 bg-slate-300/50 dark:bg-slate-700/50 rounded-lg mb-2"></div>
                  <div className="h-3 bg-slate-300/50 dark:bg-slate-700/50 rounded-lg w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Results Section */}
      {books.length > 0 && !loading && (
        <div className="container mx-auto px-4 pb-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4">
              {searchMode === 'genre' ? `${query} Books` : 
               searchMode === 'author' ? `Books by ${query}` :
               searchMode === 'hybrid' ? 'Smart Recommendations' :
               'Curated for You'}
            </h2>
            <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
              <svg className="h-5 w-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-lg">
                {books.length} {searchMode} recommendations
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book, index) => (
              <div key={`${book.title}-${index}`} className="relative">
                {/* Method Badge */}
                {book.method && (
                  <div className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
                    {book.method}
                  </div>
                )}
                <BookCard
                  book={book}
                  isFavorite={safeFavorites.some(fav => fav.title === book.title)}
                  onToggleFavorite={() => toggleFavorite(book)}
                  onViewDetails={() => openBookDetails(book)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it Works Section */}
      {books.length === 0 && !loading && !error && (
        <div className="container mx-auto px-4 pb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4">How BookQuest Works</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our advanced AI system uses multiple recommendation strategies to find your perfect next read
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="group text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 group-hover:border-indigo-300/50 dark:group-hover:border-indigo-500/30 transition-all">
                  <div className="text-5xl mb-4">📚</div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Content Analysis</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Analyze book titles, authors, and genres to find similar content
              </p>
            </div>
            
            <div className="group text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 group-hover:border-purple-300/50 dark:group-hover:border-purple-500/30 transition-all">
                  <div className="text-5xl mb-4">🎭</div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Genre Matching</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Discover books within your favorite genres and explore new ones
              </p>
            </div>
            
            <div className="group text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-100 to-indigo-100 dark:from-pink-900/30 dark:to-indigo-900/30 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 group-hover:border-pink-300/50 dark:group-hover:border-pink-500/30 transition-all">
                  <div className="text-5xl mb-4">👥</div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Collaborative Filtering</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Learn from users with similar tastes to suggest hidden gems
              </p>
            </div>
            
            <div className="group text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 group-hover:border-emerald-300/50 dark:group-hover:border-emerald-500/30 transition-all">
                  <div className="text-5xl mb-4">🤖</div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Smart Hybrid</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Combine all methods for the most accurate personalized recommendations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Modal */}
      {selectedBook && (
        <Modal
          book={selectedBook}
          bookDetails={bookDetails}
          loading={modalLoading}
          favorites={safeFavorites}
          userRating={userRating}
          onClose={closeModal}
          onToggleFavorite={() => toggleFavorite(selectedBook)}
          onRate={(rating) => rateBook(selectedBook, rating)}
        />
      )}

      {/* Enhanced CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(-180deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
          animation-delay: 2s;
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  )
}
