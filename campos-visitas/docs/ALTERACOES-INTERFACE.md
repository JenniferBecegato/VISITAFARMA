# Ajustes da interface — calendário e atalhos

Atualização de 15/10/2026 aplicada ao projeto Campos Visitas.

- Página inicial: status junto ao nome do médico; ações por visita para editar, realizar, cancelar, reagendar e abrir formulário. Visitas concluídas preservam seu estado; cancelar/reagendar só se aplica a visitas pendentes.
- Menu: Secretárias e Formulários têm acesso próprio. O botão Secretárias saiu da pesquisa de médicos. No celular, o menu inferior permite rolagem horizontal para alcançar todas as telas.
- Agenda: calendário mensal com navegação entre meses, botão Hoje, eventos com horário/nome/situação e seleção do dia. O botão + de cada dia abre o agendamento com essa data. Clicar no nome do evento abre a pasta e o histórico do médico. As visitas do dia selecionado aparecem abaixo do calendário.
- Reagendamentos: data e horário anteriores são registrados na mesma transação da alteração. Edições desatualizadas são recusadas para evitar perda de alterações recentes.
- Médico: campo Nome da secretária cria um contato vinculado, disponível no menu e sugerido no agendamento. E-mail foi removido da tela; valores antigos permanecem armazenados.
- Produtos: ordem dos controles alterada para busca, botão Pesquisar e situação. Médicos e Produtos usam botão de pesquisa menor e com estilo discreto.

Validação: 14 testes passaram, assim como TypeScript, ESLint e build de produção/PWA. No navegador foi conferida a criação do médico com secretária, o agendamento pelo calendário, a abertura do histórico pelo evento, o atalho de reagendamento, a mudança da visita de hoje para próximas visitas e a abertura de um formulário finalizado pelo menu.

Os registros usados nos testes visuais estão identificados como teste e pertencem ao endereço local de conferência `http://127.0.0.1:4173`.
