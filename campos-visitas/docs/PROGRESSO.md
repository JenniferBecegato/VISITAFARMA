# Campos Visitas — avanço de 15/10/2026

Projeto atualizado diretamente em `C:\Users\Meire\Desktop\VISITAFARMA\campos-visitas`.

## Implementado nesta continuação

- Produtos: criar e editar nome, categoria, descrição, observações e situação. Busca sem distinção de acentos; filtros de ativos/inativos; bloqueio de nomes duplicados na transação local.
- Secretárias: criar, editar, buscar e vincular o mesmo contato a vários médicos. Acesso em Médicos > Gerenciar secretárias. Cadastros antigos com um médico continuam compatíveis.
- Agenda: sugere a clínica ao escolher o médico e permite selecionar uma secretária vinculada.
- Formulário: seleciona produtos cadastrados, informa quantidades inteiras de amostras e mantém os campos livres. Grava formulário e vínculos na mesma transação, sem duplicar relações no reenvio. Remoções são lógicas. Sugere secretárias e preenche o contato escolhido no agendamento. Relatórios antigos continuam editáveis.
- Médicos: bloqueio de CRM/UF repetidos e aviso para nomes semelhantes, com conferência explícita antes de aceitar pessoas diferentes.
- Relatórios: 30/60/90 dias ou período personalizado, situações das visitas, médicos visitados, especialidades, produtos, amostras e médicos sem visita realizada há mais de 60 dias. Impressão/salvar PDF pelo navegador.
- Backup: botão de exportação JSON, com snapshot consistente das tabelas e salvamento prévio do formulário aberto. A restauração/importação do backup ainda não foi implementada.
- Supabase: `.env.example`, migração inicial com RLS, vínculos por proprietária, versões e RPC de finalização; instruções em `docs/SUPABASE.md`. Apenas preparação local; nenhum banco remoto foi criado ou modificado.
- Scripts do Vite usam carregamento nativo da configuração para contornar `spawn EPERM` neste ambiente. Usar Node.js 24, como no ambiente validado.

## Como abrir

No terminal, dentro da pasta `campos-visitas`:

```powershell
npm run dev
```

Abra o endereço mostrado pelo Vite. Para validar:

```powershell
npm test
npm run lint
npm run build
```

## Verificações

Build de produção e PWA concluídos; TypeScript e ESLint aprovados. Sete testes automatizados cobrem os cadastros, concorrência, vínculos, relatórios e recuperação de erros. Os testes de persistência usam banco simulado; a conferência adicional no navegador usa IndexedDB real.

Fluxo conferido no navegador local: produto persiste após recarregar; nome duplicado é bloqueado; médico e secretária são cadastrados; a secretária aparece na agenda e no formulário; a visita é agendada; o formulário é finalizado com produto selecionado e três amostras; os relatórios exibem uma visita realizada e três amostras. O backup baixado foi lido e contém médico, secretária, produto, visita, formulário e vínculo das amostras.

Os registros usados nessa conferência estão identificados como teste local no endereço `http://127.0.0.1:4173`. Os dados do IndexedDB são separados por endereço/origem; não foram transferidos para o banco de outro endereço.

## Próximas etapas necessárias

1. Criar o projeto Supabase e testar a migração SQL e as políticas com duas contas. O SQL não foi executado neste ambiente.
2. Implementar Supabase Auth, isolamento e desbloqueio seguro do acesso offline. Hoje o aplicativo ainda usa `usuario-local-teste`; não está pronto para contas reais separadas.
3. Implementar o serviço de sincronização bidirecional, fila persistente, importação controlada dos dados existentes e resolução de conflitos. A sincronização entre celular e tablet ainda não funciona.
4. Implementar integração com Google Agenda e lembretes individuais, com credenciais protegidas no servidor.
5. Implementar restauração validada de backup, testar persistência do armazenamento e validar a PWA nos dispositivos Android, iPhone e iPad, inclusive falhas de conexão e atualização da aplicação.

As contagens de produtos e amostras incluem apenas itens selecionados do catálogo, em visitas realizadas. Registros históricos em texto livre permanecem preservados, mas não são interpretados automaticamente como quantidades.
