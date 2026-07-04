import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MsgNexus.AI",
  description: "Unify all your messaging • Semantic search anywhere • AI that spots bills, subs & shopping automatically",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MsgNexus",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Theme initialization script - runs before interactive to prevent FOUC and avoid React <script> warning */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function() {
            try {
              var stored = localStorage.getItem('msgnexus-theme');
              var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var theme = stored || (prefersDark ? 'dark' : 'light');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              // Store system choice explicitly if no stored value (for toggle to know)
              if (!stored) {
                document.documentElement.setAttribute('data-theme', theme);
              }
            } catch (_) {}
          })();`}
        </Script>

        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
