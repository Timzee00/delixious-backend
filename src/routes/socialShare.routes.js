import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
function safeImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}
const base = () => (process.env.FRONTEND_URL || 'https://delixious.netlify.app').replace(/\/$/, '');
function sendCard(res, { title, description, image, sharePath, destination }) {
  const publicBase = base();
  const previewUrl = `${publicBase}${sharePath}`;
  const destinationUrl = `${publicBase}${destination}`;
  const hero = safeImage(image);
  const tags = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${esc(title)} | Delixious</title>`,
    `<meta name="description" content="${esc(description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="Delixious">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(previewUrl)}">`,
    `<meta name="twitter:card" content="${hero ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    ...(hero ? [
      `<meta property="og:image" content="${esc(hero)}">`,
      `<meta name="twitter:image" content="${esc(hero)}">`,
    ] : []),
    `<link rel="canonical" href="${esc(destinationUrl)}">`,
    `<meta http-equiv="refresh" content="0;url=${esc(destinationUrl)}">`,
    '</head><body>',
    `<h1>${esc(title)}</h1><p>${esc(description)}</p>`,
    `<p><a href="${esc(destinationUrl)}">View on Delixious</a></p>`,
    '</body></html>',
  ].join('\n');
  res.set('Cache-Control', 'public, max-age=300');
  res.type('html').send(tags);
}

router.get('/restaurants/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('restaurants')
      .select('id,name,description,cuisine_type,address,cover_image_url,logo_url')
      .eq('id', req.params.id).eq('approval_status', 'approved').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).send('Restaurant not found');
    sendCard(res, {
      title: data.name,
      description: [data.description || `Discover ${data.cuisine_type || 'great'} food`, data.address]
        .filter(Boolean).join(' · ').slice(0, 300),
      image: data.cover_image_url || data.logo_url,
      sharePath: `/share/restaurants/${encodeURIComponent(data.id)}`,
      destination: `/restaurants/${encodeURIComponent(data.id)}`,
    });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('restaurant_jobs')
      .select('id,title,location,job_type,restaurant_id,restaurants!inner(name,cover_image_url,logo_url,approval_status)')
      .eq('id', req.params.id).eq('published', true)
      .eq('restaurants.approval_status','approved').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).send('Vacancy not found');
    sendCard(res, {
      title: `${data.title} at ${data.restaurants.name}`,
      description: `${data.location} · ${data.job_type.replace(/_/g, ' ')} · Apply on Delixious`,
      image: data.restaurants.cover_image_url || data.restaurants.logo_url,
      sharePath: `/share/jobs/${encodeURIComponent(data.id)}`,
      destination: `/restaurants/${encodeURIComponent(data.restaurant_id)}/careers?job=${encodeURIComponent(data.id)}`,
    });
  } catch (err) { next(err); }
});
export default router;
