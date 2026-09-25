/* Progressive enhancement: all guides and article content remain available without JS. */
(() => {
  'use strict';
  const search = document.querySelector('#article-search');
  if (search) {
    document.querySelector('.library-controls').hidden = false;
    const cards = [...document.querySelectorAll('.guide-card')];
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let category = '';
    function filter() {
      const query = normalize(search.value.trim());
      let count = 0;
      cards.forEach(card => {
        card.hidden = !((!category || card.dataset.category === category) && normalize(card.textContent).includes(query));
        if (!card.hidden) count++;
      });
      document.querySelector('#results-count').textContent = `${count} ${count === 1 ? 'guia encontrado' : 'guias encontrados'}`;
      document.querySelector('.empty-results').hidden = count !== 0;
      document.querySelector('.featured-section').hidden = Boolean(query || category);
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
    }
    search.addEventListener('input', filter);
    buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; filter(); }));
    document.querySelector('#clear-filters').addEventListener('click', () => { search.value = ''; category = ''; filter(); search.focus(); });
  }
  const article = document.querySelector('#article-content');
  if (!article) return;
  const toc = document.querySelector('.article-toc');
  if (toc) {
    const details = document.createElement('details');
    details.className = 'mobile-toc';
    const summary = document.createElement('summary');
    summary.textContent = 'Neste guia · sumário';
    details.append(summary, toc.cloneNode(true));
    article.before(details);
    details.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { details.open = false; }));
  }
  document.querySelectorAll('.side-card > a').forEach(link => {
    const slug = link.getAttribute('href').replace(/\.html$/, '');
    if (!/^[a-z0-9-]+$/.test(slug)) return;
    const img = document.createElement('img');
    img.src = `assets/blog/${slug}.svg`; img.alt = ''; img.className = 'related-cover'; img.loading = 'lazy'; img.width = 62; img.height = 46;
    link.prepend(img);
  });
  const bar = document.querySelector('.reading-progress span');
  const headings = [...article.querySelectorAll('h2[id]')];
  const links = [...document.querySelectorAll('.article-toc a')];
  let queued = false;
  function update() {
    const rect = article.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight + 105);
    const progress = Math.min(1, Math.max(0, (105 - rect.top) / distance));
    bar.style.transform = `scaleX(${progress})`;
    let current = headings[0];
    headings.forEach(heading => { if (heading.getBoundingClientRect().top <= 150) current = heading; });
    links.forEach(link => {
      if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    queued = false;
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  update();
})();
