import Dexie, { type Transaction } from 'dexie';
import type { CamposDatabase } from './database';
import { TABELAS_SYNC, chaveSync, type RegistroLocal, type TabelaSync } from './syncTypes';

const remotas = new WeakSet<IDBTransaction>();
export function marcarTransacaoRemota(tx: Transaction) { remotas.add(tx.idbtrans); }

// Amplia a transação nativa: registro e outbox são confirmados ou revertidos juntos,
// inclusive quando a tela usa table.put/update fora de uma transação explícita.
export function instalarRastreamento(db: CamposDatabase) {
  db.use({ stack: 'dbcore', name: 'outbox-atomica', create: core => ({
    ...core,
    transaction(stores, mode, options) {
      return core.transaction(mode === 'readwrite' && stores.some(s => TABELAS_SYNC.includes(s as TabelaSync))
        ? [...new Set([...stores, 'filaSincronizacao', 'metadadosSync', 'conflitosSync'])] : stores, mode, options);
    }
  }) });
  for (const nome of TABELAS_SYNC) {
    const tabela = db.table(nome);
    function registrar(registro: RegistroLocal, tx: Transaction) {
      if (remotas.has(tx.idbtrans) || registro.usuarioId === 'usuario-local-teste') return;
      const id = chaveSync(nome, registro.id);
      tx.idbtrans.objectStore('filaSincronizacao').put({ id, usuarioId: registro.usuarioId,
        tabela: nome, registroId: registro.id, revisao: crypto.randomUUID(),
        registro: structuredClone({ ...registro, sincronizacao: 'pendente' }),
        criadoEm: new Date().toISOString(), tentativas: 0 });
      tx.on('complete', () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('campos-gravacao-local'));
      });
    }
    tabela.hook('creating', (_key, obj, tx) => {
      if (!remotas.has(tx.idbtrans) && obj.usuarioId !== 'usuario-local-teste') obj.sincronizacao = 'pendente';
      registrar(obj, tx);
    });
    tabela.hook('updating', (mudancas, key, original, tx) => {
      if (remotas.has(tx.idbtrans) || original.usuarioId === 'usuario-local-teste') return;
      if ('usuarioId' in mudancas && mudancas.usuarioId !== original.usuarioId) throw new Error('Proprietária imutável.');
      const registro = structuredClone(original);
      for (const [campo, valor] of Object.entries(mudancas)) Dexie.setByKeyPath(registro, campo, valor);
      registrar({ ...registro, id: key }, tx);
      return { sincronizacao: 'pendente' };
    });
    tabela.hook('deleting', (_key, original, tx) => {
      if (!remotas.has(tx.idbtrans) && original.usuarioId !== 'usuario-local-teste') {
        throw new Error('Use exclusão lógica para permitir sincronização.');
      }
    });
  }
}
