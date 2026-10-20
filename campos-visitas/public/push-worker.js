/* Importado pelo service worker gerado pelo Workbox; sem dependências da página aberta. */
(() => {
  function banco() {
    return new Promise((resolve, reject) => {
      const pedido = indexedDB.open('campos-push-config', 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('estado');
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
  }
  async function estado() {
    const db = await banco();
    try {
      return await new Promise((resolve, reject) => {
        const pedido = db.transaction('estado').objectStore('estado').get('conta');
        pedido.onsuccess = () => resolve(pedido.result ?? { usuarioId: '', lidas: [] });
        pedido.onerror = () => reject(pedido.error);
      });
    } finally { db.close(); }
  }
  async function guardar(valor) {
    const db = await banco();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('estado', 'readwrite');
        tx.objectStore('estado').put(valor, 'conta');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function selo(total) {
    try {
      if (total > 0) await self.navigator.setAppBadge?.(total);
      else await self.navigator.clearAppBadge?.();
    } catch { /* Suporte depende do sistema operacional e da permissão. */ }
  }
  // Serializa mensagens/leitura de estado para não perder uma marcação durante um push.
  let fila = Promise.resolve();
  const enfileirar = tarefa => {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  };
  self.addEventListener('push', evento => {
    evento.waitUntil(enfileirar(async () => {
      let aviso;
      try { aviso = evento.data?.json(); } catch { return; }
      if (aviso?.tipo !== 'lembrete' || typeof aviso.chave !== 'string' || !Number.isFinite(aviso.expiraEm) || aviso.expiraEm <= Date.now()) return;
      const atual = await estado();
      if (!atual.usuarioId || aviso.usuarioId !== atual.usuarioId || atual.lidas.includes(aviso.chave)) return;
      await self.registration.showNotification(aviso.titulo || 'Lembrete de visita', {
        body: aviso.corpo, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png',
        tag: `lembrete/${aviso.usuarioId}/${aviso.chave}`, data: aviso,
        renotify: false
      });
      await selo(Math.max(0, Number(aviso.total) || 0));
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const janela of janelas) janela.postMessage({ tipo: 'ATUALIZAR_LEMBRETES', usuarioId: aviso.usuarioId });
    }));
  });
  self.addEventListener('message', evento => {
    const mensagem = evento.data;
    if (!['CONTA_PUSH', 'SAIR_PUSH', 'LEMBRETES_LIDOS'].includes(mensagem?.tipo)) return;
    evento.waitUntil(enfileirar(async () => {
      const atual = await estado();
      if (mensagem.tipo === 'CONTA_PUSH') {
        await guardar({ usuarioId: mensagem.usuarioId, lidas: atual.usuarioId === mensagem.usuarioId ? atual.lidas : [] });
      } else if (mensagem.tipo === 'SAIR_PUSH') {
        await guardar({ usuarioId: '', lidas: [] });
        for (const aviso of await self.registration.getNotifications()) aviso.close();
        await selo(0);
      } else {
        // Ler lembretes não ativa push sem o toque de permissão/cadastro do aparelho.
        if (atual.usuarioId === mensagem.usuarioId) await guardar({ ...atual, lidas: mensagem.lidas ?? atual.lidas });
        const chaves = mensagem.chaves ?? [];
        for (const aviso of await self.registration.getNotifications()) {
          if (aviso.data?.tipo === 'lembrete' && (aviso.data.usuarioId !== mensagem.usuarioId || !chaves.includes(aviso.data.chave))) aviso.close();
        }
        await selo(chaves.length);
      }
    }));
  });
  self.addEventListener('notificationclick', evento => {
    if (evento.notification.data?.tipo !== 'lembrete') return;
    evento.notification.close();
    evento.waitUntil((async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const janela = janelas.find(j => new URL(j.url).origin === self.location.origin);
      if (janela) {
        await janela.focus();
        janela.postMessage({ tipo: 'ABRIR_LEMBRETES', usuarioId: evento.notification.data.usuarioId });
      } else await self.clients.openWindow('/?lembretes=1');
    })());
  });
})();
