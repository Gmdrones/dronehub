# Renovação por e-mail

A rotina POST /api/cron/subscription-expiry envia lembretes para Pro ativo com vencimento futuro dentro de 7 dias. São três faixas: até 7, até 3 e até 1 dia. Uma conta descoberta com 4 dias restantes recebe a faixa de 7 dias. Administradores, contas bloqueadas e e-mails não confirmados são excluídos. A validade e o destinatário são conferidos novamente antes do envio.

Cada combinação usuário + vencimento + faixa é reservada atomicamente em renewal_email_deliveries. Não há repetição automática de uma tentativa, inclusive em caso de timeout. Estados failed, claimed e uncertain exigem conferência no Brevo antes de qualquer recuperação manual. accepted significa aceitação pelo provedor, não entrega na caixa de entrada.

## Configuração

Pages: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, EMAIL_FROM, CRON_SECRET e RENEWAL_EMAILS_ENABLED=true. Sem a última variável, envios reais permanecem desativados. Nunca coloque segredos no repositório.

POST com Authorization: Bearer <CRON_SECRET> e ?dry_run=true verifica estrutura e conta elegíveis sem enviar e sem gravar. O dry run não valida credenciais do Brevo nem entregabilidade.

O agendador precisa chamar por POST, diariamente. O handler local de operations-worker foi corrigido, mas o Worker de produção não possui cron nem as variáveis SITE_URL/CRON_SECRET. Não substituir o Worker de clima sem comparar seu código implantado. Preparar um agendador separado ou configurar o existente após essa comparação. Usar apenas um agendador.

## Implantação verificada em 29/09/2026

A tabela da migration 20260929185557 foi criada pelo SQL Editor no projeto de produção. A migration ainda precisa ser reconciliada no histórico com `supabase migration repair 20260929185557 --status applied --linked`, após autenticar o CLI e conferir o projeto correto. Não executar db push em lote: há diferenças anteriores no histórico.

O código de renovação está em revisão local. Ativação pendente de teste de entrega para endereço indicado pelo proprietário e configuração do agendador. Não foram enviados e-mails reais nesta validação. O downgrade de planos permanece sob responsabilidade do cron já existente no banco.
