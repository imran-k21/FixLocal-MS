function DashboardLayout({ title, subtitle, actions, children }) {
  return (
    <section className="space-y-5 sm:space-y-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-1 py-2 sm:px-2 sm:py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:py-4 lg:px-3">
        <div>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <main className="mx-auto w-full max-w-6xl px-1 pb-12 sm:px-2 sm:pb-14 lg:px-3 lg:pb-16">{children}</main>
    </section>
  );
}

export default DashboardLayout;