document.addEventListener('DOMContentLoaded', function () {
  var proBenefits = [
    'Até 20 aeronaves e perfil profissional do piloto',
    'Documentos ilimitados, missões e checklist pré-voo',
    'Índice de risco por local, data e aeronave',
    'Previsão climática e alertas de vento, rajadas e chuva',
    'Mapa de operações com histórico de missões',
    'Diário automático de missão e evidências',
    'Saúde da frota: baterias, seguro, firmware e manutenção',
    'Modo fiscalização com QR Code temporário',
    'Gerador de propostas, contratos, recibos e relatórios',
    'Relatórios pós-voo para o cliente, PDF, Excel e CSV',
    'Financeiro, assistente IA e backup de dados'
  ];

  var proList = document.querySelector('.pricing-card.pro .pricing-features');
  if (proList) {
    proList.innerHTML = proBenefits.map(function (label) {
      return '<li><span class="check" aria-hidden="true">&#10003;</span> ' + label + '</li>';
    }).join('');
  }

  var featureCards = [
    ['01', 'Índice de risco de voo', 'Cruza local, data, previsão meteorológica e limite da aeronave para apoiar a decisão operacional.'],
    ['02', 'Mapa de operações', 'Visualize locais de missão, planejamento e histórico em uma linha do tempo geográfica.'],
    ['03', 'Alertas inteligentes', 'Receba avisos de vento, rajadas, chuva, documentos e manutenções pendentes.'],
    ['04', 'Diário automático', 'Registre piloto, aeronave, local, clima, checklist e evidências de cada missão.'],
    ['05', 'Saúde da frota', 'Acompanhe ciclos de bateria, seguro, firmware e manutenção em um só painel.'],
    ['06', 'Relatório pós-voo', 'Entregue um resumo profissional, exportável e pronto para compartilhar com o cliente.']
  ];

  if (document.title.indexOf('Funcionalidades') !== -1) {
    var grids = document.querySelectorAll('.grid-3');
    var target = grids.length ? grids[grids.length - 1] : null;
    if (target && !target.dataset.operationalSuite) {
      target.dataset.operationalSuite = 'true';
      featureCards.forEach(function (feature) {
        var card = document.createElement('article');
        card.className = 'card operation-feature';
        card.innerHTML = '<div class="feature-mark" aria-hidden="true">' + feature[0] + '</div><h3>' + feature[1] + '</h3><p>' + feature[2] + '</p><span class="badge pro">Pro</span>';
        target.appendChild(card);
      });
    }
  }
});
