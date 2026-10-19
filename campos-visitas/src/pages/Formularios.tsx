import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Visita } from '../database/database';
import { correspondeBuscaMedico } from '../utils/texto';
import './Medicos.css';
const USUARIO = 'usuario-local-teste';
export default function Formularios({ abrir }: { abrir: (visita: Visita) => void }) {
  const [busca, setBusca] = useState('');
  const [sugerir, setSugerir] = useState(false);
  const [dia, setDia] = useState('');
  const [filtros, setFiltros] = useState({ medico: '', dia: '' });
  const dados = useLiveQuery(() => db.transaction('r', db.formularios, db.visitas, db.medicos, async () => ({
    formularios: await db.formularios.where('usuarioId').equals(USUARIO).filter(f => !f.excluidoEm).toArray(),
    visitas: await db.visitas.where('usuarioId').equals(USUARIO).filter(v => !v.excluidoEm).toArray(),
    medicos: await db.medicos.where('usuarioId').equals(USUARIO).toArray()
  })), []);
  const sugestoes = (dados?.medicos ?? []).filter(m => !m.excluidoEm && correspondeBuscaMedico(m.nome, busca)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 10);
  const visitas = (dados?.visitas ?? []).filter(v => correspondeBuscaMedico(dados?.medicos.find(m => m.id === v.medicoId)?.nome ?? '', filtros.medico) && (!filtros.dia || v.data === filtros.dia)).sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`));
  return <div className="medicos-pagina"><header className="medicos-cabecalho"><div><h1>Formulários</h1>
    <p>Preencha os relatórios de visita e consulte os formulários salvos.</p></div></header>
    <section className="medicos-card">
      <form className="formularios-busca" role="search" aria-label="Buscar formulários" onSubmit={e => { e.preventDefault(); setSugerir(false); setFiltros({ medico: busca, dia }); }}>
        <div className="formularios-medico-busca">
          <label>Nome do médico<input type="search" autoComplete="off" placeholder="Digite o nome do médico ou Dr." value={busca}
            onFocus={() => setSugerir(true)} onKeyDown={e => { if (e.key === 'Escape') setSugerir(false); }}
            onChange={e => { setBusca(e.target.value); setSugerir(true); }} /></label>
          {sugerir && busca.trim() && sugestoes.length > 0 && <ul className="formularios-sugestoes" aria-label="Sugestões de médicos">
            {sugestoes.map(m => <li key={m.id}><button type="button" onClick={() => { setBusca(m.nome); setSugerir(false); }}>{m.nome}</button></li>)}
          </ul>}
        </div>
        <label>Dia da visita<input type="date" value={dia} onChange={e => setDia(e.target.value)} /></label>
        <button type="submit" className="medicos-botao-principal">Buscar</button>
        <button type="button" onClick={() => { setSugerir(false); setBusca(''); setDia(''); setFiltros({ medico: '', dia: '' }); }}>Limpar</button>
      </form>
      {!dados ? <p>Carregando formulários...</p> : !visitas.length ? <p className="medicos-vazio">Nenhuma visita encontrada para a busca.</p> : visitas.map(v => {
        const formulario = dados.formularios.find(f => f.visitaId === v.id);
        return <article key={v.id} className="medicos-item"><div className="medicos-info"><strong>{dados.medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico não encontrado'}</strong>
          <span>{v.data.split('-').reverse().join('/')} às {v.horaInicio}</span><small>{formulario ? formulario.status === 'finalizado' ? 'Formulário finalizado' : 'Rascunho' : v.status === 'cancelada' ? 'Visita cancelada' : 'Relatório não iniciado'}</small></div>
          {(formulario || v.status !== 'cancelada') && <button onClick={() => abrir(v)}>{formulario ? 'Abrir formulário' : 'Preencher formulário'}</button>}</article>;
      })}
    </section></div>;
}
