import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import { Geist, Geist_Mono } from "next/font/google";
import NavbarCompoment from "@/components/Navbar";
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
  description: "Discover Your Next Favorite Read  Using advanced machine learning, collaborative filtering, and genre analysis to recommend books perfectly matched to your taste.",
  icons:{
    icon:"/favicon.ico.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
     
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
      <AuthProvider>
      <NavbarCompoment/>
        {children}
        <Footer/>
      </AuthProvider>  
      </body>
    </html>
  );
}
