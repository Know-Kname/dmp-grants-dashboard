import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

// Environment variables (set via: supabase secrets set RESEND_API_KEY=re_xxxx)
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM_ADDRESS = 'payments@detroitmemorialpark.org';

interface ARRecord {
  id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
}

interface WebhookPayload {
  type: 'UPDATE';
  table: string;
  record: ARRecord;
  old_record: ARRecord;
}

serve(async (req: Request): Promise<Response> => {
  try {
    const payload: WebhookPayload = await req.json();
    const record = payload.record;

    // Only act on rows that just became overdue
    if (record.status !== 'overdue' || payload.old_record?.status === 'overdue') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    if (!record.customer_id) {
      return new Response(JSON.stringify({ error: 'no customer_id' }), { status: 200 });
    }

    // Fetch customer email via service role (bypasses RLS)
    const customerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?id=eq.${record.customer_id}&select=email,first_name,last_name`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    const customers = await customerRes.json();
    const customer = customers?.[0];

    if (!customer?.email) {
      return new Response(JSON.stringify({ skipped: 'no email on file' }), { status: 200 });
    }

    const firstName = customer.first_name ?? 'Valued Customer';
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(record.amount);

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [customer.email],
        subject: `Payment Overdue — Invoice ${record.invoice_number}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1a3d2b; padding: 24px 32px;">
              <h1 style="color: #c49a2c; margin: 0; font-size: 20px; letter-spacing: 0.05em;">
                DETROIT MEMORIAL PARK
              </h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">
                Payment Notice
              </p>
            </div>

            <div style="padding: 32px;">
              <p>Dear ${firstName},</p>

              <p>
                Our records indicate that a payment of <strong>${formattedAmount}</strong>
                for invoice <strong>${record.invoice_number}</strong> was due on
                <strong>${record.due_date}</strong> and has not yet been received.
              </p>

              <p>
                Please contact our office at your earliest convenience to arrange payment
                or discuss your account.
              </p>

              <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Invoice</td>
                  <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #eee; font-weight: 600;">${record.invoice_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; border-bottom: 1px solid #eee;">Amount Due</td>
                  <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #eee; font-weight: 600; color: #c0392b;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Due Date</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${record.due_date}</td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #666;">
                If you have already sent payment, please disregard this notice.
                We apologize for any inconvenience.
              </p>
            </div>

            <div style="background: #f5f5f5; padding: 20px 32px; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0;">Detroit Memorial Park Association</p>
              <p style="margin: 4px 0 0;">248-543-8090 · www.detroitmemorialpark.org</p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', errText);
      return new Response(JSON.stringify({ error: 'email send failed', detail: errText }), { status: 500 });
    }

    const result = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, resendId: result.id }), { status: 200 });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
