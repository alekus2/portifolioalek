export async function insertProfileManual(supabase, { id, email, nome = null, data_nascimento = null, role = 'user' }) {
  if (!supabase) throw new Error('Supabase client required');
  if (!id) throw new Error('id (auth.uid) is required to insert profile');
  if (!email) throw new Error('email is required to insert profile');

  const row = {
    id,
    email: (email || '').toLowerCase(),
    nome: nome ?? null,
    data_nascimento: data_nascimento ?? null,
    role: role
  };

  // usamos insert (ou use upsert se preferir tolerância a duplicatas)
  const { data, error } = await supabase
    .from('profiles')
    .insert([row])
    .select()
    .single();

  if (error) {
    // propaga o erro para o caller tratar (p.ex. mostrar mensagem)
    const err = new Error(error.message || 'Failed to insert profile');
    err._supabase = error;
    throw err;
  }
  return data;
}

export async function upsertProfileById(supabase, { id, email, nome = null, data_nascimento = null, role = 'user' }) {
  if (!supabase) throw new Error('Supabase client required');
  if (!id) throw new Error('id required');
  const payload = { id, email: (email||'').toLowerCase(), nome, data_nascimento, role };
  const { data, error } = await supabase
    .from('profiles')
    .upsert([payload], { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    const err = new Error(error.message || 'Failed to upsert profile');
    err._supabase = error;
    throw err;
  }
  return data;
}
