# Drone Hub — plano de produto e crescimento

Atualizado em 30 de agosto de 2026.

## Objetivo do produto

Ser a central operacional do piloto profissional de drones: organizar cadastro, conformidade e fiscalização no Free; transformar planejamento, execução, evidências e gestão financeira em um fluxo único no Pro.

## Bugs e riscos prioritários

### P0 — corrigir antes de aumentar tráfego pago

1. Criar testes ponta a ponta dos fluxos cadastro → aeronave → assinatura → Pro → vencimento → Free.
2. Testar webhook de pagamento, idempotência, reembolso e atraso de confirmação em produção controlada.
3. Remover divergências entre dados iniciais do `localStorage` e a hidratação posterior do Supabase. Cada tela deve renderizar novamente após `dronehub:cloud-ready`.
4. Revisar interpolação de dados do usuário em HTML. Algumas telas antigas ainda montam HTML sem escape consistente.
5. Garantir que toda autorização Pro seja validada no servidor, não apenas escondida no menu.

### P1 — estabilidade e experiência

1. Centralizar calendário, alertas e missões em módulos reutilizáveis, evitando lógica duplicada no HTML.
2. Criar estados de carregamento, vazio, erro e nova tentativa em todas as consultas externas.
3. Monitorar erros JavaScript, falhas do Worker, latência do Supabase e erros de pagamento.
4. Criar matriz responsiva para 390 px, 768 px, 1024 px e desktop.
5. Adicionar testes de acessibilidade: foco dos modais, teclado, contraste e leitores de tela.

## Marketing

### Posicionamento recomendado

- Free: perfil do piloto, uma aeronave e modo Fiscalização.
- Pro: Central de Voo, documentos, missões, relatórios, financeiro, alertas e gestão da frota.
- Promessa principal: “Planeje, execute e comprove cada operação em um só lugar.”

### Correções de mensagem

Existem textos antigos que ainda sugerem clima ou Central de Voo no Free e devem ser uniformizados antes de campanhas. A página Funcionalidades já apresenta a divisão correta e deve ser a fonte de verdade editorial.

### Funil mínimo

1. Visita à página pública.
2. Clique em cadastro.
3. Conta criada.
4. Perfil concluído.
5. Primeira aeronave cadastrada.
6. Visualização da oferta Pro.
7. Checkout iniciado.
8. Pagamento aprovado.
9. Primeira missão criada.
10. Retenção em 7 e 30 dias.

Sem esses eventos não é possível calcular CAC, conversão, ativação ou retorno dos anúncios com segurança.

## Anúncios

### Preparação obrigatória

- Instalar analytics e eventos de conversão com consentimento compatível com a política de privacidade.
- Não iniciar campanha de compra antes de validar checkout e atribuição.
- Criar públicos separados: pilotos iniciantes, prestadores profissionais e empresas com frota.
- Usar UTMs padronizadas em todas as campanhas.

### Primeiros testes criativos

1. Dor de conformidade: “Se houver fiscalização hoje, seus documentos estão prontos?”
2. Dor operacional: “Clima, missão, aeronave e evidências em uma única central.”
3. Dor financeira: “Descubra se cada missão realmente deu lucro.”

Landing pages e anúncios devem apresentar exatamente a mesma divisão Free/Pro exibida no produto.

## Documentação

Criar e manter:

1. Guia de início rápido do piloto.
2. Matriz oficial Free × Pro.
3. Guia de cadastro de aeronave e Fiscalização.
4. Guia de missões, calendário e notificações.
5. Guia de cobrança, renovação, cancelamento e retorno ao Free.
6. Procedimento de suporte e resposta a incidentes.
7. Runbook técnico de Cloudflare, Supabase, pagamentos e restauração.
8. Histórico de versões com mudanças visíveis para o cliente.

## Roadmap de 90 dias

### 0–30 dias — confiabilidade e medição

- Concluir calendário e notificações internas.
- Uniformizar mensagens Free/Pro.
- Implantar monitoramento de erros e funil de conversão.
- Cobrir autenticação, pagamentos e permissões com testes ponta a ponta.
- Criar documentação de suporte e cobrança.

### 31–60 dias — ativação e retenção

- Onboarding guiado com checklist de ativação.
- Central de notificações persistente, com lidas/não lidas.
- Preferências de aviso por e-mail e, depois, push com consentimento.
- Modelos de missão e documentos por tipo de serviço.
- Painel administrativo de saúde do produto.

### 61–90 dias — aquisição e expansão

- Iniciar campanhas pequenas após validar atribuição.
- Criar programa de indicação.
- Testar plano anual e oferta para pequenas equipes.
- Publicar estudos de caso e páginas por segmento.
- Medir retenção, conversão Free→Pro, churn e receita recorrente.

## Métricas de decisão

- Ativação: perfil completo + primeira aeronave em até 24 horas.
- Conversão Free→Pro.
- Tempo até primeira missão.
- Retenção de 7 e 30 dias.
- Churn e motivo do cancelamento.
- Pagamentos aprovados, pendentes, recusados e reembolsados.
- Uso semanal de Central de Voo, missões, documentos e Fiscalização.
- CAC, receita recorrente e retorno por campanha.

## Próxima decisão

Priorizar medição e confiabilidade antes de escalar anúncios. A próxima entrega recomendada é instrumentação do funil, monitoramento de erros e uniformização completa das mensagens Free/Pro.
