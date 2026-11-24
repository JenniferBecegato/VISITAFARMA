import { useId } from 'react';
import type { ContatoSecretaria } from '../database/catalogos';
import '../pages/Medicos.css';

interface Props {
  maisDeUmaSecretaria: boolean;
  camposSecretarias: ContatoSecretaria[];
  setMaisDeUmaSecretaria: (valor: boolean) => void;
  setCamposSecretarias: (campos: ContatoSecretaria[]) => void;
}

export default function CamposSecretarias({
  maisDeUmaSecretaria, camposSecretarias, setMaisDeUmaSecretaria, setCamposSecretarias
}: Props) {
  const grupo = useId();
  return (
    <fieldset className="medico-secretarias"><legend>Secretárias do médico</legend>
      <fieldset className="medico-opcoes-secretarias">
        <legend>Tem mais de uma secretária?</legend>
        <div className="medico-radios">
          <label><input type="radio" name={grupo} value="sim" checked={maisDeUmaSecretaria}
            onChange={() => {
              setMaisDeUmaSecretaria(true);
              if (camposSecretarias.length < 2) setCamposSecretarias([...camposSecretarias, { nome: '' }]);
            }} />Sim</label>
          <label><input type="radio" name={grupo} value="nao" checked={!maisDeUmaSecretaria}
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
  );
}
