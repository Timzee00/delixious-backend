export default function Contact() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Contact Us</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Have a question about an order, a restaurant partnership, or anything else? Reach out and we'll get back to
        you as soon as we can.
      </p>

      <div className="mt-8 space-y-4 rounded-xl border border-hairline bg-paper p-6">
        <div>
          <p className="text-sm font-medium text-ink-soft">Email</p>
          <p className="text-ink">support@delixious.com</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink-soft">Cities Served</p>
          <p className="text-ink">Lagos · Abuja · Port Harcourt</p>
        </div>
      </div>
    </div>
  );
}
