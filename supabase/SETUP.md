# Supabase Setup (Jornasa)

1. Crie um projeto no Supabase.
2. No SQL Editor, execute `supabase/rls.sql` inteiro.
3. Em `Authentication > Providers`, habilite Email/Password.
4. Opcional: habilite Google e configure `VITE_GOOGLE_CLIENT_ID`.
5. Crie um `.env` na raiz com base em `.env.example`.
6. Garanta `VITE_USE_LOCAL_STORE=0`.
7. Rode `npm run dev`.

## Validação rápida

1. Cadastre um usuário novo no frontend.
2. Crie uma pauta e confirme no painel do Supabase (`public.pautas`).
3. Faça login com outro usuário e confirme que os dados do primeiro não aparecem.
4. No SQL Editor, tente um `select * from public.pautas;` com role anon/authenticated e confirme que o RLS está bloqueando dados de outros usuários.

## Observação

O frontend envia token do usuário autenticado no header `Authorization: Bearer <jwt>` para os endpoints do Worker.
Esses endpoints devem validar o JWT e operar no banco respeitando o `auth.uid()` para que as políticas RLS tenham efeito.
