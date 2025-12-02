import React, { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react';
import officialSources from './officialSources.json';
import { Plus, Search, FileText, Users, BookOpen, User, Bell, Clock, Edit2, Trash2, X, MessageCircle, Copy as CopyIcon } from 'lucide-react';
import { listarPautas, criarPautaWorker, atualizarPautaWorker, deletarPautaWorker } from './services/pautasWorkerService';
import { listarFontes, criarFonteWorker, atualizarFonteWorker, deletarFonteWorker } from './services/fontesWorkerService';
import { listarTemplates, criarTemplateWorker, atualizarTemplateWorker, deletarTemplateWorker } from './services/templatesWorkerService';
import { listarConversas, criarConversaWorker, deletarConversaWorker, listarMensagens, criarMensagemWorker } from './services/chatWorkerService';
import { listarNotificacoes } from './services/notificationsWorkerService';
import { getTemplateMeta, upsertTemplateMeta, recordTemplateUsage, removeTemplateMeta } from './services/templateMetaStore';

const officialDomainSuffixes = [
  '.gov.br',
  '.mil.br',
  '.jus.br',
  '.leg.br',
  '.mp.br',
  '.edu.br',
  '.tc.br'
];
const USE_LOCAL_STORE = (import.meta.env.VITE_USE_LOCAL_STORE ?? '1') !== '0';
const getUserKey = (user) => user?.id || 'local-user';

// Base do backend publicado (ajuste VITE_ACOLHEIA_API_URL no .env para outro ambiente)
const ACOLHEIA_API_URL = import.meta.env.VITE_ACOLHEIA_API_URL || 'https://jornasa-worker.jornabot.workers.dev/mensagem';
const ACOLHEIA_API_KEY = import.meta.env.VITE_ACOLHEIA_KEY || '';

const stripHtml = (text = '') =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildTemplateContent = (titulo = '', texto = '', fonte = '') => {
  return `TÍTULO: ${titulo || ''}\n\nTEXTO: ${texto || ''}\n\nFONTE: ${fonte || ''}`.trimEnd();
};

const parseTemplateContent = (content = '') => {
  const pattern = /T[ÍI]TULO:\s*([\s\S]*?)(?:\n\s*\n)?TEXTO:\s*([\s\S]*?)(?:\n\s*\n)?FONTE:\s*([\s\S]*)/i;
  const match = content.match(pattern);
  if (!match) {
    return { templateTitulo: '', templateTexto: '', templateFonte: '' };
  }
  return {
    templateTitulo: match[1]?.trim() || '',
    templateTexto: match[2]?.trim() || '',
    templateFonte: match[3]?.trim() || '',
  };
};

const addProfessionalEmojis = (text = '') => {
  if (!text) return text;
  const rules = [
    { emoji: '✅', pattern: /\b(sucesso|feito|conclu[ií]do)\b/i },
    { emoji: '⚠️', pattern: /\b(aten[cç][aã]o|alerta|cuidado|atenção)\b/i },
    { emoji: '❌', pattern: /\b(erro|falha|n[oã]o (foi|consig\w*)|problema)\b/i },
    { emoji: '💡', pattern: /\b(insight|dica|sugest[aã]o|resumo)\b/i },
    { emoji: '🛠️', pattern: /\b(ajuste|corrig(ir|ido)|pr[oó]ximos passos|a[cç][aã]o|implementar)\b/i },
    { emoji: '⏰', pattern: /\b(prazo|deadline|hoje|amanh[ãa]|urgente)\b/i },
    { emoji: '📚', pattern: /\b(fonte|refer[eê]ncia|documenta[cç][aã]o)\b/i },
    { emoji: '💬', pattern: /\b(resposta|mensagem|chat|conversa)\b/i },
  ];

  const used = [];
  rules.forEach(({ emoji, pattern }) => {
    if (pattern.test(text) && !used.includes(emoji)) {
      used.push(emoji);
    }
  });

  if (!used.length) return text;
  return `${used.join(' ')} ${text}`;
};

const formatBotResponseText = (text = '') => {
  let formatted = text.trim();
  if (!formatted) return '';

  formatted = addProfessionalEmojis(formatted);

  formatted = formatted.replace(/(^|\n)\*\s*([^*\n]+)/g, (match, prefix, content) => {
    return `${prefix}<strong>${content.trim()}</strong>`;
  });

  formatted = formatted.replace(/\*(.*?)\*/g, (_, content) => `<strong>${content.trim()}</strong>`);
  formatted = formatted.replace(/\n/g, '<br />');

  const trimmed = formatted.trim();
  if (trimmed && !/[.!?…>]$/.test(trimmed)) {
    formatted = `${trimmed}.`;
  } else {
    formatted = trimmed;
  }

  return formatted;
};

const getFirstAndLastName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const mockUsers = [
  {
    id: 1,
    nome: 'Marcos Jornalista',
    email: 'marcos@jornasa.com',
    senha: '123456',
    iniciais: 'MJ'
  },
  {
    id: 2,
    nome: 'Ana Repórter',
    email: 'ana@jornasa.com',
    senha: 'reporter',
    iniciais: 'AR'
  }
];
const STORAGE_KEY = 'jornabot:user';
const CURRENT_USER_KEY = 'jernasa:user';
const makeUserKey = (userId, suffix) => `jornabot:${suffix}:${userId}`;
const getDefaultPautas = () => [];
const getDefaultFontes = () => [];
const getDefaultTemplates = () => [];
const getDefaultChatMessages = () => ([
  {
    id: 1,
    role: 'bot',
    content: formatBotResponseText('Olá, amorecos! Sou o JornaIA. Posso ajudar a estruturar pautas, sugerir fontes ou organizar seu workflow. Em que posso ajudar hoje?'),
    isHTML: true
  }
]);
const getDefaultNotifications = () => [];
const buildChatTitle = (messages = []) => {
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser?.content) {
    const text = typeof firstUser.content === 'string' ? firstUser.content : '';
    return text.slice(0, 50) || 'Conversa';
  }
  return 'Conversa';
};
const buildChatPreview = (messages = []) => {
  const lastMessage = [...messages].reverse().find(m => m.content);
  if (!lastMessage) return '';
  const text = typeof lastMessage.content === 'string' ? lastMessage.content : stripHtml(lastMessage.content);
  return text.slice(0, 80);
};
const limitHistory = (history = [], max = 20) => history.slice(0, max);
const Toast = ({ alert, onClose }) => {
  if (!alert) return null;
  const color = alert.type === 'error' ? 'bg-red-500' : alert.type === 'success' ? 'bg-green-500' : 'bg-jorna-600';
  const label = alert.type === 'success' ? 'Salvo' : (alert.type || 'info');
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-white text-sm flex items-center gap-2">
      <span className={`${color} px-2 py-1 rounded-full text-[11px] uppercase tracking-wide`}>{label}</span>
      <span>{alert.message}</span>
      <button onClick={onClose} className="ml-2 text-white/80 hover:text-white">×</button>
    </div>
  );
};

