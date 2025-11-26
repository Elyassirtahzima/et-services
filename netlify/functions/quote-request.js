// netlify/functions/quote-request.js

export async function handler(event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    const {
      fullName,
      email,
      phone,
      postcode,
      service,      // generic service description (we use this for both forms)
      date,
      message,
      attachments = [],
      company,      // honeypot

      // in case we ever send raw removals fields directly
      from,
      to,
      moveSize,
      services,
    } = data;

    // 🕵️ Honeypot spam trap
    if (company) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, spam: true }),
      };
    }

    // 🔑 ENV VARS
    const apiKey = process.env.MAILERSEND_API_KEY;
    const fromEmail =
      process.env.MAILERSEND_FROM_EMAIL || 'info@et-services.co.uk';
    const toEmail =
      process.env.MAILERSEND_TO_EMAIL || 'info@et-services.co.uk';

    if (!apiKey) {
      console.error('MAILERSEND_API_KEY is missing');
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Server email is not configured. Please try again later.',
        }),
      };
    }

    // Try to build a helpful subject line
    const subjectBits = [];
    if (service) subjectBits.push(service);
    if (moveSize) subjectBits.push(moveSize);
    const subjectSuffix = subjectBits.length
      ? ` – ${subjectBits.join(' / ')}`
      : '';
    const subject = `New website quote request from ${fullName || 'Unknown'}${subjectSuffix}`;

    // Build email text body (includes both handyman + removals style fields)
    const textBody = `
New quote request from the ET Services website

Name: ${fullName || '-'}
Email: ${email || '-'}
Phone: ${phone || '-'}

Postcode: ${postcode || from || '-'}
Service: ${service || services || '-'}

Move details (if removals):
- From: ${from || '-'}
- To: ${to || '-'}
- Move size: ${moveSize || '-'}

Preferred date: ${date || 'Not specified'}

Message:
${message || '(no message)'}
    `.trim();

    const payload = {
      from: { email: fromEmail, name: 'ET Services Website' },
      to: [{ email: toEmail, name: 'ET Services' }],
      subject,
      text: textBody,
    };

    // Optional attachments (handyman photos)
    if (attachments.length) {
      payload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.base64,
        disposition: 'attachment',
        content_type: a.content_type || 'application/octet-stream',
      }));
    }

    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('MailerSend error:', errText);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send email via MailerSend.',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
}
