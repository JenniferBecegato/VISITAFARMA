import { useState, type FormEvent } from 'react';
import { UNIDADES, type Identificacao } from '../services/identificacao';
import './Login.css';
import logoCampos from '../assets/logo-campos.png';

const NOMES = ['Adriana', 'Patrícia', 'Jennifer'];
export default function Login({ entrar }: { entrar: (identificacao: Identificacao) => void }) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<Identificacao['unidade'] | ''>('');
  const [erro, setErro] = useState('');
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
    if (!NOMES.includes(nomeLimpo) || !unidade) { setErro('Informe seu nome e selecione sua unidade.'); return; }
    entrar({ nome: nomeLimpo, unidade });
  }
  return <main className="login-pagina"><section className="login-card">
    <div className="login-marca"><img src={logoCampos} alt="Farmácia Campos" /></div>
    <h1>Bem vinda(o) ao Campos Visitas Farmacêuticas</h1>
    <form onSubmit={enviar}><label>Seu nome<select required value={nome}
      onChange={e => { setNome(e.target.value); setErro(''); }}>
        <option value="">Selecione seu nome</option>
        {NOMES.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
      </select></label>
      <label>Unidade<select required value={unidade} onChange={e => { setUnidade(e.target.value as Identificacao['unidade']); setErro(''); }}>
        <option value="">Selecione sua unidade</option>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
      </select></label>{erro && <p role="alert">{erro}</p>}<button type="submit">Entrar</button>
    </form><p className="login-nota">Identificação local neste aparelho. O acesso com conta e senha será disponibilizado na integração com o Supabase.</p>
  </section></main>;
}
