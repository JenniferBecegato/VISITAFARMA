import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/database';
import { calcularRelatorio, dataLocal, diasAntes } from '../utils/relatorios';
import './Medicos.css';
import './Relatorios.css';
const USUARIO = 'usuario-local-teste';
const formatar = (data: string) => data.split('-').reverse().join('/');
const rotulos = { agendada: 'Agendadas', realizada: 'Realizadas', reagendada: 'Reagendadas', cancelada: 'Canceladas' };
export default function Relatorios() {
  const [periodo, setPeriodo] = useState('30');
  const [inicio, setInicio] = useState(() => diasAntes(29));
  const [fim, setFim] = useState(() => dataLocal());
  const dados = useLiveQuery(() => db.transaction('r', [db.medicos, db.visitas, db.produtos, db.visitaProdutos], async () => ({
    medicos: await db.medicos.where('usuarioId').equals(USUARIO).toArray(),
    visitas: await db.visitas.where('usuarioId').equals(USUARIO).toArray(),
    produtos: await db.produtos.where('usuarioId').equals(USUARIO).toArray(),
    vinculos: await db.visitaProdutos.where('usuarioId').equals(USUARIO).toArray()
  })), []);
  const invalido = !inicio || !fim || inicio > fim;
  const resumo = dados && !invalido ? calcularRelatorio(dados.medicos, dados.visitas, dados.produtos, dados.vinculos, inicio, fim) : undefined;
  return <div className="medicos-pagina relatorios-pagina">
    <header className="medicos-cabecalho"><div><h1>Relatórios</h1><p>Acompanhamento das visitas a partir dos registros deste aparelho.</p></div>
      <button className="medicos-botao-principal" disabled={!resumo} onClick={() => window.print()}>Imprimir / salvar PDF</button></header>
    <section className="medicos-card relatorios-filtros"><div className="medicos-grid">
      <label>Período<select value={periodo} onChange={e => {
        const valor = e.target.value; setPeriodo(valor);
        if (valor !== 'personalizado') { setInicio(diasAntes(Number(valor) - 1)); setFim(dataLocal()); }
      }}><option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option>
        <option value="personalizado">Personalizado</option></select></label>
      <label>De<input type="date" value={inicio} onChange={e => { setInicio(e.target.value); setPeriodo('personalizado'); }} /></label>
      <label>Até<input type="date" value={fim} onChange={e => { setFim(e.target.value); setPeriodo('personalizado'); }} /></label>
    </div>{invalido && <p role="alert" className="medicos-erro">Informe um período válido; a data inicial deve ser anterior ou igual à final.</p>}</section>
    {!dados && <p>Carregando relatórios...</p>}
    {resumo && <><p>Período: {formatar(inicio)} a {formatar(fim)}</p>
      <div className="relatorios-indicadores"><section className="medicos-card"><h2>Visitas realizadas</h2><strong>{resumo.realizadas}</strong></section>
        <section className="medicos-card"><h2>Médicos diferentes visitados</h2><strong>{resumo.medicosVisitados}</strong></section>
        {resumo.status.map(s => <section className="medicos-card" key={s.status}><h2>{rotulos[s.status]}</h2><strong>{s.total}</strong></section>)}</div>
      <section className="medicos-card"><h2>Especialidades mais visitadas</h2>
        {resumo.especialidades.length ? resumo.especialidades.map(([nome, total]) => <p key={nome}>{nome}: <strong>{total}</strong></p>) : <p>Nenhuma visita realizada no período.</p>}</section>
      <section className="medicos-card"><h2>Produtos apresentados e amostras</h2>
        <p>Contagem dos produtos selecionados no catálogo em visitas realizadas. Registros apenas em texto livre não entram nesses totais.</p>
        {resumo.produtos.length ? <div className="relatorios-tabela"><table><thead><tr><th>Produto</th><th>Visitas</th><th>Amostras</th></tr></thead>
          <tbody>{resumo.produtos.map(p => <tr key={p.nome}><td>{p.nome}</td><td>{p.visitas}</td><td>{p.amostras}</td></tr>)}</tbody></table></div> : <p>Nenhum produto vinculado no período.</p>}</section>
      <section className="medicos-card"><h2>Médicos sem visita realizada há mais de 60 dias</h2>
        <p>Considera todo o histórico até hoje, independentemente do filtro acima. Inclui médicos sem visita realizada registrada.</p>
        {resumo.semVisita.length ? resumo.semVisita.map(item => <p key={item.medico.id}><strong>{item.medico.nome}</strong> — {item.ultima ? `Última visita: ${formatar(item.ultima)}` : 'Nenhuma visita realizada registrada'}</p>) : <p>{dados?.medicos.some(m => !m.excluidoEm) ? 'Todos os médicos possuem visita realizada nos últimos 60 dias.' : 'Nenhum médico cadastrado.'}</p>}</section>
      <section className="medicos-card"><h2>Histórico no período ({resumo.periodo.length})</h2>
        {resumo.periodo.length ? <div className="relatorios-tabela"><table><thead><tr><th>Data</th><th>Médico</th><th>Situação</th></tr></thead><tbody>
          {resumo.periodo.map(v => <tr key={v.id}><td>{formatar(v.data)} {v.horaInicio}</td><td>{dados?.medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico indisponível'}</td><td>{rotulos[v.status]}</td></tr>)}
        </tbody></table></div> : <p>Nenhuma visita no período.</p>}</section>
    </>}
  </div>;
}
