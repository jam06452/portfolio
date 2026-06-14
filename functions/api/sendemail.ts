import { Resend } from 'resend';
import { userData } from '../../shared-data.js';

interface Env {
  RESEND_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  console.log('[sendemail] onRequestPost:start');
  try {
    // 1. Parse the incoming JSON body from your frontend script
    const { name, email, message } = await context.request.json() as any;
    console.log('[sendemail] onRequestPost:payload-parsed', {
      hasName: Boolean(name),
      hasEmail: Boolean(email),
      messageLength: typeof message === 'string' ? message.length : 0,
    });

    // 2. Initialize Resend with the secret variable from Cloudflare
    const resend = new Resend(context.env.RESEND_API_KEY);

    // 3. Dispatch the email payload
    const { data, error } = await resend.emails.send({
      from: `${name} <email@${userData.domain}>`,
      to: userData.email, // Where you want to receive the notifications
      replyTo: `${name} <${email}>`,
      subject: `New message from ${name}`,
      html: `
    <p><strong>Message:</strong> ${message}</p>
    <hr />
    <!-- Clicking this link inside your email client opens a direct response draft -->
    <p><a href="mailto:${email}?subject=Re: Your contact form submission">Click here to reply directly to ${name}</a></p>
  `,
    });

    if (error) {
      console.error('[sendemail] onRequestPost:send-failed', { error: error.message });
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    console.log('[sendemail] onRequestPost:send-success', { id: data?.id });
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { 'Content-Type': 'applications/json' },
    });

  } catch (err: any) {
    console.error('[sendemail] onRequestPost:exception', {
      error: err?.message || 'Internal Error',
    });
    return new Response(JSON.stringify({ error: err.message || 'Internal Error' }), { 
      status: 500 
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  console.log('[sendemail] onRequestOptions:start');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};