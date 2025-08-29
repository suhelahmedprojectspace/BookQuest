'use client'
import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import dynamic from 'next/dynamic'

// Dynamically import word cloud to avoid SSR issues
const ReactWordcloud = dynamic(() => import('react-wordcloud'), { ssr: false })

interface VisualizationModalProps {
  book: any
  isOpen: boolean
  onClose: () => void
}

export default function VisualizationModal({ book, isOpen, onClose }: VisualizationModalProps) {
  const [activeTab, setActiveTab] = useState<'wordcloud' | 'similarity'>('wordcloud')
  
  const wordCloudData = book.keywords?.map((keyword: string, index: number) => ({
    text: keyword,
    value: Math.max(1, 10 - index)
  })) || []

  const similarityData = [
    { label: 'Genre Match', value: 85, color: '#8B5CF6' },
    { label: 'Author Style', value: 72, color: '#06B6D4' },  
    { label: 'Theme Similarity', value: 91, color: '#10B981' },
    { label: 'User Preference', value: 68, color: '#F59E0B' }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Why We Recommended This Book
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('wordcloud')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'wordcloud'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            🔤 Key Themes
          </button>
          <button
            onClick={() => setActiveTab('similarity')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'similarity'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📊 Match Analysis
          </button>
        </div>

        {/* Content */}
        {activeTab === 'wordcloud' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
              Common Themes & Keywords
            </h3>
            <div className="h-64 bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              {wordCloudData.length > 0 ? (
                <ReactWordcloud 
                  words={wordCloudData}
                  options={{
                    colors: ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'],
                    fontFamily: 'Inter',
                    fontSizes: [12, 32],
                    rotations: 2,
                    rotationAngles: [0, 90]
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No theme data available
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
              This word cloud shows the main themes and concepts that make this book similar to your interests.
            </p>
          </div>
        )}

        {activeTab === 'similarity' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">
              Recommendation Breakdown
            </h3>
            <div className="space-y-4">
              {similarityData.map((item) => (
                <div key={item.label} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {item.value}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${item.value}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                <strong>Overall Match: {Math.round((similarityData.reduce((acc, item) => acc + item.value, 0) / similarityData.length))}%</strong>
                <br />
                {book.recommendationReason?.details || 'This book matches your preferences based on multiple factors.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
