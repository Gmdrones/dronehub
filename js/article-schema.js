(function () {
  var navScript = document.createElement('script');
  navScript.src = 'js/public-content-nav.js';
  document.head.appendChild(navScript);

  var article = document.querySelector('article');
  var heading = document.querySelector('h1');
  var description = document.querySelector('meta[name="description"]');

  // Links editoriais usam azul, mas os CTAs precisam de contraste escuro.
  document.querySelectorAll('.article a.button').forEach(function (button) {
    button.style.color = '#06111c';
  });

  // Linguagem mais clara no exemplo de precificação.
  if (document.body) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      node.nodeValue = node.nodeValue
        .replace('rateio dos custos fixos', 'parcela dos custos de equipamentos e estrutura')
        .replace('rateio de equipamento e estrutura', 'parcela dos custos de equipamentos e estrutura atribuída ao serviço');
    }
  }

  if (!article || !heading) return;
  var schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.text = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: heading.textContent,
    description: description ? description.content : '',
    inLanguage: 'pt-BR',
    datePublished: '2026-07-28',
    dateModified: '2026-07-28',
    author: { '@type': 'Organization', name: 'Drone Hub' },
    publisher: { '@type': 'Organization', name: 'Drone Hub' },
    mainEntityOfPage: location.href
  });
  document.head.appendChild(schema);
}());
