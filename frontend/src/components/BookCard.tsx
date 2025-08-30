'use client';

import React, { useState, useEffect } from 'react'

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

interface BookCardProps {
  book: Book
  isFavorite: boolean
  onToggleFavorite: () => void
  onViewDetails: () => void
}

export default function BookCard({ book, isFavorite, onToggleFavorite, onViewDetails }: BookCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false) // ← SSR PROTECTION

  // SSR Protection
  useEffect(() => {
    setMounted(true)
  }, [])

  const shareBook = (book: Book) => {
    // SSR Guard for browser-only APIs
    if (typeof window === 'undefined') return

    const shareText = `📚 Check out "${book.title}" by ${book.author} - recommended by BookQuest!`
    const shareUrl = `${window.location.origin}/?search=${encodeURIComponent(book.title)}`
    
    if (navigator.share) {
      navigator.share({
        title: `BookQuest - ${book.title}`,
        text: shareText,
        url: shareUrl
      }).catch(console.error)
    } else {
      navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`)
        .then(() => {
          const toast = document.createElement('div')
          toast.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300'
          toast.textContent = '📋 Link copied to clipboard!'
          document.body.appendChild(toast)
          setTimeout(() => {
            toast.style.opacity = '0'
            setTimeout(() => document.body.removeChild(toast), 300)
          }, 2000)
        })
        .catch(() => alert('❌ Failed to copy link'))
    }
  }

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm animate-pulse">
        <div className="w-full h-52 bg-slate-300 dark:bg-slate-600 rounded-lg mb-4"></div>
        <div className="h-4 bg-slate-300 dark:bg-slate-600 rounded mb-2"></div>
        <div className="h-3 bg-slate-300 dark:bg-slate-600 rounded w-2/3"></div>
      </div>
    )
  }

  return (
    <div 
      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-5 rounded-xl border border-slate-200/70 dark:border-slate-700/50 transition-all duration-300 cursor-pointer relative group shadow-sm hover:shadow-xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: isHovered ? 'translateY(-8px) scale(1.03)' : 'none',
        boxShadow: isHovered 
          ? '0 20px 40px -12px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.1)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Favorite Heart - Top Right */}
      <button 
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        className="absolute top-3 right-3 z-10 transition-all duration-300 hover:scale-110"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <div className={`p-2 rounded-full backdrop-blur-sm transition-all duration-300 ${
          isFavorite 
            ? 'bg-pink-100/90 dark:bg-pink-900/40 shadow-md' 
            : 'bg-white/90 dark:bg-slate-700/90 shadow-sm hover:shadow-md'
        }`}>
          <svg 
            className={`w-5 h-5 transition-colors duration-300 ${
              isFavorite 
                ? 'text-pink-500 fill-current' 
                : 'text-slate-400 dark:text-slate-500 hover:text-pink-400'
            }`} 
            viewBox="0 0 24 24"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
      </button>

      {/* Enhanced Similarity Score - Top Left */}
      {book.similarity && (
        <div className="absolute top-3 z-20 left-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {Math.round((book.similarity || 0) * 100)}%
          </span>
        </div>
      )}

      <div onClick={onViewDetails} className="h-full flex flex-col">
        {/* Enhanced Book Cover */}
        <div className="relative w-full h-52 mb-4 overflow-hidden rounded-lg shadow-md">
          {book.image && !imageError && (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 dark:from-slate-700 dark:via-slate-600 dark:to-slate-500 rounded-lg animate-pulse flex items-center justify-center">
                  <div className="text-slate-400 dark:text-slate-500">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                </div>
              )}
              <img 
                src={book.image} 
                alt={book.title}
                className={`w-full h-full object-cover rounded-lg transition-all duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${isHovered ? 'scale-110' : 'scale-100'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true)
                  setImageLoaded(true)
                }}
              />
              <div className={`absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent rounded-lg transition-opacity duration-300 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`} />
            </>
          )}
          
          {(!book.image || imageError) && (
            <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 dark:from-slate-700 dark:via-slate-600 dark:to-slate-500 rounded-lg flex items-center justify-center">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <div className="text-5xl mb-2">📚</div>
                <div className="text-sm font-medium">No Cover Available</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Enhanced Book Details */}
        <div className="flex-grow flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 line-clamp-2 leading-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-300">
            {book.title}
          </h3>
          
          {book.author && book.author !== 'Unknown' && (
            <p className="text-slate-600 dark:text-slate-400 mb-3 text-sm font-medium">
              by <span className="text-slate-700 dark:text-slate-300">{book.author}</span>
            </p>
          )}

          {/* Recommendation Reason */}
          {book.recommendationReason && (
            <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                📍 {book.recommendationReason}
              </div>
            </div>
          )}
          
          {book.rating > 0 && (
            <div className="flex items-center mb-4 mt-auto">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => {
                  const filled = i < Math.floor(book.rating)
                  const partial = i === Math.floor(book.rating) && book.rating % 1 > 0
                  
                  return (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${filled ? 'fill-current' : 'stroke-current'}`}
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                    >
                      {filled ? (
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      ) : (
                        <>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                            fill={partial ? `url(#partialFill-${i})` : 'none'}
                          />
                          {partial && (
                            <defs>
                              <linearGradient id={`partialFill-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset={`${book.rating % 1 * 100}%`} stopColor="currentColor" />
                                <stop offset={`${book.rating % 1 * 100}%`} stopColor="transparent" />
                              </linearGradient>
                            </defs>
                          )}
                        </>
                      )}
                    </svg>
                  )
                })}
              </div>
              <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold ml-2 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                {book.rating.toFixed(1)}
              </span>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/30">
            <button 
              onClick={onViewDetails}
              className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-300 text-sm font-medium"
            >
              View details
              <svg 
                className="w-4 h-4 ml-1" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation()
                shareBook(book)
              }}
              className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all duration-300"
              aria-label="Share this book"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
