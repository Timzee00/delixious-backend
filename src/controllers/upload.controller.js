import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase.js';

const BUCKET = 'delixious-media';
const ALLOWED_CATEGORIES = ['logo', 'cover', 'menu-item', 'avatar'];

// Different upload types need different max dimensions - a cover photo can
// be much larger than an avatar thumbnail. Everything is re-encoded to
// WebP, which is typically 25-35% smaller than an equivalent-quality JPEG.
const MAX_WIDTH_BY_CATEGORY = {
  logo: 512,
  avatar: 512,
  'menu-item': 1000,
  cover: 1600,
};

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'No file uploaded. Send it as multipart/form-data under field "file".' });
    }

    const category = ALLOWED_CATEGORIES.includes(req.body.category) ? req.body.category : 'menu-item';
    const maxWidth = MAX_WIDTH_BY_CATEGORY[category];
    const path = `${category}/${req.user.id}-${uuidv4()}.webp`;

    let optimizedBuffer;
    try {
      optimizedBuffer = await sharp(req.file.buffer)
        .rotate() // auto-orient based on EXIF, then strip metadata below
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (sharpError) {
      return res.status(400).json({ error: 'That file could not be processed as an image.' });
    }

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, optimizedBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    res.status(201).json({ message: 'Image uploaded.', url: publicUrlData.publicUrl, path });
  } catch (err) {
    next(err);
  }
}
