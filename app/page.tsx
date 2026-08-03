import { ThemeToggle } from '@/components/theme-toggle'

// Placeholder. Task 12 replaces this with the real landing / room picker.
// Deliberately sets no background so the body token from globals.css shows through.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-display text-[32px] leading-9 font-semibold tracking-[-0.02em]">
        hitchat
      </h1>
      <p className="text-graphite">
        Anonymous lab chat. Everything vanishes in 24 hours.
      </p>
      <ThemeToggle />
    </main>
  )
}
