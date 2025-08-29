'use client'
import { Suspense } from 'react'
import BrowseContent from './BrowseContent'

export default function Browse() {
  return (
    <Suspense fallback={
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
    }>
      <BrowseContent />
    </Suspense>
  )
}
