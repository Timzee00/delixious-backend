import { useState } from 'react';

const FAQS = [
  {
    q: 'How do I track my order?',
    a: 'Once a restaurant confirms your order, you can track its status in real time from the Orders page - from preparation, to pickup, to delivery.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'Delixious accepts card and bank payments through Paystack, covering all major Nigerian banks and cards.',
  },
  {
    q: 'Can I cancel an order after placing it?',
    a: 'Yes, as long as the restaurant has not started preparing it yet. See our Refund & Cancellation Policy for full details.',
  },
  {
    q: 'How do I become a restaurant partner?',
    a: 'Sign up and select "Sell food" during registration. Your account will go through a short approval process before you can start receiving orders.',
  },
  {
    q: 'How do I become a delivery rider?',
    a: 'Sign up and select "Deliver orders" during registration. You will be able to claim available deliveries once your account is approved.',
  },
  {
    q: 'What if my order arrives wrong or incomplete?',
    a: 'Contact us through the Contact page within 24 hours with your order number, and we will work with the restaurant to make it right.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Frequently Asked Questions</h1>

      <div className="mt-8 divide-y divide-hairline border-y border-hairline">
        {FAQS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-medium text-ink">{item.q}</span>
                <span className="ml-4 text-ink-soft">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <p className="pb-4 leading-relaxed text-ink-soft">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
