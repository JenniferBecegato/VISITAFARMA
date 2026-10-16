import { rotuloStatusVisita } from '../utils/statusVisita';
import { useState } from 'react';
import type { Medico, Visita } from '../database/database';
import { diasDoMes, visitasNaData } from '../utils/calendario';
import { dataLocal } from '../utils/relatorios';
import './CalendarioVisitas.css';
interface Props {
  visitas: Visita[]; medicos: Medico[]; selecionado: string;
  selecionar: (dia: string) => void; agendar: (dia: string) => void;
}
export default function CalendarioVisitas({ visitas, medicos, selecionado, selecionar, agendar }: Props) {
  const [mesAtual, setMesAtual] = useState(() => new Date(`${selecionado}T12:00:00`));
  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth();
  const titulo = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hoje = dataLocal();
  function mover(delta: number) {
    const proximo = new Date(ano, mes + delta, 1);
    setMesAtual(proximo); selecionar(dataLocal(proximo));
  }
  return <section className="medicos-card calendario" aria-label="Calendário de visitas">
    <header className="calendario-topo"><h2>{titulo}</h2><div>
      <button type="button" aria-label="Mês anterior" onClick={() => mover(-1)}>‹</button>
      <button type="button" onClick={() => { setMesAtual(new Date()); selecionar(hoje); }}>Hoje</button>
      <button type="button" aria-label="Próximo mês" onClick={() => mover(1)}>›</button>
    </div></header><p className="calendario-ajuda">Selecione um dia para ver as visitas abaixo do calendário. Na lista do dia, clique no nome do médico para abrir sua pasta.</p>
    <div className="calendario-rolagem"><div className="calendario-grade">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div className="calendario-semana" key={d}>{d}</div>)}
      {diasDoMes(ano, mes).map((dia, indice) => dia ? <div key={dia} className={`calendario-dia ${dia === hoje ? 'hoje' : ''} ${dia === selecionado ? 'selecionado' : ''}`}>
        <button className="calendario-selecionar" type="button" aria-label={`Ver visitas de ${dia.split('-').reverse().join('/')}`}
          aria-pressed={dia === selecionado} onClick={() => selecionar(dia)} />
        <div className="calendario-dia-topo"><span className="calendario-numero">{Number(dia.slice(-2))}</span>
          <button type="button" className="calendario-agendar" aria-label={`Agendar visita em ${dia.split('-').reverse().join('/')}`} onClick={() => { selecionar(dia); agendar(dia); }}>+</button></div>
        {visitasNaData(visitas, dia).length > 0 && <span className="calendario-resumo-mobile"
          aria-label={`${visitasNaData(visitas, dia).length} ${visitasNaData(visitas, dia).length === 1 ? "visita" : "visitas"}`}>
          {visitasNaData(visitas, dia).length}<span>{visitasNaData(visitas, dia).length === 1 ? "visita" : "visitas"}</span>
        </span>}
        {visitasNaData(visitas, dia).map(v => <div className={`calendario-evento ${v.status}`} key={v.id}
          title={`${v.horaInicio} · ${medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico'} · ${rotuloStatusVisita(v.status)}`}
          ><span>{v.horaInicio}</span><strong className="calendario-evento-nome">{medicos.find(m => m.id === v.medicoId)?.nome ?? 'Médico não encontrado'}</strong><small>{rotuloStatusVisita(v.status)}</small></div>)}
      </div> : <div className="calendario-dia vazio" key={`vazio-${indice}`} />)}
    </div></div>
  </section>;
}
