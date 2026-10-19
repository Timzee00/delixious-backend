const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (value) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[value]));
const line = (value) => String(value ?? '').replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ').trim().slice(0,200);
function safeLink(raw) {
  try {
    const url = new URL(String(raw));
    return ['https:','http:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

export function renderTransactionalEmail(eventType, vars = {}) {
  const brand = 'Delixious';
  const name = line(vars.name) || 'there';
  const restaurant = line(vars.restaurant) || 'your restaurant';
  const order = line(vars.orderId).slice(0,8);
  let subject, intro, details, cta, ctaTitle;
  switch (eventType) {
    case 'staff_invitation':
      subject = `You are invited to join ${restaurant} on Delixious`;
      intro = `Hello ${name}, you have been invited to join the team at ${restaurant} as ${line(vars.role)}.`;
      details = 'This invitation is private, single-use and expires in seven days. Sign in with the email address that received this message, then accept the invitation.';
      cta = vars.inviteUrl; ctaTitle = 'Accept team invitation';
      break;
    case 'job_application_received':
      subject = `New job application at ${restaurant}`;
      intro = `Hello ${name}, a candidate has applied for the ${line(vars.jobTitle)} role at ${restaurant}.`;
      details = 'Review the application inside your private restaurant Hiring workspace. Applicant contact details are never included in notification emails.';
      cta = vars.hiringUrl; ctaTitle = 'Review applications';
      break;
    case 'job_application_confirmation':
      subject = `We received your application to ${restaurant}`;
      intro = `Hello ${name}, your application for ${line(vars.jobTitle)} at ${restaurant} has been received.`;
      details = 'The restaurant will contact shortlisted candidates directly. This message does not grant access to the restaurant staff system.';
      cta = vars.careersUrl; ctaTitle = 'View restaurant careers';
      break;
    case 'order_paid':
      subject = `Payment received for Delixious order #${order}`;
      intro = `Hello ${name}, we have received your payment for order #${order}.`;
      details = 'The restaurant still needs to accept and prepare your order. Track its progress in your Delixious account.';
      cta = vars.orderUrl; ctaTitle = 'Track your order';
      break;
    case 'restaurant_order_received':
      subject = `New paid order #${order} for ${restaurant}`;
      intro = `Hello ${name}, ${restaurant} received a new paid order #${order}.`;
      details = 'Open the restaurant order queue to accept and prepare it. Payment receipt alone does not mean the kitchen accepted the order.';
      cta = vars.dashboardUrl; ctaTitle = 'Open order queue';
      break;
    case 'order_accepted':
      subject = `Restaurant accepted your Delixious order #${order}`;
      intro = `Hello ${name}, the restaurant accepted your order #${order}.`;
      details = 'Watch for updates as your meal is prepared and dispatched.';
      cta = vars.orderUrl; ctaTitle = 'Track your order';
      break;
    case 'delivery_assigned':
      subject = `A rider is assigned to order #${order}`;
      intro = `Hello ${name}, your order #${order} has a delivery rider.`;
      details = 'You can follow the delivery status in Delixious. Share your handoff code only after receiving the food.';
      cta = vars.orderUrl; ctaTitle = 'Track delivery';
      break;
    default: throw new Error('Unsupported transactional email event.');
  }
  const href = safeLink(cta);
  const textContent = [intro, details, href ? `${ctaTitle}: ${href}` : '', 'Delixious transactional notification — not a marketing subscription.'].filter(Boolean).join('\n\n');
  const htmlContent = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
  <body style="background:#f7f6f4;margin:0;padding:24px;font-family:Arial,sans-serif;color:#202020">
  <main style="max-width:580px;margin:auto;background:#fff;border:1px solid #e8e5df;border-radius:16px;padding:28px">
  <div style="font-weight:800;font-size:24px;letter-spacing:-.5px">Delixious</div>
  <h1 style="font-size:22px;line-height:1.4;margin-top:25px">${esc(subject)}</h1>
  <p style="font-size:15px;line-height:1.7">${esc(intro)}</p>
  <p style="font-size:15px;line-height:1.7">${esc(details)}</p>
  ${href ? `<p style="margin:28px 0"><a style="background:#b83b28;color:white;padding:13px 20px;border-radius:9px;text-decoration:none;display:inline-block" href="${esc(href)}">${esc(ctaTitle)}</a></p>` : ''}
  <hr style="border:0;border-top:1px solid #ece9e4;margin:25px 0">
  <p style="font-size:12px;color:#696969;line-height:1.6">This is an essential account or order notification from ${brand}, not a promotional email. If you did not expect it, you can ignore this message or contact Delixious support.</p>
  </main></body></html>`;
  return { subject: subject.slice(0,220), htmlContent, textContent };
}
