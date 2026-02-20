-- Jornasa - schema + RLS
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.pautas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'em-andamento', 'concluido')),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fontes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cargo text not null default '',
  contato text not null default '',
  categoria text not null default '',
  oficial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  conteudo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Conversa',
  preview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  content text not null,
  is_html boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text not null default '',
  data timestamptz not null default now(),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pautas_user_id_created_at on public.pautas(user_id, created_at desc);
create index if not exists idx_fontes_user_id_created_at on public.fontes(user_id, created_at desc);
create index if not exists idx_templates_user_id_created_at on public.templates(user_id, created_at desc);
create index if not exists idx_chat_conversas_user_id_created_at on public.chat_conversas(user_id, created_at desc);
create index if not exists idx_chat_mensagens_conversa_id_created_at on public.chat_mensagens(conversa_id, created_at asc);
create index if not exists idx_notificacoes_user_id_created_at on public.notificacoes(user_id, created_at desc);

-- Triggers de updated_at

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_pautas_updated_at') then
    create trigger trg_pautas_updated_at before update on public.pautas
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_fontes_updated_at') then
    create trigger trg_fontes_updated_at before update on public.fontes
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_templates_updated_at') then
    create trigger trg_templates_updated_at before update on public.templates
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_chat_conversas_updated_at') then
    create trigger trg_chat_conversas_updated_at before update on public.chat_conversas
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_chat_mensagens_updated_at') then
    create trigger trg_chat_mensagens_updated_at before update on public.chat_mensagens
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_notificacoes_updated_at') then
    create trigger trg_notificacoes_updated_at before update on public.notificacoes
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.pautas enable row level security;
alter table public.fontes enable row level security;
alter table public.templates enable row level security;
alter table public.chat_conversas enable row level security;
alter table public.chat_mensagens enable row level security;
alter table public.notificacoes enable row level security;

alter table public.pautas force row level security;
alter table public.fontes force row level security;
alter table public.templates force row level security;
alter table public.chat_conversas force row level security;
alter table public.chat_mensagens force row level security;
alter table public.notificacoes force row level security;

drop policy if exists "pautas_select_own" on public.pautas;
drop policy if exists "pautas_insert_own" on public.pautas;
drop policy if exists "pautas_update_own" on public.pautas;
drop policy if exists "pautas_delete_own" on public.pautas;
drop policy if exists "fontes_select_own" on public.fontes;
drop policy if exists "fontes_insert_own" on public.fontes;
drop policy if exists "fontes_update_own" on public.fontes;
drop policy if exists "fontes_delete_own" on public.fontes;
drop policy if exists "templates_select_own" on public.templates;
drop policy if exists "templates_insert_own" on public.templates;
drop policy if exists "templates_update_own" on public.templates;
drop policy if exists "templates_delete_own" on public.templates;
drop policy if exists "chat_conversas_select_own" on public.chat_conversas;
drop policy if exists "chat_conversas_insert_own" on public.chat_conversas;
drop policy if exists "chat_conversas_update_own" on public.chat_conversas;
drop policy if exists "chat_conversas_delete_own" on public.chat_conversas;
drop policy if exists "chat_mensagens_select_own" on public.chat_mensagens;
drop policy if exists "chat_mensagens_insert_own" on public.chat_mensagens;
drop policy if exists "chat_mensagens_update_own" on public.chat_mensagens;
drop policy if exists "chat_mensagens_delete_own" on public.chat_mensagens;
drop policy if exists "notificacoes_select_own" on public.notificacoes;
drop policy if exists "notificacoes_insert_own" on public.notificacoes;
drop policy if exists "notificacoes_update_own" on public.notificacoes;
drop policy if exists "notificacoes_delete_own" on public.notificacoes;

-- Pautas
create policy "pautas_select_own" on public.pautas
for select using (auth.uid() = user_id);

create policy "pautas_insert_own" on public.pautas
for insert with check (auth.uid() = user_id);

create policy "pautas_update_own" on public.pautas
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pautas_delete_own" on public.pautas
for delete using (auth.uid() = user_id);

-- Fontes
create policy "fontes_select_own" on public.fontes
for select using (auth.uid() = user_id);

create policy "fontes_insert_own" on public.fontes
for insert with check (auth.uid() = user_id);

create policy "fontes_update_own" on public.fontes
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "fontes_delete_own" on public.fontes
for delete using (auth.uid() = user_id);

-- Templates
create policy "templates_select_own" on public.templates
for select using (auth.uid() = user_id);

create policy "templates_insert_own" on public.templates
for insert with check (auth.uid() = user_id);

create policy "templates_update_own" on public.templates
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "templates_delete_own" on public.templates
for delete using (auth.uid() = user_id);

-- Conversas
create policy "chat_conversas_select_own" on public.chat_conversas
for select using (auth.uid() = user_id);

create policy "chat_conversas_insert_own" on public.chat_conversas
for insert with check (auth.uid() = user_id);

create policy "chat_conversas_update_own" on public.chat_conversas
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chat_conversas_delete_own" on public.chat_conversas
for delete using (auth.uid() = user_id);

-- Mensagens
create policy "chat_mensagens_select_own" on public.chat_mensagens
for select using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.chat_conversas c
    where c.id = conversa_id
      and c.user_id = auth.uid()
  )
);

create policy "chat_mensagens_insert_own" on public.chat_mensagens
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.chat_conversas c
    where c.id = conversa_id
      and c.user_id = auth.uid()
  )
);

create policy "chat_mensagens_update_own" on public.chat_mensagens
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chat_mensagens_delete_own" on public.chat_mensagens
for delete using (auth.uid() = user_id);

-- Notificações
create policy "notificacoes_select_own" on public.notificacoes
for select using (auth.uid() = user_id);

create policy "notificacoes_insert_own" on public.notificacoes
for insert with check (auth.uid() = user_id);

create policy "notificacoes_update_own" on public.notificacoes
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notificacoes_delete_own" on public.notificacoes
for delete using (auth.uid() = user_id);
