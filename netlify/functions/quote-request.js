// netlify/functions/quote-request.js
export async function handler(event) {
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
      postcode,      // handyman
      service,       // handyman service name
      date,
      message,

      // removals-specific fields
      from,
      to,
      moveSize,
      services,

      attachments = [],
      company,
    } = data;

    // Honeypot spam trap
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

    // Decide if this is handyman or removals based on fields present
    const isRemovals = !!(from || to || moveSize);
    const typeLabel = isRemovals ? 'Removal services' : 'Handyman services';

    // Simple reference for tracking
    const reference = 'ET-' + Date.now().toString().slice(-6);

    // Subject clearly shows type + reference
    const subject = `[${typeLabel}] Quote request ${reference} from ${
      fullName || 'Unknown'
    }`;

    let textBody;

    if (isRemovals) {
      textBody = `
Quote request from ET Services website

Reference: ${reference}
Type: ${typeLabel}

Name: ${fullName || '-'}
Email: ${email || '-'}
Phone: ${phone || '-'}

Moving date: ${date || 'Not specified'}

From: ${from || '-'}
To: ${to || '-'}

Move size: ${moveSize || '-'}
Services requested: ${services || '-'}

Details:
${message || '(no additional details)'}
      `.trim();
    } else {
      textBody = `
Quote request from ET Services website

Reference: ${reference}
Type: ${typeLabel}

Name: ${fullName || '-'}
Email: ${email || '-'}
Phone: ${phone || '-'}

Postcode: ${postcode || '-'}
Service requested: ${service || '-'}

Preferred date: ${date || 'Not specified'}

Message:
${message || '(no message)'}
      `.trim();
    }

    const payload = {
      from: { email: fromEmail, name: 'ET Services Website' },
      to: [{ email: toEmail, name: 'ET Services' }],
      subject,
      text: textBody,
    };

    // Optional attachments (for handyman in future if needed)
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
