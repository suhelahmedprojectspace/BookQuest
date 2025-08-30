'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import BookCard from '@/components/BookCard'
import Modal from '@/components/Modal'

interface Book {
  title: string
  author: string
  rating: number
  image: string
  genre?: string
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

function BrowseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false) 
  
  const [popularBooks, setPopularBooks] = useState<Book[]>([])
  const [randomBooks, setRandomBooks] = useState<Book[]>([])
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<Book[]>([])
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string>('all')
  
 
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [userRating, setUserRating] = useState(0)


  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      console.log('Browse page loading...')
      fetchBooks()
      fetchFavorites()
      fetchGenres()
      
     
      const bookTitle = searchParams?.get('book')
      if (bookTitle && (popularBooks.length > 0 || randomBooks.length > 0)) {
        const allBooks = [...popularBooks, ...randomBooks]
        const book = allBooks.find(b => b.title === decodeURIComponent(bookTitle))
        if (book) {
          openBookDetails(book)
        }
      }
    }
  }, [mounted])

  const fetchBooks = async () => {
    console.log('Fetching books from API...')
    try {
      const [popularRes, randomRes] = await Promise.all([
        fetch('https://bookquest-f7t2.onrender.com/api/popular'),
        fetch('https://bookquest-f7t2.onrender.com/api/random')
      ])
      
      console.log('Popular response status:', popularRes.status)
      console.log('Random response status:', randomRes.status)
      
      if (popularRes.ok && randomRes.ok) {
        const popular = await popularRes.json()
        const random = await randomRes.json()
        
        console.log('Popular books:', popular.length)
        console.log('Random books:', random.length)
        
        setPopularBooks(Array.isArray(popular) ? popular : [])
        setRandomBooks(Array.isArray(random) ? random : [])
      } else {
        console.error('Failed to fetch books - Popular:', popularRes.status, 'Random:', randomRes.status)
        setPopularBooks([])
        setRandomBooks([])
      }
    } catch (err) {
      console.error('Error fetching books:', err)
      setPopularBooks([])
      setRandomBooks([])
    } finally {
      setLoading(false)
    }
  }

  const fetchGenres = async () => {
    try {
      const response = await fetch('https://bookquest-f7t2.onrender.com/api/genres')
      if (response.ok) {
        const data = await response.json()
        setAvailableGenres(Array.isArray(data.genres) ? data.genres : [])
      }
    } catch (err) {
      console.error('Error fetching genres:', err)
    }
  }

  const fetchBooksByGenre = async (genre: string) => {
    if (genre === 'all') {
      setFilteredBooks([])
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`https://bookquest-f7t2.onrender.com/api/books/genre/${encodeURIComponent(genre)}`)
      if (response.ok) {
        const books = await response.json()
        setFilteredBooks(Array.isArray(books) ? books : [])
        console.log(`Fetched ${books.length} books for genre: ${genre}`)
      } else {
        console.error('Failed to fetch books by genre:', response.status)
        setFilteredBooks([])
      }
    } catch (err) {
      console.error('Error fetching books by genre:', err)
      setFilteredBooks([])
    } finally {
      setLoading(false)
    }
  }

  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre)
    fetchBooksByGenre(genre)
  }

  const fetchFavorites = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('https://bookquest-f7t2.onrender.com/api/favorites', { headers })
      if (response.ok) {
        const data = await response.json()
        setFavorites(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching favorites:', err)
    }
  }

  const toggleFavorite = async (book: Book) => {
    const isFavorite = favorites.some(fav => fav.title === book.title)
    
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      if (isFavorite) {
        const response = await fetch(`https://bookquest-f7t2.onrender.com/api/favorites?title=${encodeURIComponent(book.title)}`, {
          method: 'DELETE',
          headers
        })
        if (response.ok) {
          setFavorites(favorites.filter(fav => fav.title !== book.title))
        }
      } else {
        const response = await fetch('https://bookquest-f7t2.onrender.com/api/favorites', {
          method: 'POST',
          headers,
          body: JSON.stringify(book)
        })
        if (response.ok) {
          setFavorites([...favorites, book])
        }
      }
    } catch (err) {
      console.error('Error updating favorites:', err)
    }
  }

  const openBookDetails = async (book: Book) => {
    setSelectedBook(book)
    setModalLoading(true)
    setBookDetails(null)
    setUserRating(0)

    // Update URL with book parameter
    router.push(`/browse?book=${encodeURIComponent(book.title)}`)

    try {
      const response = await fetch(`https://bookquest-f7t2.onrender.com/api/book/${encodeURIComponent(book.title)}`)
      if (response.ok) {
        const data = await response.json()
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
    
    // Remove book parameter from URL
    router.push('/browse')
  }

  const rateBook = async (book: Book, rating: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      await fetch('https://bookquest-f7t2.onrender.com/api/rate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: book.title, rating })
      })
      setUserRating(rating)
    } catch (err) {
      console.error('Error rating book:', err)
    }
  }


  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
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
            <p className="mt-4 text-slate-600 dark:text-slate-300">Loading amazing books...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header Section */}
      <header className="relative overflow-hidden py-16 md:py-20 lg:py-24">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-100/30 to-purple-100/30 dark:from-indigo-900/20 dark:to-purple-900/20"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob dark:bg-indigo-800/20"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/30 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000 dark:bg-purple-800/20"></div>
        
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-6">
              Browse Our Library
            </h1>
            
            <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-6"></div>
            
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
              Discover curated collections and hidden gems in our extensive library
            </p>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-2xl mx-auto">
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{popularBooks.length + randomBooks.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Total Books</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">{popularBooks.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Popular Titles</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 mb-1">{randomBooks.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Hidden Gems</div>
              </div>
              <div className="text-center bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{favorites.length}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Your Favorites</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-16">
        {/* Genre Filter Section */}
        <section className="mb-12">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 dark:border-slate-700/50">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Filter by Genre</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleGenreChange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  selectedGenre === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                }`}
              >
                All Genres
              </button>
              {availableGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => handleGenreChange(genre)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    selectedGenre === genre
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Filtered Books Section */}
        {selectedGenre !== 'all' && filteredBooks.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full mr-3"></span>
                {selectedGenre} Books
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {filteredBooks.length} books found
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredBooks.map((book, index) => (
                <BookCard
                  key={`filtered-${index}`}
                  book={book}
                  isFavorite={favorites.some(fav => fav.title === book.title)}
                  onToggleFavorite={() => toggleFavorite(book)}
                  onViewDetails={() => openBookDetails(book)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Popular Books Section */}
        {selectedGenre === 'all' && (
          <section className="mb-16">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 flex items-center">
                  <span className="w-2 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full mr-3"></span>
                  Popular Books
                </h2>
                <p className="text-slate-600 dark:text-slate-400 ml-5">Highest rated books in our collection</p>
              </div>
            </div>
            
            {popularBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {popularBooks.map((book, index) => (
                  <BookCard
                    key={`popular-${index}`}
                    book={book}
                    isFavorite={favorites.some(fav => fav.title === book.title)}
                    onToggleFavorite={() => toggleFavorite(book)}
                    onViewDetails={() => openBookDetails(book)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-slate-500 dark:text-slate-400">No popular books found</p>
                <button 
                  onClick={fetchBooks}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </section>
        )}
        
     
        {selectedGenre === 'all' && (
          <section>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 flex items-center">
                  <span className="w-2 h-8 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full mr-3"></span>
                  Discover Something New
                </h2>
                <p className="text-slate-600 dark:text-slate-400 ml-5">Hidden gems and random discoveries</p>
              </div>
              <button 
                onClick={() => {
                  setLoading(true)
                  fetchBooks()
                }}
                className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300 border border-slate-300/50 dark:border-slate-600/50 hover:shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Discoveries
              </button>
            </div>
            
            {randomBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {randomBooks.map((book, index) => (
                  <BookCard
                    key={`random-${index}`}
                    book={book}
                    isFavorite={favorites.some(fav => fav.title === book.title)}
                    onToggleFavorite={() => toggleFavorite(book)}
                    onViewDetails={() => openBookDetails(book)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <div className="text-4xl mb-4">🎲</div>
                <p className="text-slate-500 dark:text-slate-400">No books found</p>
                <button 
                  onClick={fetchBooks}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <Modal
          book={selectedBook}
          bookDetails={bookDetails}
          loading={modalLoading}
          favorites={favorites}
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
      `}</style>
    </div>
  )
}

export default function Browse() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <BrowseContent />
    </Suspense>
  )
}
