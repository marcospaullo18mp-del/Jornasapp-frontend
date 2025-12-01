import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSupabaseSession } from '../hooks/useSupabaseSession';
import { workerApi, type Pauta, type PautaPayload } from '../lib/workerApi';

export function WorkerApiExamples() {
  const { user, accessToken, loading, signInWithEmail, signOut } = useSupabaseSession();
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [mensagemResposta, setMensagemResposta] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    if (!accessToken) {
      setPautas([]);
      return;
    }

    workerApi
      .listarPautas()
      .then(setPautas)
      .catch((error) => setStatus(error.message));
  }, [accessToken]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await signInWithEmail(form.email, form.password);
      setStatus('');
    } catch (error: any) {
      setStatus(error.message ?? 'Erro ao logar');
    }
  };

  const handleCriarPauta = async () => {
    const payload: PautaPayload = {
      titulo: 'Pauta criada pelo exemplo',
      descricao: 'Demonstração rápida de POST /pautas',
      status: 'pendente',
      deadline: new Date().toISOString(),
    };

    try {
      const criada = await workerApi.criarPauta(payload);
      setPautas((prev) => [criada, ...prev]);
    } catch (error: any) {
      setStatus(error.message ?? 'Erro ao criar pauta');
    }
  };

  const handleEnviarMensagem = async () => {
    try {
      const resposta = await workerApi.enviarMensagem({
        mensagem: 'Olá, Worker! Pode me dar um resumo?',
        buscar_web: false,
      });
      setMensagemResposta(resposta.resposta ?? JSON.stringify(resposta));
    } catch (error: any) {
      setStatus(error.message ?? 'Erro ao enviar mensagem');
    }
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', padding: 16, borderRadius: 12, marginTop: 16 }}>
      <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Exemplos de integração Worker + Supabase</h3>
      {loading ? <p>Carregando sessão...</p> : null}
      {status ? <p style={{ color: '#b42318' }}>{status}</p> : null}

      {!user ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            type="email"
            placeholder="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            style={{ padding: 8, flex: '1 1 220px' }}
          />
          <input
            type="password"
            placeholder="senha"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            style={{ padding: 8, flex: '1 1 160px' }}
          />
          <button type="submit" style={{ padding: '8px 12px' }}>
            Entrar
          </button>
        </form>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>Logado como {user.email}</span>
          <button onClick={() => signOut()} style={{ padding: '6px 10px' }}>
            Sair
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => workerApi.listarPautas().then(setPautas)} disabled={!accessToken}>
          Listar pautas
        </button>
        <button onClick={handleCriarPauta} disabled={!accessToken}>
          Criar pauta
        </button>
        <button onClick={handleEnviarMensagem} disabled={!accessToken}>
          Enviar mensagem
        </button>
      </div>

      {mensagemResposta ? (
        <div style={{ marginBottom: 12 }}>
          <strong>Resposta do /mensagem:</strong>
          <p>{mensagemResposta}</p>
        </div>
      ) : null}

      <div>
        <strong>Pautas:</strong>
        <ul>
          {pautas.map((pauta) => (
            <li key={pauta.id}>
              {pauta.titulo} — {pauta.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
