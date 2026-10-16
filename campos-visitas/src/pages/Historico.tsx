import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/database';
import { filtrarHistorico } from '../utils/historico';
import { rotuloStatusVisita } from '../utils/statusVisita';
import './Medicos.css';
import './Historico.css';
const USUARIO = 'usuario-local-teste';
export default function Historico() {
  const [ano, setAno] = useState(() => new Date().getFullYear());
  useEffect(() => {
    const atualizar = () => setAno(new Date().getFullYear());
    const timer = window.setInterval(atualizar, 30000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', atualizar); document.removeEventListener('visibilitychange', atualizar); };
  }, []);
  return <HistoricoDoAno key={ano} ano={ano} />;
}
function HistoricoDoAno({ ano }: { ano: number }) {
  const primeiro = `${ano}-01-01`, ultimo = `${ano}-12-31`;
  const [inicio, setInicio] = useState(primeiro);
  const [fim, setFim] = useState(ultimo);
  const [periodo, setPeriodo] = useState({ inicio: primeiro, fim: ultimo });
  const [erro, setErro] = useState('');
  const dados = useLiveQuery(async () => {
    const [visitas, medicos, secretarias, produtos, vinculos] = await Promise.all([
      db.visitas.where('usuarioId').equals(USUARIO).toArray(),
      db.medicos.where('usuarioId').equals(USUARIO).toArray(),
      db.secretarias.where('usuarioId').equals(USUARIO).toArray(),
      db.produtos.where('usuarioId').equals(USUARIO).toArray(),
      db.visitaProdutos.where('usuarioId').equals(USUARIO).toArray()
    ]);
    return { visitas, medicos, secretarias, produtos, vinculos };
  }, []);
  const lista = filtrarHistorico(dados?.visitas ?? [], ano, periodo.inicio, periodo.fim);
  function buscar(e: FormEvent) {
    e.preventDefault();
    if (inicio > fim) { setErro('A data inicial deve ser anterior ou igual à data final.'); return; }
    setErro(''); setPeriodo({ inicio, fim });
  }
  return <div className="medicos-pagina historico-pagina">
    <header className="medicos-cabecalho"><div><h1>Histórico</h1><p>Eventos de {ano}. Consulte os registros por período.</p></div></header>
    <section className="medicos-card">
      <form className="historico-filtros" onSubmit={buscar}>
        <label>De<input required type="date" min={primeiro} max={ultimo} value={inicio} onChange={e => setInicio(e.target.value)} /></label>
        <label>Até<input required type="date" min={primeiro} max={ultimo} value={fim} onChange={e => setFim(e.target.value)} /></label>
        <button className="medicos-botao-principal" type="submit">Buscar</button>
        <button type="button" onClick={() => { setInicio(primeiro); setFim(ultimo); setPeriodo({ inicio: primeiro, fim: ultimo }); setErro(''); }}>Ano inteiro</button>
      </form>
      {erro && <p role="alert" className="medicos-erro">{erro}</p>}
    </section>
    <section className="medicos-card"><h2>Histórico ({lista.length})</h2>
      {!dados ? <p>Carregando histórico...</p> : !lista.length ? <p className="medicos-vazio">Nenhum evento encontrado neste período.</p> :
        <table className="historico-tabela"><thead><tr><th>Data / hora</th><th>Médico</th><th>Secretária</th><th>Produto / assunto</th><th>Situação</th></tr></thead>
          <tbody>{lista.map(v => {
            const produtos = v.produtosAssuntos || dados.vinculos.filter(x => x.visitaId === v.id && !x.excluidoEm)
              .map(x => dados.produtos.find(p => p.id === x.produtoId)?.nome).filter(Boolean).join('; ');
            return <tr key={v.id}>
              <td data-label="Data / hora">{v.data.split('-').reverse().join('/')} {v.horaInicio}</td>
              <td data-label="Médico">{dados.medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico não encontrado'}</td>
              <td data-label="Secretária">{dados.secretarias.find(s => s.id === v.secretariaId)?.nome ?? 'Não informada'}</td>
              <td data-label="Produto / assunto">{produtos || 'Não informado'}</td>
              <td data-label="Situação"><span className={`inicio-status ${v.status}`}>{rotuloStatusVisita(v.status)}</span></td>
            </tr>;
          })}</tbody>
        </table>}
    </section>
  </div>;
}
