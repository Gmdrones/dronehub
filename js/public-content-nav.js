(function () {
  var nav = document.querySelector('.content-nav');
  if (!nav) return;
  nav.innerHTML =
    '<a href="index.html">Home</a>' +
    '<a href="funcionalidades.html">Funcionalidades</a>' +
    '<a href="precos.html">Preços</a>' +
    '<a href="sobre.html">Sobre</a>' +
    '<a href="blog.html">Blog</a>' +
    '<a href="login.html">Entrar</a>' +
    '<a class="nav-cta" href="login.html?signup=true&utm_source=conteudo&utm_medium=organic">Cadastrar grátis</a>';
}());
