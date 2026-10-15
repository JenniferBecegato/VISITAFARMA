import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Visita } from '../database/database';
import { normalizarTexto } from '../utils/texto';
import './Medicos.css';
const USUARIO = 'usuario-local-teste';
export default function Formularios({ abrir }: { abrir: (visita: Visita) => void }) {
  const [busca, setBusca] = useState('');
  const dados = useLiveQuery(() => db.transaction('r', db.formularios, db.visitas, db.medicos, async () => ({
    formularios: await db.formularios.where('usuarioId').equals(USUARIO).filter(f => !f.excluidoEm).toArray(),
    visitas: await db.visitas.where('usuarioId').equals(USUARIO).filter(v => !v.excluidoEm).toArray(),
    medicos: await db.medicos.where('usuarioId').equals(USUARIO).toArray()
  })), []);
  const visitas = (dados?.visitas ?? []).filter(v => normalizarTexto(dados?.medicos.find(m => m.id === v.medicoId)?.nome ?? '')
    .includes(normalizarTexto(busca))).sort((a, b) => `${b.data} ${b.horaInicio}`.localeCompare(`${a.data} ${a.horaInicio}`));
  return <div className="medicos-pagina"><header className="medicos-cabecalho"><div><h1>Formulários</h1>
    <p>Preencha os relatórios de visita e consulte os formulários salvos.</p></div></header>
    <section className="medicos-card"><label>Buscar pelo médico<input type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      {!dados ? <p>Carregando formulários...</p> : !visitas.length ? <p className="medicos-vazio">Nenhuma visita encontrada. Cadastre uma visita na Agenda.</p> : visitas.map(v => {
        const formulario = dados.formularios.find(f => f.visitaId === v.id);
        return <article key={v.id} className="medicos-item"><div className="medicos-info"><strong>{dados.medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico não encontrado'}</strong>
          <span>{v.data.split('-').reverse().join('/')} às {v.horaInicio}</span><small>{formulario ? formulario.status === 'finalizado' ? 'Formulário finalizado' : 'Rascunho' : v.status === 'cancelada' ? 'Visita cancelada' : 'Relatório não iniciado'}</small></div>
          {(formulario || v.status !== 'cancelada') && <button onClick={() => abrir(v)}>{formulario ? 'Abrir formulário' : 'Preencher formulário'}</button>}</article>;
      })}
    </section></div>;
}
