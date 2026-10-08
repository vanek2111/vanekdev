import http from 'node:http';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.APP_BASE || '/vanekdev/detailing').replace(/\/$/, '') || '';
const PORT = Number(process.env.PORT || 8787);
const DB_FILE = process.env.FORMA_DB_PATH || path.join(ROOT, 'data', 'forma.sqlite');
const SESSION_DAYS = 7;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};

await mkdir(path.dirname(DB_FILE), {recursive:true});
const db = new DatabaseSync(DB_FILE);
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS vehicles (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 make TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 name TEXT NOT NULL, contact TEXT NOT NULL, vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
 vehicle_label TEXT NOT NULL DEFAULT '', service TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status, created_at DESC);`);

const statements = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT id,name,email,phone,role,created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)'),
  sessionUser: db.prepare('SELECT u.id,u.name,u.email,u.phone,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash=?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at<?'),
  listVehicles: db.prepare('SELECT id,make,model,color,created_at FROM vehicles WHERE user_id=? ORDER BY id DESC'),
  insertVehicle: db.prepare('INSERT INTO vehicles (user_id,make,model,color) VALUES (?,?,?,?)'),
  vehicleByOwner: db.prepare('SELECT id,make,model,color FROM vehicles WHERE id=? AND user_id=?'),
  insertBooking: db.prepare('INSERT INTO bookings (public_id,user_id,name,contact,vehicle_id,vehicle_label,service,message) VALUES (?,?,?,?,?,?,?,?)'),
  listUserBookings: db.prepare('SELECT b.public_id,b.vehicle_label,b.service,b.message,b.status,b.created_at,b.updated_at FROM bookings b WHERE b.user_id=? ORDER BY b.id DESC'),
  listStaffBookings: db.prepare('SELECT b.public_id,b.name,b.contact,b.vehicle_label,b.service,b.message,b.status,b.created_at,b.updated_at,u.email FROM bookings b LEFT JOIN users u ON u.id=b.user_id ORDER BY CASE b.status WHEN \'new\' THEN 0 WHEN \'confirmed\' THEN 1 WHEN \'in_progress\' THEN 2 WHEN \'ready\' THEN 3 ELSE 4 END,b.id DESC'),
  updateBooking: db.prepare('UPDATE bookings SET status=?,updated_at=CURRENT_TIMESTAMP WHERE public_id=?'),
  bookingById: db.prepare('SELECT public_id,status FROM bookings WHERE public_id=?')
};

const loginAttempts = new Map();
const json = (res, status, data, headers={}) => {
  const payload = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':payload.length,'Cache-Control':'no-store',...headers});
  res.end(payload);
};
const fail = (res, status, error) => json(res,status,{error});
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const clean = (value, max=240) => String(value ?? '').trim().slice(0,max);
const normalizeRuPhone = value => {
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.length===10)digits=`7${digits}`;
  if(digits.length===11&&digits[0]==='8')digits=`7${digits.slice(1)}`;
  return digits.length===11&&digits[0]==='7'?`+${digits}`:'';
};
const tokenDigest = token => createHash('sha256').update(token).digest('hex');
const baseCookiePath = BASE || '/';
const cookieOptions = `Path=${baseCookiePath}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
const clearCookie = `Path=${baseCookiePath}; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

async function readJson(req) {
  let raw='';
  for await (const chunk of req) { raw += chunk; if (raw.length > 65536) throw Object.assign(new Error('Слишком большой запрос.'),{status:413}); }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Проверьте формат отправленных данных.'),{status:400}); }
}
function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) { const [key,...rest]=cookie.trim().split('='); if (key===name) return decodeURIComponent(rest.join('=')); }
  return '';
}
function getUser(req) {
  const token=cookieValue(req,'forma_session');
  if (!token) return null;
  statements.deleteExpiredSessions.run(Date.now());
  return statements.sessionUser.get(tokenDigest(token),Date.now()) || null;
}
function setSession(userId) {
  const token=randomBytes(32).toString('base64url');
  const expires=Date.now()+SESSION_DAYS*86400000;
  statements.insertSession.run(tokenDigest(token),userId,expires);
  return token;
}
async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  const derived=await scrypt(password,salt,64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}
async function passwordMatches(password, encoded) {
  const [scheme,salt,hex]=String(encoded).split('$');
  if (scheme!=='scrypt' || !salt || !hex) return false;
  const actual=Buffer.from(await scrypt(password,salt,64));
  const expected=Buffer.from(hex,'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
async function notifyN8n(booking) {
  const endpoint=process.env.N8N_BOOKING_WEBHOOK;
  if (!endpoint) return;
  try {
    await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'booking.created',booking}),signal:AbortSignal.timeout(5000)});
  } catch { /* Saving the booking must not depend on notification delivery. */ }
}

async function api(req,res,url) {
  const route=url.pathname.slice(BASE.length) || '/';
  if (req.method==='GET' && route==='/api/me') {
    const user=getUser(req);
    return json(res,200,{authenticated:Boolean(user),user:user||null});
  }
  if (req.method==='POST' && route==='/api/register') {
    const input=await readJson(req);
    const name=clean(input.name,100), email=normalizeEmail(input.email), phone=normalizeRuPhone(input.phone), password=String(input.password||'');
    if (name.length<2 || !phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10 || password.length>200) return fail(res,400,'Проверьте имя, почту, российский номер телефона и пароль от 10 символов.');
    if (statements.userByEmail.get(email)) return fail(res,409,'Аккаунт с такой почтой уже существует. Войдите в него.');
    try {
      const passwordHash=await hashPassword(password);
      const result=statements.insertUser.run(name,email,phone,passwordHash);
      const token=setSession(Number(result.lastInsertRowid));
      return json(res,201,{user:statements.userById.get(Number(result.lastInsertRowid))},{'Set-Cookie':`forma_session=${encodeURIComponent(token)}; ${cookieOptions}`});
    } catch(error) {
      if (String(error.message).includes('UNIQUE')) return fail(res,409,'Аккаунт с такой почтой уже существует.');
      throw error;
    }
  }
  if (req.method==='POST' && route==='/api/login') {
    const remote=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'local').split(',')[0].trim();
    const now=Date.now(), attempts=loginAttempts.get(remote)||{count:0,until:now+15*60*1000};
    if (attempts.until<now) {attempts.count=0;attempts.until=now+15*60*1000;}
    if (attempts.count>=8) return fail(res,429,'Слишком много попыток. Подождите 15 минут.');
    const input=await readJson(req), email=normalizeEmail(input.email), password=String(input.password||'');
    const user=statements.userByEmail.get(email);
    if (!user || !(await passwordMatches(password,user.password_hash))) {
      attempts.count++;loginAttempts.set(remote,attempts);
      return fail(res,401,'Не удалось войти. Проверьте почту и пароль.');
    }
    loginAttempts.delete(remote);
    const token=setSession(user.id);
    return json(res,200,{user:statements.userById.get(user.id)},{'Set-Cookie':`forma_session=${encodeURIComponent(token)}; ${cookieOptions}`});
  }
  if (req.method==='POST' && route==='/api/logout') {
    const token=cookieValue(req,'forma_session'); if (token) statements.deleteSession.run(tokenDigest(token));
    return json(res,200,{ok:true},{'Set-Cookie':`forma_session=; ${clearCookie}`});
  }
  if (route.startsWith('/api/')) {
    const user=getUser(req);
    if (!user && !(req.method==='POST' && route==='/api/bookings')) return fail(res,401,'Войдите в личный кабинет.');
    if (req.method==='GET' && route==='/api/vehicles') return json(res,200,{vehicles:statements.listVehicles.all(user.id)});
    if (req.method==='POST' && route==='/api/vehicles') {
      const input=await readJson(req),make=clean(input.make,80),model=clean(input.model,80),color=clean(input.color,80);
      if (make.length<2) return fail(res,400,'Укажите марку и модель автомобиля.');
      const result=statements.insertVehicle.run(user.id,make,model,color);
      return json(res,201,{vehicle:{id:Number(result.lastInsertRowid),make,model,color}});
    }
    if (req.method==='GET' && route==='/api/bookings') return json(res,200,{bookings:statements.listUserBookings.all(user.id)});
    if (req.method==='POST' && route==='/api/bookings') {
      const input=await readJson(req),service=clean(input.service,120),message=clean(input.message,1500),contact=clean(input.contact,100)||clean(user?.phone,100),name=clean(input.name,100)||clean(user?.name,100);
      if (!name || contact.length<5 || service.length<3) return fail(res,400,'Укажите имя, телефон или Telegram и услугу.');
      let vehicleId=null,vehicleLabel=clean(input.car,160);
      if (user && input.vehicleId) {
        const vehicle=statements.vehicleByOwner.get(Number(input.vehicleId),user.id);
        if (!vehicle) return fail(res,400,'Выбранный автомобиль не найден в профиле.');
        vehicleId=vehicle.id;vehicleLabel=[vehicle.make,vehicle.model,vehicle.color].filter(Boolean).join(' · ');
      }
      const publicId=`F-${randomBytes(3).toString('hex').toUpperCase()}`;
      statements.insertBooking.run(publicId,user?.id||null,name,contact,vehicleId,vehicleLabel,service,message);
      const booking={number:publicId,name,contact,vehicle:vehicleLabel,service,message,status:'new',createdAt:new Date().toISOString()};
      void notifyN8n(booking);
      return json(res,201,{booking:{number:publicId,status:'new',service,vehicle:vehicleLabel,createdAt:booking.createdAt}});
    }
    if (['staff','owner'].includes(user?.role) && req.method==='GET' && route==='/api/studio/bookings') return json(res,200,{bookings:statements.listStaffBookings.all()});
    if (['staff','owner'].includes(user?.role) && req.method==='PATCH' && route.startsWith('/api/studio/bookings/')) {
      const publicId=decodeURIComponent(route.slice('/api/studio/bookings/'.length));
      const input=await readJson(req),status=String(input.status||'');
      if (!['confirmed','in_progress','ready','completed','cancelled'].includes(status)) return fail(res,400,'Недопустимый статус заказа.');
      if (!statements.bookingById.get(publicId)) return fail(res,404,'Заявка не найдена.');
      statements.updateBooking.run(status,publicId);
      return json(res,200,{booking:statements.bookingById.get(publicId)});
    }
    if (route.startsWith('/api/studio/')) return fail(res,['staff','owner'].includes(user?.role)?404:403,'Раздел доступен сотрудникам студии.');
    return fail(res,404,'Метод API не найден.');
  }
  return false;
}

async function serve(req,res) {
  const url=new URL(req.url,'http://localhost');
  if (url.pathname===BASE) {res.writeHead(308,{Location:`${BASE}/`});return res.end();}
  if (!url.pathname.startsWith(`${BASE}/`) && !(BASE==='' && url.pathname.startsWith('/'))) {res.writeHead(404);return res.end('Not found');}
  if (url.pathname.startsWith(`${BASE}/api/`)) {
    try { const handled=await api(req,res,url); if (handled!==false) return; }
    catch(error) { console.error('Request failed:',error.message); return fail(res,error.status||500,error.status?error.message:'Не удалось обработать запрос.'); }
  }
  if (req.method!=='GET' && req.method!=='HEAD') return fail(res,405,'Метод не поддерживается.');
  let relative=decodeURIComponent(url.pathname.slice(BASE.length)).replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative+='index.html';
  const full=path.resolve(ROOT,relative);
  if (!full.startsWith(`${ROOT}${path.sep}`)) {res.writeHead(403);return res.end('Forbidden');}
  try {
    const data=await readFile(full),type=MIME[path.extname(full).toLowerCase()]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':path.extname(full)==='.html'?'no-cache':'public, max-age=300'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Страница не найдена.');}
}

if (['promote','owner'].includes(process.argv[2])) {
  const email=normalizeEmail(process.argv[3]);
  if (!email) {console.error('Использование: node server.mjs owner email@example.com');process.exit(2);}
  const role=process.argv[2]==='owner'?'owner':'staff';
  const result=db.prepare('UPDATE users SET role=? WHERE email=?').run(role,email);
  if (!result.changes) {console.error('Аккаунт не найден. Сначала зарегистрируйте его на сайте.');process.exit(1);}
  console.log(`${role==='owner'?'Роль владельца':'Роль сотрудника'} назначена для указанного аккаунта.`);db.close();process.exit(0);
}

const server=http.createServer((req,res)=>void serve(req,res));
server.listen(PORT,'127.0.0.1',()=>console.log(`FORMA локально: http://127.0.0.1:${PORT}${BASE}/`));
