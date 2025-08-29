import React, { useState, useEffect } from 'react'
import RecommendationChart from './RecommendationChart'

interface Book {
  title: string
  author: string
  rating: number
  image: string
  similarity?: number
  method?: string
  recommendationReason?: string
  keywords?: string[]
  recommendationFactors?: Array<{
    factor: string
    score: number
    color?: string
  }>
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
  imageLinks?: {
    thumbnail?: string
    smallThumbnail?: string
    small?: string
    medium?: string
    large?: string
    extraLarge?: string
  }
  categories?: string[]
  language?: string
  isbn?: string
  previewLink?: string
  infoLink?: string
  source?: string
  error?: string
}

interface ModalProps {
  book: Book
  bookDetails: BookDetails | null
  loading: boolean
  favorites: Book[]
  userRating: number
  onClose: () => void
  onToggleFavorite: () => void
  onRate: (rating: number) => void
}

export default function Modal({ 
  book, 
  bookDetails, 
  loading, 
  favorites, 
  userRating, 
  onClose, 
  onToggleFavorite, 
  onRate 
}: ModalProps) {
  const [imageError, setImageError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const isFavorite = favorites.some(fav => fav.title === book.title)

  // Close modal on Escape key press
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [onClose])

  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Generate recommendation factors if not provided
  const getRecommendationFactors = () => {
    if (book.recommendationFactors) {
      return book.recommendationFactors
    }

    // Generate based on available data
    const factors = []
    
    if (book.method === 'genre') {
      factors.push({ factor: 'Genre Match', score: 85, color: '#8B5CF6' })
      factors.push({ factor: 'Content Similarity', score: 72, color: '#06B6D4' })
      factors.push({ factor: 'User Preference', score: 68, color: '#10B981' })
    } else if (book.method === 'author') {
      factors.push({ factor: 'Author Match', score: 90, color: '#8B5CF6' })
      factors.push({ factor: 'Writing Style', score: 78, color: '#06B6D4' })
      factors.push({ factor: 'Genre Similarity', score: 65, color: '#10B981' })
    } else {
      factors.push({ factor: 'Content Match', score: Math.round((book.similarity || 0.75) * 100), color: '#8B5CF6' })
      factors.push({ factor: 'Genre Similarity', score: 75, color: '#06B6D4' })
      factors.push({ factor: 'User Preference', score: 68, color: '#10B981' })
      factors.push({ factor: 'Collaborative Filter', score: 60, color: '#F59E0B' })
    }

    return factors
  }

  const getBestAvailableImage = () => {
    if (imageError) return null
    
    const images = bookDetails?.imageLinks
    if (!images) return book.image || null
    
    return (
      images.extraLarge ||
      images.large ||
      images.medium ||
      images.small ||
      images.thumbnail ||
      images.smallThumbnail ||
      book.image ||
      null
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown'
    
    try {
      const date = new Date(dateString)
      return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const truncateDescription = (text: string, maxLength: number = 300) => {
    if (expanded || text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  const bookImage = getBestAvailableImage()
  const displayDescription = bookDetails?.description ? truncateDescription(bookDetails.description) : ''
  const showReadMore = bookDetails?.description && bookDetails.description.length > 300 && !expanded

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-gray-700" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-gray-900/50">
          <div className="flex-1 min-w-0">
            <h2 id="modal-title" className="text-3xl font-bold text-white mb-2 truncate">{book.title}</h2>
            <p className="text-gray-400 text-lg mb-4">{book.author}</p>
            
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onToggleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isFavorite 
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorite ? (
                  <>
                    <span className="text-red-500">❤️</span> Favorited
                  </>
                ) : (
                  <>
                    <span>🤍</span> Add to Favorites
                  </>
                )}
              </button>

              {/* Show Chart Button */}
              {book.method && (
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200"
                >
                  <span>📊</span>
                  {showChart ? 'Hide' : 'Show'} Recommendation Analysis
                </button>
              )}
              
              {/* Rating Stars */}
              <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-2 rounded-lg">
                <span className="text-sm text-gray-400">Your Rating:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => onRate(star)}
                      className={`text-2xl transition-all ${
                        star <= userRating 
                          ? 'text-yellow-400 transform scale-110' 
                          : 'text-gray-600 hover:text-yellow-300'
                      }`}
                      aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl font-light ml-4 flex-shrink-0 transition-colors p-1 rounded-full hover:bg-gray-700"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 space-y-6">
              <div className="animate-pulse flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-48 mx-auto">
                  <div className="w-48 h-72 bg-gray-700 rounded-xl"></div>
                </div>
                <div className="flex-1 space-y-5">
                  <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-700 rounded w-4/6"></div>
                    <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : bookDetails ? (
            <div className="p-6">
              {/* Recommendation Chart */}
              {showChart && book.method && (
                <div className="mb-8">
                  <RecommendationChart data={getRecommendationFactors()} />
                </div>
              )}

              {/* Recommendation Explanation Section */}
              {book.method && (
                <div className="mb-8 p-4 border-l-4 border-indigo-500 bg-indigo-900/20 rounded text-indigo-200">
                  <h3 className="mb-2 text-lg font-semibold text-indigo-400">
                    📍 Why this book was recommended
                  </h3>
                  <p className="mb-3">{book.recommendationReason || `Recommended based on ${book.method}`}</p>

                  {/* Confidence bar */}
                  {book.similarity !== undefined && (
                    <div className="mb-3">
                      <div className="text-sm mb-1">Overall Confidence: {(book.similarity * 100).toFixed(1)}%</div>
                      <div className="w-full h-3 bg-indigo-700 rounded">
                        <div
                          className="h-3 rounded bg-indigo-500 transition-all duration-500"
                          style={{ width: `${book.similarity * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {book.keywords && book.keywords.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Key Themes:</div>
                      <div className="flex flex-wrap gap-2">
                        {book.keywords.slice(0, 5).map((word, idx) => (
                          <span
                            key={idx}
                            className="bg-indigo-600/50 rounded px-2 py-1 text-xs select-none"
                            title={word}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-8 mb-8">
                {/* Book Cover */}
                <div className="flex-shrink-0 w-full md:w-48 mx-auto">
                  {bookImage ? (
                    <div className="relative group">
                      <img 
                        src={bookImage} 
                        alt={bookDetails.title}
                        className="w-48 h-72 object-cover rounded-xl shadow-2xl mx-auto transition-transform group-hover:scale-105"
                        onError={() => setImageError(true)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center">
                        <a 
                          href={bookDetails.previewLink || bookDetails.infoLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-white bg-blue-600/80 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
                        >
                          Preview Book
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 h-72 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center mx-auto border border-gray-600">
                      <span className="text-gray-400 text-center px-4">No Cover Available</span>
                    </div>
                  )}
                </div>
                
                {/* Book Info */}
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-gray-700">Book Details</h3>
                      <div className="space-y-3">
                        {bookDetails.authors && bookDetails.authors.length > 0 && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">Authors:</span> 
                            <span>{bookDetails.authors.join(', ')}</span>
                          </p>
                        )}
                        
                        {bookDetails.publisher && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">Publisher:</span> 
                            <span>{bookDetails.publisher}</span>
                          </p>
                        )}
                        
                        {bookDetails.publishedDate && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">Published:</span> 
                            <span>{formatDate(bookDetails.publishedDate)}</span>
                          </p>
                        )}
                        
                        {bookDetails.pageCount && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">Pages:</span> 
                            <span>{bookDetails.pageCount.toLocaleString()}</span>
                          </p>
                        )}
                        
                        {bookDetails.language && bookDetails.language !== 'Unknown' && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">Language:</span> 
                            <span className="capitalize">{bookDetails.language}</span>
                          </p>
                        )}
                        
                        {bookDetails.isbn && (
                          <p className="text-gray-300">
                            <span className="font-medium text-blue-400 mr-2">ISBN:</span> 
                            <span>{bookDetails.isbn}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-gray-700">Ratings & Categories</h3>
                      <div className="space-y-4">
                        {bookDetails.averageRating && (
                          <div className="flex items-center">
                            <span className="font-medium text-blue-400 mr-2">Google Rating:</span>
                            <div className="flex items-center">
                              <span className="text-yellow-400 mr-1">★</span>
                              <span className="text-white mr-2">{bookDetails.averageRating}/5</span>
                              {bookDetails.ratingsCount && (
                                <span className="text-gray-400 text-sm">({bookDetails.ratingsCount.toLocaleString()} reviews)</span>
                              )}
                            </div>
                          </div>
                        )}

                        {userRating > 0 && (
                          <div className="flex items-center">
                            <span className="font-medium text-blue-400 mr-2">Your Rating:</span>
                            <div className="flex items-center">
                              <span className="text-yellow-400 mr-1">★</span>
                              <span className="text-white">{userRating}/5</span>
                            </div>
                          </div>
                        )}
                        
                        {bookDetails.categories && bookDetails.categories.length > 0 && (
                          <div>
                            <span className="font-medium text-blue-400 mr-2">Categories:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {bookDetails.categories.slice(0, 4).map((category, index) => (
                                <span 
                                  key={index} 
                                  className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm border border-blue-500/30"
                                >
                                  {category}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {(bookDetails.previewLink || bookDetails.infoLink) && (
                          <div className="flex gap-3 pt-2">
                            {bookDetails.previewLink && (
                              <a 
                                href={bookDetails.previewLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                              >
                                <span>📖</span> Preview
                              </a>
                            )}
                            {bookDetails.infoLink && (
                              <a 
                                href={bookDetails.infoLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                              >
                                <span>🔗</span> More Info
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Description */}
              {bookDetails.description && (
                <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700">
                  <h3 className="text-xl font-semibold text-white mb-4">Description</h3>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 leading-relaxed">
                      {displayDescription}
                    </p>
                    {showReadMore && (
                      <button 
                        onClick={() => setExpanded(true)}
                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 font-medium"
                      >
                        Read more
                      </button>
                    )}
                  </div>
                  
                  {bookDetails.source && (
                    <p className="text-gray-500 text-sm mt-4 italic">
                      Source: {bookDetails.source}
                    </p>
                  )}
                </div>
              )}

              {/* Error handling */}
              {bookDetails.error && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 flex items-center gap-2">
                    <span>⚠️</span> {bookDetails.error}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center py-12">
              <div className="text-red-400 text-5xl mb-4">📚</div>
              <p className="text-red-400 text-lg font-medium">Could not load book details</p>
              <p className="text-gray-400 mt-2">The book may not be available in Google Books database.</p>
              <button 
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}
