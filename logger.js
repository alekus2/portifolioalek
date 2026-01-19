// logger.js
// Utilities para criar/upsertar profiles manualmente e integrar com onAuthStateChange.
// Todas as funções recebem o objeto `supabase` para evitar dependências globais.

export function savePendingProfile(email, { nome = null, data_nascimento = null } = {}) {
  if (!email) return;
  try {
    const key = 'pendingProfile_' + email.toLowerCase();
    localStorage.setItem(key, JSON.stringify({ nome, data_nascimento, email: email.toLowerCase() }));
  } catch (e) {
    console.warn('savePendingProfile failed', e);
  }
}

export function readPendingProfile(email) {
  if (!email) return null;
  try {
    const key = 'pendingProfile_' + email.toLowerCase();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearPendingProfile(email) {
  if (!email) return;
  try {
    const key = 'pendingProfile_' + email.toLowerCase();
    localStorage.removeItem(key);
  } catch (e) {}
}

/**
 * upsertProfile(supabase, profileObj)
 * profileObj deve conter pelo menos: { id, email, role:'user' } para ser compatível com RLS que exige id = auth.uid()
 * Retorna o objeto salvo (data) ou lança erro com detalhes.
 */
export async function upsertProfile(supabase, profileObj) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!profileObj || !profileObj.id) throw new Error('profileObj.id (uid) is required for upsertProfile');

  const payload = {
    id: profileObj.id,
    email: profileObj.email ?? null,
    nome: profileObj.nome ?? null,
    data_nascimento: profileObj.data_nascimento ?? null,
    role: profileObj.role ?? 'user',
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert([payload], { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    // lança o erro para o caller tratar; include context
    const err = new Error('upsertProfile failed: ' + (error.message || JSON.stringify(error)));
    err._supabase = error;
    throw err;
  }
  return data;
}

/**
 * createProfileAfterSignup(supabase, user, pendingFields)
 * Usar logo após signUp quando `user` foi retornado (fluxo sem confirmação).
 * pendingFields é opcional (nome, data_nascimento).
 */
export async function createProfileAfterSignup(supabase, user, pendingFields = {}) {
  if (!user || !user.id) throw new Error('user with id required');
  const profileObj = {
    id: user.id,
    email: (user.email || pendingFields.email || '').toLowerCase(),
    nome: pendingFields.nome ?? null,
    data_nascimento: pendingFields.data_nascimento ?? null,
    role: 'user'
  };
  return await upsertProfile(supabase, profileObj);
}

/**
 * initLoggerAuthListener(supabase)
 * Inicializa o onAuthStateChange e garante o profile quando a sessão aparece.
 * Também aplica campos pendentes salvos em localStorage (savePendingProfile).
 * Retorna o objeto { subscription } retornado por supabase.auth.onAuthStateChange
 */
export function initLoggerAuthListener(supabase) {
  if (!supabase) throw new Error('Supabase client is required');

  const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      if (!session?.user) return;
      const user = session.user;
      // tenta recuperar pendingProfile que pode ter sido salvo no signup
      try {
        const pending = readPendingProfile(user.email);
        if (pending && pending.email && pending.email.toLowerCase() === (user.email || '').toLowerCase()) {
          await upsertProfile(supabase, {
            id: user.id,
            email: user.email,
            nome: pending.nome,
            data_nascimento: pending.data_nascimento,
            role: 'user'
          });
          clearPendingProfile(user.email);
          console.log('logger: profile criado via pending profile for', user.id);
        } else {
          // garante profile mínimo com email/role
          await upsertProfile(supabase, { id: user.id, email: user.email, role: 'user' });
          console.log('logger: profile garantido para', user.id);
        }
      } catch (err) {
        console.warn('logger: erro ao garantir profile no listener', err);
      }

      // atualiza last_active (não obrigatório)
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id);
        if (error) console.warn('logger: error update last_active', error);
      } catch (e) {
        console.warn('logger: last_active update failed', e);
      }
    } catch (e) {
      console.error('logger: unexpected auth listener error', e);
    }
  });

  return subscription;
}
