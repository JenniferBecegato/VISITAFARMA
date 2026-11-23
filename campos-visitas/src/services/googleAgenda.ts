import { Browser } from '@capacitor/browser';
import { RETORNO_ANDROID } from './loginAndroid';
import { androidNativo, supabase } from './supabase';
import { dataLocal } from '../utils/relatorios';
import type { Visita } from '../database/database';

const escopos = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];
export const RETORNO_GOOGLE_AGENDA = 'campos-retorno-google-agenda';

export async function autorizarGoogleAgenda(email: string) {
  if (!supabase || !navigator.onLine) throw new Error('Conecte-se à internet para acessar o Google Agenda.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: escopos.join(' '),
      redirectTo: androidNativo ? RETORNO_ANDROID : window.location.origin + window.location.pathname,
      skipBrowserRedirect: true,
      queryParams: { login_hint: email, prompt: 'consent' },
    },
  });
  if (error || !data.url) throw new Error('Não foi possível abrir a autorização do Google Agenda.');
  if (androidNativo) await Browser.open({ url: data.url });
  else {
    sessionStorage.setItem(RETORNO_GOOGLE_AGENDA, '1');
    window.location.assign(data.url);
  }
}

export interface AgendaGoogle {
  id: string;
  summary: string;
  summaryOverride?: string;
  primary?: boolean;
  accessRole?: string;
}

interface DataGoogle { date?: string; dateTime?: string }
interface EventoGoogle {
  id: string;
  summary?: string;
  start?: DataGoogle;
  end?: DataGoogle;
}

export class ErroGoogleAgenda extends Error {}
export class PermissaoGoogleAgenda extends ErroGoogleAgenda {}

async function verificarResposta(resposta: Response) {
  if (resposta.ok) return;
  if (resposta.status === 401) {
    throw new PermissaoGoogleAgenda('O acesso ao Google Agenda expirou. Conecte novamente.');
  }
  const corpo = await resposta.json().catch(() => null);
  const motivos = new Set<string>();
  for (const lista of [corpo?.error?.errors, corpo?.error?.details]) {
    if (!Array.isArray(lista)) continue;
    for (const item of lista) {
      if (typeof item?.reason === 'string') motivos.add(item.reason);
    }
  }
  if (motivos.has('SERVICE_DISABLED') || motivos.has('accessNotConfigured')) {
    throw new ErroGoogleAgenda('Habilite a Google Calendar API no projeto Google Cloud do cliente OAuth usado pelo Supabase e tente novamente.');
  }
  if (motivos.has('insufficientPermissions') || motivos.has('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
    throw new PermissaoGoogleAgenda('Autorize novamente o Google Agenda e conceda as permissões solicitadas.');
  }
  throw new ErroGoogleAgenda(`O Google Agenda retornou o erro HTTP ${resposta.status}.`);
}

export function idEventoGoogle(visitaId: string) {
  return 'visita' + Array.from(new TextEncoder().encode(visitaId), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function criarEventoGoogle(token: string, agenda: string, visita: Pick<Visita, 'id' | 'data' | 'horaInicio' | 'horaFim'>) {
  const dateTime = `${visita.data}T${visita.horaInicio}:00`;
  const fimPadrao = new Date(Date.parse(`${dateTime}Z`) + 30 * 60_000).toISOString().slice(0, 19);
  const timeZone = 'America/Sao_Paulo';
  const resposta = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(agenda)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: idEventoGoogle(visita.id),
      summary: 'Visita farmacêutica',
      visibility: 'private',
      start: { dateTime, timeZone },
      end: { dateTime: visita.horaFim ? `${visita.data}T${visita.horaFim}:00` : fimPadrao, timeZone },
    }),
    signal: AbortSignal.timeout(15000),
  });
  // Uma tentativa anterior pode ter criado o evento antes de perder a resposta.
  if (resposta.status !== 409) await verificarResposta(resposta);
}

async function listar<T>(token: string, caminho: string, parametros: Record<string, string>, signal: AbortSignal) {
  const url = new URL(caminho, 'https://www.googleapis.com/calendar/v3/');
  url.search = new URLSearchParams(parametros).toString();
  const itens: T[] = [];
  let proximaPagina: string | undefined;
  do {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    await verificarResposta(resposta);
    const pagina: { items?: T[]; nextPageToken?: string } = await resposta.json();
    itens.push(...(pagina.items ?? []));
    proximaPagina = pagina.nextPageToken;
    if (proximaPagina) url.searchParams.set('pageToken', proximaPagina);
  } while (proximaPagina);
  return itens;
}

export function listarAgendasGoogle(token: string, signal: AbortSignal) {
  return listar<AgendaGoogle>(token, 'users/me/calendarList', {
    minAccessRole: 'reader',
    fields: 'nextPageToken,items(id,summary,summaryOverride,primary,accessRole)',
  }, signal);
}

export async function listarEventosGoogle(token: string, agenda: string, mes: string, signal: AbortSignal) {
  const inicio = new Date(`${mes}-01T00:00:00`);
  const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
  // Agendas em outro fuso podem registrar eventos de dia inteiro com limites UTC diferentes.
  const eventos = await listar<EventoGoogle>(token, `calendars/${encodeURIComponent(agenda)}/events`, {
    timeMin: new Date(inicio.getTime() - 86400000).toISOString(),
    timeMax: new Date(fim.getTime() + 86400000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    fields: 'nextPageToken,items(id,summary,start,end)',
  }, signal);
  const dias: Record<string, { id: string; nome: string; horario: string }[]> = {};
  for (const evento of eventos) {
    const diaInteiro = evento.start?.date;
    const horaInicio = evento.start?.dateTime ? new Date(evento.start.dateTime) : undefined;
    const horaFim = evento.end?.dateTime ? new Date(evento.end.dateTime) : undefined;
    const primeiro = diaInteiro ?? (horaInicio && dataLocal(horaInicio));
    if (!primeiro) continue;
    const ultimo = evento.end?.date ?? (horaFim ? dataLocal(new Date(horaFim.getTime() - 1)) : primeiro);
    for (const cursor = new Date(inicio); cursor < fim; cursor.setDate(cursor.getDate() + 1)) {
      const dia = dataLocal(cursor);
      if (dia < primeiro || (diaInteiro ? dia >= ultimo : dia > ultimo && dia !== primeiro)) continue;
      const horario = diaInteiro ? 'Dia inteiro' : dia === primeiro && horaInicio
        ? horaInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'Em andamento';
      (dias[dia] ??= []).push({ id: evento.id, nome: evento.summary || 'Compromisso sem título', horario });
    }
  }
  return dias;
}
