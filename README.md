# Jornasa Frontend

Frontend React + Vite do Jornasa.

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`.

## Supabase + RLS

1. Crie o projeto no Supabase.
2. Execute `supabase/rls.sql` no SQL Editor.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.
4. Mantenha `VITE_USE_LOCAL_STORE=0` para usar backend real com autenticação.

Guia detalhado: `supabase/SETUP.md`.

## Segurança

- Não exponha segredos de provedores de IA no frontend.
- Nunca use `VITE_*` para chaves privadas (Groq/OpenAI etc.).
- Mantenha esses segredos apenas no backend (Vercel Function/Worker).

## Build

```bash
npm run build
npm run preview
```
