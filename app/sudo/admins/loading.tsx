function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-input bg-wash motion-reduce:animate-none ${className}`} />
}

export default function AdminsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12" aria-busy="true" aria-label="Loading admins">
      <Block className="h-4 w-12" />
      <Block className="mt-4 h-9 w-28" />
      <Block className="mt-2 h-5 w-64 max-w-full" />
      <div className="mt-8 space-y-6">
        {[0, 1].map((item) => (
          <section key={item} className="rounded-card border border-hairline bg-surface px-5 py-5">
            <Block className="h-6 w-32" />
            <Block className="mt-4 h-10 w-full" />
            <Block className="mt-3 h-8 w-24" />
          </section>
        ))}
      </div>
    </main>
  )
}
