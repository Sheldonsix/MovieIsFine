import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MovieIsFine",
  description: "Movie is all you need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen flex flex-col">
            <header className="p-4 flex justify-between items-center max-w-7xl mx-auto w-full">
              <h1 className="text-2xl font-bold">MovieIsFine</h1>
              <ThemeToggle />
            </header>
            <main className="flex-1 w-full max-w-7xl mx-auto p-4">
              {children}
            </main>
            <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} MovieIsFine
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
