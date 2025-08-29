'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BookCard from '@/components/BookCard'
import Modal from '@/components/Modal'

interface Book {
  title: string
  author: string
  rating: number
  image: string
  similarity?: number
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

export default function Favorites() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'rating' | 'dateAdded'>('dateAdded')
  const [searchQuery, setSearchQuery] = useState('')
  const [userRating, setUserRating] = useState(0)
  const [filteredFavorites, setFilteredFavorites] = useState<Book[]>([])

  useEffect(() => {
    fetchFavorites()
  }, [])

  useEffect(() => {
    // Filter and sort favorites whenever favorites, searchQuery, or sortBy changes
    const filtered = favorites
      .filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortBy) {
          case 'title': return a.title.localeCompare(b.title)
          case 'author': return a.author.localeCompare(b.author)
          case 'rating': return b.rating - a.rating
          default: return 0 // dateAdded would need timestamp from backend
        }
      })
    
    setFilteredFavorites(filtered)
  }, [favorites, searchQuery, sortBy])

  const fetchFavorites = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/favorites')
      const data = await response.json()
      setFavorites(data)
    } catch (err) {
      console.error('Error fetching favorites:', err)
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (book: Book) => {
    try {
      await fetch(`http://localhost:5000/api/favorites?title=${encodeURIComponent(book.title)}`, {
        method: 'DELETE'
      })
      setFavorites(favorites.filter(fav => fav.title !== book.title))
    } catch (err) {
      console.error('Error removing favorite:', err)
    }
  }

  const openBookDetails = async (book: Book) => {
    setSelectedBook(book)
    setModalLoading(true)
    setBookDetails(null)

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

  const exportFavorites = () => {
    const content = favorites.map((book, i) => 
      `${i+1}. ${book.title} by ${book.author} (Rating: ${book.rating})`
    ).join('\n')
    
    const blob = new Blob([`My Favorite Books\n\n${content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-favorite-books.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getRecommendationsFromFavorites = () => {
    if (favorites.length === 0) return
    
    // Get recommendations based on a random favorite
    const randomFav = favorites[Math.floor(Math.random() * favorites.length)]
    router.push(`/?search=${encodeURIComponent(randomFav.title)}`)
  }

  const clearAllFavorites = async () => {
    if (window.confirm('Are you sure you want to remove all favorites?')) {
      try {
        for (const book of favorites) {
          await fetch(`http://localhost:5000/api/favorites?title=${encodeURIComponent(book.title)}`, {
            method: 'DELETE'
          })
        }
        setFavorites([])
      } catch (err) {
        console.error('Error clearing favorites:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-flex items-center justify-center space-x-2">
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce"></div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-300">Loading your favorites...</p>
          </div>
        </div>
      </div>
    )
  } 

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <header className="relative overflow-hidden py-12 md:py-16 lg:py-20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-100/30 to-purple-100/30 dark:from-indigo-900/20 dark:to-purple-900/20"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob dark:bg-indigo-800/20"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000 dark:bg-purple-800/20"></div>
        
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-6">
              My Favorites
            </h1>
            
            <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-6"></div>
            
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
              Your personal collection of beloved books
            </p>
            
            {/* Stats Card */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200/50 dark:border-slate-700/50 max-w-md mx-auto mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{favorites.length}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Total Books</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {favorites.length > 0 ? (favorites.reduce((acc, book) => acc + book.rating, 0) / favorites.length).toFixed(1) : '0'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Avg Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-16">
        {favorites.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50 max-w-2xl mx-auto">
            <div className="text-6xl mb-6">📚</div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Your favorites collection is empty</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
              Start building your personal library by adding books you love from your discoveries.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-indigo-500/30"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Discover Books
            </button>
          </div>
        ) : (
          <div>
            {/* Controls Section */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 dark:border-slate-700/50 mb-8">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="flex-1 w-full">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search your favorites..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-lg text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div className="flex-shrink-0 w-full md:w-auto">
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white/50 dark:bg-slate-700/50 border border-slate-300/50 dark:border-slate-600/50 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 appearance-none"
                    >
                      <option value="dateAdded">Recently Added</option>
                      <option value="title">Title A-Z</option>
                      <option value="author">Author A-Z</option>
                      <option value="rating">Highest Rated</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Count */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Showing {filteredFavorites.length} of {favorites.length} books
                </p>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={getRecommendationsFromFavorites}
                    className="inline-flex items-center px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg transition-colors text-sm"
                    title="Get recommendations based on your favorites"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Recommendations
                  </button>
                  <button
                    onClick={exportFavorites}
                    className="inline-flex items-center px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors text-sm"
                    title="Export your favorites list"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={clearAllFavorites}
                    className="inline-flex items-center px-3 py-2 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg transition-colors text-sm"
                    title="Clear all favorites"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Books Grid */}
            {filteredFavorites.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredFavorites.map((book, index) => (
                  <BookCard
                    key={index}
                    book={book}
                    isFavorite={true}
                    onToggleFavorite={() => removeFavorite(book)}
                    onViewDetails={() => openBookDetails(book)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-slate-600 dark:text-slate-400">No books match your search criteria</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Book Details Modal */}
        {selectedBook && (
          <Modal
            book={selectedBook}
            bookDetails={bookDetails}
            loading={modalLoading}
            favorites={favorites}
            userRating={userRating}
            onClose={closeModal}
            onToggleFavorite={() => removeFavorite(selectedBook)}
            onRate={(rating) => console.log('Rating:', rating)}
          />
        )}
      </div>

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
      `}</style>
    </div>
  )
}