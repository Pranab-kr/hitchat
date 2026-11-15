import { OwnerNav } from '@/components/admin/owner-nav'

// Shared chrome for the owner pages. None is linked from anywhere a student can see;
// the tab row here exists so the owner can move between them.
export function OwnerShell({
  title,
  sub,
  role,
  children,
}: {
  title: string
  sub: string
  role?: 'owner' | 'co_admin'
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-10 pb-24">
      <div className="rise mb-8">
        {/* design.md § Component notes: marigold as a 2px left border plus its 12%
            wash, label in ink. The all-marigold form measures 1.57:1 on paper. */}
        <span className="mb-3 inline-block rounded-[4px] border-l-2 border-l-marigold bg-marigold/12 px-1.5 py-0.5 font-mono text-[11px] leading-4 tracking-[0.08em] text-ink">
          SUDO
        </span>
        <h1 className="font-display text-[44px] leading-[48px] font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="mt-2 text-[17px] leading-7 text-graphite">{sub}</p>
      </div>

      <OwnerNav role={role} />

      <div className="rise" style={{ '--i': 1 } as React.CSSProperties}>
        {children}
      </div>
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
      className="drop mt-2 border-l-2 border-rule bg-rule/10 px-2 py-1.5 font-mono text-[12px] leading-4 tracking-[0.02em] text-ink"
    >
      {children}
    </p>
  )
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="drop mt-2 border-l-2 border-pen bg-pen/10 px-2 py-1.5 font-mono text-[12px] leading-4 tracking-[0.02em] text-ink"
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
        className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink transition-colors duration-150 placeholder:text-graphite/70 hover:border-graphite/50 focus:border-pen"
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
      ? 'bg-pen text-paper hover:brightness-110'
      : 'border border-hairline text-rule hover:border-rule hover:bg-rule/10'

  return (
    <button
      type="submit"
      disabled={pending}
      className={`press rounded-input px-4 py-2 text-[13px] leading-5 font-medium disabled:opacity-60 ${styles}`}
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
    <section className="rounded-card border border-hairline bg-surface px-6 py-6">
      <h2 className="text-[20px] leading-7 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
