import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-hairline bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Company</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li><Link to="/about" className="hover:text-ink">About</Link></li>
              <li><Link to="/contact" className="hover:text-ink">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-ink">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li><Link to="/legal/terms" className="hover:text-ink">Terms of Service</Link></li>
              <li><Link to="/legal/privacy" className="hover:text-ink">Privacy Policy</Link></li>
              <li><Link to="/legal/cookies" className="hover:text-ink">Cookie Policy</Link></li>
              <li><Link to="/legal/refunds" className="hover:text-ink">Refunds</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-soft">© {year} Delixious. All rights reserved.</p>
      </div>
    </footer>
  );
}
