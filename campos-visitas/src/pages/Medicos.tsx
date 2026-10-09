
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  gerarId,
  dataAtual,
  type Medico
} from '../database/database';

import './Medicos.css';

const USUARIO_TESTE = 'usuario-local-teste';

const formularioInicial = {
  nome: '',
  crm: '',
  ufCrm: 'SP',
  especialidade: '',
  clinica: '',
  endereco: '',
  telefone: '',
  email: '',
  observacoes: ''
};

export default function Medicos() {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [busca, setBusca] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [erro, setErro] = useState('');

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(USUARIO_TESTE)
      .toArray(),
    []
  );

  const atualizarCampo = (campo: string, valor: string) => {
    setFormulario(anterior => ({
      ...anterior,
      [campo]: valor
    }));
  };

  const limparFormulario = () => {
    setFormulario(formularioInicial);
    setEditandoId(null);
    setMostrarFormulario(false);
    setErro('');
  };

  const salvarMedico = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const nome = formulario.nome.trim();
    const especialidade = formulario.especialidade.trim();
    const crm = formulario.crm.trim();
    const ufCrm = formulario.ufCrm.trim().toUpperCase();

    if (!nome || !especialidade) {
      setErro('Preencha o nome e a especialidade.');
      return;
    }

    const normalizar = (valor: string) =>
      valor.trim().toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

    const duplicado = medicos?.find(medico => {
      if (medico.id === editandoId || medico.excluidoEm) {
        return false;
      }

      const mesmoCrm = Boolean(
        crm &&
        medico.crm &&
        normalizar(medico.crm) === normalizar(crm) &&
        normalizar(medico.ufCrm || '') === normalizar(ufCrm)
      );

      const mesmoNome = normalizar(medico.nome) === normalizar(nome);
      const mesmaEspecialidade =
        normalizar(medico.especialidade) === normalizar(especialidade);

      return mesmoCrm || (mesmoNome && mesmaEspecialidade);
    });

    if (duplicado) {
      setErro(`Possível cadastro duplicado: ${duplicado.nome}.`);
      return;
    }

    const agora = dataAtual();

    try {
      if (editandoId) {
        await db.medicos.update(editandoId, {
          ...formulario,
          nome,
          crm,
          ufCrm,
          especialidade,
          atualizadoEm: agora,
          sincronizacao: 'pendente'
        });
      } else {
        const novoMedico: Medico = {
          id: gerarId(),
          usuarioId: USUARIO_TESTE,
          ...formulario,
          nome,
          crm,
          ufCrm,
          especialidade,
          criadoEm: agora,
          atualizadoEm: agora,
          sincronizacao: 'pendente'
        };

        await db.medicos.add(novoMedico);
      }

      limparFormulario();
    } catch (error) {
      console.error(error);
      setErro('Não foi possível salvar o médico.');
    }
  };

  const editarMedico = (medico: Medico) => {
    setFormulario({
      nome: medico.nome,
      crm: medico.crm || '',
      ufCrm: medico.ufCrm || 'SP',
      especialidade: medico.especialidade,
      clinica: medico.clinica || '',
      endereco: medico.endereco || '',
      telefone: medico.telefone || '',
      email: medico.email || '',
      observacoes: medico.observacoes || ''
    });

    setEditandoId(medico.id);
    setMostrarFormulario(true);
    setErro('');
  };

  const medicosFiltrados = (medicos || [])
    .filter(medico => !medico.excluidoEm)
    .filter(medico => {
      const texto = busca.toLocaleLowerCase('pt-BR');

      return (
        medico.nome.toLocaleLowerCase('pt-BR').includes(texto) ||
        medico.especialidade.toLocaleLowerCase('pt-BR').includes(texto) ||
        (medico.clinica || '').toLocaleLowerCase('pt-BR').includes(texto)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <main className="medicos-pagina">
      <header className="medicos-cabecalho">
        <div>
          <h1>Médicos</h1>
          <p>Gerencie seus médicos e contatos.</p>
        </div>

        <button
          className="medicos-botao-principal"
          onClick={() => {
            limparFormulario();
            setMostrarFormulario(true);
          }}
        >
          + Novo médico
        </button>
      </header>

      {mostrarFormulario && (
        <section className="medicos-card">
          <h2>{editandoId ? 'Editar médico' : 'Cadastrar médico'}</h2>

          <form onSubmit={salvarMedico}>
            <div className="medicos-grid">
              <label>
                Nome completo *
                <input
                  required
                  value={formulario.nome}
                  onChange={e => atualizarCampo('nome', e.target.value)}
                  placeholder="Dr. Fernando Agra"
                />
              </label>

              <label>
                Especialidade *
                <input
                  required
                  value={formulario.especialidade}
                  onChange={e => atualizarCampo('especialidade', e.target.value)}
                  placeholder="Cardiologia"
                />
              </label>

              <label>
                CRM
                <input
                  value={formulario.crm}
                  onChange={e => atualizarCampo('crm', e.target.value)}
                  placeholder="123456"
                />
              </label>

              <label>
                UF do CRM
                <input
                  maxLength={2}
                  value={formulario.ufCrm}
                  onChange={e => atualizarCampo('ufCrm', e.target.value)}
                />
              </label>

              <label>
                Clínica / Local
                <input
                  value={formulario.clinica}
                  onChange={e => atualizarCampo('clinica', e.target.value)}
                />
              </label>

              <label>
                Telefone
                <input
                  type="tel"
                  value={formulario.telefone}
                  onChange={e => atualizarCampo('telefone', e.target.value)}
                />
              </label>

              <label>
                E-mail
                <input
                  type="email"
                  value={formulario.email}
                  onChange={e => atualizarCampo('email', e.target.value)}
                />
              </label>

              <label>
                Endereço
                <input
                  value={formulario.endereco}
                  onChange={e => atualizarCampo('endereco', e.target.value)}
                />
              </label>
            </div>

            <label>
              Observações
              <textarea
                rows={3}
                value={formulario.observacoes}
                onChange={e => atualizarCampo('observacoes', e.target.value)}
              />
            </label>

            {erro && <p className="medicos-erro">{erro}</p>}

            <div className="medicos-acoes">
              <button type="button" onClick={limparFormulario}>
                Cancelar
              </button>
              <button type="submit" className="medicos-botao-principal">
                {editandoId ? 'Salvar alterações' : 'Cadastrar médico'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="medicos-card">
        <div className="medicos-lista-topo">
          <h2>Meus médicos ({medicosFiltrados.length})</h2>
          <input
            placeholder="Buscar médico, especialidade ou clínica..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div className="medicos-lista">
          {medicosFiltrados.length === 0 ? (
            <p className="medicos-vazio">Nenhum médico encontrado.</p>
          ) : (
            medicosFiltrados.map(medico => (
              <article key={medico.id} className="medicos-item">
                <div className="medicos-avatar">👨‍⚕️</div>

                <div className="medicos-info">
                  <strong>{medico.nome}</strong>
                  <span>{medico.especialidade}</span>
                  <small>{medico.clinica || 'Clínica não informada'}</small>
                </div>

                <button onClick={() => editarMedico(medico)}>
                  Editar
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
