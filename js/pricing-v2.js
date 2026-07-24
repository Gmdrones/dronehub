document.addEventListener('DOMContentLoaded', function(){
  var footer=document.querySelector('.footer'); if(!footer || document.querySelector('.faq-v2')) return;
  var faq=document.createElement('section'); faq.className='faq-v2';
  faq.innerHTML='<h2>Dúvidas frequentes</h2><div class="faq-v2-grid"><details><summary>O plano anual é uma cobrança mensal?</summary>Não. É um pagamento único de R$ 358,80 que libera 12 meses de acesso ao Drone Hub.</details><details><summary>Posso cancelar o plano mensal?</summary>Sim. O acesso permanece ativo até o fim do período já pago, sem multa.</details><details><summary>Quais meios de pagamento são aceitos?</summary>Cartão, PIX e boleto são processados com segurança pelo Mercado Pago.</details><details><summary>O plano Free expira?</summary>Não. Ele continua disponível para iniciar a organização da sua operação.</details></div>';
  footer.parentNode.insertBefore(faq,footer);
});
