export function normalizarTexto(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

export function nomesMedicosParecidos(a: string, b: string): boolean {
  const limpar = (nome: string) => normalizarTexto(nome).replace(/^(dr|dra|doutor|doutora)\.?\s+/, '')
    .split(' ').filter(p => !['de', 'da', 'do', 'das', 'dos'].includes(p));
  const x = limpar(a), y = limpar(b);
  if (!x.length || !y.length || x[0] !== y[0]) return false;
  const comuns = x.filter(p => y.includes(p)).length;
  return comuns === Math.min(x.length, y.length) || comuns >= 2 && comuns / Math.max(x.length, y.length) >= 0.66;
}

export function correspondeBuscaMedico(nome: string, busca: string): boolean {
  const limpar = (valor: string) => normalizarTexto(valor).replace(/[.]/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(dr|dra|doutor|doutora)\b/g, '').trim().replace(/\s+/g, ' ');
  const alvo = limpar(nome);
  return limpar(busca).split(' ').filter(Boolean).every(parte => alvo.includes(parte));
}
