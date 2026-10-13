import { supabaseAdmin } from '../config/supabase.js';

async function checkOwner(restaurantId, req) {
  let q = supabaseAdmin.from('restaurants').select('id,name,owner_id,approval_status,logo_url,cover_image_url,description,address')
    .eq('id', restaurantId);
  if (req.profile.role !== 'admin') q = q.eq('owner_id', req.user.id);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublicCareers(req, res, next) {
  try {
    const { data: restaurant, error: re } = await supabaseAdmin.from('restaurants')
      .select('id,name,description,address,logo_url,cover_image_url')
      .eq('id', req.params.restaurantId).eq('approval_status', 'approved').maybeSingle();
    if (re) throw re;
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
    const { data, count, error } = await supabaseAdmin.from('restaurant_jobs')
      .select('id,title,description,location,job_type,created_at', { count: 'exact' })
      .eq('restaurant_id', restaurant.id).eq('published', true)
      .order('created_at', { ascending: false })
      .range((req.query.page - 1) * req.query.limit, req.query.page * req.query.limit - 1);
    if (error) throw error;
    res.json({ restaurant, jobs: data || [], total: count ?? 0, page: req.query.page, limit: req.query.limit });
  } catch (err) { next(err); }
}

export async function listOwnerJobs(req, res, next) {
  try {
    const restaurant = await checkOwner(req.params.restaurantId, req);
    if (!restaurant) return res.status(403).json({ error: 'Only the restaurant owner can manage vacancies.' });
    const { data, error } = await supabaseAdmin.from('restaurant_jobs')
      .select('id,title,description,location,job_type,published,created_at')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.set('Cache-Control', 'private, no-store');
    res.json({ jobs: data || [] });
  } catch (err) { next(err); }
}

export async function createOwnerJob(req, res, next) {
  try {
    const restaurant = await checkOwner(req.params.restaurantId, req);
    if (!restaurant) return res.status(403).json({ error: 'Only the owner can create vacancies.' });
    const { data, error } = await supabaseAdmin.from('restaurant_jobs')
      .insert({ ...req.body, restaurant_id: restaurant.id }).select().single();
    if (error) throw error;
    res.status(201).json({ job: data });
  } catch (err) { next(err); }
}

export async function updateOwnerJob(req, res, next) {
  try {
    const restaurant = await checkOwner(req.params.restaurantId, req);
    if (!restaurant) return res.status(403).json({ error: 'Only the owner can edit vacancies.' });
    const { data, error } = await supabaseAdmin.from('restaurant_jobs')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurant.id).eq('id', req.params.jobId)
      .select('id,title,description,location,job_type,published,created_at').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Vacancy not found.' });
    res.json({ job: data });
  } catch (err) { next(err); }
}

export async function submitJobApplication(req, res, next) {
  try {
    const { data: job, error: je } = await supabaseAdmin.from('restaurant_jobs')
      .select('id,restaurant_id,published,restaurants!inner(approval_status,owner_id)')
      .eq('id', req.params.jobId).eq('published', true).eq('restaurants.approval_status','approved')
      .maybeSingle();
    if (je) throw je;
    if (!job) return res.status(404).json({ error: 'This vacancy is no longer accepting applications.' });
    const { applicant_name, applicant_email, applicant_phone, cover_note } = req.body;
    const { error } = await supabaseAdmin.from('restaurant_job_applications').insert({
      job_id: job.id, applicant_name, applicant_email: applicant_email.toLowerCase(),
      applicant_phone: applicant_phone || null, cover_note, privacy_consent_at: new Date().toISOString(),
    });
    if (error) throw error;
    // Inform the owner, but keep applicant contact details inside the
    // authenticated hiring workspace rather than a push notification.
    await supabaseAdmin.from('notifications').insert({
      user_id: job.restaurants.owner_id,
      type: 'general',
      title: 'New restaurant job application',
      body: 'A new application was received for one of your published vacancies. Open Hiring to review it.',
    });
    // Application submission must not expose applicant identity in a response.
    res.status(201).json({ message: 'Application received. The restaurant will contact shortlisted candidates.' });
  } catch (err) { next(err); }
}

export async function listJobApplications(req, res, next) {
  try {
    const restaurant = await checkOwner(req.params.restaurantId, req);
    if (!restaurant) return res.status(403).json({ error: 'Only the owner can review applications.' });
    const { data: job, error: je } = await supabaseAdmin.from('restaurant_jobs')
      .select('id,title').eq('id', req.params.jobId).eq('restaurant_id', restaurant.id).maybeSingle();
    if (je) throw je;
    if (!job) return res.status(404).json({ error: 'Vacancy not found.' });
    const { data, count, error } = await supabaseAdmin.from('restaurant_job_applications')
      .select('id,applicant_name,applicant_email,applicant_phone,cover_note,status,created_at', { count: 'exact' })
      .eq('job_id', job.id).order('created_at', { ascending: false })
      .range((req.query.page - 1) * req.query.limit, req.query.page * req.query.limit - 1);
    if (error) throw error;
    res.set('Cache-Control','private, no-store');
    res.json({ applications: data || [], total: count ?? 0, job, page: req.query.page });
  } catch (err) { next(err); }
}

export async function updateJobApplication(req, res, next) {
  try {
    const restaurant = await checkOwner(req.params.restaurantId, req);
    if (!restaurant) return res.status(403).json({ error: 'Only the owner can review applications.' });
    const { data: job, error: je } = await supabaseAdmin.from('restaurant_jobs')
      .select('id').eq('restaurant_id', restaurant.id).eq('id', req.params.jobId).maybeSingle();
    if (je) throw je;
    if (!job) return res.status(404).json({ error: 'Vacancy not found.' });
    const { data, error } = await supabaseAdmin.from('restaurant_job_applications')
      .update({ status: req.body.status }).eq('job_id', job.id).eq('id', req.params.applicationId)
      .select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Application not found.' });
    res.json({ application: data });
  } catch (err) { next(err); }
}