const HomeView = memo(({ filteredPautas, searchTermPautas, onSearchTermPautasChange, filterStatus, onFilterStatusChange, getDaysUntilDeadline, getStatusColor, openModal, deletePauta, loading }) => (
  <div className="p-4 pb-24 sm:pb-20">
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-jorna-brown mb-4">Minhas Pautas</h1>
      <div className="flex flex-col gap-3 mb-4 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar pautas..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
            value={searchTermPautas}
            onChange={(e) => onSearchTermPautasChange(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 border rounded-lg bg-white w-full sm:w-auto"
          value={filterStatus}
          onChange={(e) => onFilterStatusChange(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="pendente">Pendente</option>
          <option value="em-andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>
    </div>

    {loading ? (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4 border border-gray-100 animate-pulse space-y-3">
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
            <div className="h-3 w-5/6 bg-gray-100 rounded" />
            <div className="flex gap-2">
              <span className="h-6 w-20 bg-gray-100 rounded-full" />
              <span className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ) : filteredPautas.length === 0 ? (
      <div className="bg-white rounded-2xl shadow p-6 text-center border border-dashed border-gray-200">
        <p className="text-sm text-gray-600">Nenhuma pauta por aqui.</p>
        <button
          onClick={() => openModal('pauta')}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-jorna-600 text-white rounded-lg hover:bg-jorna-700 transition text-sm"
        >
          <Plus size={16} /> Criar primeira pauta
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {filteredPautas.map(pauta => {
          const daysLeft = getDaysUntilDeadline(pauta.deadline);
          return (
            <div key={pauta.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-jorna-500">
              <div className="flex justify-between items-start mb-2 gap-3 flex-col sm:flex-row">
                <h3 className="font-semibold text-lg flex-1">{pauta.titulo}</h3>
                <div className="flex gap-2 ml-0 sm:ml-2">
                  <button onClick={() => openModal('pauta', pauta)} className="text-jorna-500 hover:text-jorna-700" aria-label="Editar pauta">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => deletePauta(pauta.id)} className="text-red-500 hover:text-red-700" aria-label="Excluir pauta">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-3 break-words">{pauta.descricao}</p>
              <div className="flex justify-between items-center flex-wrap gap-2 flex-col sm:flex-row">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(pauta.status)}`}>
                  {pauta.status.replace('-', ' ')}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className={daysLeft <= 2 ? 'text-red-500' : 'text-gray-500'} />
                  <span className={daysLeft <= 2 ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                    {daysLeft > 0 ? `${daysLeft} dias` : daysLeft === 0 ? 'Hoje!' : 'Atrasado'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}

    <button
      onClick={() => openModal('pauta')}
      className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 bg-jorna-500 text-white rounded-full p-4 shadow-lg hover:bg-jorna-600 transition"
    >
      <Plus size={24} />
    </button>
  </div>
));

const FontesView = memo(({ filteredFontes, searchTermFontes, setSearchTermFontes, openModal, deleteFonte }) => (
  <div className="p-4 pb-24 sm:pb-20">
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-jorna-brown mb-4">Banco de Fontes</h1>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar fontes..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
          value={searchTermFontes}
          onChange={(e) => setSearchTermFontes(e.target.value)}
        />
      </div>
    </div>

    {filteredFontes.length === 0 ? (
      <div className="bg-white rounded-2xl shadow p-6 text-center border border-dashed border-gray-200">
        <p className="text-sm text-gray-600">Nenhuma fonte cadastrada.</p>
        <button
          onClick={() => openModal('fonte')}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-jorna-600 text-white rounded-lg hover:bg-jorna-700 transition text-sm"
        >
          <Plus size={16} /> Adicionar fonte
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        {filteredFontes.map(fonte => (
          <div key={fonte.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2 gap-2 flex-col sm:flex-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{fonte.nome}</h3>
                  {fonte.oficial && (
                    <span className="bg-jorna-100 text-jorna-800 text-xs px-2 py-0.5 rounded">
                      Oficial
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mt-1">{fonte.cargo}</p>
              </div>
              <div className="flex gap-2 ml-0 sm:ml-2">
                <button onClick={() => openModal('fonte', fonte)} className="text-jorna-500 hover:text-jorna-700" aria-label="Editar fonte">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => deleteFonte(fonte.id)} className="text-red-500 hover:text-red-700" aria-label="Excluir fonte">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-700 mt-2">
              <p className="mb-1">📞 {fonte.contato}</p>
              <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {fonte.categoria}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}

    <button
      onClick={() => openModal('fonte')}
      className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 bg-jorna-500 text-white rounded-full p-4 shadow-lg hover:bg-jorna-600 transition"
    >
      <Plus size={24} />
    </button>
  </div>
));

const ChatbotView = memo(({ messages, messagesLoading, chatInput, onInputChange, onSendMessage, onNewChat, onOpenHistory, historyCount, loading, buscarWeb, onToggleBuscarWeb, chatListRef, chatInputRef }) => (
  <div className="p-4 pb-20">
    <div className="mb-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-md mb-3">
        <img src="/avatarchat.png" alt="JornaIA" className="w-full h-full object-cover rounded-full" />
      </div>
      <h1 className="text-2xl font-bold text-jorna-brown">JornaIA</h1>
      <p className="text-gray-600 text-sm">Seu assistente para organizar pautas, fontes e insights em tempo real.</p>
      {buscarWeb && (
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-jorna-50 text-jorna-700 text-xs font-semibold border border-jorna-100">
          Busca web ativa
        </div>
      )}
      <div className="mt-3 flex justify-center gap-2">
        <button
          onClick={onNewChat}
          className="text-sm text-jorna-600 font-semibold px-3 py-1.5 rounded-full border border-jorna-200 hover:bg-jorna-50 transition"
          type="button"
        >
          Nova conversa
        </button>
        <button
          onClick={onOpenHistory}
          className="text-sm text-gray-700 font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition"
          type="button"
        >
          Histórico {historyCount > 0 ? `(${historyCount})` : ''}
        </button>
      </div>
    </div>

    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col min-h-[60vh]">
      <div ref={chatListRef} className="flex-1 bg-gradient-to-b from-jorna-50/60 to-white p-4 space-y-3 overflow-y-auto max-h-[60vh]">
        {messagesLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="flex justify-start">
                <div className="w-3/4 h-16 bg-white border border-gray-100 rounded-2xl shadow-sm animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.map(message => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-full sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              message.role === 'user' ? 'bg-jorna-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border'
            }`}>
              {message.role === 'bot' && (
                <p className="text-xs font-semibold text-jorna-600 mb-1">JornaIA</p>
              )}
              {message.pending ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-2 h-2 bg-jorna-500 rounded-full animate-pulse" />
                  <span>Apurando...</span>
                </div>
              ) : message.isHTML ? (
                <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: message.content }} />
              ) : (
                <p className="text-sm leading-relaxed">{message.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder="Conte como posso ajudar suas pautas..."
            className="flex-1 px-4 py-3 border rounded-2xl focus:ring-2 focus:ring-jorna-500 outline-none bg-gray-50 w-full"
            disabled={loading}
          />
          <button
            onClick={onSendMessage}
            disabled={loading || !chatInput.trim()}
            className="bg-jorna-600 text-white px-5 py-3 rounded-2xl font-semibold shadow hover:bg-jorna-700 disabled:bg-gray-300 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <input
            id="buscar-web"
            type="checkbox"
            checked={buscarWeb}
            onChange={(e) => onToggleBuscarWeb(e.target.checked)}
            className="w-4 h-4 text-jorna-600 border-gray-300 rounded focus:ring-jorna-500"
          />
          <label htmlFor="buscar-web" className="text-sm text-gray-600 select-none">
            Buscar na web (quando necessário)
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Inteligência Artificial de alto nível treinada para Jornalistas
        </p>
      </div>
    </div>
  </div>
));

const GuiasView = memo(({
  verifyText,
  onVerifyTextChange,
  verificarFonte,
  verifying,
  verifyResult,
  templates,
  guias,
  onTemplateAction,
  copiedTemplateId,
  canShareTemplates,
  onEditTemplate,
  onAddTemplate,
  templateSearch,
  onTemplateSearchChange,
  templateTagFilter,
  onTemplateTagChange,
  templateOnlyFavorites,
  onToggleTemplateOnlyFavorites,
  availableTemplateTags,
  onUseTemplate,
  onDuplicateTemplate,
  onToggleTemplateFavorite
}) => (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold text-jorna-brown mb-6">Guias e Templates</h1>
    
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Search size={20} className="text-green-500" />
          Verificador de Fontes Oficiais
        </h2>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-3">Cole o texto ou URL para verificar a confiabilidade da fonte</p>
          <textarea
            value={verifyText}
            onChange={(e) => onVerifyTextChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg mb-3 focus:ring-2 focus:ring-green-500 outline-none"
            rows="4"
            placeholder="Ex: https://site.com/noticia ou texto completo..."
          />
          <button
            onClick={verificarFonte}
            disabled={verifying || !verifyText.trim()}
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {verifying ? '🔍 Verificando...' : '✓ Verificar Fonte'}
          </button>
        
          {verifyResult && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${verifyResult.confiavel ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-lg">
                  {verifyResult.confiavel ? '✓ Fonte Confiável' : '⚠️ Fonte Duvidosa'}
                </span>
                <span className="text-2xl font-bold">{verifyResult.score}%</span>
              </div>
              <ul className="text-sm space-y-1 mt-3">
                {verifyResult.detalhes.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={20} className="text-jorna-500" />
            Templates
          </h2>
          <button
            onClick={onAddTemplate}
            className="text-sm text-jorna-500 font-medium hover:text-jorna-700"
          >
            <Plus size={16} className="inline mr-1" />
            Novo
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <input
            value={templateSearch}
            onChange={(e) => onTemplateSearchChange(e.target.value)}
            placeholder="Buscar por nome ou conteúdo..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
          />
          <select
            value={templateTagFilter}
            onChange={(e) => onTemplateTagChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="todas">Todas as tags</option>
            {availableTemplateTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <button
            onClick={onToggleTemplateOnlyFavorites}
            className={`w-full px-3 py-2 border rounded-lg ${templateOnlyFavorites ? 'bg-jorna-50 border-jorna-300 text-jorna-700' : 'bg-white text-gray-700'}`}
          >
            {templateOnlyFavorites ? '★ Mostrar favoritos' : '☆ Todos os templates'}
          </button>
        </div>
        <div className="space-y-3">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    {template.nome}
                    {template.favorito ? <span className="text-amber-500">★</span> : null}
                  </h3>
                  {template.categoria ? (
                    <span className="text-xs text-gray-500">Categoria: {template.categoria}</span>
                  ) : null}
                </div>
                <div className="text-right text-xs text-gray-500">
                  {template.lastUsedAt ? `Usado em ${new Date(template.lastUsedAt).toLocaleDateString()}` : 'Ainda não usado'}
                  <div className="font-medium text-jorna-600">Usos: {template.usageCount || 0}</div>
                </div>
              </div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded border">
                {template.conteudo}
              </pre>
              {template.tags?.length ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {template.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-jorna-50 text-jorna-700 rounded-full text-xs border border-jorna-100">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                <button
                  onClick={() => onTemplateAction(template)}
                  className="text-jorna-500 hover:text-jorna-700"
                >
                  {copiedTemplateId === template.id
                    ? '✅ Copiado!'
                    : canShareTemplates
                      ? '📤 Compartilhar Template'
                      : '📋 Copiar Template'}
                </button>
                <button
                  onClick={() => onUseTemplate(template)}
                  className="text-jorna-500 hover:text-jorna-700 flex items-center gap-1"
                >
                  <MessageCircle size={14} />
                  Usar no chat
                </button>
                <button
                  onClick={() => onEditTemplate(template)}
                  className="text-gray-600 hover:text-jorna-700 flex items-center gap-1"
                >
                  <Edit2 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => onDuplicateTemplate(template)}
                  className="text-gray-600 hover:text-jorna-700 flex items-center gap-1"
                >
                  <CopyIcon />
                  Duplicar
                </button>
                <button
                  onClick={() => onToggleTemplateFavorite(template)}
                  className="text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  {template.favorito ? '★ Favorito' : '☆ Favoritar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen size={20} className="text-jorna-500" />
          Guias Práticos
        </h2>
        <div className="space-y-3">
          {guias.map(guia => (
            <div key={guia.id} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">{guia.titulo}</h3>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                {guia.conteudo}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  ));

  const ModalComponent = memo(({ showModal, modalType, editingItem, formData, onClose, onUpdateField, onSavePauta, onSaveFonte, onSaveTemplate }) => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-jorna-brown bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
            <h2 className="text-xl font-semibold">
              {modalType === 'pauta' ? (editingItem ? 'Editar Pauta' : 'Nova Pauta') : 
               modalType === 'fonte' ? (editingItem ? 'Editar Fonte' : 'Nova Fonte') :
               modalType === 'template' ? (editingItem ? 'Editar Template' : 'Novo Template') : ''}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <div className="p-4">
            {modalType === 'pauta' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Retranca *</label>
                  <input
                    type="text"
                    value={formData.titulo || ''}
                    onChange={(e) => onUpdateField('titulo', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Ex: Reportagem sobre saúde pública"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Lead</label>
                  <textarea
                    value={formData.descricao || ''}
                    onChange={(e) => onUpdateField('descricao', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    rows="3"
                    placeholder="Descreva os detalhes da pauta..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deadline *</label>
                  <input
                    type="date"
                    value={formData.deadline || ''}
                    onChange={(e) => onUpdateField('deadline', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status || 'pendente'}
                    onChange={(e) => onUpdateField('status', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none bg-white"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em-andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
                <button
                  onClick={onSavePauta}
                  className="w-full bg-jorna-500 text-white py-3 rounded-lg hover:bg-jorna-600 transition font-medium"
                >
                  Salvar Pauta
                </button>
              </div>
            )}

            {modalType === 'fonte' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome || ''}
                    onChange={(e) => onUpdateField('nome', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Ex: Dr. João Silva"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cargo</label>
                  <input
                    type="text"
                    value={formData.cargo || ''}
                    onChange={(e) => onUpdateField('cargo', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Ex: Secretário Municipal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contato *</label>
                  <input
                    type="text"
                    value={formData.contato || ''}
                    onChange={(e) => onUpdateField('contato', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Email ou telefone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <input
                    type="text"
                    value={formData.categoria || ''}
                    onChange={(e) => onUpdateField('categoria', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Ex: Política, Educação, Saúde"
                  />
                </div>
                <button
                  onClick={onSaveFonte}
                  className="w-full bg-jorna-500 text-white py-3 rounded-lg hover:bg-jorna-600 transition font-medium"
                >
                  Salvar Fonte
                </button>
              </div>
            )}

            {modalType === 'template' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome || ''}
                    onChange={(e) => onUpdateField('nome', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                    placeholder="Ex: Nota Oficial"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Conteúdo *</label>
                  <div className="grid gap-2 mb-2">
                    <input
                      value={formData.templateTitulo || ''}
                      onChange={(e) => onUpdateField('templateTitulo', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                      placeholder="Título do material"
                    />
                    <textarea
                      value={formData.templateTexto || ''}
                      onChange={(e) => onUpdateField('templateTexto', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                      rows="3"
                      placeholder="Texto principal"
                    />
                    <input
                      value={formData.templateFonte || ''}
                      onChange={(e) => onUpdateField('templateFonte', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                      placeholder="Fonte / referência"
                    />
                  </div>
                  <textarea
                    value={formData.conteudo || ''}
                    onChange={(e) => onUpdateField('conteudo', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none font-mono"
                    rows="6"
                    placeholder={'TÍTULO:\n\nTEXTO:\n\nFONTE:'}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tags (separe por vírgulas)</label>
                    <input
                      value={formData.templateTags || ''}
                      onChange={(e) => onUpdateField('templateTags', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                      placeholder="briefing, nota, giro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Categoria</label>
                    <input
                      value={formData.templateCategoria || ''}
                      onChange={(e) => onUpdateField('templateCategoria', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                      placeholder="Ex: Apuração, Newsletter"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.templateFavorito}
                    onChange={(e) => onUpdateField('templateFavorito', e.target.checked)}
                    className="w-4 h-4"
                  />
                  Marcar como favorito
                </label>
                <button
                  onClick={onSaveTemplate}
                  className="w-full bg-jorna-500 text-white py-3 rounded-lg hover:bg-jorna-600 transition font-medium"
                >
                  Salvar Template
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

const JornalismoApp = () => {
  const [currentView, setCurrentView] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(mockUsers);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pautas, setPautas] = useState(getDefaultPautas);
  const [fontes, setFontes] = useState(getDefaultFontes);
  const [templates, setTemplates] = useState(getDefaultTemplates);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateTagFilter, setTemplateTagFilter] = useState('todas');
  const [templateOnlyFavorites, setTemplateOnlyFavorites] = useState(false);
  const [availableTemplateTags, setAvailableTemplateTags] = useState([]);
  const [loadingPautas, setLoadingPautas] = useState(false);
  const [guias] = useState([
    { id: 1, titulo: 'Como Verificar Fontes', conteudo: '1. Cheque credenciais\n2. Busque fontes oficiais\n3. Cruzar informações\n4. Verificar histórico' },
    { id: 2, titulo: 'Técnicas de Entrevista', conteudo: '1. Prepare perguntas\n2. Escuta ativa\n3. Perguntas abertas\n4. Follow-up' },
    { id: 3, titulo: 'Checklist de Apuração', conteudo: '✅ Verificar 3+ fontes\n✅ Dados oficiais\n✅ Contexto histórico\n✅ Ouvir todos os lados' }
  ]);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [searchTermPautas, setSearchTermPautas] = useState('');
  const [searchTermFontes, setSearchTermFontes] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [formData, setFormData] = useState({});
  const [notifications, setNotifications] = useState(getDefaultNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationButtonRef = useRef(null);
  const notificationPanelRef = useRef(null);
  const profileButtonRef = useRef(null);
  const profilePanelRef = useRef(null);
  const quickAvatarInputRef = useRef(null);
  const profileAvatarInputRef = useRef(null);
  const googleButtonRef = useRef(null);
  const chatRequestController = useRef(null);
  const chatCacheRef = useRef(new Map());
  const pendingBotIdRef = useRef(null);
  const copyTemplateTimeoutRef = useRef(null);
  const chatInputRef = useRef(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(Date.now());
  const [chatMessages, setChatMessages] = useState([
    ...getDefaultChatMessages()
  ]);
  const chatListRef = useRef(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [buscarWeb, setBuscarWeb] = useState(false);
  const [uiAlert, setUiAlert] = useState(null);
  const parseTagsInput = useCallback((value = '') => {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }, []);
  const applyTemplateMeta = useCallback((list = []) => {
    return list.map((template) => {
      const meta = getTemplateMeta(template.id);
      return {
        ...template,
        tags: meta.tags || [],
        categoria: meta.categoria || '',
        favorito: !!meta.favorito,
        usageCount: meta.usageCount || 0,
        lastUsedAt: meta.lastUsedAt || null,
      };
    });
  }, []);
  const [authToken, setAuthToken] = useState(null);
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages, chatMessagesLoading]);
  useEffect(() => {
    const tags = Array.from(
      new Set(
        (templates || []).flatMap((t) => (t.tags || []).filter(Boolean))
      )
    );
    setAvailableTemplateTags(tags);
  }, [templates]);
  useEffect(() => {
    if (!uiAlert) return;
    const timer = setTimeout(() => setUiAlert(null), 3500);
    return () => clearTimeout(timer);
  }, [uiAlert]);

  const buildConversationContext = useCallback(() => {
    const recent = chatMessages
      .filter(message => !message.pending)
      .slice(-6)
      .map(message => {
        const prefix = message.role === 'user' ? 'Usuario' : 'JornaBot';
        const content = message.role === 'user'
          ? message.content
          : stripHtml(message.content);
        return `${prefix}: ${content}`;
      })
      .filter(Boolean);
    return recent.length ? `Contexto recente:\n${recent.join('\n')}` : '';
  }, [chatMessages]);

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.toLowerCase();
    return templates
      .filter((t) => {
        const haystack = `${t.nome || ''} ${t.conteudo || ''} ${t.categoria || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
        const matchesTerm = !term || haystack.includes(term);
        const matchesTag = templateTagFilter === 'todas' || (t.tags || []).includes(templateTagFilter);
        const matchesFav = !templateOnlyFavorites || t.favorito;
        return matchesTerm && matchesTag && matchesFav;
      })
      .sort((a, b) => {
        if (a.favorito && !b.favorito) return -1;
        if (!a.favorito && b.favorito) return 1;
        const aUse = a.usageCount || 0;
        const bUse = b.usageCount || 0;
        return bUse - aUse;
      });
  }, [templates, templateSearch, templateTagFilter, templateOnlyFavorites]);

  const handleSetSearchTermPautas = useCallback((value) => {
    setSearchTermPautas(value);
  }, [authToken]);

  const handleSetSearchTermFontes = useCallback((value) => {
    setSearchTermFontes(value);
  }, []);

  const handleSetFilterStatus = useCallback((value) => {
    setFilterStatus(value);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
  }, []);

  useEffect(() => {
    return () => {
      if (copyTemplateTimeoutRef.current) {
        clearTimeout(copyTemplateTimeoutRef.current);
      }
      if (chatRequestController.current) {
        chatRequestController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          setCurrentUser(parsed);
        }
        if (parsed?.token) {
          setAuthToken(parsed.token);
        }
      }
    } catch (error) {
      console.warn('Nao foi possivel carregar usuario salvo', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const loadMessagesForConversation = useCallback(async (conversation) => {
    if (!conversation || !conversation.id) return;
    const userId = getUserKey(currentUser);
    try {
      setChatMessagesLoading(true);
      const msgs = await listarMensagens(authToken, conversation.id, userId);
      setChatMessages(msgs && msgs.length ? msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        isHTML: m.is_html,
        pending: false
      })) : getDefaultChatMessages());
      setCurrentChatId(conversation.id);
    } catch (error) {
      console.warn('Erro ao carregar mensagens', error);
      setChatMessages(getDefaultChatMessages());
      setCurrentChatId(conversation.id);
    } finally {
      setChatMessagesLoading(false);
    }
  }, [authToken, currentUser]);

  const ensureConversation = useCallback(async (userId, existingConvs) => {
    if (existingConvs && existingConvs.length > 0) {
      return existingConvs[0];
    }
    if (!authToken && !USE_LOCAL_STORE) return null;
    const created = await criarConversaWorker(authToken, { title: 'Nova conversa', preview: '' }, userId);
    return created;
  }, [authToken]);

  const updateConversationInHistory = useCallback((conversaId, updates) => {
    setChatHistory(prev => {
      const existing = prev.find(c => c.id === conversaId);
      const updated = existing ? { ...existing, ...updates } : { id: conversaId, ...updates };
      return [updated, ...prev.filter(c => c.id !== conversaId)];
    });
  }, []);

  const handleDeleteConversation = useCallback(async (conversaId) => {
    const userId = getUserKey(currentUser);
    if (!userId) return;
    try {
      await deletarConversaWorker(authToken, conversaId, userId);
      setChatHistory(prev => prev.filter(c => c.id !== conversaId));
      if (currentChatId === conversaId) {
        // fallback: carregar próxima conversa ou criar nova
        const convs = await listarConversas(authToken, userId);
        setChatHistory(convs || []);
        const next = convs && convs.length ? convs[0] : await ensureConversation(userId, convs);
        setCurrentChatId(next?.id || Date.now());
        await loadMessagesForConversation(next);
      }
      setUiAlert({ type: 'success', message: 'Conversa removida.' });
    } catch (error) {
      console.warn('Erro ao remover conversa', error);
      setUiAlert({ type: 'error', message: 'Não foi possível remover a conversa.' });
    }
  }, [authToken, currentUser, currentChatId, ensureConversation, loadMessagesForConversation]);

  const fetchNotifications = useCallback(async (userId) => {
    return listarNotificacoes(authToken, userId);
  }, [authToken]);

  const loadUserData = useCallback(async (userId) => {
    const effectiveUserId = getUserKey({ id: userId });
    if (!effectiveUserId) return;
    try {
      setLoadingPautas(true);
      const fetchedPautas = await listarPautas(authToken, effectiveUserId);
      setPautas(fetchedPautas || getDefaultPautas());

      const fetchedFontes = await listarFontes(authToken, effectiveUserId);
      setFontes(fetchedFontes || getDefaultFontes());

      const fetchedTemplates = await listarTemplates(authToken, effectiveUserId);
      const mergedTemplates = applyTemplateMeta(fetchedTemplates || getDefaultTemplates());
      setTemplates(mergedTemplates);

      const conversas = await listarConversas(authToken, effectiveUserId);
      const hasConvs = conversas && conversas.length > 0;
      const conversaAtual = hasConvs ? conversas[0] : await ensureConversation(effectiveUserId, conversas);
      setChatHistory(hasConvs ? conversas : (conversaAtual ? [conversaAtual] : []));
      setCurrentChatId(conversaAtual?.id || Date.now());
      if (conversaAtual) {
        await loadMessagesForConversation(conversaAtual);
      }

      const fetchedNotifications = await fetchNotifications(effectiveUserId);
      setNotifications(fetchedNotifications || getDefaultNotifications());
      setLoadingPautas(false);
    } catch (error) {
      console.warn('Nao foi possivel carregar dados do usuario', error);
      setPautas(getDefaultPautas());
      setFontes(getDefaultFontes());
      setTemplates(getDefaultTemplates());
      setChatMessages(getDefaultChatMessages());
      setChatHistory([]);
      setCurrentChatId(Date.now());
      setNotifications(getDefaultNotifications());
      setLoadingPautas(false);
    }
  }, [authToken, fetchNotifications, loadMessagesForConversation, ensureConversation, applyTemplateMeta]);

  useEffect(() => {
    const userId = getUserKey(currentUser);
    loadUserData(userId);
  }, [currentUser, loadUserData]);

  const updateField = useCallback((field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      const isTemplateSection = ['templateTitulo', 'templateTexto', 'templateFonte'].includes(field);
      if (isTemplateSection) {
        const titulo = field === 'templateTitulo' ? value : prev.templateTitulo || '';
        const texto = field === 'templateTexto' ? value : prev.templateTexto || '';
        const fonte = field === 'templateFonte' ? value : prev.templateFonte || '';
        next.conteudo = buildTemplateContent(titulo, texto, fonte);
      }
      return next;
    });
  }, []);

  const handleLogin = useCallback(() => {
    setAuthError('');

    const normalizedEmail = authEmail.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail && u.senha === authPassword);

    if (!user) {
      setAuthError('E-mail ou senha inválidos.');
      return;
    }

    const loggedUser = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      iniciais: user.iniciais,
      avatarUrl: user.avatarUrl || null,
    };
    setCurrentUser(loggedUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
    } catch (error) {
      console.warn('Nao foi possivel salvar usuario no localStorage', error);
    }
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
  }, [authEmail, authPassword, users]);

  const handleRegister = useCallback(() => {
    setAuthError('');
    const name = authName.trim();
    const email = authEmail.trim().toLowerCase();

    if (!name) {
      setAuthError('Informe seu nome completo.');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (authPassword !== authConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    const alreadyExists = users.some((user) => user.email.toLowerCase() === email);
    if (alreadyExists) {
      setAuthError('Já existe um usuário cadastrado com este e-mail.');
      return;
    }

    const newUser = {
      id: Date.now(),
      nome: name,
      email,
      senha: authPassword,
      iniciais: name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'JR'
    };

    setUsers((prev) => [...prev, newUser]);
    const savedUser = {
      id: newUser.id,
      nome: newUser.nome,
      email: newUser.email,
      iniciais: newUser.iniciais,
      avatarUrl: null,
    };
    setCurrentUser(savedUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedUser));
    } catch (error) {
      console.warn('Nao foi possivel salvar usuario no localStorage', error);
    }
    setIsRegistering(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthName('');
  }, [authName, authEmail, authPassword, authConfirmPassword, users]);

  const handleGoogleCredential = useCallback((credential) => {
    if (!credential) {
      setAuthError('Não foi possível usar o login Google.');
      return;
    }

    try {
      const payloadBase64 = credential.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      const payload = payloadBase64 ? JSON.parse(atob(payloadBase64)) : null;
      if (!payload?.email) {
        setAuthError('Não foi possível validar o Google.');
        return;
      }

      const name = payload.name || payload.email || 'Conta Google';
      const email = payload.email.toLowerCase();
      const initials =
        name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0]?.toUpperCase())
          .join('') || 'GG';

      const loggedUser = {
        id: payload.sub || `google-${Date.now()}`,
        nome: name,
        email,
        iniciais: initials,
        avatarUrl: payload.picture || null,
        token: credential
      };

      setCurrentUser(loggedUser);
      setAuthToken(credential);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
      setAuthError('');
    } catch (error) {
      console.warn('Erro ao processar credential do Google', error);
      setAuthError('Não foi possível validar o Google.');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!googleButtonRef.current) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => handleGoogleCredential(res?.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        type: 'standard',
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [handleGoogleCredential]);

  const handleAuthSubmit = useCallback((event) => {
    event?.preventDefault?.();
    if (isRegistering) {
      handleRegister();
    } else {
      handleLogin();
    }
  }, [isRegistering, handleLogin, handleRegister]);

  const toggleAuthMode = useCallback(() => {
    setIsRegistering((prev) => !prev);
    setAuthError('');
    setAuthName('');
    setAuthConfirmPassword('');
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Nao foi possivel limpar usuario salvo', error);
    }
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthName('');
    setAuthError('');
    setAuthToken(null);
    setCurrentView('home');
    setShowNotifications(false);
    setShowProfileMenu(false);
  }, []);

  const handleAvatarFileSelected = useCallback((event) => {
    if (!currentUser) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setUsers(prev =>
        prev.map(user =>
          user.id === currentUser.id ? { ...user, avatarUrl: dataUrl || null } : user
        )
      );
      setCurrentUser(prev => {
        const updated = prev ? { ...prev, avatarUrl: dataUrl || null } : prev;
        if (updated) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch (error) {
            console.warn('Nao foi possivel atualizar avatar no localStorage', error);
          }
        }
        return updated;
      });
      setShowProfileMenu(false);
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  }, [authToken, currentUser]);

  const handleOpenAvatarPicker = useCallback(() => {
    setShowProfileMenu(false);
    quickAvatarInputRef.current?.click();
  }, []);

  const handleProfileAvatarPicker = useCallback(() => {
    profileAvatarInputRef.current?.click();
  }, []);

  const handleChatInputChange = useCallback((value) => {
    setChatInput(value);
  }, []);

  const handleNewChat = useCallback(async () => {
    const userId = getUserKey(currentUser);
    try {
      const conversa = await criarConversaWorker(authToken, { title: 'Nova conversa', preview: '' }, userId);
      setChatHistory(prev => [conversa, ...prev]);
      setCurrentChatId(conversa.id);
      setChatMessages(getDefaultChatMessages());
      setChatInput('');
    } catch (error) {
      console.warn('Erro ao criar conversa', error);
      setUiAlert({ type: 'error', message: 'Não foi possível criar nova conversa.' });
    }
  }, [currentUser]);

  const handleOpenChatFromHistory = useCallback((conversation) => {
    if (!conversation) return;
    loadMessagesForConversation(conversation);
    setShowChatHistory(false);
  }, [loadMessagesForConversation]);

  const renderChatHistory = () => {
    if (!showChatHistory) return null;
    return (
      <div
        className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center p-4"
        onClick={() => setShowChatHistory(false)}
      >
        <div
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-lg font-semibold text-jorna-brown">Histórico de conversas</h3>
            <button onClick={() => setShowChatHistory(false)} className="text-sm text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {chatHistory.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma conversa salva.</div>
            )}
            {chatHistory.map(conv => (
              <button
                key={conv.id}
                onClick={() => handleOpenChatFromHistory(conv)}
                className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-jorna-50 flex items-start gap-3"
              >
                <div className="flex-1">
                  <p className="font-semibold text-jorna-brown">{conv.title || 'Conversa'}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(conv.created_at || conv.createdAt || Date.now()).toLocaleString()}</p>
                  {conv.preview && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{conv.preview}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-gray-500">
                  {currentChatId === conv.id && (
                    <span className="px-2 py-0.5 rounded-full bg-jorna-100 text-jorna-700 text-[11px]">Atual</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="px-2 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50"
                  >
                    Apagar
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const sendChatMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    const userId = getUserKey(currentUser);

    let conversaId = currentChatId;
    if (!conversaId || typeof conversaId === 'undefined') {
      try {
        const nova = await criarConversaWorker(authToken, { title: buildChatTitle([{ role: 'user', content: trimmed }]), preview: buildChatPreview([{ content: trimmed }]) }, userId);
        conversaId = nova.id;
        setCurrentChatId(nova.id);
        setChatHistory(prev => [nova, ...prev]);
      } catch (err) {
        console.warn('Erro ao criar conversa antes do envio', err);
        setUiAlert({ type: 'error', message: 'Não foi possível iniciar a conversa.' });
        return;
      }
    }

    const contextSnippet = buildConversationContext();
    const continuationHint =
      'Instrucao: continue a conversa a partir do contexto, sem repetir saudacoes iniciais e indo direto aos passos.';
    const payloadMessage = contextSnippet
      ? `${contextSnippet}\n\nPergunta atual: ${trimmed}\n${continuationHint}`
      : `${trimmed}\n${continuationHint}`;
    const normalizedKey = `${contextSnippet}||${trimmed}`.toLowerCase();
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      isHTML: false
    };
    const previousPendingId = pendingBotIdRef.current;

    if (chatRequestController.current) {
      chatRequestController.current.abort();
    }
    const controller = new AbortController();
    chatRequestController.current = controller;

    const pendingId = Date.now() + 1;
    pendingBotIdRef.current = pendingId;

    setChatMessages(prev => {
      const cleaned = previousPendingId
        ? prev.filter(message => !(message.pending && message.id === previousPendingId))
        : prev;
      return [
        ...cleaned,
        userMessage,
        {
          id: pendingId,
          role: 'bot',
          content: 'Apurando...',
          isHTML: false,
          pending: true
        }
      ];
    });
    setChatInput('');
    setChatLoading(true);

    (async () => {
      try {
        await criarMensagemWorker(authToken, conversaId, { role: 'user', content: trimmed, is_html: false }, userId);
        updateConversationInHistory(conversaId, { title: buildChatTitle([userMessage]), preview: buildChatPreview([userMessage]) });
      } catch (err) {
        console.warn('Erro ao registrar mensagem do usuário', err);
      }
    })();

    const finalizeMessage = (content, isHTML = true) => {
      setChatMessages(prev =>
        prev.map(message =>
          message.id === pendingId
            ? { ...message, content, isHTML, pending: false }
            : message
        )
      );
      pendingBotIdRef.current = null;
      setChatLoading(false);
      (async () => {
        try {
          await criarMensagemWorker(authToken, conversaId, { role: 'bot', content, is_html: isHTML }, userId);
          updateConversationInHistory(conversaId, {
            title: buildChatTitle([{ role: 'user', content: trimmed }]),
            preview: buildChatPreview([{ content }])
          });
        } catch (err) {
          console.warn('Erro ao registrar resposta do bot', err);
        }
      })();
    };

    const cachedReply = chatCacheRef.current.get(normalizedKey);
    if (cachedReply) {
      finalizeMessage(cachedReply, true);
      return;
    }

    (async () => {
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (ACOLHEIA_API_KEY) {
          headers['x-jornasa-key'] = ACOLHEIA_API_KEY;
        }
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(ACOLHEIA_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ mensagem: payloadMessage, buscar_web: buscarWeb }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Erro ${response.status}`);
        }

        const data = await response.json();
        const botReply = data?.resposta || 'Recebi sua mensagem! Assim que o backend responder, trarei mais detalhes.';
        const formattedReply = formatBotResponseText(botReply);
        chatCacheRef.current.set(normalizedKey, formattedReply);
        finalizeMessage(formattedReply, true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('Erro ao enviar mensagem para o backend:', error);
        setUiAlert({ type: 'error', message: 'Não consegui falar com o serviço agora. Confira a URL da API.' });
        finalizeMessage(
          formatBotResponseText('Não consegui falar com o serviço agora. Confira a URL da API e tente novamente.'),
          true
        );
      }
    })();
  }, [authToken, currentUser, chatInput, chatLoading, buildConversationContext, buscarWeb, updateConversationInHistory]);

  const toggleProfileMenu = useCallback(() => {
    setShowProfileMenu(prev => !prev);
    setShowNotifications(false);
  }, []);

  const copyTemplateToClipboard = useCallback(async (template) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(template.conteudo);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = template.conteudo;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedTemplateId(template.id);
      if (copyTemplateTimeoutRef.current) {
        clearTimeout(copyTemplateTimeoutRef.current);
      }
      copyTemplateTimeoutRef.current = setTimeout(() => setCopiedTemplateId(null), 2000);

      const meta = recordTemplateUsage(template.id);
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, ...meta } : t));
    } catch (error) {
      console.error('Erro ao copiar template', error);
      alert('Não foi possível copiar o template.');
    }
  }, []);

  const handleTemplateShareOrCopy = useCallback(async (template) => {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (canShare) {
      try {
        await navigator.share({
          title: `Template: ${template.nome}`,
          text: template.conteudo
        });
        const meta = recordTemplateUsage(template.id);
        setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, ...meta } : t));
        return;
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
        console.warn('Erro ao compartilhar template, tentando copiar...', error);
      }
    }

    await copyTemplateToClipboard(template);
  }, [copyTemplateToClipboard]);

  const handleUseTemplateInChat = useCallback((template) => {
    setChatInput(template.conteudo || '');
    const meta = recordTemplateUsage(template.id);
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, ...meta } : t));
    setCurrentView('chatbot');
    setUiAlert({ type: 'success', message: 'Template aplicado no chat.' });
    requestAnimationFrame(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focus();
      }
    });
  }, []);

  const handleDuplicateTemplate = useCallback(async (template) => {
    const userId = getUserKey(currentUser);
    try {
      const payload = {
        nome: `${template.nome || 'Template'} (cópia)`,
        conteudo: template.conteudo || ''
      };
      const created = await criarTemplateWorker(authToken, payload, userId);
      const meta = upsertTemplateMeta(created.id, {
        tags: template.tags || [],
        categoria: template.categoria || '',
        favorito: template.favorito || false
      });
      setTemplates(prev => [{ ...created, ...meta }, ...prev]);
      setUiAlert({ type: 'success', message: 'Template duplicado.' });
    } catch (error) {
      console.warn('Erro ao duplicar template', error);
      setUiAlert({ type: 'error', message: 'Não foi possível duplicar o template.' });
    }
  }, [authToken, currentUser]);

  const handleToggleTemplateFavorite = useCallback((template) => {
    const meta = upsertTemplateMeta(template.id, { favorito: !template.favorito });
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, ...meta } : t));
  }, []);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
    setShowProfileMenu(false);
  }, []);

  const markNotificationAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event) => {
      const clickedNotifications = notificationPanelRef.current?.contains(event.target) || notificationButtonRef.current?.contains(event.target);

      if (!clickedNotifications) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    if (!showProfileMenu) return;

    const handleClickOutsideProfile = (event) => {
      const clickedProfile = profilePanelRef.current?.contains(event.target) || profileButtonRef.current?.contains(event.target);
      if (!clickedProfile) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideProfile);
    return () => document.removeEventListener('mousedown', handleClickOutsideProfile);
  }, [showProfileMenu]);

  const savePauta = useCallback(async () => {
    const userId = getUserKey(currentUser);

    const payload = {
      titulo: formData.titulo || '',
      deadline: formData.deadline || '',
      status: formData.status || 'pendente',
      descricao: formData.descricao || ''
    };

    try {
      if (editingItem) {
        const updated = await atualizarPautaWorker(authToken, editingItem.id, payload, userId);
        setPautas(prev => prev.map(p => p.id === editingItem.id ? updated : p));
      } else {
        const created = await criarPautaWorker(authToken, payload, userId);
        setPautas(prev => [created, ...prev]);
      }
      closeModal();
      setUiAlert({ type: 'success', message: 'Pauta salva.' });
    } catch (error) {
      console.warn('Erro ao salvar pauta', error);
      setUiAlert({ type: 'error', message: 'Não foi possível salvar a pauta.' });
    }
  }, [editingItem, formData, closeModal, currentUser, authToken]);

  const saveFonte = useCallback(async () => {
    const userId = getUserKey(currentUser);

    const payload = {
      nome: formData.nome || '',
      cargo: formData.cargo || '',
      contato: formData.contato || '',
      categoria: formData.categoria || '',
      oficial: formData.oficial || false
    };

    try {
      if (editingItem) {
        const updated = await atualizarFonteWorker(authToken, editingItem.id, payload, userId);
        setFontes(prev => prev.map(f => f.id === editingItem.id ? updated : f));
      } else {
        const created = await criarFonteWorker(authToken, payload, userId);
        setFontes(prev => [created, ...prev]);
      }
      closeModal();
      setUiAlert({ type: 'success', message: 'Fonte salva.' });
    } catch (error) {
      console.warn('Erro ao salvar fonte', error);
      setUiAlert({ type: 'error', message: 'Não foi possível salvar a fonte.' });
    }
  }, [editingItem, formData, closeModal, currentUser, authToken]);

  const saveTemplate = useCallback(async () => {
    const userId = getUserKey(currentUser);

    const payload = {
      nome: formData.nome || 'Novo Template',
      conteudo: formData.conteudo || ''
    };
    const tags = parseTagsInput(formData.templateTags || '');
    const categoria = formData.templateCategoria || '';
    const favorito = !!formData.templateFavorito;

    try {
      if (editingItem) {
        const updated = await atualizarTemplateWorker(authToken, editingItem.id, payload, userId);
        const meta = upsertTemplateMeta(updated.id, { tags, categoria, favorito });
        setTemplates(prev => prev.map(template => template.id === editingItem.id ? { ...updated, ...meta } : template));
      } else {
        const created = await criarTemplateWorker(authToken, payload, userId);
        const meta = upsertTemplateMeta(created.id, { tags, categoria, favorito });
        setTemplates(prev => [{ ...created, ...meta }, ...prev]);
      }
      closeModal();
      setUiAlert({ type: 'success', message: 'Template salvo.' });
    } catch (error) {
      console.warn('Erro ao salvar template', error);
      setUiAlert({ type: 'error', message: 'Não foi possível salvar o template.' });
    }
  }, [editingItem, formData, closeModal, currentUser, authToken, parseTagsInput]);

  const deletePauta = useCallback(async (id) => {
    const userId = getUserKey(currentUser);
    try {
      await deletarPautaWorker(authToken, id, userId);
      setPautas(prev => prev.filter(p => p.id !== id));
      setUiAlert({ type: 'success', message: 'Pauta removida.' });
    } catch (error) {
      console.warn('Erro ao remover pauta', error);
      setUiAlert({ type: 'error', message: 'Não foi possível remover a pauta.' });
    }
  }, [currentUser, authToken]);

  const deleteFonte = useCallback(async (id) => {
    const userId = getUserKey(currentUser);
    try {
      await deletarFonteWorker(authToken, id, userId);
      setFontes(prev => prev.filter(f => f.id !== id));
      setUiAlert({ type: 'success', message: 'Fonte removida.' });
    } catch (error) {
      console.warn('Erro ao remover fonte', error);
      setUiAlert({ type: 'error', message: 'Não foi possível remover a fonte.' });
    }
  }, [currentUser, authToken]);

  const getStatusColor = useCallback((status) => {
    switch(status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'em-andamento': return 'bg-jorna-100 text-jorna-800';
      case 'concluido': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-jorna-brown';
    }
  }, []);

  const getDaysUntilDeadline = useCallback((deadline) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    return diff;
  }, []);

  const syncWithGoogleCalendar = useCallback(() => {
    if (!pautas.length) {
      alert('Cadastre pelo menos uma pauta para exportar para a agenda.');
      return;
    }

    const toICSDate = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const deadlineToDate = (deadline, hour = 9) => {
      if (!deadline) return null;
      const dt = new Date(`${deadline}T${String(hour).padStart(2, '0')}:00:00`);
      return toICSDate(dt);
    };

    const dtStamp = toICSDate(new Date());

    const events = pautas
      .map(pauta => {
        const start = deadlineToDate(pauta.deadline, 9);
        if (!start) return null;
        const end = deadlineToDate(pauta.deadline, 10);
        return [
          'BEGIN:VEVENT',
          `UID:${pauta.id}@jornasa`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${start}`,
          `DTEND:${end}`,
          `SUMMARY:${pauta.titulo || 'Pauta'}`,
          `DESCRIPTION:${(pauta.descricao || '').replace(/\n/g, '\\n')}`,
          'END:VEVENT'
        ].join('\n');
      })
      .filter(Boolean)
      .join('\n');

    if (!events) {
      alert('Nenhuma pauta possui deadline para enviar à agenda.');
      return;
    }

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jornasa//Pautas//PT-BR',
      'CALSCALE:GREGORIAN',
      events,
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pautas-jornasa.ics';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, [pautas]);

  const openModal = useCallback((type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item || {});
    setShowModal(true);
  }, []);

  const handleEditTemplate = useCallback((template) => {
    const meta = getTemplateMeta(template.id);
    const parsed = parseTemplateContent(template.conteudo || '');
    setModalType('template');
    setEditingItem(template);
    setFormData({
      ...template,
      templateTags: (meta.tags || []).join(', '),
      templateCategoria: meta.categoria || '',
      templateFavorito: meta.favorito || false,
      templateTitulo: parsed.templateTitulo,
      templateTexto: parsed.templateTexto,
      templateFonte: parsed.templateFonte,
    });
    setShowModal(true);
  }, []);

  const handleAddTemplate = useCallback(() => {
    setModalType('template');
    setEditingItem(null);
    setFormData({
      nome: '',
      conteudo: '',
      templateTags: '',
      templateCategoria: '',
      templateFavorito: false,
      templateTitulo: '',
      templateTexto: '',
      templateFonte: '',
    });
    setShowModal(true);
  }, []);

  const filteredPautas = pautas.filter(p => {
    const matchSearch = p.titulo.toLowerCase().includes(searchTermPautas.toLowerCase());
    const matchFilter = filterStatus === 'todos' || p.status === filterStatus;
    return matchSearch && matchFilter;
  });

  const filteredFontes = fontes.filter(f => 
    f.nome.toLowerCase().includes(searchTermFontes.toLowerCase()) ||
    f.categoria.toLowerCase().includes(searchTermFontes.toLowerCase())
  );

  // HomeView is defined at top-level (memoized) to avoid remounts.

  const [verifyText, setVerifyText] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const handleSetVerifyText = useCallback((value) => {
    setVerifyText(value);
  }, []);

  const normalizeDomain = useCallback((urlOrText) => {
    try {
      if (!urlOrText) return null;
      const text = urlOrText.trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const url = new URL(text);
        return url.hostname.replace(/^www\./, '').toLowerCase();
      }
      const matches = text.match(/(?:https?:\/\/)?(?:www\.)?([^\s/]+)/i);
      if (matches?.[1]) {
        return matches[1].replace(/^www\./, '').toLowerCase();
      }
    } catch (error) {
      console.warn('Não foi possível normalizar o domínio', error);
    }
    return null;
  }, []);

  const verificarFonte = useCallback(() => {
    if (!verifyText.trim()) return;

    setVerifying(true);
    setTimeout(() => {
      const input = verifyText.trim();
      const domain = normalizeDomain(input);

      if (!domain) {
        setVerifyResult({
          confiavel: false,
          score: 20,
          detalhes: ['Não foi possível identificar um domínio na entrada fornecida. Informe uma URL válida.']
        });
        setVerifying(false);
        return;
      }

      const matchingSource = officialSources.find((source) =>
        source.dominios.some((dominio) => domain === dominio.replace(/^www\./, '').toLowerCase())
      );

      const matchingSuffix = officialDomainSuffixes.find((suffix) => {
        const normalizedSuffix = suffix.startsWith('.') ? suffix.slice(1) : suffix;
        return domain.endsWith(normalizedSuffix);
      });

      if (matchingSource) {
        setVerifyResult({
          confiavel: true,
          score: 95,
          detalhes: [
            `Domínio reconhecido: ${domain}`,
            `Fonte oficial cadastrada: ${matchingSource.nome}`,
            `Categoria: ${matchingSource.categoria}`
          ]
        });
      } else if (matchingSuffix) {
        setVerifyResult({
          confiavel: true,
          score: 80,
          detalhes: [
            `Domínio reconhecido: ${domain}`,
            `Termina com ${matchingSuffix}, um sufixo reservado a órgãos oficiais no Brasil.`,
            'Confirme qual órgão específico é responsável pelo conteúdo.'
          ]
        });
      } else {
        setVerifyResult({
          confiavel: false,
          score: 40,
          detalhes: [
            `Domínio não encontrado na base de fontes oficiais: ${domain}`,
            'Verifique se o endereço pertence a um órgão público conhecido.',
            'Considere buscar a notícia em portais oficiais para confirmação.'
          ]
        });
      }

      setVerifying(false);
    }, 1200);
  }, [verifyText, normalizeDomain]);

  const PerfilView = () => (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold text-jorna-brown mb-6">Perfil</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 text-center sm:text-left">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br from-jorna-500 to-jorna-600 overflow-hidden mx-auto sm:mx-0">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser?.nome || 'Foto de perfil'} className="w-full h-full object-cover" />
            ) : (
              currentUser?.iniciais || 'JD'
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{currentUser?.nome || 'Jornalista'}</h2>
            <p className="text-gray-600">{currentUser?.email || 'contato@jornasa.com'}</p>
            <button
              onClick={handleProfileAvatarPicker}
              className="mt-2 text-sm text-jorna-600 hover:text-jorna-700 font-medium"
            >
              Alterar foto de perfil
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between py-3 border-b">
            <span className="text-gray-700">Pautas Criadas</span>
            <span className="font-semibold text-jorna-600">{pautas.length}</span>
          </div>
          <div className="flex justify-between py-3 border-b">
            <span className="text-gray-700">Fontes Cadastradas</span>
            <span className="font-semibold text-jorna-600">{fontes.length}</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-gray-700">Pautas Concluídas</span>
            <span className="font-semibold text-green-600">{pautas.filter(p => p.status === 'concluido').length}</span>
          </div>
        </div>

        <input
          ref={profileAvatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarFileSelected}
          className="hidden"
        />
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        <button onClick={toggleNotifications} className="w-full text-left py-4 px-4 hover:bg-gray-50 transition flex items-center gap-3">
          <Bell size={20} className="text-gray-600" />
          <span>Notificações</span>
        </button>
        <button onClick={syncWithGoogleCalendar} className="w-full text-left py-4 px-4 hover:bg-gray-50 transition flex items-center gap-3">
          <FileText size={20} className="text-gray-600" />
          <span>Sincronizar Google Agenda</span>
        </button>
        <button onClick={handleLogout} className="w-full text-left py-4 px-4 hover:bg-gray-50 transition flex items-center gap-3 text-red-500">
          <X size={20} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-jorna-600 to-jorna-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center">
              <img src="/3.png" alt="Jornasa" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-jorna-brown text-center">Bem-vindo ao JornasaApp</h1>
            <p className="text-gray-600 text-center text-sm">Acesse sua conta para gerenciar pautas e fontes.</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                  placeholder="Seu nome"
                  required={isRegistering}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                placeholder="voce@jornasa.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-jorna-500 outline-none"
                  placeholder="Repita a senha"
                  required={isRegistering}
                />
              </div>
            )}
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-jorna-600 text-white py-3 rounded-lg font-semibold hover:bg-jorna-700 transition"
            >
              {isRegistering ? 'Criar conta' : 'Entrar'}
            </button>
            <div className="mt-4">
              <div className="flex items-center gap-2 my-3">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-500">ou</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="flex justify-center">
                <div ref={googleButtonRef} className="flex justify-center" />
              </div>
            </div>
          </form>
          <p className="text-center text-sm text-gray-600 mt-4">
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="text-jorna-600 font-semibold hover:text-jorna-700"
            >
              {isRegistering ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const profileHeaderName = getFirstAndLastName(currentUser?.nome || '');

  const unreadCount = notifications.filter(notification => !notification.read).length;
  const hasUnreadNotifications = unreadCount > 0;
  const canUseWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-20">
      <div className="bg-gradient-to-r from-jorna-600 to-jorna-700 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-row items-center justify-between text-center gap-3 md:gap-6 md:items-center md:justify-between md:text-center">
              <div className="flex items-center justify-start w-1/4 md:w-1/4 md:pl-4">
                <button
                  onClick={() => { setCurrentView('home'); setShowNotifications(false); setShowProfileMenu(false); }}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
                  aria-label="Ir para a página inicial"
                  type="button"
                >
                  <img src="/2.png" alt="Jornasa" className="w-full h-full object-contain" />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 flex-1 text-center">
                <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight leading-tight">O futuro do jornalismo começa agora.</h1>
                <p className="text-xs md:text-sm text-white/80 leading-tight">Bem-vindo(a) ao Jornasa.</p>
              </div>
            <div className="flex items-start md:items-center justify-end gap-3 w-1/4 md:w-1/4">
              <div className="relative mt-4 md:mt-0">
                <button
                  ref={notificationButtonRef}
                  onClick={toggleNotifications}
                  className="hover:bg-jorna-500 p-1 rounded-full transition relative focus:outline-none focus:ring-2 focus:ring-white/60"
                  aria-label="Abrir notificações"
                >
                  <Bell size={16} className="sm:size-18" />
                  {hasUnreadNotifications && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] sm:text-xs font-semibold rounded-full px-1.5">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div
                    ref={notificationPanelRef}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-6 w-[85vw] max-w-[320px] sm:w-72 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 md:left-auto md:right-0 md:translate-x-0 md:mt-3 md:w-72 md:max-w-xs"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <span className="font-semibold text-jorna-brown">Notificações</span>
                      {notifications.length > 0 && (
                        <button
                          onClick={markAllNotificationsAsRead}
                          className="text-xs text-jorna-500 hover:text-jorna-700 font-medium"
                        >
                          Marcar todas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length ? (
                        notifications.map(notification => (
                          <button
                            key={notification.id}
                            onClick={() => markNotificationAsRead(notification.id)}
                            className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                              notification.read ? 'bg-white' : 'bg-jorna-50'
                            }`}
                          >
                            <p className="text-sm font-semibold text-jorna-700">{notification.titulo}</p>
                            <p className="text-xs text-gray-600 mt-1">{notification.descricao}</p>
                            <span className="text-[11px] text-gray-400 mt-2 inline-block">{notification.data}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">
                          Nenhuma notificação por aqui.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative flex flex-col items-center text-center text-white gap-1">
                <input
                  ref={quickAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileSelected}
                />
                <button
                  ref={profileButtonRef}
                  onClick={toggleProfileMenu}
                  className="flex flex-col items-center gap-1 focus:outline-none"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white text-base font-semibold overflow-hidden">
                    {currentUser?.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.nome} className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.iniciais || 'JA'
                    )}
                  </div>
                  <span className="text-sm font-semibold">
                    {profileHeaderName || 'Perfil'}
                  </span>
                </button>

                {showProfileMenu && (
                  <div
                    ref={profilePanelRef}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-6 w-[85vw] max-w-[320px] sm:w-72 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 md:left-auto md:right-0 md:translate-x-0 md:mt-3 md:w-72 md:max-w-xs"
                  >
                    <div className="px-4 py-3 border-b bg-jorna-50">
                      <p className="text-sm text-gray-500">Logado como</p>
                      <p className="font-semibold text-jorna-brown">{currentUser?.nome}</p>
                      <p className="text-xs text-gray-500">{currentUser?.email}</p>
                    </div>
                    <button
                      onClick={() => { setCurrentView('perfil'); setShowProfileMenu(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <User size={16} />
                      Minha conta
                    </button>
                    <button
                      onClick={handleOpenAvatarPicker}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm border-t"
                    >
                      <Edit2 size={16} />
                      Alterar foto de perfil
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-red-500 border-t"
                    >
                      <X size={16} />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pb-16 px-4">
        {currentView === 'home' && <HomeView filteredPautas={filteredPautas} searchTermPautas={searchTermPautas} onSearchTermPautasChange={handleSetSearchTermPautas} filterStatus={filterStatus} onFilterStatusChange={handleSetFilterStatus} getDaysUntilDeadline={getDaysUntilDeadline} getStatusColor={getStatusColor} openModal={openModal} deletePauta={deletePauta} loading={loadingPautas} />}
        {currentView === 'chatbot' && (
          <ChatbotView
            messages={chatMessages}
            messagesLoading={chatMessagesLoading}
            chatInput={chatInput}
            onInputChange={handleChatInputChange}
            onSendMessage={sendChatMessage}
            onNewChat={handleNewChat}
            onOpenHistory={() => setShowChatHistory(true)}
            historyCount={chatHistory.length}
            buscarWeb={buscarWeb}
            onToggleBuscarWeb={setBuscarWeb}
            loading={chatLoading}
            chatListRef={chatListRef}
            chatInputRef={chatInputRef}
          />
        )}
        {currentView === 'fontes' && <FontesView filteredFontes={filteredFontes} searchTermFontes={searchTermFontes} setSearchTermFontes={handleSetSearchTermFontes} openModal={openModal} deleteFonte={deleteFonte} />}
        {currentView === 'guias' && (
          <GuiasView
            verifyText={verifyText}
            onVerifyTextChange={handleSetVerifyText}
            verificarFonte={verificarFonte}
            verifying={verifying}
            verifyResult={verifyResult}
            templates={filteredTemplates}
            guias={guias}
            onTemplateAction={handleTemplateShareOrCopy}
            copiedTemplateId={copiedTemplateId}
            canShareTemplates={canUseWebShare}
            onEditTemplate={handleEditTemplate}
            onAddTemplate={handleAddTemplate}
            templateSearch={templateSearch}
            onTemplateSearchChange={setTemplateSearch}
            templateTagFilter={templateTagFilter}
            onTemplateTagChange={setTemplateTagFilter}
            templateOnlyFavorites={templateOnlyFavorites}
            onToggleTemplateOnlyFavorites={() => setTemplateOnlyFavorites(prev => !prev)}
            availableTemplateTags={availableTemplateTags}
            onUseTemplate={handleUseTemplateInChat}
            onDuplicateTemplate={handleDuplicateTemplate}
            onToggleTemplateFavorite={handleToggleTemplateFavorite}
          />
        )}
        {currentView === 'perfil' && <PerfilView />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex justify-around p-2 max-w-6xl mx-auto px-2">
          <button
            onClick={() => {setCurrentView('home'); setSearchTermPautas('');}}
            className={`flex flex-col items-center p-2 rounded-lg transition ${currentView === 'home' ? 'text-jorna-600 bg-jorna-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileText size={24} />
            <span className="text-xs mt-1 font-medium">Pautas</span>
          </button>
          <button
            onClick={() => setCurrentView('chatbot')}
            className={`flex flex-col items-center p-2 rounded-lg transition ${currentView === 'chatbot' ? 'text-jorna-600 bg-jorna-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <MessageCircle size={24} />
            <span className="text-xs mt-1 font-medium">Chat IA</span>
          </button>
          <button
            onClick={() => {setCurrentView('fontes'); setSearchTermFontes('');}}
            className={`flex flex-col items-center p-2 rounded-lg transition ${currentView === 'fontes' ? 'text-jorna-600 bg-jorna-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Users size={24} />
            <span className="text-xs mt-1 font-medium">Fontes</span>
          </button>
          <button
            onClick={() => setCurrentView('guias')}
            className={`flex flex-col items-center p-2 rounded-lg transition ${currentView === 'guias' ? 'text-jorna-600 bg-jorna-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <BookOpen size={24} />
            <span className="text-xs mt-1 font-medium">Guias</span>
          </button>
          <button
            onClick={() => setCurrentView('perfil')}
            className={`flex flex-col items-center p-2 rounded-lg transition ${currentView === 'perfil' ? 'text-jorna-600 bg-jorna-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <User size={24} />
            <span className="text-xs mt-1 font-medium">Perfil</span>
          </button>
        </div>
      </div>

      <ModalComponent
        showModal={showModal}
        modalType={modalType}
        editingItem={editingItem}
        formData={formData}
        onClose={closeModal}
        onUpdateField={updateField}
        onSavePauta={savePauta}
        onSaveFonte={saveFonte}
        onSaveTemplate={saveTemplate}
      />
      {renderChatHistory()}
      <Toast alert={uiAlert} onClose={() => setUiAlert(null)} />
    </div>
  );
};

export default JornalismoApp;
