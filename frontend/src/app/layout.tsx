import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '-0.3s'}}></div>
                  <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '-0.15s'}}></div>
                  <div className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce"></div>
                </div>
                <p className="mt-4 text-slate-600 dark:text-slate-300">Loading...</p>
              </div>
            </div>
          }>
            <NavbarComponent />
            {children}
            <Footer />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
