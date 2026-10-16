import type { Visita } from '../database/database';
export function rotuloStatusVisita(status: Visita['status']) {
  return status === 'reagendada' ? 'Visita remarcada' : status;
}
