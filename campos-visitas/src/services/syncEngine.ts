import type { CamposDatabase } from '../database/database';
import { marcarTransacaoRemota } from '../database/rastreamento';
import { TABELAS_SYNC, chaveSync, type ConflitoSync, type Pendencia, type RegistroRemoto, type TabelaSync } from '../database/syncTypes';
import { paraLocal, paraRemoto } from './syncMap';

export interface Envio { tabela: TabelaSync; registro: Record<string, unknown>; versao: number; revisao: string }
export interface RespostaRegistro { tabela: TabelaSync; registro: RegistroRemoto }
export interface TransporteSync {
  validar: (usuarioId: string) => Promise<void>;
  enviar: (lote: Envio[]) => Promise<{ registros?: RespostaRegistro[]; conflitos?: RespostaRegistro[] }>;
  baixar: () => Promise<RespostaRegistro[]>;
}
export class MotorSync {
  parado = false;
  readonly db: CamposDatabase;
  readonly usuarioId: string;
  readonly transporte: TransporteSync;
  constructor(db: CamposDatabase, usuarioId: string, transporte: TransporteSync) {
    this.db = db; this.usuarioId = usuarioId; this.transporte = transporte;
  }
  async executar() {
    const { db, usuarioId } = this;
    await this.transporte.validar(usuarioId);
    if (this.parado) return false;
    const pendencias = await db.filaSincronizacao.where('usuarioId').equals(usuarioId).toArray();
    const lote: Envio[] = await Promise.all(pendencias.map(async p => ({ tabela: p.tabela,
      registro: paraRemoto(p.tabela, p.registro), revisao: p.revisao,
      versao: (await db.metadadosSync.get(p.id))?.versao ?? 0 })));
    if (lote.length) {
      const resposta = await this.transporte.enviar(lote);
      if (this.parado) return false;
      if (resposta.conflitos?.length) {
        await db.transaction('rw', db.conflitosSync, db.filaSincronizacao, async () => {
          for (const item of resposta.conflitos!) {
            this.conferir(item);
            const id = chaveSync(item.tabela, item.registro.id);
            const atual = await db.filaSincronizacao.get(id);
            if (atual?.usuarioId === usuarioId) await db.conflitosSync.put({ id, usuarioId,
              tabela: item.tabela, registroId: item.registro.id, local: atual.registro,
              remoto: item.registro, revisaoLocal: atual.revisao });
          }
        });
        return false;
      }
      if (!resposta.registros || resposta.registros.length !== lote.length) throw new Error('Resposta incompleta do Supabase. A fila foi preservada.');
      await db.transaction('rw', [...TABELAS_SYNC.map(t => db.table(t)), db.metadadosSync, db.filaSincronizacao, db.conflitosSync], async tx => {
        marcarTransacaoRemota(tx);
        for (const item of resposta.registros!) {
          this.conferir(item);
          const id = chaveSync(item.tabela, item.registro.id);
          const enviada = pendencias.find(p => p.id === id);
          if (!enviada || enviada.revisao !== item.registro.revisao_cliente) throw new Error('Confirmação de envio inválida.');
          await db.metadadosSync.put({ id, usuarioId, versao: item.registro.versao });
          const atual = await db.filaSincronizacao.get(id);
          if (atual?.revisao === enviada.revisao) {
            await db.table(item.tabela).put(paraLocal(item.tabela, item.registro));
            await db.filaSincronizacao.delete(id);
            await db.conflitosSync.delete(id);
          }
        }
      });
    }
    if (this.parado) return false;
    const snapshot = await this.transporte.baixar();
    if (this.parado) return false;
    await db.transaction('rw', [...TABELAS_SYNC.map(t => db.table(t)), db.metadadosSync, db.filaSincronizacao], async tx => {
      marcarTransacaoRemota(tx);
      for (const item of snapshot) {
        this.conferir(item);
        const id = chaveSync(item.tabela, item.registro.id);
        if (await db.filaSincronizacao.get(id)) continue;
        const meta = await db.metadadosSync.get(id);
        if (meta && meta.versao >= item.registro.versao) continue;
        await db.table(item.tabela).put(paraLocal(item.tabela, item.registro));
        await db.metadadosSync.put({ id, usuarioId, versao: item.registro.versao });
      }
    });
    return (await db.filaSincronizacao.where('usuarioId').equals(usuarioId).count()) === 0;
  }
  private conferir(item: RespostaRegistro) {
    if (!TABELAS_SYNC.includes(item.tabela) || item.registro.usuario_id !== this.usuarioId) {
      throw new Error('Resposta do servidor não pertence à conta ativa.');
    }
  }
  async resolver(conflito: ConflitoSync, escolha: 'local' | 'remoto') {
    const { db, usuarioId } = this;
    if (this.parado || conflito.usuarioId !== usuarioId) throw new Error('Conta inválida.');
    await db.transaction('rw', db.table(conflito.tabela), db.metadadosSync, db.filaSincronizacao, db.conflitosSync, async tx => {
      marcarTransacaoRemota(tx);
      const atual = await db.filaSincronizacao.get(conflito.id);
      if (!atual || atual.revisao !== conflito.revisaoLocal) throw new Error('O registro mudou. Sincronize e confira novamente as versões.');
      await db.metadadosSync.put({ id: conflito.id, usuarioId, versao: conflito.remoto.versao });
      if (escolha === 'remoto') {
        await db.table(conflito.tabela).put(paraLocal(conflito.tabela, conflito.remoto));
        await db.filaSincronizacao.delete(conflito.id);
      } else {
        const pendencia: Pendencia = { ...atual, revisao: crypto.randomUUID(), tentativas: 0 };
        await db.filaSincronizacao.put(pendencia);
      }
      await db.conflitosSync.delete(conflito.id);
    });
  }
}
