import { db } from '../database/database';
export async function exportarBackup(usuarioId: string) {
  const tabelas = db.tables.filter(t => t.name !== 'backupsLegados' && t.schema.indexes.some(i => i.name === 'usuarioId'));
  const registros = await db.transaction('r', tabelas, async () => {
    const entradas = await Promise.all(tabelas.map(async tabela => [tabela.name,
      await tabela.where('usuarioId').equals(usuarioId).toArray()] as const));
    return Object.fromEntries(entradas);
  });
  const conteudo = { formato: 'campos-visitas-backup', versao: 1, exportadoEm: new Date().toISOString(), usuarioId, registros };
  const url = URL.createObjectURL(new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `campos-visitas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportarBackupLegado() {
  const backup = await db.backupsLegados.get('testes-v2');
  if (!backup) throw new Error('Backup de testes não encontrado.');
  const url = URL.createObjectURL(new Blob([JSON.stringify({ formato: 'campos-visitas-backup-testes', versao: 1, ...backup }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'campos-visitas-testes-anteriores.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
