// logger.js
// Dependência: supabaseClient.js (exportando `supabase`)
import { supabase } from './supabaseClient.js';

/**
 * Insere/atualiza (upsert) um profile com id = uid.
 * Retorna o profile criado/atualizado.
 */
export async function createOrUpdateProfile(uid, { email, nome = null, data_nascimento = null }) {
  if (!uid) throw new Error('UID obrigatório para criar o profile.');

  const profile = {
    id: uid,
    email,
    nome,
    data_nascimento,
    role: 'user'
  };

  // upsert: se já existir com o mesmo id, atualiza; se não, insere.
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir/upsert profile:', error);
    throw error;
  }

  return data;
}

/**
 * Busca profile existente (ou null se não existir).
 */
export async function getProfile(uid) {
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar profile:', error);
    throw error;
  }
  return data;
}

/**
 * SIGN UP: cria user no Auth. Se o Auth já retornar o user (sem confirmação),
 * cria o profile imediatamente. Caso contrário, retorna { needsConfirm: true }.
 */
export async function signUpAndCreateProfile({ email, password, nome = null, data_nascimento = null }) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('Erro no signUp:', error);
    throw error;
  }

  const user = data?.user ?? null;

  if (user) {
    // cria ou atualiza profile (id = user.id)
    const profile = await createOrUpdateProfile(user.id, { email, nome, data_nascimento });
    return { user, profile };
  }

  // Se user não retornado, normalmente precisa confirmar e-mail.
  return { needsConfirm: true };
}

/**
 * SIGN IN: faz login e garante que um profile exista (cria se necessário).
 * Retorna { user, profile }.
 */
export async function signIn({ email, password }) {
  // supabase-js v2 usa signInWithPassword
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Erro no signIn:', error);
    throw error;
  }

  const user = data?.user ?? null;
  if (!user) {
    return { needsAction: true };
  }

  // garante profile
  let profile = await getProfile(user.id);
  if (!profile) {
    profile = await createOrUpdateProfile(user.id, { email: user.email, nome: null, data_nascimento: null });
  }

  return { user, profile };
}

/**
 * SIGN OUT
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Erro ao deslogar:', error);
    throw error;
  }
  return true;
}

export function initAuthListener() {
  // onAuthStateChange recebe (event, session)
  const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      if (session?.user) {
        const user = session.user;
        const profile = await getProfile(user.id);
        if (!profile) {
          await createOrUpdateProfile(user.id, { email: user.email, nome: null, data_nascimento: null });
          console.log('Profile criado via listener para:', user.id);
        }
      }
    } catch (err) {
      console.error('Erro no auth listener:', err);
    }
  });

  return subscription;
}
