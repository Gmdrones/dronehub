import { getUser, json, logIntegration, sendEmail } from '../_lib/server.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, function (character) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character];
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUser(request, env);
    const body = await request.json();
    const message = String(body.message || '').trim();
    const topic = String(body.topic || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 100);
    const phone = String(body.phone || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 40);
    if (topic.length < 3) return json({ error: 'Informe o assunto da sua mensagem.' }, 400);
    if (message.length < 10 || message.length > 4000) return json({ error: 'Escreva uma mensagem entre 10 e 4.000 caracteres.' }, 400);
    const name = String(user.user_metadata?.full_name || 'Piloto DroneHub').trim().slice(0, 120);
    await sendEmail(env, {
      to: 'appdronehub@gmail.com',
      subject: `[Suporte DroneHub] ${topic} · ${user.email}${phone ? ` · ${phone}` : ''}`,
      replyTo: { email: user.email, name },
      text: `Solicitação de suporte\n\nPiloto: ${name}\nE-mail: ${user.email}\nTelefone: ${phone || 'Não informado'}\nAssunto: ${topic}\n\nMensagem:\n${message}`,
      html: `<h2>Nova solicitação de suporte</h2><p><strong>Piloto:</strong> ${escapeHtml(name)}<br><strong>E-mail:</strong> ${escapeHtml(user.email)}<br><strong>Telefone:</strong> ${escapeHtml(phone || 'Não informado')}<br><strong>Assunto:</strong> ${escapeHtml(topic)}</p><p><strong>Mensagem:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
    });
    await logIntegration(env, 'support', 'message_sent', 'info', { topic, message_length: message.length }, user.id);
    return json({ ok: true });
  } catch (error) {
    const status = error.status || 500;
    return json({ error: status === 401 ? 'Faça login para enviar uma mensagem ao suporte.' : 'Não foi possível enviar sua mensagem agora. Tente novamente.' }, status);
  }
}
