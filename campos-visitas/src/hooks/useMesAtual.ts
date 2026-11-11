import { useEffect, useState } from 'react';

function mesAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export function useMesAtual() {
  const [mes, setMes] = useState(mesAtual);
  useEffect(() => {
    const atualizar = () => setMes(mesAtual());
    const timer = window.setInterval(atualizar, 1000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, []);
  return mes;
}