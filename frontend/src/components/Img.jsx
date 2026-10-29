/**
 * Renders an image inside a "frame" div (size/rounding/background passed
 * via frameClassName), falling back to a centered letter when there's no
 * image yet. Adds loading="lazy" + decoding="async" everywhere images
 * appear in the app - real, if small, bandwidth savings on any page with
 * more than a couple of images (restaurant grids, menus, cart).
 *
 * Consolidates a pattern that used to be hand-written in RestaurantCard,
 * MenuItemRow, Cart, Home (dish search results), and the dashboard.
 */
export default function Img({ src, alt = '', fallbackText, frameClassName, imgClassName = 'h-full w-full object-cover' }) {
  return (
    <div className={frameClassName}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className={imgClassName} />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-ink-soft/40">
          {fallbackText}
        </div>
      )}
    </div>
  );
}
