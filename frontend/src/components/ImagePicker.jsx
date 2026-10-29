import { useState } from 'react';
import api from '../lib/api.js';

/**
 * Uploads an image via POST /api/uploads and reports the resulting URL back
 * to the parent. One implementation shared by restaurant logo/cover, menu
 * item photos, and profile avatars, instead of near-identical copies in
 * each of those places.
 */
export default function ImagePicker({ label, url, category, onUploaded, shape = 'square', size = 'h-20 w-20' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      const { data } = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data.url);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  }

  const roundedClass = shape === 'round' ? 'rounded-full' : 'rounded-lg';

  return (
    <div>
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      <div className={`${size} overflow-hidden bg-hairline ${roundedClass}`}>
        {url && <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
      </div>
      <label className="mt-1 inline-block cursor-pointer text-xs font-medium text-pepper hover:underline">
        {uploading ? 'Uploading...' : url ? 'Change' : 'Upload'}
        <input type="file" accept="image/*" onChange={handleChange} disabled={uploading} className="hidden" />
      </label>
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
