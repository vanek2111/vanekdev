(() => {
  const config = window.FORMA_SUPABASE_CONFIG || {};
  const publicKey = config.publicKey || config.publishableKey;
  const clientReady = Boolean(config.url && publicKey && window.supabase?.createClient);
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const db = clientReady ? window.supabase.createClient(config.url, publicKey) : null;
  const fail = error => { throw new Error(error?.message || 'Не удалось выполнить запрос.'); };
  const readBody = options => {
    if (!options?.body) return {};
    try { return JSON.parse(options.body); } catch { return {}; }
  };
  const dataOrFail = ({data,error}) => error ? fail(error) : data;

  async function signedUser() {
    const {data,error}=await db.auth.getUser();
    if (error) fail(error);
    return data.user;
  }
  async function publicUser(user) {
    const [{data:profile,error:profileError},{data:staff,error:staffError}]=await Promise.all([
      db.from('forma_profiles').select('full_name,phone').eq('id',user.id).maybeSingle(),
      db.from('forma_staff').select('role').eq('user_id',user.id).maybeSingle()
    ]);
    if (profileError) fail(profileError);
    if (staffError) fail(staffError);
    return {id:user.id,name:profile?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'',email:user.email||'',phone:profile?.phone||user.user_metadata?.phone||'',role:staff?.role||'customer'};
  }
  async function supabaseRequest(route,options={}) {
    const method=(options.method||'GET').toUpperCase();
    const input=readBody(options);
    if (route==='me' && method==='GET') {
      const user=await signedUser();
      return {authenticated:Boolean(user),user:user?await publicUser(user):null};
    }
    if (route==='register' && method==='POST') {
      const {data,error}=await db.auth.signUp({email:input.email,password:input.password,options:{data:{full_name:input.name,phone:input.phone}}});
      if (error) fail(error);
      return {user:data.user?await publicUser(data.user):null,session:data.session,confirmationRequired:Boolean(data.user&&!data.session)};
    }
    if (route==='login' && method==='POST') {
      const {data,error}=await db.auth.signInWithPassword({email:input.email,password:input.password});
      if (error) fail(error);
      return {user:await publicUser(data.user),session:data.session};
    }
    if (route==='logout' && method==='POST') return dataOrFail(await db.auth.signOut());
    if (route==='vehicles' && method==='GET') {
      const {data,error}=await db.from('forma_vehicles').select('*').order('created_at',{ascending:false});
      return {vehicles:dataOrFail({data,error})};
    }
    if (route==='vehicles' && method==='POST') {
      const user=await signedUser();
      if (!user) throw new Error('Войдите в личный кабинет.');
      const {data,error}=await db.from('forma_vehicles').insert({user_id:user.id,make:input.make,model:input.model||'',color:input.color||''}).select().single();
      return {vehicle:dataOrFail({data,error})};
    }
    if (route==='bookings' && method==='GET') {
      const {data,error}=await db.from('forma_bookings').select('*').order('created_at',{ascending:false});
      return {bookings:dataOrFail({data,error})};
    }
    if (route==='bookings' && method==='POST' && db) {
      const {data,error}=await db.functions.invoke('forma-booking',{body:input});
      if (error) {
        const responseBody=error.context?.body;
        if (responseBody) {
          try { const parsed=typeof responseBody==='string'?JSON.parse(responseBody):responseBody; if (parsed.error) throw new Error(parsed.error); } catch (parseError) { if (parseError instanceof Error && parseError.message!=='Unexpected end of JSON input') throw parseError; }
        }
        fail(error);
      }
      return {booking:data.booking};
    }
    if (route==='studio/bookings' && method==='GET') {
      const {data,error}=await db.from('forma_bookings').select('*').order('created_at',{ascending:false});
      return {bookings:dataOrFail({data,error})};
    }
    const statusMatch=route.match(/^studio\/bookings\/(.+)$/);
    if (statusMatch && method==='PATCH') {
      const {data,error}=await db.from('forma_bookings').update({status:input.status}).eq('public_id',decodeURIComponent(statusMatch[1])).select().single();
      return {booking:dataOrFail({data,error})};
    }
    throw new Error('Неизвестный запрос FORMA.');
  }
  async function api(route,options={}) {
    if (clientReady) return supabaseRequest(route,options);
    if (!localHost) throw new Error('Личный кабинет ещё не подключён к Supabase.');
    if (route==='bookings'&&(options.method||'GET').toUpperCase()==='POST') return localRequest(route,options);
    const response=await fetch(`./api/${route}`,{credentials:'same-origin',signal:AbortSignal.timeout(8000),...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error||'Не удалось выполнить запрос.');
    return data;
  }
  async function localRequest(route,options={}) {
    const response=await fetch(`./api/${route}`,{credentials:'same-origin',signal:AbortSignal.timeout(8000),...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if (!response.ok) {
      if(response.status===401&&route==='bookings'&&(options.method||'GET').toUpperCase()==='POST'){
        window.location.href=`account.html?next=booking`;
        throw new Error('Открываем личный кабинет для записи…');
      }
      throw new Error(data.error||'Не удалось выполнить запрос.');
    }
    return data;
  }
  window.formaData={api,clientReady,db};
})();
