import { useConta } from '../services/conta';

import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  gerarId,
  dataAtual,
  type Medico
} from '../database/database';

import './Medicos.css';
import { gravarSecretariasDoMedico, type ContatoSecretaria } from '../database/catalogos';
import { normalizarTexto, nomesMedicosParecidos } from '../utils/texto';


const formularioInicial = {
  nome: '',
  crm: '',
  ufCrm: 'SP',
  especialidade: '',
  clinica: '',
  endereco: '',
  telefone: '',
  observacoes: ''
};

interface MedicosProps {
  abrirPasta: (medicoId: string) => void;
}

export default function Medicos({ abrirPasta }: MedicosProps) {
  const { usuarioId } = useConta();

  const [formulario, setFormulario] = useState(formularioInicial);
  const [maisDeUmaSecretaria, setMaisDeUmaSecretaria] = useState(false);
  const [camposSecretarias, setCamposSecretarias] = useState<ContatoSecretaria[]>([{ nome: '' }]);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [erro, setErro] = useState('');
  const [conferido, setConferido] = useState(false);
  const [avisoNome, setAvisoNome] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);

  const medicos = useLiveQuery(
    () => db.medicos
      .where('usuarioId')
      .equals(usuarioId)
      .toArray(),
    []
  );

  const secretarias = useLiveQuery(() => db.secretarias.where('usuarioId').equals(usuarioId).filter(s => !s.excluidoEm).toArray(), []);

  const atualizarCampo = (campo: string, valor: string) => {
    setConferido(false);
    setAvisoNome(false);
    setFormulario(anterior => ({
      ...anterior,
      [campo]: valor
    }));
  };

  const limparFormulario = () => {
    setConferido(false);
    setAvisoNome(false);
    setFormulario(formularioInicial);
    setMaisDeUmaSecretaria(false);
    setCamposSecretarias([{ nome: '' }]);
    setEditandoId(null);
    setMostrarFormulario(false);
    setErro('');
  };

  const salvarMedico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trava.current) return;
    setErro('');
    const nome = formulario.nome.trim();
    const especialidade = formulario.especialidade.trim();
    const crm = formulario.crm.replace(/[^0-9]/g, '');
    const ufCrm = formulario.ufCrm.trim().toUpperCase();
    if (!nome || !especialidade) { setErro('Preencha o nome e a especialidade.'); return; }
    if (formulario.crm.trim() && (!crm || !/^[A-Z]{2}$/.test(ufCrm))) {
      setErro('Informe um CRM numérico e a UF com duas letras.'); return;
    }
    const contatosVisiveis = maisDeUmaSecretaria ? camposSecretarias : camposSecretarias.slice(0, 1);
    const contatosPreenchidos = contatosVisiveis.filter(c => c.nome.trim());
    if (maisDeUmaSecretaria && (contatosVisiveis.length < 2 || contatosPreenchidos.length !== contatosVisiveis.length)) {
      setErro('Preencha os nomes das secretárias nos campos exibidos.'); return;
    }
    if (new Set(contatosPreenchidos.map(c => normalizarTexto(c.nome))).size !== contatosPreenchidos.length) {
      setErro('Informe nomes diferentes para as secretárias.'); return;
    }
    trava.current = true; setSalvando(true);
    try {
      await db.transaction('rw', db.medicos, db.secretarias, async () => {
        const registros = await db.medicos.where('usuarioId').equals(usuarioId)
          .filter(m => !m.excluidoEm && m.id !== editandoId).toArray();
        const mesmoCrm = registros.find(m => crm && m.crm?.replace(/[^0-9]/g, '') === crm && m.ufCrm?.toUpperCase() === ufCrm);
        if (mesmoCrm) throw new Error(`CRM já cadastrado para ${mesmoCrm.nome}. Abra o cadastro existente.`);
        const mesmoNome = registros.find(m => normalizarTexto(m.nome) === normalizarTexto(nome) &&
          normalizarTexto(m.especialidade) === normalizarTexto(especialidade));
        if (mesmoNome) throw new Error(`Médico já cadastrado: ${mesmoNome.nome}.`);
        const semelhante = registros.find(m => nomesMedicosParecidos(m.nome, nome));
        if (semelhante && !conferido) {
          setAvisoNome(true);
          throw new Error(`Nome semelhante a ${semelhante.nome}. Confira se são pessoas diferentes antes de continuar.`);
        }
        const anterior = editandoId ? await db.medicos.get(editandoId) : undefined;
        if (editandoId && (!anterior || anterior.usuarioId !== usuarioId || anterior.excluidoEm)) throw new Error('Médico não encontrado.');
        const agora = dataAtual();
        const medico: Medico = { ...anterior, ...formulario, nome, crm, ufCrm, especialidade,
          id: editandoId ?? gerarId(), usuarioId: usuarioId,
          criadoEm: anterior?.criadoEm ?? agora, atualizadoEm: agora, sincronizacao: 'pendente' };
        await db.medicos.put(medico);
        await gravarSecretariasDoMedico(usuarioId, medico.id, contatosPreenchidos);
      });
      limparFormulario();
    } catch (error) {
      console.error(error);
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar o médico.');
    } finally { trava.current = false; setSalvando(false); }
  };

  const editarMedico = (medico: Medico) => {
    setAvisoNome(false); setConferido(false);
    const ordem = medico.secretariaIds ?? (medico.secretariaId ? [medico.secretariaId] : []);
    const posicao = (id: string) => ordem.includes(id) ? ordem.indexOf(id) : Number.MAX_SAFE_INTEGER;
    const contatos = (secretarias ?? []).filter(s => (s.medicoIds ?? [s.medicoId]).includes(medico.id))
      .sort((a, b) => posicao(a.id) - posicao(b.id));
    setCamposSecretarias(contatos.length ? contatos.map(s => ({ id: s.id, nome: s.nome })) : [{ nome: '' }]);
    setMaisDeUmaSecretaria(contatos.length > 1);
    setFormulario({
      nome: medico.nome,
      crm: medico.crm || '',
      ufCrm: medico.ufCrm || 'SP',
      especialidade: medico.especialidade,
      clinica: medico.clinica || '',
      endereco: medico.endereco || '',
      telefone: medico.telefone || '',
      observacoes: medico.observacoes || ''
    });

    setEditandoId(medico.id);
    setMostrarFormulario(true);
    setErro('');
  };

  const medicosFiltrados = (medicos || [])
    .filter(medico => !medico.excluidoEm)
    .filter(medico => {
      const texto = normalizarTexto(buscaAplicada);

      return (
        normalizarTexto(medico.nome).includes(texto) ||
        normalizarTexto(medico.especialidade).includes(texto) ||
        normalizarTexto(medico.clinica || '').includes(texto)
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <main className="medicos-pagina">
      <header className="medicos-cabecalho cabecalho-com-busca">
        <div>
          <h1>Médicos</h1>
          <p>Gerencie seus médicos e contatos.</p>
        </div>

        <form className="busca-cabecalho" role="search" aria-label="Pesquisar médicos" onSubmit={e => { e.preventDefault(); setBuscaAplicada(busca); }}>
          <label className="busca-texto">Buscar médico<input type="search" placeholder="Médico, especialidade ou clínica" value={busca}
            onChange={e => { setBusca(e.target.value); if (!e.target.value) setBuscaAplicada(''); }} /></label>
          <button className="botao-pesquisa" type="submit">Pesquisar</button>
        </form>
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

          <form onSubmit={salvarMedico}><fieldset disabled={salvando} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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


            </div>

            <fieldset className="medico-secretarias"><legend>Secretárias do médico</legend>
              <fieldset className="medico-opcoes-secretarias">
                <legend>Tem mais de uma secretária?</legend>
                <div className="medico-radios">
                  <label><input type="radio" name="mais-de-uma-secretaria" value="sim" checked={maisDeUmaSecretaria}
                    onChange={() => {
                      setMaisDeUmaSecretaria(true);
                      if (camposSecretarias.length < 2) setCamposSecretarias([...camposSecretarias, { nome: '' }]);
                    }} />Sim</label>
                  <label><input type="radio" name="mais-de-uma-secretaria" value="nao" checked={!maisDeUmaSecretaria}
                    onChange={() => setMaisDeUmaSecretaria(false)} />Não</label>
                </div>
              </fieldset>
              <div className="medicos-grid">{(maisDeUmaSecretaria ? camposSecretarias : camposSecretarias.slice(0, 1)).map((contato, indice) =>
                <div key={indice} className="medico-secretaria-campo"><label>{maisDeUmaSecretaria ? `Nome da secretária ${indice + 1} *` : 'Nome da secretária'}
                  <input required={maisDeUmaSecretaria} maxLength={160} value={contato.nome} onChange={e => setCamposSecretarias(camposSecretarias.map((c, i) =>
                    i === indice ? { ...c, nome: e.target.value } : c))} /></label>
                  {maisDeUmaSecretaria && indice > 1 && <button type="button" onClick={() => setCamposSecretarias(camposSecretarias.filter((_, i) => i !== indice))}>Remover campo {indice + 1}</button>}
                </div>)}
              </div>
              {maisDeUmaSecretaria && <button type="button" className="medico-adicionar-secretaria" onClick={() => setCamposSecretarias([...camposSecretarias, { nome: '' }])}>+ Adicionar mais uma secretária</button>}
            </fieldset>

            <label>
              Observações
              <textarea
                rows={3}
                value={formulario.observacoes}
                onChange={e => atualizarCampo('observacoes', e.target.value)}
              />
            </label>

            {erro && <p role="alert" className="medicos-erro">{erro}</p>}
            {avisoNome && <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input style={{ width: 22, height: 22 }} type="checkbox" checked={conferido} onChange={e => setConferido(e.target.checked)} />
              Conferi os dados e são médicos diferentes.
            </label>}

            <div className="medicos-acoes">
              <button type="button" onClick={limparFormulario}>
                Cancelar
              </button>
              <button type="submit" className="medicos-botao-principal">
                {editandoId ? 'Salvar alterações' : 'Cadastrar médico'}
              </button>
            </div>
          </fieldset></form>
        </section>
      )}

      {!mostrarFormulario && <section className="medicos-card">
        <div className="medicos-lista-topo">
          <h2>Meus médicos ({medicosFiltrados.length})</h2>

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

                
<div className="medicos-botoes">
  <button
    type="button"
    className="medicos-botao-pasta"
    onClick={() => abrirPasta(medico.id)}
  >
    📁 Abrir pasta
  </button>

  <button
    type="button"
    disabled={secretarias === undefined || salvando}
    onClick={() => editarMedico(medico)}
  >
    Editar
  </button>
</div>

              </article>
            ))
          )}
        </div>
      </section>}
    </main>
  );
}
