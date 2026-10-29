import { useParams, Link } from 'react-router-dom';
import { legalPages } from '../data/legalContent.js';

export default function LegalPage() {
  const { slug } = useParams();
  const page = legalPages[slug];

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Page not found</h1>
        <Link to="/" className="mt-4 inline-block text-pepper hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">{page.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">Last updated: {page.updated}</p>

      <div className="mt-8 space-y-8">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg font-semibold text-ink">{section.heading}</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
