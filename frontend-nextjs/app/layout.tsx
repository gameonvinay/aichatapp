import "@/globals.css"

export const metadata = {
  title: "AI Agents — Command Center",
  description: "Multi-agent AI orchestration with real-time streaming and tool execution",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
