import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Produto } from '../database/database';
import { salvarProduto, type DadosProduto } from '../database/catalogos';
import { normalizarTexto } from '../utils/texto';
import './Medicos.css';
import './Cadastros.css';

const USUARIO = 'usuario-local-teste';
const inicial: DadosProduto = { nome: '', categoria: '', descricao: '', observacoes: '', ativo: true };

export default function Produtos() {
  const [dados, setDados] = useState(inicial);
  const [editando, setEditando] = useState<string>();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [situacao, setSituacao] = useState('ativos');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const trava = useRef(false);
  const produtos = useLiveQuery(() => db.produtos.where('usuarioId').equals(USUARIO).filter(p => !p.excluidoEm).toArray(), []);
  const lista = (produtos ?? []).filter(p => (situacao === 'todos' || p.ativo === (situacao === 'ativos')) &&
    normalizarTexto(`${p.nome} ${p.categoria ?? ''} ${p.descricao ?? ''}`).includes(normalizarTexto(buscaAplicada)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  function editar(produto?: Produto) {
    setDados(produto ? { nome: produto.nome, categoria: produto.categoria ?? '', descricao: produto.descricao ?? '',
      observacoes: produto.observacoes ?? '', ativo: produto.ativo } : inicial);
    setEditando(produto?.id); setAberto(true); setErro(''); setMensagem('');
  }
  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (trava.current) return;
    trava.current = true; setSalvando(true); setErro('');
    try {
      await salvarProduto(USUARIO, dados, editando);
      setAberto(false); setMensagem('Produto salvo offline.');
    } catch (error) { setErro(error instanceof Error ? error.message : 'Erro ao salvar o produto.'); }
    finally { trava.current = false; setSalvando(false); }
  }
  return <div className="medicos-pagina cadastros-pagina">
    <header className="medicos-cabecalho cabecalho-com-busca"><div><h1>Produtos</h1><p>Seu catálogo disponível também sem internet.</p></div>
      <form className="busca-cabecalho" role="search" aria-label="Pesquisar produtos" onSubmit={e => { e.preventDefault(); setBuscaAplicada(busca); }}>
        <label className="busca-texto">Buscar produto<input type="search" value={busca} placeholder="Nome, categoria ou descrição"
          onChange={e => { setBusca(e.target.value); if (!e.target.value) setBuscaAplicada(''); }} /></label>
        <button className="botao-pesquisa" type="submit">Pesquisar</button>
        <label>Situação<select value={situacao} onChange={e => setSituacao(e.target.value)}><option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option><option value="todos">Todos</option></select></label>
      </form>
      <button className="medicos-botao-principal" disabled={salvando} onClick={() => editar()}>+ Novo produto</button></header>
    {mensagem && <p role="status">{mensagem}</p>}
    {aberto && <section className="medicos-card"><h2>{editando ? 'Editar produto' : 'Cadastrar produto'}</h2>
      <form onSubmit={salvar}><fieldset disabled={salvando} className="cadastro-campos">
        <div className="medicos-grid">
          <label>Nome *<input required maxLength={160} value={dados.nome} onChange={e => setDados({ ...dados, nome: e.target.value })} /></label>
          <label>Categoria<input maxLength={100} value={dados.categoria} onChange={e => setDados({ ...dados, categoria: e.target.value })} /></label>
          <label>Descrição<textarea value={dados.descricao} onChange={e => setDados({ ...dados, descricao: e.target.value })} /></label>
          <label>Observações<textarea value={dados.observacoes} onChange={e => setDados({ ...dados, observacoes: e.target.value })} /></label>
          <label>Situação<select value={String(dados.ativo)} onChange={e => setDados({ ...dados, ativo: e.target.value === 'true' })}>
            <option value="true">Ativo</option><option value="false">Inativo</option></select></label>
        </div>
        {erro && <p role="alert" className="medicos-erro">{erro}</p>}
        <div className="medicos-acoes"><button type="button" onClick={() => setAberto(false)}>Cancelar</button>
          <button className="medicos-botao-principal" type="submit">{salvando ? 'Salvando...' : 'Salvar produto'}</button></div>
      </fieldset></form></section>}
    <section className="medicos-card"><div className="medicos-lista-topo"><h2>Catálogo ({lista.length})</h2>
      </div>
      {produtos === undefined ? <p>Carregando produtos...</p> : !lista.length ? <p className="medicos-vazio">Nenhum produto encontrado.</p> :
        lista.map(p => <article className="medicos-item" key={p.id}><div className="medicos-info"><strong>{p.nome}</strong>
          <span>{p.categoria || 'Sem categoria'} · {p.ativo ? 'Ativo' : 'Inativo'}</span><span>{p.descricao}</span>
          {p.observacoes && <small>{p.observacoes}</small>}</div><button disabled={salvando} onClick={() => editar(p)}>Editar</button></article>)}
    </section></div>;
}
