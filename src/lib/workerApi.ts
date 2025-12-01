import { apiFetch, type ApiFetchOptions } from './api';

type WithAuth = { token?: string | null };

export type PautaStatus = 'pendente' | 'em-andamento' | 'concluido';

export type PautaPayload = {
  titulo: string;
  descricao?: string;
  status?: PautaStatus;
  deadline?: string | null;
};

export type Pauta = PautaPayload & {
  id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type FontePayload = {
  nome: string;
  cargo?: string;
  contato?: string;
  categoria?: string;
  oficial?: boolean;
};

export type Fonte = FontePayload & {
  id: string;
  user_id?: string;
  created_at?: string;
};

export type TemplatePayload = {
  titulo: string;
  conteudo: string;
};

export type Template = TemplatePayload & {
  id: string;
  user_id?: string;
  created_at?: string;
};

export type ConversaPayload = {
  title?: string;
  preview?: string;
};

export type Conversa = ConversaPayload & {
  id: string;
  user_id?: string;
  created_at?: string;
};

export type ChatMessagePayload = {
  role: 'user' | 'bot';
  content: string;
  is_html?: boolean;
};

export type ChatMessage = ChatMessagePayload & {
  id: string;
  conversa_id?: string;
  created_at?: string;
};

export type NotificacaoPayload = {
  titulo: string;
  conteudo: string;
  lido?: boolean;
};

export type Notificacao = NotificacaoPayload & {
  id: string;
  user_id?: string;
  created_at?: string;
};

export type MensagemPayload = {
  mensagem: string;
  buscar_web?: boolean;
};

export type MensagemResponse = {
  resposta?: string;
  [key: string]: unknown;
};

const authOptions = (options?: WithAuth): ApiFetchOptions => ({
  token: options?.token ?? null,
});

export const workerApi = {
  listarPautas: (options?: WithAuth) => apiFetch<Pauta[]>('/pautas', authOptions(options)),
  criarPauta: (payload: PautaPayload, options?: WithAuth) =>
    apiFetch<Pauta>('/pautas', { ...authOptions(options), method: 'POST', body: payload }),
  atualizarPauta: (id: string, payload: PautaPayload, options?: WithAuth) =>
    apiFetch<Pauta>(`/pautas/${id}`, { ...authOptions(options), method: 'PUT', body: payload }),
  deletarPauta: (id: string, options?: WithAuth) =>
    apiFetch<void>(`/pautas/${id}`, { ...authOptions(options), method: 'DELETE' }),

  listarFontes: (options?: WithAuth) => apiFetch<Fonte[]>('/fontes', authOptions(options)),
  criarFonte: (payload: FontePayload, options?: WithAuth) =>
    apiFetch<Fonte>('/fontes', { ...authOptions(options), method: 'POST', body: payload }),
  atualizarFonte: (id: string, payload: FontePayload, options?: WithAuth) =>
    apiFetch<Fonte>(`/fontes/${id}`, { ...authOptions(options), method: 'PUT', body: payload }),
  deletarFonte: (id: string, options?: WithAuth) =>
    apiFetch<void>(`/fontes/${id}`, { ...authOptions(options), method: 'DELETE' }),

  listarTemplates: (options?: WithAuth) => apiFetch<Template[]>('/templates', authOptions(options)),
  criarTemplate: (payload: TemplatePayload, options?: WithAuth) =>
    apiFetch<Template>('/templates', { ...authOptions(options), method: 'POST', body: payload }),
  atualizarTemplate: (id: string, payload: TemplatePayload, options?: WithAuth) =>
    apiFetch<Template>(`/templates/${id}`, { ...authOptions(options), method: 'PUT', body: payload }),
  deletarTemplate: (id: string, options?: WithAuth) =>
    apiFetch<void>(`/templates/${id}`, { ...authOptions(options), method: 'DELETE' }),

  listarConversas: (options?: WithAuth) => apiFetch<Conversa[]>('/chat/conversas', authOptions(options)),
  criarConversa: (payload: ConversaPayload, options?: WithAuth) =>
    apiFetch<Conversa>('/chat/conversas', { ...authOptions(options), method: 'POST', body: payload }),
  deletarConversa: (id: string, options?: WithAuth) =>
    apiFetch<void>(`/chat/conversas/${id}`, { ...authOptions(options), method: 'DELETE' }),

  listarMensagens: (conversaId: string, options?: WithAuth) =>
    apiFetch<ChatMessage[]>(
      `/chat/mensagens?conversa_id=${encodeURIComponent(conversaId)}`,
      authOptions(options),
    ),
  criarMensagem: (conversaId: string, payload: ChatMessagePayload, options?: WithAuth) =>
    apiFetch<ChatMessage>(`/chat/mensagens?conversa_id=${encodeURIComponent(conversaId)}`, {
      ...authOptions(options),
      method: 'POST',
      body: payload,
    }),

  listarNotificacoes: (options?: WithAuth) =>
    apiFetch<Notificacao[]>('/notificacoes', authOptions(options)),
  criarNotificacao: (payload: NotificacaoPayload, options?: WithAuth) =>
    apiFetch<Notificacao>('/notificacoes', { ...authOptions(options), method: 'POST', body: payload }),
  atualizarNotificacao: (id: string, payload: NotificacaoPayload, options?: WithAuth) =>
    apiFetch<Notificacao>(`/notificacoes/${id}`, {
      ...authOptions(options),
      method: 'PUT',
      body: payload,
    }),
  deletarNotificacao: (id: string, options?: WithAuth) =>
    apiFetch<void>(`/notificacoes/${id}`, { ...authOptions(options), method: 'DELETE' }),

  enviarMensagem: (payload: MensagemPayload, options?: WithAuth) =>
    apiFetch<MensagemResponse>('/mensagem', { ...authOptions(options), method: 'POST', body: payload }),
};
