import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { Geist, Geist_Mono } from "next/font/google";
import NavbarComponent from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono", 
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BookQuest",
  description: "Discover Your Next Favorite Read Using advanced machine learning, collaborative filtering, and genre analysis to recommend books perfectly matched to your taste.",
  icons: {
    icon: "/favicon.ico.png"
  }
};

// ✅ SUPER COOL Loading Component
export const BookQuestLoader = () => (
  <div className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-indigo-900 dark:to-purple-900 flex flex-col items-center justify-center overflow-hidden">
    
    {/* Floating Background Elements */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-indigo-200/30 to-purple-300/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-purple-200/30 to-pink-300/30 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
    </div>

    <div className="relative z-10 flex flex-col items-center">
      
      {/* Animated BookQuest Logo */}
      <div className="mb-8 relative">
        <div className="flex items-center gap-4">
          {/* Spinning Book Icon */}
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 rounded-2xl shadow-2xl flex items-center justify-center animate-spin">
              <svg 
                className="w-10 h-10 text-white" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M4 2v20l8-4 8 4V2H4zm2 2h12v14.5l-6-3-6 3V4z"/>
                <circle cx="12" cy="9" r="2" fill="currentColor"/>
              </svg>
            </div>
            {/* Orbiting Dots */}
            <div className="absolute inset-0 animate-spin" style={{animationDuration: '3s', animationDirection: 'reverse'}}>
              <div className="absolute -top-2 left-1/2 w-3 h-3 bg-yellow-400 rounded-full transform -translate-x-1/2 animate-bounce"></div>
              <div className="absolute top-1/2 -right-2 w-2 h-2 bg-pink-400 rounded-full transform -translate-y-1/2 animate-bounce" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute -bottom-2 left-1/2 w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2 animate-bounce" style={{animationDelay: '1s'}}></div>
              <div className="absolute top-1/2 -left-2 w-2 h-2 bg-blue-400 rounded-full transform -translate-y-1/2 animate-bounce" style={{animationDelay: '1.5s'}}></div>
            </div>
          </div>
          
          {/* Animated Text Logo */}
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent tracking-tight animate-pulse">
              BookQuest
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-[0.2em] -mt-1 animate-pulse" style={{animationDelay: '0.5s'}}>
              DISCOVER
            </p>
          </div>
        </div>
      </div>

      {/* Loading Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center space-x-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>

      {/* Loading Text with Typewriter Effect */}
      <div className="text-center mb-8">
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2 animate-pulse">
          Loading Your Literary Adventure...
        </p>
        <div className="flex items-center justify-center space-x-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="animate-pulse">Discovering</span>
          <div className="flex space-x-1">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce" style={{animationDelay: '0.1s'}}>.</span>
            <span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span>
          </div>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-30 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
      </div>
      
      {/* Loading Stats */}
      <div className="mt-8 grid grid-cols-3 gap-6 text-center">
        <div className="animate-pulse" style={{animationDelay: '0.5s'}}>
          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">270K+</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Books</div>
        </div>
        <div className="animate-pulse" style={{animationDelay: '1s'}}>
          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">50+</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Genres</div>
        </div>
        <div className="animate-pulse" style={{animationDelay: '1.5s'}}>
          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-red-600">AI</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Powered</div>
        </div>
      </div>
    </div>

    {/* Floating Books Animation */}
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce"
          style={{
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 2) * 60}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: '3s'
          }}
        >
          <div className="w-4 h-4 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-lg shadow-lg opacity-20 transform rotate-12">
            <svg className="w-full h-full p-2 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 2v20l8-4 8 4V2H4z"/>
            </svg>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ✅ CRITICAL: Root layout MUST return html > body structure
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <Suspense fallback={<BookQuestLoader />}>
            <NavbarComponent />
            {children}
            <Footer />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
