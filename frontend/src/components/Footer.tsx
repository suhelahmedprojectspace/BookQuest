import React from 'react'

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} BookQuest. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
