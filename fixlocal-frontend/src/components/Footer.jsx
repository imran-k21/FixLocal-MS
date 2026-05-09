import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="animate-aurora relative mt-14 overflow-hidden border-t border-white/20 bg-gradient-to-r from-[#020617] via-[#1e1b4b] to-[#0f172a] text-white">
      <div className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-cyan-400/25 blur-3xl animate-soft-float" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-52 w-52 rounded-full bg-fuchsia-500/20 blur-3xl animate-soft-float-delayed" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="stagger-children relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <img src="/logo.png" alt="FixLocal" className="mb-2 h-14 drop-shadow-2xl" />
          <p className="mt-3 text-sm text-white/70">
            India’s trusted marketplace for booking vetted tradespersons. Built by FixLocal for local neighborhoods.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">Discover</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link className="transition hover:text-white" to="/search?city=Bengaluru&service=Electrician">Electricians</Link></li>
            <li><Link className="transition hover:text-white" to="/search?city=Bengaluru&service=Plumber">Plumbers</Link></li>
            <li><Link className="transition hover:text-white" to="/search?city=Bengaluru&service=Cleaning">Cleaning pros</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-violet-200">For trades</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link className="transition hover:text-white" to="/register">Join FixLocal</Link></li>
            <li><Link className="transition hover:text-white" to="/dashboard/tradesperson">Tradesperson Console</Link></li>
            <li><Link className="transition hover:text-white" to="/dashboard/tradesperson/ratings">Reviews</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-fuchsia-200">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><a href="mailto:support@fixlocal.example">support@fixlocal.example</a></li>
            <li>+91 99887 66554</li>
            <li>Mon–Sat, 9am–7pm IST</li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 px-4 py-4 text-center text-xs text-white/70 sm:px-6 md:flex-row md:items-center md:justify-between md:text-left">
          <p>© {new Date().getFullYear()} FixLocal. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end">
            <Link className="transition hover:text-white" to="/terms">Terms</Link>
            <Link className="transition hover:text-white" to="/privacy">Privacy</Link>
            <a className="transition hover:text-white" href="https://www.instagram.com" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;