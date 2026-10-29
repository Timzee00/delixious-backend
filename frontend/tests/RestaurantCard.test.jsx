import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RestaurantCard from '../src/components/RestaurantCard.jsx';

const baseRestaurant = {
  id: 'r1',
  name: 'Mama Nkechi Kitchen',
  cuisine_type: 'Nigerian',
  is_open: true,
  rating_avg: 4.5,
  rating_count: 12,
  cover_image_url: null,
};

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <RestaurantCard restaurant={{ ...baseRestaurant, ...overrides }} />
    </MemoryRouter>
  );
}

describe('RestaurantCard', () => {
  it('renders the restaurant name and cuisine', () => {
    renderCard();
    expect(screen.getByText('Mama Nkechi Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Nigerian')).toBeInTheDocument();
  });

  it('shows an "Open" badge when is_open is true', () => {
    renderCard({ is_open: true });
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('shows a "Closed" badge when is_open is false', () => {
    renderCard({ is_open: false });
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('falls back to the first letter of the name when there is no cover image', () => {
    renderCard({ cover_image_url: null });
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('shows the rating when there are reviews', () => {
    renderCard({ rating_count: 12, rating_avg: 4.5 });
    expect(screen.getByText(/4\.5/)).toBeInTheDocument();
  });

  it('hides the rating when there are no reviews yet', () => {
    renderCard({ rating_count: 0 });
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });
});
