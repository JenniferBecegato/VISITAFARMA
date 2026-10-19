export type TipoData = 'nacional' | 'estadual' | 'municipal' | 'facultativo' | 'comemorativo';
export const legendaDatas: Record<TipoData, string> = {
  nacional: 'Feriado nacional', estadual: 'Feriado estadual', municipal: 'Feriado municipal',
  facultativo: 'Ponto facultativo', comemorativo: 'Data comemorativa'
};
export const fonteDatas2027 = 'https://feriados.com.br/SP/Presidente%20Prudente/2027';
// Datas e categorias conforme a fonte indicada. Restritas ao ano de 2027.
const registros: [string, string, TipoData][] = [
  ['01-01', 'Ano Novo', 'nacional'],
  ['01-20', 'Padroeiro — São Sebastião', 'municipal'],
  ['02-08', 'Carnaval', 'facultativo'],
  ['02-09', 'Carnaval', 'facultativo'],
  ['02-10', 'Carnaval — Quarta-feira de Cinzas', 'facultativo'],
  ['03-26', 'Sexta-Feira Santa', 'nacional'],
  ['03-26', 'Sexta-feira da Paixão', 'municipal'],
  ['03-28', 'Páscoa', 'comemorativo'],
  ['04-01', 'Dia da Mentira', 'comemorativo'],
  ['04-21', 'Dia de Tiradentes', 'nacional'],
  ['05-01', 'Dia do Trabalho', 'nacional'],
  ['05-09', 'Dia das Mães', 'comemorativo'],
  ['05-27', 'Corpus Christi', 'facultativo'],
  ['05-27', 'Corpus Christi', 'municipal'],
  ['06-12', 'Dia dos Namorados', 'comemorativo'],
  ['07-09', 'Revolução Constitucionalista', 'estadual'],
  ['08-08', 'Dia dos Pais', 'comemorativo'],
  ['09-07', 'Independência do Brasil', 'nacional'],
  ['09-14', 'Aniversário de Presidente Prudente', 'municipal'],
  ['10-12', 'Nossa Senhora Aparecida', 'nacional'],
  ['10-15', 'Dia do Professor', 'facultativo'],
  ['10-17', 'Dia do Comércio', 'comemorativo'],
  ['10-28', 'Dia do Servidor Público', 'facultativo'],
  ['11-02', 'Dia de Finados', 'nacional'],
  ['11-15', 'Proclamação da República', 'nacional'],
  ['11-20', 'Consciência Negra', 'nacional'],
  ['12-08', 'Imaculada Conceição', 'municipal'],
  ['12-25', 'Natal', 'nacional']
];
export const datasPresidentePrudente2027 = registros.map(([dia, nome, tipo]) => ({ data: `2027-${dia}`, nome, tipo }));
export const fonteDatas2026 = 'https://www.presidenteprudente.sp.gov.br/site/noticia/66177';
const registros2026: [string, string, TipoData][] = [
  ['01-01', 'Confraternização Universal', 'nacional'],
  ['01-02', 'Ponto facultativo municipal', 'facultativo'],
  ['01-19', 'Ponto facultativo municipal', 'facultativo'],
  ['01-20', 'São Sebastião', 'municipal'],
  ['02-16', 'Carnaval', 'facultativo'],
  ['02-17', 'Carnaval', 'facultativo'],
  ['02-18', 'Quarta-feira de Cinzas', 'facultativo'],
  ['04-02', 'Ponto facultativo municipal', 'facultativo'],
  ['04-03', 'Sexta-feira da Paixão', 'municipal'],
  ['04-20', 'Ponto facultativo municipal', 'facultativo'],
  ['04-21', 'Tiradentes', 'nacional'],
  ['05-01', 'Dia do Trabalho', 'nacional'],
  ['06-04', 'Corpus Christi', 'municipal'],
  ['06-05', 'Ponto facultativo municipal', 'facultativo'],
  ['07-09', 'Revolução Constitucionalista', 'estadual'],
  ['09-07', 'Independência do Brasil', 'nacional'],
  ['09-14', 'Aniversário de Presidente Prudente', 'municipal'],
  ['10-12', 'Nossa Senhora Aparecida', 'nacional'],
  ['10-30', 'Dia do Servidor Público — ponto facultativo transferido', 'facultativo'],
  ['11-02', 'Finados', 'nacional'],
  ['11-15', 'Proclamação da República', 'nacional'],
  ['11-20', 'Consciência Negra', 'nacional'],
  ['12-07', 'Ponto facultativo municipal', 'facultativo'],
  ['12-08', 'Imaculada Conceição', 'municipal'],
  ['12-24', 'Véspera de Natal — ponto facultativo', 'facultativo'],
  ['12-25', 'Natal', 'nacional'],
  ['12-31', 'Véspera de Ano Novo — ponto facultativo', 'facultativo']
];
export const datasPresidentePrudente2026 = registros2026.map(([dia, nome, tipo]) => ({ data: `2026-${dia}`, nome, tipo }));
const todasDatas = [...datasPresidentePrudente2026, ...datasPresidentePrudente2027];
export function datasProfissionais(ano: number) {
  return [
    { data: `${ano}-01-20`, nome: 'Dia do Farmacêutico', tipo: 'comemorativo' as const },
    { data: `${ano}-09-30`, nome: 'Dia da Secretária', tipo: 'comemorativo' as const },
    { data: `${ano}-10-18`, nome: 'Dia do Médico', tipo: 'comemorativo' as const }
  ];
}
export function datasNoDia(data: string) {
  return [...todasDatas, ...datasProfissionais(Number(data.slice(0, 4)))].filter(item => item.data === data);
}
export function datasNoMes(ano: number, mes: number) {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}-`;
  return [...todasDatas, ...datasProfissionais(ano)].filter(item => item.data.startsWith(prefixo)).sort((a, b) => a.data.localeCompare(b.data));
}
