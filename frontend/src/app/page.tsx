'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';


const Home = dynamic(() => import('@/components/Home'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-slate-600 dark:text-slate-300 text-lg">Loading AI Recommendations...</p>
      </div>
    </div>
  )
});

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-300 text-lg">Initializing BookQuest...</p>
        </div>
      </div>
    );
  }

  return <Home />;
}
