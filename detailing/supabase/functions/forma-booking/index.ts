import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Content-Type': 'application/json' },
  });
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } });
  if (request.method !== 'POST') return reply({ error: 'Метод не поддерживается.' }, 405, origin);

  const allowedOrigins = (Deno.env.get('FORMA_ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) return reply({ error: 'Источник запроса не разрешён.' }, 403, origin);

  try {
    const body = await request.json();
    if (clean(body.website, 200)) return reply({ booking: { number: 'F-REQUESTED' } }, 200, origin);

    let name = clean(body.name, 100);
    let contact = clean(body.contact, 160);
    const service = clean(body.service, 120);
    const vehicleLabel = clean(body.car || body.vehicle_label, 240);
    const message = clean(body.message, 2000);
    if (name.length < 2 || contact.length < 5 || !service) {
      return reply({ error: 'Заполни имя и контакт, чтобы студия могла ответить.' }, 400, origin);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const publicKeys = [publishableKeys.default, Deno.env.get('SUPABASE_ANON_KEY')].filter(Boolean);
    if (!url || !secretKey || !publicKeys.length) throw new Error('Supabase function secrets are not configured.');

    const admin = createClient(url, secretKey, { auth: { persistSession: false } });
    const authorization = request.headers.get('Authorization') || '';
    let userId: string | null = null;
    if (authorization.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      if (!publicKeys.includes(token)) {
        const { data, error } = await admin.auth.getUser(token);
        if (error) return reply({ error: 'Сессия устарела. Войди в аккаунт и попробуй ещё раз.' }, 401, origin);
        userId = data.user.id;
      }
    }

    if (userId) {
      const { data: profile, error } = await admin.from('forma_profiles').select('full_name,phone').eq('id', userId).maybeSingle();
      if (error) throw error;
      name ||= profile?.full_name || '';
      contact ||= profile?.phone || '';
      if (name.length < 2 || contact.length < 5) return reply({ error: 'Добавь имя и телефон в профиль, чтобы оставить заявку.' }, 400, origin);
    }

    let vehicleId: string | null = null;
    if (body.vehicle_id) {
      if (!userId) return reply({ error: 'Войди в кабинет, чтобы выбрать автомобиль.' }, 401, origin);
      const { data: vehicle, error } = await admin.from('forma_vehicles').select('id,user_id').eq('id', body.vehicle_id).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!vehicle) return reply({ error: 'Не удалось найти выбранный автомобиль в профиле.' }, 400, origin);
      vehicleId = vehicle.id;
    }

    let email = '';
    if (userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) throw error;
      email = data.user.email || '';
    }
    const { data: booking, error: insertError } = await admin.from('forma_bookings').insert({
      user_id: userId,
      vehicle_id: vehicleId,
      vehicle_label: vehicleLabel,
      name,
      contact,
      email,
      service,
      message,
    }).select('public_id,created_at').single();
    if (insertError) throw insertError;

    const webhook = Deno.env.get('N8N_BOOKING_WEBHOOK');
    if (webhook) {
      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...booking, name, contact, email, service, car: vehicleLabel, message }),
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) console.error('n8n webhook returned', response.status);
      } catch (error) {
        console.error('n8n notification failed after booking was saved', error);
      }
    }

    return reply({ booking: { number: booking.public_id, created_at: booking.created_at } }, 201, origin);
  } catch (error) {
    console.error('Booking request failed', error);
    return reply({ error: 'Не удалось отправить запрос. Попробуй ещё раз чуть позже.' }, 500, origin);
  }
});
