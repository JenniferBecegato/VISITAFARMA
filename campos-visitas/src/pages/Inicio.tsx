
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Visita } from '../database/database';
import './Inicio.css';
import { alterarSituacaoVisita } from '../database/visitas';
import { separarVisitas } from '../utils/inicio';

const USUARIO_TESTE = 'usuario-local-teste';

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  if (!data) return '';

  const [ano, mes, dia] = data.split('-');

  return `${dia}/${mes}/${ano}`;
}

interface Props { nomeUsuario: string; unidade: string; editarVisita: (visita: Visita) => void;
  abrirRelatorio: (visita: Visita) => void; abrirPasta: (medicoId: string) => void; }
export default function Inicio({ nomeUsuario, unidade, editarVisita, abrirRelatorio, abrirPasta }: Props) {
  const [mensagem, setMensagem] = useState('');
  const [atualizando, setAtualizando] = useState<string>();
  async function mudarSituacao(visita: Visita, status: 'realizada' | 'cancelada') {
    if (!window.confirm(status === 'realizada' ? 'Marcar esta visita como realizada?' : 'Cancelar esta visita?')) return;
    setAtualizando(visita.id); setMensagem('');
    try { await alterarSituacaoVisita(USUARIO_TESTE, visita.id, status); }
    catch (erro) { setMensagem(erro instanceof Error ? erro.message : 'Não foi possível atualizar a visita.'); }
    finally { setAtualizando(undefined); }
  }
  const [hoje, setHoje] = useState(obterDataLocal);
  useEffect(() => {
    const atualizar = () => setHoje(obterDataLocal());
    const temporizador = window.setInterval(atualizar, 30000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => { window.clearInterval(temporizador); window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar); };
  }, []);
  const visitas = useLiveQuery(
    () => db.visitas
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const dados = useMemo(() => separarVisitas(visitas ?? [], hoje), [visitas, hoje]);

  function nomeMedico(visita: Visita) {
    return medicos?.find(
      medico => medico.id === visita.medicoId
    )?.nome ?? 'Médico não encontrado';
  }

  return (
    <div className="inicio-pagina">
      <div className="inicio-topo">
        <div>
          <h1>Olá, {nomeUsuario}!</h1>
          <p>Unidade {unidade} · Resumo das suas visitas farmacêuticas.</p>
        </div>

        <span className="inicio-data">
          {formatarData(hoje)}
        </span>
      </div>

      <div className="inicio-indicadores">
        <div className="inicio-indicador azul">
          <span>Visitas de hoje</span>
          <strong>{dados.visitasHoje.length}</strong>
          <small>Agendamentos do dia</small>
        </div>

        <div className="inicio-indicador verde">
          <span>Realizadas</span>
          <strong>{dados.realizadas}</strong>
          <small>Visitas concluídas hoje</small>
        </div>

        <div className="inicio-indicador amarelo">
          <span>Pendentes</span>
          <strong>{dados.pendentes}</strong>
          <small>Aguardando realização</small>
        </div>
      </div>

      {mensagem && <p role="alert">{mensagem}</p>}
      <section className="inicio-card">
        <h2>Minhas visitas de hoje</h2>

        {dados.visitasHoje.length === 0 ? (
          <p className="inicio-vazio">
            Você não possui visitas cadastradas para hoje.
          </p>
        ) : (
          <div className="inicio-lista">
            {dados.visitasHoje.map(visita => (
              <div className="inicio-visita" key={visita.id}>
                <strong>{visita.horaInicio}</strong>

                <div>
                  <div className="inicio-medico-status"><button className="inicio-nome-medico" type="button" onClick={() => abrirPasta(visita.medicoId)}>{nomeMedico(visita)}</button>
                    <span className={`inicio-status ${visita.status}`}>{visita.status}</span></div>
                  <small>
                    {visita.local || 'Local não informado'}
                  </small>
                </div>

                <div className="inicio-acoes-visita">
                  {visita.status !== 'cancelada' && visita.status !== 'realizada' &&
                    <div className="inicio-acoes-linha">
                      <button type="button" disabled={!!atualizando} className="realizar" onClick={() => void mudarSituacao(visita, 'realizada')}>Realizar</button>
                      <button type="button" disabled={!!atualizando} className="cancelar" onClick={() => void mudarSituacao(visita, 'cancelada')}>Cancelar</button>
                      <button type="button" disabled={!!atualizando} onClick={() => editarVisita(visita)}>Reagendar visita</button>
                    </div>}
                  <div className="inicio-acoes-linha">
                    {visita.status !== 'cancelada' && <button type="button" disabled={!!atualizando} onClick={() => editarVisita(visita)}>Editar</button>}
                    <button type="button" disabled={!!atualizando} className="abrir-formulario" onClick={() => abrirRelatorio(visita)}>Formulário</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="inicio-card">
        <h2>Próximas visitas</h2><p className="inicio-mes">Agendamentos para os próximos dias deste mês.</p>
        {dados.proximasVisitas.length === 0 ? <p className="inicio-vazio">Nenhuma próxima visita agendada neste mês.</p> :
          <div className="inicio-lista">{dados.proximasVisitas.map(visita => <div className="inicio-visita" key={visita.id}>
            <strong>{visita.horaInicio}</strong><div><span>{nomeMedico(visita)}</span>
              <small>{formatarData(visita.data)} · {visita.local || 'Local não informado'}</small></div>
            <span className={`inicio-status ${visita.status}`}>{visita.status}</span>
          </div>)}</div>}
      </section>
    </div>
  );
}
