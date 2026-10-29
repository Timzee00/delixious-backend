import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';
import ImagePicker from '../components/ImagePicker.jsx';

export default function Profile() {
  const { profile, user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateProfile({ full_name: fullName, phone, avatar_url: avatarUrl });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Your profile</h1>

      <form onSubmit={handleSubmit} className="ticket mt-6 space-y-4 p-6">
        <ImagePicker
          url={avatarUrl}
          category="avatar"
          shape="round"
          onUploaded={setAvatarUrl}
        />

        <FormField label="Full name" value={fullName} onChange={setFullName} required />
        <FormField label="Phone" value={phone} onChange={setPhone} type="tel" />

        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Email</span>
          <p className="rounded-lg border border-hairline bg-sand px-3 py-2 text-sm text-ink-soft">{user?.email}</p>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-ink">Account type</span>
          <p className="rounded-lg border border-hairline bg-sand px-3 py-2 text-sm capitalize text-ink-soft">
            {profile?.role?.replace(/_/g, ' ')}
          </p>
        </div>

        {message && (
          <p role="status" aria-live="polite" className="rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-pepper py-2.5 font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
