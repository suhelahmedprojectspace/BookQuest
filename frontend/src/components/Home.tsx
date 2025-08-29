'use client'
import { useState, useEffect } from 'react'
import NavbarComponent from './Navbar'
import BookCard from '@/components/BookCard'
import Modal from '@/components/Modal'

interface Book {
  title: string
  author: string
  rating: number
  image: string
  similarity?: number
  genre?: string
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

export default function Home() {
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
  
  // Enhanced filter state with genre support
  const [filters, setFilters] = useState({
    minRating: 0,
    maxRating: 10,
    genre: 'all',
    author: ''
  })
  
  // Advanced search options
  const [searchMode, setSearchMode] = useState<'title' | 'genre' | 'author' | 'hybrid'>('title')
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([])
  const [userPreferences, setUserPreferences] = useState<{[key: string]: number}>({})
  
  const [showFilters, setShowFilters] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const suggestions = ['Harry Potter', 'The Alchemist', '1984', 'To Kill a Mockingbird', 'Pride and Prejudice', 'The Great Gatsby']

  // Safe favorites helper - always returns an array
  const getSafeFavorites = (): Book[] => {
    return Array.isArray(favorites) ? favorites : []
  }
   
  // Fetch available genres and authors
  const fetchGenresAndAuthors = async () => {
    try {
      const [genresRes, authorsRes] = await Promise.all([
        fetch('http://localhost:5000/api/genres'),
        fetch('http://localhost:5000/api/authors')
      ])
      
      if (genresRes.ok) {
        const genresData = await genresRes.json()
        setAvailableGenres(Array.isArray(genresData.genres) ? genresData.genres : [])
      }
      
      if (authorsRes.ok) {
        const authorsData = await authorsRes.json()
        setAvailableAuthors(Array.isArray(authorsData.authors) ? authorsData.authors : [])
      }
    } catch (error) {
      console.error('Error fetching genres/authors:', error)
    }
  }

  useEffect(() => {
    console.log('🔄 Component mounted, initializing...')
    
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

    fetchFavorites()
    fetchGenresAndAuthors()
    testBackendConnection()
  }, [])

  const testBackendConnection = async () => {
    console.log('🧪 Testing backend connection...')
    try {
      const response = await fetch('http://localhost:5000/api/health')
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Backend health check passed:', data)
      } else {
        console.error('❌ Backend health check failed:', response.status)
      }
    } catch (error) {
      console.error('❌ Backend connection failed:', error)
      setError('Cannot connect to server. Make sure the backend is running on port 5000.')
    }
  }

  // Enhanced fetchFavorites with proper error handling
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

      const response = await fetch('http://localhost:5000/api/favorites', { headers })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Favorites response:', data)
        
        // Ensure data is always an array
        if (Array.isArray(data)) {
          setFavorites(data)
        } else {
          console.warn('⚠️ Favorites API returned non-array:', data)
          setFavorites([])
        }
      } else if (response.status === 401) {
        // User not authenticated - this is okay
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

  // Enhanced search function with multiple modes
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
      
      // Choose API endpoint based on search mode
      switch (mode) {
        case 'genre':
          url = `http://localhost:5000/api/recommend/genre/${encodeURIComponent(searchQuery)}`
          break
          
        case 'author':
          url = `http://localhost:5000/api/recommend/author/${encodeURIComponent(searchQuery)}`
          break
          
        case 'hybrid':
          url = 'http://localhost:5000/api/recommend/hybrid'
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
          url = `http://localhost:5000/api/recommend?q=${encodeURIComponent(searchQuery)}`
      }
      
      console.log('📡 Making request to:', url)
      
      const response = await fetch(url, requestOptions)
      console.log('📊 Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ Raw API response:', data)
      
      const recommendations = data.recommendations || []
      
      if (Array.isArray(recommendations)) {
        console.log('🔍 Applying filters...')
        
        // Apply filters
        let filteredBooks = recommendations.filter((book: Book) => {
          const meetsRating = book.rating >= filters.minRating && book.rating <= filters.maxRating
          const meetsAuthor = !filters.author || book.author.toLowerCase().includes(filters.author.toLowerCase())
          const meetsGenre = filters.genre === 'all' || !book.genre || book.genre.toLowerCase().includes(filters.genre.toLowerCase())
          
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
        console.error('❌ Invalid response format:', data)
        setError('Invalid response format from server')
      }
    } catch (err: any) {
      console.error('❌ Fetch error:', err)
      setError('Failed to connect to server. Make sure the backend is running and accessible.')
    } finally {
      setLoading(false)
    }
  }

  const searchBooks = () => {
    console.log('🚀 Search button clicked, query:', query, 'mode:', searchMode)
    performSearch(query, searchMode)
  }

  // Quick genre search
  const searchByGenre = (genre: string) => {
    setQuery(genre)
    setSearchMode('genre')
    performSearch(genre, 'genre')
  }

  // Quick author search
  const searchByAuthor = (author: string) => {
    setQuery(author)
    setSearchMode('author')
    performSearch(author, 'author')
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

  // Enhanced toggleFavorite with proper authentication and safety checks
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
        const response = await fetch(`http://localhost:5000/api/favorites?title=${encodeURIComponent(book.title)}`, {
          method: 'DELETE',
          headers
        })
        
        if (response.ok) {
          setFavorites(safeFavorites.filter(fav => fav.title !== book.title))
        } else {
          throw new Error('Failed to remove favorite')
        }
      } else {
        const response = await fetch('http://localhost:5000/api/favorites', {
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

  const rateBook = async (book: Book, rating: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      
      if (!token) {
        setError('Please login to rate books')
        return
      }

      const response = await fetch('http://localhost:5000/api/rate', {
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

  const openBookDetails = async (book: Book) => {
    setSelectedBook(book)
    setModalLoading(true)
    setBookDetails(null)
    setUserRating(0)

    try {
      const response = await fetch(`http://localhost:5000/api/book/${encodeURIComponent(book.title)}`)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      {/* Enhanced Hero Section */}
      <div className="relative overflow-hidden py-12 md:py-16 lg:py-20">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-br from-indigo-100/30 to-purple-100/30 dark:from-indigo-900/20 dark:to-purple-900/20"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob dark:bg-indigo-800/20"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000 dark:bg-purple-800/20"></div>
        
        <div className="relative container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-6 tracking-tight">
              BookQuest
            </h1>
            
            <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-6"></div>
            
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-4 font-light">
              Discover Your Next Favorite Read
            </p>
            
            <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
              Using advanced machine learning, collaborative filtering, and genre analysis to recommend books perfectly matched to your taste.
            </p>
            
            {/* Enhanced Stats Bar */}
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-4 mb-12 max-w-3xl mx-auto">
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">10K+</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Books</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">{availableGenres.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Genres</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{Object.keys(userPreferences).length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rated</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 mb-1">{safeFavorites.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Favorites</div>
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
                      {availableGenres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  ) : searchMode === 'author' ? (
                    <select
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 text-base bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300"
                      disabled={loading}
                    >
                      <option value="">Select an author...</option>
                      {availableAuthors.slice(0, 100).map(author => (
                        <option key={author} value={author}>{author}</option>
                      ))}
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
                        {availableGenres.slice(0, 20).map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
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
                {availableGenres.slice(0, 8).map(genre => (
                  <button
                    key={genre}
                    onClick={() => searchByGenre(genre)}
                    className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-sm rounded-full transition-all duration-300 font-medium border border-emerald-300/50 dark:border-emerald-600/50"
                  >
                    🎭 {genre}
                  </button>
                ))}
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
              {searchHistory.map(search => (
                <button 
                  key={search}
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

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
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
