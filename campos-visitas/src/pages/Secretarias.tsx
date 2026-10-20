import { useConta } from '../services/conta';
import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Secretaria } from '../database/database';
import { salvarSecretaria, type DadosSecretaria } from '../database/catalogos';
import { normalizarTexto } from '../utils/texto';
import './Medicos.css';
import './Cadastros.css';
const inicial: DadosSecretaria = { nome: '', telefone: '', localTrabalho: '', observacoes: '', medicoIds: [] };
export default function Secretarias() {
  const { usuarioId } = useConta();
  const [dados, setDados] = useState(inicial);
  const [editando, setEditando] = useState<string>();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const medicos = useLiveQuery(() => db.medicos.where('usuarioId').equals(usuarioId).filter(m => !m.excluidoEm).sortBy('nome'), []);
  const secretarias = useLiveQuery(() => db.secretarias.where('usuarioId').equals(usuarioId).filter(s => !s.excluidoEm).toArray(), []);
  function completarContato(contato: DadosSecretaria): DadosSecretaria {
    const vinculados = contato.medicoIds.map(id => medicos?.find(m => m.id === id)).filter(m => !!m);
    const telefones = [...new Set(vinculados.map(m => m.telefone?.trim()).filter(Boolean))].join(' / ');
    const locais = [...new Set(vinculados.map(m => m.clinica?.trim() || m.endereco?.trim()).filter(Boolean))].join(' / ');
    return { ...contato, telefone: contato.telefone || telefones, localTrabalho: contato.localTrabalho || locais };
  }
  function editar(s?: Secretaria) {
    setDados(s ? completarContato( { nome: s.nome, telefone: s.telefone ?? '', localTrabalho: s.localTrabalho ?? '',
      observacoes: s.observacoes ?? '', medicoIds: s.medicoIds ?? [s.medicoId] }) : inicial);
    setEditando(s?.id); setAberto(true); setErro(''); setMensagem('');
  }
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (trava.current) return;
    trava.current = true; setSalvando(true); setErro('');
    try { await salvarSecretaria(usuarioId, dados, editando); setAberto(false); setMensagem('Secretária salva offline.'); }
    catch (error) { setErro(error instanceof Error ? error.message : 'Erro ao salvar.'); }
    finally { trava.current = false; setSalvando(false); }
  }
  const lista = (secretarias ?? []).map(s => ({ ...s, ...completarContato({
    nome: s.nome, telefone: s.telefone, localTrabalho: s.localTrabalho, observacoes: s.observacoes,
    medicoIds: s.medicoIds ?? [s.medicoId]
  }) })).filter(s => normalizarTexto(`${s.nome} ${s.localTrabalho ?? ''} ${s.telefone ?? ''}`).includes(normalizarTexto(buscaAplicada)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return <div className="medicos-pagina cadastros-pagina">
    <header className="medicos-cabecalho cabecalho-com-busca"><div><h1>Secretárias</h1><p>Contatos vinculados a um ou mais médicos.</p></div>
      <form className="busca-cabecalho" role="search" aria-label="Pesquisar secretárias" onSubmit={e => { e.preventDefault(); setBuscaAplicada(busca); }}>
        <label className="busca-texto">Buscar secretária<input type="search" placeholder="Nome, telefone ou local de trabalho" value={busca}
          onChange={e => { setBusca(e.target.value); if (!e.target.value) setBuscaAplicada(''); }} /></label>
        <button className="botao-pesquisa" type="submit">Pesquisar</button>
      </form>
      <button className="medicos-botao-principal" disabled={salvando} onClick={() => editar()}>+ Nova secretária</button></header>
    {mensagem && <p role="status">{mensagem}</p>}
    {aberto && <section className="medicos-card"><h2>{editando ? 'Editar secretária' : 'Cadastrar secretária'}</h2><form onSubmit={salvar}>
      <fieldset className="cadastro-campos" disabled={salvando}><div className="medicos-grid">
        <label>Nome *<input required value={dados.nome} onChange={e => setDados({ ...dados, nome: e.target.value })} /></label>
        <label>Telefone<input type="tel" value={dados.telefone} onChange={e => setDados({ ...dados, telefone: e.target.value })} /></label>
        <label>Local de trabalho<input value={dados.localTrabalho} onChange={e => setDados({ ...dados, localTrabalho: e.target.value })} /></label>
        <label>Observações<textarea value={dados.observacoes} onChange={e => setDados({ ...dados, observacoes: e.target.value })} /></label>
      </div><fieldset className="cadastro-vinculos"><legend>Médicos vinculados *</legend>
        {!medicos?.length && <p>Cadastre um médico antes de cadastrar sua secretária.</p>}
        {medicos?.map(m => <label className="cadastro-opcao" key={m.id}><input type="checkbox" checked={dados.medicoIds.includes(m.id)}
          onChange={e => setDados(completarContato({ ...dados, medicoIds: e.target.checked ? [...dados.medicoIds, m.id] : dados.medicoIds.filter(id => id !== m.id) }))} />{m.nome}</label>)}
      </fieldset>{erro && <p className="medicos-erro" role="alert">{erro}</p>}
      <div className="medicos-acoes"><button type="button" onClick={() => setAberto(false)}>Cancelar</button>
        <button type="submit" className="medicos-botao-principal">{salvando ? 'Salvando...' : 'Salvar secretária'}</button></div></fieldset>
    </form></section>}
    {!aberto && <section className="medicos-card"><div className="medicos-lista-topo"><h2>Contatos ({lista.length})</h2>
      </div>
      {secretarias === undefined ? <p>Carregando...</p> : !lista.length ? <p className="medicos-vazio">Nenhuma secretária encontrada.</p> : lista.map(s =>
        <article className="medicos-item" key={s.id}><div className="medicos-info"><strong>{s.nome}</strong><span>{s.telefone || 'Telefone não informado'}</span>
          <span>{s.localTrabalho}</span><small>{(s.medicoIds ?? [s.medicoId]).map(id => medicos?.find(m => m.id === id)?.nome ?? 'Médico indisponível').join(', ')}</small>
          <small>{s.observacoes}</small></div><button disabled={salvando} onClick={() => editar(s)}>Editar</button></article>)}
    </section>}</div>;
}
