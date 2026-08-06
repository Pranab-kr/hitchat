import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

// Shared chrome for the two owner pages. Neither is linked from anywhere a student
// can see; the nav here exists so the owner can move between them.
export function OwnerShell({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            {/* design.md § Component notes: marigold as a 2px left border plus its 12%
                wash, label in ink. The all-marigold form measures 1.57:1 on paper. */}
            <span className="rounded-[4px] border-l-2 border-l-marigold bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] leading-4 tracking-[0.08em] text-ink">
              SUDO
            </span>
          </div>
          <h1 className="font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">{sub}</p>
        </div>
        <ThemeToggle />
      </div>

      <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline pb-3 font-mono text-[12px] leading-4 tracking-[0.02em]">
        <Link prefetch href="/sudo/structure" className="py-2 text-graphite hover:text-pen">
          structure
        </Link>
        <Link prefetch href="/sudo/admins" className="py-2 text-graphite hover:text-pen">
          admins
        </Link>
        <Link prefetch href="/" className="py-2 text-graphite hover:text-pen">
          rooms
        </Link>
      </nav>

      {children}
    </main>
  )
}

// `rule` at 12px measures 4.28:1 on the card in light mode, under the 4.5 floor, so it
// carries meaning as a border with the text in ink. Same fix as SudoForm's error.
export function FormError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 border-l-2 border-rule bg-rule/10 px-2 py-1.5 font-mono text-[12px] leading-4 tracking-[0.02em] text-ink"
    >
      {children}
    </p>
  )
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-2 border-l-2 border-pen bg-pen/10 px-2 py-1.5 font-mono text-[12px] leading-4 tracking-[0.02em] text-ink"
    >
      {children}
    </p>
  )
}

export function Field({
  id,
  name,
  label,
  ...rest
}: {
  id: string
  name: string
  label: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[12px] leading-4 font-medium tracking-[0.02em] text-graphite"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink"
        {...rest}
      />
    </div>
  )
}

export function SubmitButton({
  pending,
  children,
  variant = 'primary',
}: {
  pending: boolean
  children: React.ReactNode
  variant?: 'primary' | 'destructive'
}) {
  const styles =
    variant === 'primary'
      ? 'bg-pen text-paper hover:opacity-90'
      : 'border border-hairline text-rule hover:border-rule hover:bg-rule/10'

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-input px-4 py-2 text-[13px] leading-5 font-medium transition-opacity disabled:opacity-60 ${styles}`}
    >
      {pending ? 'Working…' : children}
    </button>
  )
}

export function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface px-5 py-5">
      <h2 className="text-[17px] leading-6 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
