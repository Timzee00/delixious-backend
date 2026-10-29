import { useEffect, useMemo, useState } from 'react';
import FoodCard from './FoodCard.jsx';

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={direction === 'left' ? 'm14.5 5-7 7 7 7' : 'm9.5 5 7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FeaturedCarousel({ items = [], onAdd, addingId }) {
  const slides = useMemo(() => items.filter(Boolean), [items]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [active, slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  if (!slides.length) return null;

  const current = slides[active];

  function previous() {
    setActive((value) => (value - 1 + slides.length) % slides.length);
  }

  function next() {
    setActive((value) => (value + 1) % slides.length);
  }

  return (
    <section
      aria-label="Featured dishes"
      className="ticket overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-pepper">Featured</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">What looks good right now</h2>
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previous}
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-paper text-ink-soft transition-colors hover:border-pepper hover:text-pepper"
              aria-label="Previous featured dish"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={next}
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-paper text-ink-soft transition-colors hover:border-pepper hover:text-pepper"
              aria-label="Next featured dish"
            >
              <ArrowIcon direction="right" />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="overflow-hidden rounded-2xl bg-ink">
          <FoodCard item={current} onAdd={onAdd} adding={addingId === current.id} />
        </div>

        <div className="flex flex-col justify-between rounded-2xl bg-sand p-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-pepper">Delixious pick</p>
            <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-ink">{current.name}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {current.description || 'A featured dish from one of the restaurants on Delixious.'}
            </p>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-xs text-ink-soft">
              <span>{current.restaurants?.name || 'Restaurant'}</span>
              <span>{active + 1} / {slides.length}</span>
            </div>
            {slides.length > 1 && (
              <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Featured dish slides">
                {slides.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === active}
                    aria-label={`Show featured dish ${index + 1}`}
                    onClick={() => setActive(index)}
                    className={`h-1.5 flex-1 rounded-full transition-opacity ${index === active ? 'bg-pepper opacity-100' : 'bg-ink-soft/20 opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] text-ink-soft/70">
              {paused ? 'Paused while you browse' : 'Auto-rotates every few seconds'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
