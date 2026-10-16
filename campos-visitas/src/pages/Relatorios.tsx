import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/database';
import { calcularRelatorio, dataLocal, diasAntes } from '../utils/relatorios';
import './Medicos.css';
import './Relatorios.css';
const USUARIO = 'usuario-local-teste';
const formatar = (data: string) => data.split('-').reverse().join('/');
const rotulos = { agendada: 'Agendadas', realizada: 'Visitas realizadas', reagendada: 'Visitas remarcadas', cancelada: 'Canceladas' };
export default function Relatorios() {
  const [periodo, setPeriodo] = useState('30');
  const [inicio, setInicio] = useState(() => diasAntes(29));
  const [fim, setFim] = useState(() => dataLocal());
  const [aplicado, setAplicado] = useState(() => ({ inicio: diasAntes(29), fim: dataLocal() }));
  const [erro, setErro] = useState('');
  const dados = useLiveQuery(() => db.transaction('r', [db.medicos, db.visitas, db.produtos, db.visitaProdutos, db.formularios], async () => ({
    medicos: await db.medicos.where('usuarioId').equals(USUARIO).toArray(),
    visitas: await db.visitas.where('usuarioId').equals(USUARIO).toArray(),
    produtos: await db.produtos.where('usuarioId').equals(USUARIO).toArray(),
    vinculos: await db.visitaProdutos.where('usuarioId').equals(USUARIO).toArray(),
    formularios: await db.formularios.where('usuarioId').equals(USUARIO).toArray()
  })), []);
  const resumo = dados ? calcularRelatorio(dados.medicos, dados.visitas, dados.produtos, dados.vinculos, aplicado.inicio, aplicado.fim, new Date(), dados.formularios) : undefined;
  function buscar(e: FormEvent) {
    e.preventDefault();
    const datas = periodo === 'personalizado' ? { inicio, fim } : { inicio: diasAntes(Number(periodo) - 1), fim: dataLocal() };
    if (!datas.inicio || !datas.fim || datas.inicio > datas.fim) {
      setErro('Informe um período válido; a data inicial deve ser anterior ou igual à final.'); return;
    }
    setErro(''); setAplicado(datas);
  }
  return <div className="medicos-pagina relatorios-pagina">
    <header className="medicos-cabecalho"><div><h1>Relatórios</h1><p>Acompanhamento das visitas a partir dos registros deste aparelho.</p></div>
      <button className="medicos-botao-principal" disabled={!resumo} onClick={() => window.print()}>Imprimir / salvar PDF</button></header>
    <section className="medicos-card relatorios-filtros"><form onSubmit={buscar}>
      <div className="relatorios-campos-busca">
        <label>Período<select value={periodo} onChange={e => { setPeriodo(e.target.value); setErro(''); }}>
          <option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option>
          <option value="personalizado">Personalizado por datas</option>
        </select></label>
        {periodo === 'personalizado' && <>
          <label>Data inicial<input required type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
          <label>Data final<input required type="date" value={fim} onChange={e => setFim(e.target.value)} /></label>
        </>}
        <button type="submit" className="medicos-botao-principal relatorios-buscar">Buscar</button>
      </div>
      {erro && <p role="alert" className="medicos-erro">{erro}</p>}
    </form></section>
    {!dados && <p>Carregando relatórios...</p>}
    {resumo && <><p>Período: {formatar(aplicado.inicio)} a {formatar(aplicado.fim)}</p>
      <div className="relatorios-indicadores">
        <section className="medicos-card"><h2>Médicos diferentes visitados</h2><strong>{resumo.medicosVisitados}</strong></section>
        {resumo.status.map(s => <section className="medicos-card" key={s.status}><h2>{rotulos[s.status]}</h2><strong>{s.total}</strong></section>)}</div>
      <section className="medicos-card"><h2>Especialidades mais visitadas</h2>
        {resumo.especialidades.length ? resumo.especialidades.map(([nome, total]) => <p key={nome}>{nome}: <strong>{total}</strong></p>) : <p className="relatorios-lista-vazia">Nenhuma especialidade na lista</p>}</section>
      <section className="medicos-card"><h2>Produtos e assuntos abordados nas visitas</h2>
        {resumo.produtos.length ? <div className="relatorios-tabela"><table><thead><tr><th>Produto / assunto</th><th>Médicos</th><th>Amostras</th></tr></thead>
          <tbody>{resumo.produtos.map(p => <tr key={p.nome}><td>{p.nome} ({p.visitas})</td><td>{p.medicos.join(", ")}</td><td>{p.amostras}</td></tr>)}</tbody></table></div> : <p className="relatorios-lista-vazia">Nenhum produto na lista</p>}</section>
      <section className="medicos-card"><h2>Médicos sem visita realizada há mais de 60 dias</h2>
        <p>Considera todo o histórico até hoje, independentemente do filtro acima.</p>
        {resumo.semVisita.length ? <div className="relatorios-tabela"><table>
          <thead><tr><th>Data da última visita</th><th>Médico</th><th>Produto / assunto abordado</th></tr></thead>
          <tbody>{resumo.semVisita.map(item => <tr key={item.medico.id}>
            <td>{item.ultima ? formatar(item.ultima) : 'Sem visita realizada'}</td>
            <td>{item.medico.nome}</td><td>{item.produtosAssuntos || 'Não informado'}</td>
          </tr>)}</tbody>
        </table></div> : <p className="relatorios-lista-vazia">Nenhum médico na lista.</p>}</section>
    </>}
  </div>;
}
