const CHAVE = 'campos-emails-login';
export function lerEmailsLogin(): string[] {
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(dados) ? dados.filter((email): email is string => typeof email === 'string' && email.includes('@')).slice(0, 10) : [];
  } catch { return []; }
}
export function lembrarEmail(email: string) {
  const normalizado = email.trim().toLowerCase();
  if (!normalizado) return;
  try { localStorage.setItem(CHAVE, JSON.stringify([normalizado, ...lerEmailsLogin().filter(item => item !== normalizado)].slice(0, 10))); }
  catch { /* O login continua funcionando quando o armazenamento está indisponível. */ }
}
