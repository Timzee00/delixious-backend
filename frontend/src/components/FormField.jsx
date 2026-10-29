/**
 * Shared label+input (or label+textarea) used by every form in the app.
 * Replaces five near-identical local `Field` components that used to be
 * redefined in Login.jsx, Signup.jsx, Profile.jsx,
 * RestaurantProfileSection.jsx, and MenuManagementSection.jsx.
 */
export default function FormField({
  label,
  type = 'text',
  as = 'input',
  value,
  onChange,
  required = false,
  placeholder,
  rows = 3,
}) {
  const sharedClassName =
    'w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-ink placeholder:text-ink-soft/60 focus:border-pepper';

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {as === 'textarea' ? (
        <textarea
          value={value}
          required={required}
          placeholder={placeholder}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={sharedClassName}
        />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={sharedClassName}
        />
      )}
    </label>
  );
}
