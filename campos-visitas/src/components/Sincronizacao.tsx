import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/database';
import { iniciarSincronizacao, type EstadoSync } from '../services/sincronizacao';
import { exportarBackupLegado } from '../services/backup';
import { useConta } from '../services/conta';
import './Sincronizacao.css';
import { paraLocal } from '../services/syncMap';

const nomesTabelas: Record<string, string> = { medicos: 'médicos', secretarias: 'secretárias', produtos: 'produtos', visitas: 'visitas',
  formularios: 'formulários', visitaProdutos: 'produtos da visita', historicoReagendamentos: 'reagendamentos' };
const nomesCampos: Record<string, string> = { nome: 'Nome', data: 'Data', horaInicio: 'Início', horaFim: 'Fim', status: 'Situação',
  especialidade: 'Especialidade', clinica: 'Clínica', telefone: 'Telefone', observacoes: 'Observações', excluidoEm: 'Excluído em',
  categoria: 'Categoria', descricao: 'Descrição', ativo: 'Ativo', localTrabalho: 'Local de trabalho', quantidadeAmostras: 'Amostras',
  temaTrabalhado: 'Tema trabalhado', produtosAbordados: 'Produtos abordados', nomeMedico: 'Médico', nomeSecretaria: 'Secretária',
  produtosSelecionados: 'Produtos selecionados', anotacoesAdicionais: 'Anotações adicionais', atualizadoEm: 'Atualizado em' };
function valorLegivel(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return 'Não informado';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (Array.isArray(valor)) return valor.map(v => typeof v === 'object' && v?.nome
    ? `${v.nome}${v.quantidadeAmostras !== undefined ? ` (${v.quantidadeAmostras} amostras)` : ''}` : String(v)).join(', ') || 'Nenhum';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

const rotulos: Record<EstadoSync['status'], string> = { conferindo: 'Conferindo sincronização…', sincronizado: 'Sincronizado',
  offline: 'Sem internet — dados salvos neste aparelho', pendente: 'Alterações aguardando envio',
  erro: 'Sincronização indisponível — dados locais preservados', conflito: 'Escolha qual versão manter' };
export default function Sincronizacao({ sessaoInvalida }: { sessaoInvalida: () => void }) {
  const { usuarioId } = useConta();
  const [estado, setEstado] = useState<EstadoSync>({ status: 'conferindo', pendencias: 0 });
  const [erro, setErro] = useState('');
  const [resolvendo, setResolvendo] = useState(false);
  const servico = useRef<ReturnType<typeof iniciarSincronizacao> | null>(null);
  const invalidarRef = useRef(sessaoInvalida);
  useEffect(() => { invalidarRef.current = sessaoInvalida; }, [sessaoInvalida]);
  useEffect(() => {
    const atual = iniciarSincronizacao(usuarioId, setEstado, () => invalidarRef.current());
    servico.current = atual;
    return () => { atual.parar(); servico.current = null; };
  }, [usuarioId]);
  // A outbox é gravada na transação nativa; o sinal de commit também cobre as consultas reativas.
  const [mudanca, setMudanca] = useState(0);
  useEffect(() => {
    const atualizar = () => setMudanca(v => v + 1);
    window.addEventListener('campos-gravacao-local', atualizar);
    return () => window.removeEventListener('campos-gravacao-local', atualizar);
  }, []);
  const conflitos = useLiveQuery(() => db.conflitosSync.where('usuarioId').equals(usuarioId).toArray(), [usuarioId, mudanca]);
  const legado = useLiveQuery(() => db.backupsLegados.get('testes-v2'), []);
  return <section className="sync-painel" aria-label="Sincronização">
    <div role="status"><strong>{rotulos[estado.status]}</strong>
      <span>{estado.pendencias} pendência(s). {estado.ultima ? `Última sincronização: ${new Date(estado.ultima).toLocaleString('pt-BR')}` : 'Ainda sem sincronização concluída.'}</span>
    </div>
    <button type="button" disabled={estado.status === 'conferindo'} onClick={() => servico.current?.tentar()}>Sincronizar agora</button>
    {estado.mensagem && <p role="alert">{estado.mensagem}</p>}
    {legado && Object.values(legado.registros).some(r => r.length) && <button type="button" onClick={() => {
      void exportarBackupLegado().catch(() => setErro('Não foi possível exportar os dados de teste.'));
    }}>Baixar backup dos testes antigos</button>}
    {conflitos?.map(c => {
      const remoto = paraLocal(c.tabela, c.remoto);
      const campos = [...new Set([...Object.keys(c.local), ...Object.keys(remoto)])]
        .filter(k => !['id', 'usuarioId', 'sincronizacao', 'criadoEm'].includes(k) && !/Ids?$/.test(k))
        .filter(k => JSON.stringify(c.local[k]) !== JSON.stringify(remoto[k]));
      return <article key={c.id} className="sync-conflito">
      <h2>Conflito em {nomesTabelas[c.tabela]}: {String(c.local.nome ?? c.local.nomeMedico ?? c.local.data ?? 'Registro alterado')}</h2>
      <p>Este registro mudou nos dois aparelhos. Confira as diferenças antes de escolher uma versão.</p>
      <div className="sync-versoes"><table><thead><tr><th>Campo</th><th>Neste aparelho</th><th>No Supabase</th></tr></thead>
        <tbody>{campos.map(campo => <tr key={campo}><th>{nomesCampos[campo] ?? campo.replace(/([A-Z])/g, ' $1')}</th>
          <td>{valorLegivel(c.local[campo])}</td><td>{valorLegivel(remoto[campo])}</td></tr>)}</tbody></table></div>
      {(['local', 'remoto'] as const).map(escolha => <button type="button" key={escolha} disabled={resolvendo || estado.status === 'conferindo'} onClick={async () => {
        setResolvendo(true); setErro('');
        try { await servico.current?.resolver(c, escolha); }
        catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível resolver o conflito.'); }
        finally { setResolvendo(false); }
      }}>{escolha === 'local' ? 'Manter versão deste aparelho' : 'Usar versão do Supabase'}</button>)}
    </article>; })}
    {erro && <p role="alert">{erro}</p>}
  </section>;
}
