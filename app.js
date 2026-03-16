// ── SUPABASE CONFIG ─────────────────────────────────────────
    const SUPABASE_URL  = 'https://zfxmzqwlcvtrsbvzhgjj.supabase.co';
    const SUPABASE_KEY  = 'sb_publishable_UE_DedafRcof_6fNuKfSvw_qiqVX7at';
    const db            = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const $ = id => document.getElementById(id);

    let replyActual = null;

    const CLOUD_NAME    = 'dhtyvavcy';
    const CLOUD_PRESET  = 'grupoestudio';




    // ── VIDEOLLAMADAS (Google Meet) ──────────────────────────────
    $('btn-iniciar-video').onclick = () => {
      if (!grupoActual?.id) return;
      window.open('https://meet.google.com/new', '_blank');
      $('meet-link-wrap').classList.remove('oculto');
      db.from('mensajes').insert({
        grupo_id: grupoActual.id,
        autor:    usuario.nombre,
        email:    usuario.email,
        texto:    '📹 ' + usuario.nombre + ' inició una videollamada en Google Meet. Copiá el link de Meet y pegalo acá para que todos se unan.'
      });
    };

    // ── VIDEO EN DM (tutor-alumno) ───────────────────────────────
    $('btn-dm-video').onclick = () => {
      if (!dmActual) return;
      window.open('https://meet.google.com/new', '_blank');
      db.from('mensajes_privados').insert({
        de_email:   usuario.email,
        de_nombre:  usuario.nombre,
        para_email: dmActual.email,
        texto:      '📹 Te invité a una videollamada de Google Meet. Abrí Meet, copiá el link y mandamelo para unirme.'
      });
    };

        // ── GAMIFICACIÓN ─────────────────────────────────────────────
    const NIVELES = [
      { nivel: 1, nombre: 'Novato',      min: 0,     emoji: '🌱' },
      { nivel: 2, nombre: 'Estudiante',  min: 2500,  emoji: '📖' },
      { nivel: 3, nombre: 'Avanzado',    min: 6200,  emoji: '🎓' },
      { nivel: 4, nombre: 'Experto',     min: 10000, emoji: '⭐' },
      { nivel: 5, nombre: 'Maestro',     min: 15000, emoji: '🏆' },
      { nivel: 6, nombre: 'Leyenda',     min: 25000, emoji: '👑' }
    ];

    function getNivel(puntos) {
      return [...NIVELES].reverse().find(n => puntos >= n.min) || NIVELES[0];
    }

    async function sumarPuntos(cantidad) {
      await db.rpc('sumar_puntos', { usuario_id: usuario.id, cantidad });
      verificarInsignias();
    }

    // ── SUBIR IMAGEN A CLOUDINARY ────────────────────────────────
    async function subirImagenCloudinary(file, carpeta) {
      const form = new FormData();
      form.append('file',           file);
      form.append('upload_preset',  CLOUD_PRESET);
      form.append('folder',         'grupoestudio/' + carpeta);
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
      const data = await res.json();
      return data.secure_url;
    }

    // ── ESTADO ──────────────────────────────────────────────────
    let usuario     = null;
    let grupoActual = null;
    let chatSub     = null;

    // ── NAVEGACIÓN CON BOTÓN ATRÁS ──────────────────────────────
    const historialPantallas = [];

    // Estado inicial en el historial para poder capturar el primer popstate
    history.replaceState({ app: true, idx: 0 }, '');
    let histIdx = 0;

    function ir(pantalla) {
      const actual = document.querySelector('.pantalla:not(.oculto)');
      if (actual && actual.id !== pantalla) {
        historialPantallas.push(actual.id);
        histIdx++;
        history.pushState({ app: true, idx: histIdx }, '');
      }
      // Mostrar pantalla
      document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculto'));
      const el = document.getElementById(pantalla);
      if (el) el.classList.remove('oculto');
      // Guardar pantalla actual para restaurar al recargar
      try { localStorage.setItem('pantalla_actual', pantalla); } catch(e) {}
      // Marcar que la app está activa (para no confundir con selector de archivos)
      sessionStorage.setItem('app_activa', '1');
    }

    window.addEventListener('popstate', (e) => {
      if (!e.state?.app) return;
      const anterior = historialPantallas.pop();
      if (anterior) {
        // Limpiar subs según pantalla que abandonamos
        const pantallaActual = document.querySelector('.pantalla:not(.oculto)')?.id;
        if (pantallaActual === 'pantalla-grupo') {
          if (chatSub)     { chatSub.unsubscribe(); chatSub = null; }
          if (presenceSub) { presenceSub.unsubscribe(); presenceSub = null; }
          grupoActual = null;
          onlineUsers = new Set();
          try { localStorage.removeItem('grupo_actual_id'); localStorage.removeItem('grupo_actual_nombre'); } catch(e) {}
        }
        if (pantallaActual === 'pantalla-dm') {
          if (dmSub) { db.removeChannel(dmSub); dmSub = null; }
          dmActual = null;
        }
        // Mostrar pantalla anterior
        document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculto'));
        const el = document.getElementById(anterior);
        if (el) el.classList.remove('oculto');
        if (anterior === 'pantalla-foro') mostrarListaForo();
        if (anterior === 'pantalla-inicio') cargarGrupos();
      } else {
        // Sin historial → pushear uno vacío para que el siguiente atrás minimice
        history.pushState({ app: true, idx: 0 }, '');
      }
    });

    // ── UTILIDADES ──────────────────────────────────────────────

    function irSilencioso(pantalla) {
      document.querySelectorAll('.pantalla').forEach(p => p.classList.add('oculto'));
      $(pantalla).classList.remove('oculto');
    }

    function vacio(id, icono, texto) {
      $(id).innerHTML = `<div class="vacio"><span>${icono}</span>${texto}</div>`;
    }

    function cargando(id) {
      $(id).innerHTML = `<p class="cargando">Cargando...</p>`;
    }

    // ── AUTH ────────────────────────────────────────────────────
    db.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        usuario        = session.user;
        usuario.nombre = session.user.user_metadata?.nombre || session.user.email;
        usuario.email  = session.user.email;
        window._miEmail = session.user.email.toLowerCase().trim();
        await cargarInicio();
        iniciarNotificaciones();
        procesarInvitacion();
        // Restaurar pantalla anterior si existía
        await restaurarPantalla();
        // Crear/cargar perfil en background
        cargarPerfil();
      } else {
        usuario = null;
        window._miEmail = null;
        ir('pantalla-login');
      }
    });

    $('btn-login').onclick = async () => {
      const email = $('login-email').value.trim();
      const pass  = $('login-pass').value;
      if (!email || !pass) return alert('Completá todos los campos');
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) alert('Correo o contraseña incorrectos');
    };

    $('btn-registro').onclick = async () => {
      const nombre = $('reg-nombre').value.trim();
      const email  = $('reg-email').value.trim();
      const pass   = $('reg-pass').value;
      if (!nombre || !email || !pass) return alert('Completá todos los campos');
      if (pass.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');
      const { error } = await db.auth.signUp({
        email, password: pass,
        options: { data: { nombre } }
      });
      if (error) {
        if (error.message.includes('already')) alert('Ya existe una cuenta con ese correo');
        else alert('Error: ' + error.message);
      } else {
        alert('✅ Cuenta creada. Revisá tu correo para confirmar (o iniciá sesión directamente si lo tenés desactivado).');
        ir('pantalla-login');
      }
    };

    $('btn-salir').onclick = () => db.auth.signOut();

    // ── INICIO ──────────────────────────────────────────────────
    let gruposSub = null;

    async function cargarInicio() {
      ir('pantalla-inicio');
      const inicial = usuario.nombre[0].toUpperCase();
      $('inicio-avatar').textContent = inicial;
      $('inicio-nombre').textContent = usuario.nombre;
      cargarGrupos();
      cargarExplorar();

      // Escuchar cambios en grupos en tiempo real
      if (gruposSub) { db.removeChannel(gruposSub); gruposSub = null; }
      gruposSub = db.channel('grupos-realtime-' + usuario.id)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'grupos'
        }, payload => {
          const m = payload.new;
          if (!m) { cargarGrupos(); return; }
          // Si soy miembro recargo
          if (Array.isArray(m.miembros) && m.miembros.includes(usuario.email)) {
            cargarGrupos();
            // Notificar si me acaban de agregar
            const anterior = payload.old;
            if (anterior && Array.isArray(anterior.miembros) && !anterior.miembros.includes(usuario.email)) {
              mostrarToast('👥 Nuevo grupo', `Fuiste añadido a "${m.nombre}"`);
              actualizarBadgeNotif();
            }
          }
        })
        .subscribe();
    }

    // ── GRUPOS ──────────────────────────────────────────────────
    async function cargarGrupos() {
      cargando('lista-grupos');
      const { data, error } = await db
        .from('grupos')
        .select('id,nombre,materia,creador,creador_email,miembros,privado,creado_el')
        .contains('miembros', [usuario.email])
        .order('creado_el', { ascending: false });

      if (error) {
        $('lista-grupos').innerHTML = `<p class="cargando" style="color:var(--red)">Error: ${error.message}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        vacio('lista-grupos', '📭', 'Todavía no tenés grupos. ¡Creá el primero!');
        return;
      }

      $('lista-grupos').innerHTML = data.map(g => `
        <div class="grupo-card" data-id="${g.id}" data-nombre="${g.nombre}">
          <div class="grupo-info">
            <h3>${g.privado ? '🔒' : '📘'} ${g.nombre}</h3>
            <p>${g.materia} · Creado por ${g.creador}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
            ${g.creador_email === usuario.email ? `<button class="btn-eliminar-grupo" data-id="${g.id}" data-nombre="${g.nombre}" onclick="event.stopPropagation();eliminarGrupo('${g.id}','${g.nombre}')">🗑️</button>` : ''}
            <span class="tag">Entrar →</span>
          </div>
        </div>`).join('');

      document.querySelectorAll('.grupo-card').forEach(card => {
        card.addEventListener('click', () => entrarGrupo(card.dataset.id, card.dataset.nombre));
      });
    }

    $('btn-nuevo-grupo').onclick = () => $('form-grupo').classList.toggle('oculto');

    $('btn-cancelar-grupo').onclick = () => {
      $('form-grupo').classList.add('oculto');
      $('nuevo-nombre').value   = '';
      $('nuevo-materia').value  = '';
      $('nuevo-privado').checked = false;
    };

    $('btn-crear-grupo').onclick = async () => {
      const nombre  = $('nuevo-nombre').value.trim();
      const materia = $('nuevo-materia').value.trim();
      if (!nombre || !materia) return alert('Completá nombre y materia');

      const privado     = $('nuevo-privado').checked;
      const descripcion = $('nuevo-descripcion').value.trim();
      const { error } = await db.from('grupos').insert({
        nombre, materia, descripcion,
        creador:       usuario.nombre,
        creador_email: usuario.email,
        miembros:      [usuario.email],
        privado
      });

      if (error) { alert('Error: ' + error.message); return; }
      $('btn-cancelar-grupo').click();
      cargarGrupos();
    };

    // ── REALTIME MIEMBROS ────────────────────────────────────────
    let miembrosSub = null;

    function escucharMiembros(grupoId) {
      if (miembrosSub) { db.removeChannel(miembrosSub); miembrosSub = null; }
      miembrosSub = db.channel('miembros-' + grupoId)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'grupos',
          filter: `id=eq.${grupoId}`
        }, payload => {
          // Actualizar tab miembros si está visible
          if (!$('tab-miembros').classList.contains('oculto')) cargarMiembros();
        })
        .subscribe();
    }

    // ── PRESENCIA ONLINE ────────────────────────────────────────
    let presenceSub = null;
    let onlineUsers = new Set();

    function iniciarPresencia(grupoId) {
      if (presenceSub) presenceSub.unsubscribe();
      presenceSub = db
        .channel('presencia-' + grupoId, { config: { presence: { key: usuario.email } } })
        .on('presence', { event: 'sync' }, () => {
          const state = presenceSub.presenceState();
          onlineUsers = new Set(Object.keys(state));
          actualizarOnlineBadge();
          if (!$('tab-miembros').classList.contains('oculto')) cargarMiembros();
        })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            await presenceSub.track({ nombre: usuario.nombre, email: usuario.email });
          }
        });
    }

    function actualizarOnlineBadge() {
      const badge = $('online-badge');
      if (badge) badge.textContent = '🟢 ' + onlineUsers.size + ' online';
    }

    // ── NOTIFICACIONES ──────────────────────────────────────────
    let notifPermiso = ('Notification' in window) && Notification.permission === 'granted';

    async function pedirPermisoNotificaciones() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') { notifPermiso = true; return; }
      if (Notification.permission !== 'denied') {
        const result = await Notification.requestPermission();
        notifPermiso = result === 'granted';
      }
    }

    function mostrarNotificacion(autor, texto) {
      if (!notifPermiso || document.visibilityState === 'visible') return;
      try {
        new Notification('📚 ' + autor + ' en ' + (grupoActual?.nombre || 'GrupoEstudio'), {
          body: texto,
          icon: '/icons/icon-192.png'
        });
      } catch(e) {}
    }

    // ── ENTRAR AL GRUPO ─────────────────────────────────────────
    async function entrarGrupo(id, nombre) {
      grupoActual = { id, nombre };
      if (chatSub) chatSub.unsubscribe();

      // Guardar grupo actual para restaurar al recargar
      try {
        localStorage.setItem('grupo_actual_id', id);
        localStorage.setItem('grupo_actual_nombre', nombre);
      } catch(e) {}

      ir('pantalla-grupo');
      $('grupo-titulo').textContent         = nombre;
      $('grupo-avatar').textContent         = usuario.nombre[0].toUpperCase();
      $('grupo-nombre-usuario').textContent = usuario.nombre;
      // Mostrar descripcion si existe
      if (!id) return;
      const { data: gData } = await db.from('grupos').select('descripcion').eq('id', id).single();
      const descEl = $('grupo-descripcion');
      if (descEl) descEl.textContent = gData?.descripcion || '';

      pedirPermisoNotificaciones();
      iniciarPresencia(id);
      escucharMiembros(id);
      activarTab('chat');
      escucharMensajes();
      cargarMensajeFijado();
      setTimeout(ajustarAlturaChat, 100);
    }

    $('btn-volver').onclick = () => {
      if (chatSub)     chatSub.unsubscribe();
      if (presenceSub) presenceSub.unsubscribe();
      if (miembrosSub) { db.removeChannel(miembrosSub); miembrosSub = null; }
      grupoActual = null;
      onlineUsers = new Set();
      try { localStorage.removeItem('grupo_actual_id'); localStorage.removeItem('grupo_actual_nombre'); } catch(e) {}
      ir('pantalla-inicio');
    };

    // ── TABS ────────────────────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => activarTab(btn.dataset.tab));
    });

    function activarTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('oculto'));
      document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('activo');
      $('tab-' + tab).classList.remove('oculto');
      if (tab === 'archivos')   cargarArchivos();
      if (tab === 'calendario') cargarEventos();
      if (tab === 'miembros')   { cargarMiembros(); cargarEstadisticasGrupo(); }
      if (tab === 'video') {
        const iframe = $('video-iframe');
        const wrap   = $('video-frame-wrap');
        const estado = $('video-estado');
        if (iframe) iframe.src = '';
        if (wrap)   wrap.classList.add('oculto');
        if (estado) estado.classList.remove('oculto');
      }
    }

    // ── CHAT ────────────────────────────────────────────────────
    const mensajesRendered = new Set();

    async function escucharMensajes() {
      if (!grupoActual?.id) return;
      cargando('mensajes');
      mensajesRendered.clear();

      // Cancelar suscripción anterior correctamente
      if (chatSub) {
        await db.removeChannel(chatSub);
        chatSub = null;
      }

      chatSub = db
        .channel('chat-' + grupoActual.id)
        .on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  'mensajes'
        }, payload => {
          const m = payload.new;
          if (!m || m.grupo_id !== grupoActual.id) return;

          if (payload.eventType === 'INSERT') {
            if (mensajesRendered.has(m.id)) return;
            mensajesRendered.add(m.id);
            const vac = $('mensajes').querySelector('.vacio');
            if (vac) $('mensajes').innerHTML = '';
            $('mensajes').insertAdjacentHTML('beforeend', htmlMensaje(m));
            $('mensajes').scrollTop = $('mensajes').scrollHeight;
            if (m.email !== usuario.email) mostrarNotificacion(m.autor, m.texto || '📷 Imagen');
          } else if (payload.eventType === 'UPDATE') {
            // Actualizar encuesta en tiempo real
            const el = $('mensajes').querySelector(`[data-id="${m.id}"]`);
            if (el) el.outerHTML = htmlMensaje(m);
            if (m.fijado !== undefined) cargarMensajeFijado();
          }
        })
        .subscribe(status => {
          console.log('Chat realtime status:', status);
        });

      // Cargar mensajes existentes
      const { data } = await db
        .from('mensajes')
        .select('*')
        .eq('grupo_id', grupoActual.id)
        .order('hora', { ascending: true });

      const mensajes = data || [];

      if (mensajes.length === 0) {
        $('mensajes').innerHTML = '<div class="vacio" style="margin:auto">💬 Nadie escribió todavía.<br>¡Sé el primero!</div>';
      } else {
        $('mensajes').innerHTML = mensajes.map(m => {
          mensajesRendered.add(m.id);
          return htmlMensaje(m);
        }).join('');
        $('mensajes').scrollTop = $('mensajes').scrollHeight;
      }

      // Asegurar que el input siempre esté habilitado
      $('msg-input').disabled  = false;
      $('btn-enviar').disabled = false;
      $('msg-input').focus();
    }

    function htmlMensaje(m) {
      const miEmail  = (window._miEmail || '').toLowerCase().trim();
      const msgEmail = (m.email || '').toLowerCase().trim();
      const esPropio = miEmail !== '' && miEmail === msgEmail;
      const hora = m.hora
        ? new Date(m.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        : '';

      // Quote reply
      const quoteHtml = m.reply_a ? `
        <div class="msg-quote" onclick="scrollAMensajeFijado('${m.reply_a}')">
          <span class="msg-quote-autor">${m.reply_autor || ''}</span>
          <span class="msg-quote-texto">${m.reply_texto || '📷 Imagen'}</span>
        </div>` : '';

      // Reacciones
      const reacciones = m.reacciones || {};
      const reaccionesHtml = Object.keys(reacciones).length > 0
        ? `<div class="msg-reacciones">${Object.entries(reacciones).map(([emoji, usuarios]) =>
            usuarios.length > 0 ? `<span class="reaccion ${usuarios.includes(miEmail) ? 'propia' : ''}"
              onclick="toggleReaccion('${m.id}','${emoji}')">${emoji} ${usuarios.length}</span>` : ''
          ).join('')}</div>` : '';

      // Botón reaccionar (solo en hover)
      const btnReaccion = `<div class="msg-actions">
        <button class="btn-reaccion" onclick="mostrarPickerReaccion(event,'${m.id}')">😊</button>
        <button class="btn-reaccion" onclick="responderMensaje('${m.id}','${(m.texto||'').replace(/'/g,"\'")}','${(m.autor||'').replace(/'/g,"\'")}')">↩</button>
      </div>`;

      // Encuesta
      if (m.tipo === 'encuesta' && m.opciones) {
        const votos = m.votos || {};
        const totalVotos = Object.values(votos).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
        const opcionesHtml = m.opciones.map(op => {
          const cantVotos = Array.isArray(votos[op]) ? votos[op].length : 0;
          const pct = totalVotos > 0 ? Math.round((cantVotos / totalVotos) * 100) : 0;
          const yoVote = Array.isArray(votos[op]) && votos[op].includes(miEmail);
          return `<div class="encuesta-opcion ${yoVote ? 'votada' : ''}" onclick="votarEncuesta('${m.id}','${op}')">
            <div class="encuesta-barra" style="width:${pct}%"></div>
            <span class="encuesta-texto">${op}</span>
            <span class="encuesta-pct">${pct}%</span>
          </div>`;
        }).join('');
        return `<div class="mensaje ${esPropio ? 'propio' : 'otro'} mensaje-encuesta" data-id="${m.id}">
          ${!esPropio ? `<div class="autor">${m.autor}</div>` : ''}
          <div class="encuesta-wrap">
            <div class="encuesta-titulo">📊 ${m.texto}</div>
            ${opcionesHtml}
            <div class="hora" style="margin-top:6px">${hora} · ${totalVotos} voto${totalVotos !== 1 ? 's' : ''}</div>
          </div>
        </div>`;
      }

      const contenido = m.imagen_url
        ? `<img src="${m.imagen_url}" class="msg-img" onclick="window.open('${m.imagen_url}','_blank')" />`
        : `<div class="texto">${m.texto}</div>`;

      return `<div class="mensaje ${esPropio ? 'propio' : 'otro'} ${m.fijado ? 'fijado' : ''}" data-id="${m.id}" oncontextmenu="mostrarMenuMensaje(event,'${m.id}',${!!m.fijado});return false;">
        ${!esPropio ? `<div class="autor">${m.autor}</div>` : ''}
        ${quoteHtml}
        ${contenido}
        ${reaccionesHtml}
        <div class="msg-footer">
          <span class="hora">${hora}${m.fijado ? ' 📌' : ''}</span>
          ${btnReaccion}
        </div>
      </div>`;
    }

    window.mostrarMenuMensaje = (e, id, fijado) => {
      e.preventDefault();
      // Simple: preguntar si fijar/desfijar
      const accion = fijado ? 'Desfijar' : 'Fijar';
      if (confirm(accion + ' este mensaje?')) toggleFijar(id, fijado);
    };

    window.scrollAMensajeFijado = (id) => {
      const el = $('mensajes').querySelector(`[data-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight momentáneo
      el.style.transition = 'background 0.3s';
      el.style.background = 'rgba(79,142,247,0.15)';
      setTimeout(() => { el.style.background = ''; }, 1500);
    };

    window.toggleFijar = async (id, estaFijado) => {
      // Desfijar todos primero
      await db.from('mensajes').update({ fijado: false }).eq('grupo_id', grupoActual.id).eq('fijado', true);
      // Fijar el nuevo si no estaba fijado
      if (!estaFijado) await db.from('mensajes').update({ fijado: true }).eq('id', id);
      cargarMensajeFijado();
      escucharMensajes();
    };

    // ── TECLADO MÓVIL ────────────────────────────────────────────
    function ajustarAlturaChat() {
      // Calcular top real del chat (topbar + tabs)
      const tabs = document.querySelector('.tabs');
      const topbar = document.querySelector('#pantalla-grupo .topbar');
      if (!tabs || !topbar) return;
      const topReal = topbar.offsetHeight + tabs.offsetHeight;

      const alturaVentana = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const teclado = window.visualViewport
        ? Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
        : 0;

      const chat = $('tab-chat');
      if (chat && !chat.classList.contains('oculto')) {
        chat.style.top    = topReal + 'px';
        chat.style.bottom = teclado + 'px';
        chat.style.height = 'auto';
        const mensajes = $('mensajes');
        if (mensajes) setTimeout(() => { mensajes.scrollTop = mensajes.scrollHeight; }, 100);
      }

      const dm = $('tab-dm');
      if (dm && !dm.classList.contains('oculto')) {
        dm.style.bottom = teclado + 'px';
        const dmMensajes = $('dm-mensajes');
        if (dmMensajes) setTimeout(() => { dmMensajes.scrollTop = dmMensajes.scrollHeight; }, 100);
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', ajustarAlturaChat);
      window.visualViewport.addEventListener('scroll', ajustarAlturaChat);
    }
    window.addEventListener('resize', ajustarAlturaChat);

    // ── SCROLL TO BOTTOM BUTTON ─────────────────────────────────
    const mensajesEl = $('mensajes');
    mensajesEl.addEventListener('scroll', () => {
      const distFromBottom = mensajesEl.scrollHeight - mensajesEl.scrollTop - mensajesEl.clientHeight;
      const btn = $('btn-scroll-abajo');
      if (distFromBottom > 150) btn.classList.remove('oculto');
      else btn.classList.add('oculto');
    });

    $('btn-scroll-abajo').onclick = () => {
      $('mensajes').scrollTop = $('mensajes').scrollHeight;
      $('btn-scroll-abajo').classList.add('oculto');
    };

    $('btn-enviar').onclick = enviarMensaje;
    $('msg-input').addEventListener('keypress', e => { if (e.key === 'Enter') enviarMensaje(); });

    // Enviar foto en chat
    $('chat-foto-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !grupoActual) return;
      // Mantener foco en el chat
      setTimeout(() => $('msg-input').focus(), 100);
      e.target.value = '';
      const btn = document.querySelector('#tab-chat .btn-foto-chat');
      if (btn) btn.textContent = '⏳';
      try {
        const url = await subirImagenCloudinary(file, grupoActual.id);
        db.from('mensajes').insert({
          grupo_id:   grupoActual.id,
          autor:      usuario.nombre,
          email:      usuario.email,
          texto:      '',
          imagen_url: url
        }).then(({ error }) => { if (error) console.error(error); });
      } catch(err) {
        alert('Error subiendo imagen');
      } finally {
        btn.textContent = '📷';
      }
    });

    async function enviarMensaje() {
      const texto = $('msg-input').value.trim();
      if (!texto || !grupoActual) return;
      $('msg-input').value = '';
      $('msg-input').focus();
      const extra = replyActual
        ? { reply_a: replyActual.id, reply_texto: replyActual.texto.slice(0,100), reply_autor: replyActual.autor }
        : {};
      cancelarReply();
      db.from('mensajes').insert({
        grupo_id: grupoActual.id,
        autor:    usuario.nombre,
        email:    usuario.email,
        texto,
        ...extra
      }).then(({ error }) => {
        if (error) console.error('Error enviando mensaje:', error.message);
        else sumarPuntos(2);
      });
    }

    // ── ARCHIVOS ────────────────────────────────────────────────
    const MAX_BYTES = 10 * 1024 * 1024;

    function comprimirImagen(file) {
      return new Promise(resolve => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 1800;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
            else                { width  = Math.round(width  * maxDim / height); height = maxDim; }
          }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            URL.revokeObjectURL(url);
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.82);
        };
        img.src = url;
      });
    }

    $('file-input').addEventListener('focus', e => e.target.blur()); // evitar scroll al abrir

    $('btn-subir').onclick = async () => {
      let file = $('file-input').files[0];
      if (!file) return alert('Seleccioná un archivo primero');

      const btn = $('btn-subir');

      if (file.type.startsWith('image/') && file.size > MAX_BYTES) {
        btn.textContent = 'Comprimiendo...'; btn.disabled = true;
        file = await comprimirImagen(file);
      }

      if (file.size > MAX_BYTES) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        alert(`⚠️ El archivo pesa ${mb}MB. El límite es 10MB.\n\nTips:\n• PDFs → ilovepdf.com\n• Videos → handbrake.fr`);
        btn.textContent = 'Subir archivo'; btn.disabled = false;
        return;
      }

      btn.textContent = 'Subiendo...'; btn.disabled = true;

      try {
        const form = new FormData();
        form.append('file',          file);
        form.append('upload_preset', CLOUD_PRESET);
        form.append('folder',        `grupoestudio/${grupoActual.id}`);

        const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.secure_url) throw new Error(data.error?.message || 'Falló la subida');

        await db.from('archivos').insert({
          grupo_id:   grupoActual.id,
          nombre:     file.name,
          url:        data.secure_url,
          tipo:       file.type || 'application/octet-stream',
          subido_por: usuario.nombre
        });

        $('file-input').value = '';
        sumarPuntos(5);
        // Quedarse en tab archivos
        activarTab('archivos');
        cargarArchivos();
      } catch(e) {
        alert('Error al subir: ' + e.message);
      } finally {
        btn.textContent = 'Subir archivo'; btn.disabled = false;
      }
    };

    async function cargarArchivos() {
      if (!grupoActual?.id) return;
      cargando('lista-archivos');
      const { data } = await db
        .from('archivos')
        .select('*')
        .eq('grupo_id', grupoActual.id)
        .order('subido_el', { ascending: false });

      if (!data || data.length === 0) { vacio('lista-archivos', '📂', 'No hay archivos todavía.'); return; }

      const iconos = {
        pdf: '📕', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
        ppt: '📊', pptx: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
        gif: '🖼️', mp4: '🎬', mp3: '🎵', zip: '🗜️', rar: '🗜️'
      };

      $('lista-archivos').innerHTML = data.map(a => {
        const ext  = a.nombre.split('.').pop().toLowerCase();
        const icon = iconos[ext] || '📄';
        const fecha = a.subido_el ? new Date(a.subido_el).toLocaleDateString('es-AR') : '';
        return `<div class="archivo-card">
          <div class="archivo-icon">${icon}</div>
          <div class="archivo-info">
            <a href="${a.url}" target="_blank">${a.nombre}</a>
            <span>Subido por ${a.subido_por} · ${fecha}</span>
          </div>
        </div>`;
      }).join('');
    }

    // ── CALENDARIO ──────────────────────────────────────────────
    $('btn-nuevo-evento').onclick    = () => $('form-evento').classList.toggle('oculto');
    $('btn-cancelar-evento').onclick = () => {
      $('form-evento').classList.add('oculto');
      $('evento-titulo').value = '';
      $('evento-fecha').value  = '';
    };

    $('btn-crear-evento').onclick = async () => {
      const titulo = $('evento-titulo').value.trim();
      const fecha  = $('evento-fecha').value;
      const tipo   = $('evento-tipo').value;
      if (!titulo || !fecha) return alert('Completá título y fecha');

      await db.from('eventos').insert({
        grupo_id:   grupoActual.id,
        titulo, fecha, tipo,
        creado_por: usuario.nombre
      });

      $('btn-cancelar-evento').click();
      // Quedarse en tab calendario
      cargarEventos();
    };

    async function cargarEventos() {
      if (!grupoActual?.id) return;
      cargando('lista-eventos');
      const { data } = await db
        .from('eventos')
        .select('*')
        .eq('grupo_id', grupoActual.id)
        .order('fecha', { ascending: true });

      if (!data || data.length === 0) { vacio('lista-eventos', '📅', 'No hay eventos todavía.'); return; }

      const iconos = { parcial: '📝', reunion: '👥', entrega: '📌', examen: '🎯' };
      const hoy    = new Date().toISOString().split('T')[0];

      $('lista-eventos').innerHTML = data.map(e => `
        <div class="evento-card ${e.fecha < hoy ? 'pasado' : ''}">
          <div class="evento-icon">${iconos[e.tipo] || '📅'}</div>
          <div class="evento-info">
            <strong>${e.titulo}</strong>
            <span>${e.fecha} · ${e.tipo} · ${e.creado_por}</span>
          </div>
          ${e.fecha >= hoy ? '<div class="evento-badge">Próximo</div>' : ''}
        </div>`).join('');
    }

    // ── MIEMBROS ────────────────────────────────────────────────
    $('btn-agregar-miembro').onclick = async () => {
      let email = $('nuevo-miembro-email').value.trim();
      // Buscar por email, nombre, teléfono o user_id
      if (!email.includes('@')) {
        const { data: encontrado } = await db.from('perfil_usuario')
          .select('email')
          .or(`nombre.ilike.${email},user_id.ilike.${email},telefono.ilike.${email}`)
          .limit(1)
          .single();
        if (!encontrado) return alert('No se encontró ningún usuario con ese nombre, teléfono o ID');
        email = encontrado.email;
      }

      const { data: grupo } = await db.from('grupos').select('miembros').eq('id', grupoActual.id).single();
      const miembros = grupo?.miembros || [];
      if (miembros.includes(email)) { alert('Ese correo ya es miembro del grupo'); return; }

      await db.from('grupos').update({ miembros: [...miembros, email] }).eq('id', grupoActual.id);
      // Notificar al nuevo miembro
      crearNotificacion(email, 'sistema', '👥 Fuiste añadido a un grupo',
        `${usuario.nombre} te añadió al grupo "${grupoActual.nombre}"`, grupoActual.id);
      $('nuevo-miembro-email').value = '';
      $('nuevo-miembro-email').placeholder = '✅ Miembro agregado';
      setTimeout(() => { $('nuevo-miembro-email').placeholder = 'Email del nuevo miembro'; }, 2000);
      cargarMiembros();
    };

    async function cargarMiembros() {
      if (!grupoActual?.id) return;
      cargando('lista-miembros');
      const { data } = await db.from('grupos').select('miembros').eq('id', grupoActual.id).single();
      const miembros = data?.miembros || [];

      if (miembros.length === 0) { vacio('lista-miembros', '👥', 'Sin miembros.'); return; }

      // Ver si soy el creador del grupo
      const { data: grupoInfo } = await db.from('grupos').select('creador_email,privado').eq('id', grupoActual.id).single();
      const soCreador = grupoInfo?.creador_email === usuario.email && grupoInfo?.privado;

      $('lista-miembros').innerHTML = miembros.map(email => {
        const isOnline = onlineUsers.has(email);
        const esYo = email === usuario.email;
        return `<div class="miembro-item">
          <div class="miembro-avatar" style="position:relative">
            ${email[0].toUpperCase()}
            ${isOnline ? '<span class="dot-online"></span>' : '<span class="dot-offline"></span>'}
          </div>
          <div class="miembro-datos">
            <span>${email}</span>
            ${esYo ? '<span class="badge-vos">Vos</span>' : ''}
            ${isOnline ? '<span class="badge-online">online</span>' : ''}
          </div>
          <div style="display:flex;gap:6px">
            ${!esYo ? `<button class="btn-dm" data-email="${email}" data-nombre="${email.split('@')[0]}">💬</button>` : ''}
            ${soCreador && !esYo ? `<button class="btn-eliminar-miembro" onclick="eliminarMiembro('${email}')">🚫</button>` : ''}
            ${!soCreador && esYo ? `<button class="btn-ghost btn-sm" style="font-size:11px;padding:4px 8px;border-radius:8px;background:transparent;border:1px solid var(--border2);color:var(--muted2);cursor:pointer" onclick="salirGrupo()">Salir</button>` : ''}
          </div>
        </div>`;
      }).join('');

      // Botones DM
      document.querySelectorAll('.btn-dm').forEach(btn => {
        btn.addEventListener('click', () => abrirDM(btn.dataset.email, btn.dataset.nombre));
      });
    }

    // ── PERFIL ──────────────────────────────────────────────────
    let perfilData = null;

    function generarUserId() {
      return 'user#' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    async function cargarPerfil() {
      const { data } = await db
        .from('perfil_usuario')
        .select('*')
        .eq('id', usuario.id)
        .single();

      if (data) {
        // Generar user_id si no tiene
        if (!data.user_id) {
          const uid = generarUserId();
          await db.from('perfil_usuario').update({ user_id: uid }).eq('id', usuario.id);
          data.user_id = uid;
        }
        perfilData = data;
      } else {
        const uid = generarUserId();
        const { data: nuevo } = await db.from('perfil_usuario').insert({
          id:      usuario.id,
          nombre:  usuario.nombre,
          email:   usuario.email,
          user_id: uid
        }).select().single();
        perfilData = nuevo;
      }
      return perfilData;
    }

    async function mostrarPantallaPeril() {
      ir('pantalla-perfil');
      if (!perfilData) return;

      // Mostrar user_id
      if (perfilData?.user_id) {
        let uidEl = $('perfil-userid-display');
        if (!uidEl) {
          const wrap = document.querySelector('#pantalla-perfil .perfil-avatar-wrap');
          if (wrap) {
            const div = document.createElement('div');
            div.id = 'perfil-userid-display';
            div.style = 'font-size:12px;color:var(--muted);margin-top:4px;cursor:pointer';
            div.title = 'Clickeá para copiar';
            div.onclick = () => { navigator.clipboard.writeText(perfilData.user_id); mostrarToast('Copiado', perfilData.user_id); };
            wrap.appendChild(div);
            uidEl = div;
          }
        }
        if (uidEl) uidEl.textContent = perfilData.user_id;
      }

      // Insignias
      const { data: perfInsig } = await db.from('perfil_usuario').select('insignias').eq('id', usuario.id).single();
      const insigEl = $('perfil-insignias');
      if (insigEl) {
        const insActuales = perfInsig?.insignias || [];
        if (insActuales.length === 0) {
          insigEl.innerHTML = '<p style="color:var(--muted);font-size:13px">Todavia no tenes insignias. ¡Participá para ganarlas!</p>';
        } else {
          insigEl.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px">` +
            INSIGNIAS.filter(i => insActuales.includes(i.id)).map(i =>
              `<div class="insignia-item" title="${i.nombre}">
                <span style="font-size:28px">${i.emoji}</span>
                <span style="font-size:11px;color:var(--muted2)">${i.nombre}</span>
              </div>`
            ).join('') + `</div>`;
        }
      }

      // Stats
      const { data: stats } = await db.from('perfil_usuario').select('puntos, nivel').eq('id', usuario.id).single();
      if (stats) {
        const niv = getNivel(stats.puntos || 0);
        $('perfil-stats').innerHTML = `
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-val">${stats.puntos || 0}</span>
              <span class="stat-label">Puntos</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">${niv.emoji} ${niv.nombre}</span>
              <span class="stat-label">Nivel ${niv.nivel}</span>
            </div>
          </div>
          <div class="nivel-bar-wrap">
            <div class="nivel-bar">
              <div class="nivel-bar-fill" style="width:${Math.min(100, ((stats.puntos||0) / (NIVELES[Math.min(niv.nivel, 4)].min || 1)) * 100)}%"></div>
            </div>
            <span style="font-size:11px;color:var(--muted)">
              ${niv.nivel < 5 ? `${stats.puntos||0} / ${NIVELES[niv.nivel].min} pts para ${NIVELES[niv.nivel].emoji} ${NIVELES[niv.nivel].nombre}` : '¡Nivel máximo! 🎉'}
            </span>
          </div>`;
      }

      // Avatar
      const av = $('perfil-avatar-grande');
      if (perfilData.avatar_url) {
        av.innerHTML = `<img src="${perfilData.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
      } else {
        av.textContent = (perfilData.nombre || 'U')[0].toUpperCase();
      }

      $('perfil-nombre-display').textContent = perfilData.nombre;
      $('perfil-nivel-display').textContent  = '⭐ Nivel ' + (perfilData.nivel || 1);
      $('perfil-nombre').value               = perfilData.nombre || '';
      $('perfil-telefono').value             = perfilData.telefono || '';
      $('perfil-mostrar-email').checked      = perfilData.mostrar_email || false;
      $('perfil-mostrar-tel').checked        = perfilData.mostrar_telefono || false;
      if ($('stat-puntos')) $('stat-puntos').textContent = perfilData.puntos || 0;
      if ($('stat-nivel'))  $('stat-nivel').textContent  = perfilData.nivel || 1;
    }

    $('btn-ir-perfil').onclick = async () => {
      await cargarPerfil();
      mostrarPantallaPeril();
    };

    $('btn-volver-perfil').onclick = () => ir('pantalla-inicio');

    // Cambiar foto de perfil
    $('perfil-foto-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      $('perfil-avatar-grande').textContent = '⏳';
      try {
        const url = await subirImagenCloudinary(file, 'avatares');
        await db.from('perfil_usuario').update({ avatar_url: url }).eq('id', usuario.id);
        perfilData.avatar_url = url;
        $('perfil-avatar-grande').innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
        // Actualizar avatar en topbar
        $('inicio-avatar').style.backgroundImage = `url(${url})`;
        $('inicio-avatar').textContent = '';
      } catch(err) {
        alert('Error subiendo foto');
        $('perfil-avatar-grande').textContent = (perfilData.nombre || 'U')[0].toUpperCase();
      }
    });

    // Guardar perfil
    $('btn-guardar-perfil').onclick = async () => {
      const nombre   = $('perfil-nombre').value.trim();
      const telefono = $('perfil-telefono').value.trim();
      const mostrar_email     = $('perfil-mostrar-email').checked;
      const mostrar_telefono  = $('perfil-mostrar-tel').checked;

      if (!nombre) return alert('El nombre no puede estar vacío');

      const { error } = await db.from('perfil_usuario').update({
        nombre, telefono, mostrar_email, mostrar_telefono
      }).eq('id', usuario.id);

      if (error) { alert('Error: ' + error.message); return; }

      // Actualizar metadata de auth
      await db.auth.updateUser({ data: { nombre } });
      usuario.nombre         = nombre;
      window._miEmail        = usuario.email;
      perfilData.nombre      = nombre;
      perfilData.telefono    = telefono;

      $('perfil-nombre-display').textContent = nombre;
      $('inicio-nombre').textContent         = nombre;
      $('btn-guardar-perfil').textContent    = '✅ Guardado';
      setTimeout(() => $('btn-guardar-perfil').textContent = 'Guardar cambios', 2000);
    };

    // ── CLASES PARTICULARES ──────────────────────────────────────
    let tutorActual   = null;
    let materiaActual = '';

    function irClases() {
      ir('pantalla-clases');
      activarCTab('buscar');
      cargarTutores();
    }

    $('btn-ir-clases').onclick    = irClases;
    $('btn-volver-clases').onclick = () => ir('pantalla-inicio');

    // Tabs clases
    document.querySelectorAll('[data-ctab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activarCTab(btn.dataset.ctab);
        if (btn.dataset.ctab === 'solicitudes') cargarSolicitudes();
        if (btn.dataset.ctab === 'ofrecer')     cargarMiPerfilTutor();
      });
    });

    function activarCTab(tab) {
      document.querySelectorAll('[data-ctab]').forEach(b => b.classList.remove('activo'));
      document.querySelectorAll('.tab-content[id^="ctab-"]').forEach(c => c.classList.add('oculto'));
      document.querySelector(`[data-ctab="${tab}"]`).classList.add('activo');
      $('ctab-' + tab).classList.remove('oculto');
    }

    // Filtros materia
    document.querySelectorAll('#filtros-materia .filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#filtros-materia .filtro-btn').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        materiaActual = btn.dataset.mat;
        cargarTutores();
      });
    });

    async function cargarTutores() {
      cargando('lista-tutores');
      let query = db.from('tutores').select('*').eq('disponible', true).order('creado_el', { ascending: false });
      if (materiaActual) query = query.eq('materia', materiaActual);
      const { data } = await query;

      if (!data || data.length === 0) { vacio('lista-tutores', '🎓', 'No hay tutores disponibles todavía.'); return; }

      const iconos = { virtual: '💻', presencial: '📍', ambas: '🔄' };
      $('lista-tutores').innerHTML = data.map(t => `
        <div class="tutor-card">
          <div class="tutor-header">
            <div class="tutor-avatar">${t.nombre[0].toUpperCase()}</div>
            <div class="tutor-info">
              <div class="tutor-nombre">${t.nombre}</div>
              <div class="tutor-meta">
                <span class="cat-badge">${t.materia}</span>
                <span class="tutor-modal">${iconos[t.modalidad] || '💻'} ${t.modalidad}</span>
              </div>
            </div>
            <div class="tutor-precio">${t.precio_hora > 0 ? '$' + t.precio_hora + '/h' : '🎁 Gratis'}</div>
          </div>
          <p class="tutor-desc">${t.descripcion}</p>
          ${t.email === usuario.email
            ? '<span style="font-size:12px;color:var(--green)">✅ Este es tu perfil</span>'
            : `<button class="btn btn-sm" onclick="abrirModalSolicitud('${t.id}','${t.nombre}','${t.materia}','${t.email}')">Solicitar clase</button>`
          }
        </div>`).join('');
    }

    async function cargarMiPerfilTutor() {
      const { data } = await db.from('tutores').select('*').eq('usuario_id', usuario.id).single();
      const wrap = $('mi-perfil-tutor');
      if (data) {
        wrap.innerHTML = `
          <div class="form-card" style="margin-bottom:16px;border-color:rgba(34,211,160,0.3)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;margin-bottom:4px">✅ Tu perfil activo</div>
                <div style="font-size:13px;color:var(--muted2)">${data.materia} · ${data.precio_hora > 0 ? '$'+data.precio_hora+'/h' : 'Gratis'} · ${data.modalidad}</div>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-toggle-disponible">
                ${data.disponible ? '⏸ Pausar' : '▶️ Activar'}
              </button>
            </div>
          </div>`;
        $('btn-toggle-disponible').onclick = async () => {
          await db.from('tutores').update({ disponible: !data.disponible }).eq('id', data.id);
          cargarMiPerfilTutor();
          cargarTutores();
        };
        $('form-tutor').querySelector('h3').textContent = '✏️ Actualizar perfil';
        $('tutor-materia').value   = data.materia;
        $('tutor-desc').value      = data.descripcion;
        $('tutor-precio').value    = data.precio_hora;
        $('tutor-modalidad').value = data.modalidad;
        $('btn-publicar-tutor').textContent = 'Actualizar perfil';
      } else {
        wrap.innerHTML = '';
      }
    }

    $('btn-publicar-tutor').onclick = async () => {
      const materia   = $('tutor-materia').value;
      const desc      = $('tutor-desc').value.trim();
      const precio    = parseFloat($('tutor-precio').value) || 0;
      const modalidad = $('tutor-modalidad').value;
      if (!desc) return alert('Agregá una descripción');

      const { data: existe } = await db.from('tutores').select('id').eq('usuario_id', usuario.id).single();
      if (existe) {
        await db.from('tutores').update({ materia, descripcion: desc, precio_hora: precio, modalidad }).eq('id', existe.id);
      } else {
        await db.from('tutores').insert({ usuario_id: usuario.id, nombre: usuario.nombre, email: usuario.email, materia, descripcion: desc, precio_hora: precio, modalidad });
        sumarPuntos(10);
      }
      alert('✅ Perfil guardado');
      cargarMiPerfilTutor();
      cargarTutores();
    };

    // Modal solicitud
    let tutorSolicitud = null;

    window.abrirModalSolicitud = (id, nombre, materia, email) => {
      tutorSolicitud = { id, nombre, materia, email };
      $('modal-tutor-info').innerHTML = `
        <div class="tutor-mini">
          <div class="tutor-avatar">${nombre[0].toUpperCase()}</div>
          <div><div style="font-weight:600">${nombre}</div><div style="font-size:12px;color:var(--muted2)">${materia}</div></div>
        </div>`;
      $('solicitud-msg').value = '';
      $('modal-solicitud').classList.remove('oculto');
    };

    $('btn-cerrar-modal').onclick = () => $('modal-solicitud').classList.add('oculto');
    $('modal-overlay') && ($('modal-overlay').onclick = (e) => { if (e.target === $('modal-overlay')) $('modal-solicitud').classList.add('oculto'); });

    $('btn-enviar-solicitud').onclick = async () => {
      const msg = $('solicitud-msg').value.trim();
      if (!msg) return alert('Escribí un mensaje para el tutor');
      await db.from('solicitudes_clase').insert({
        tutor_id:      tutorSolicitud.id,
        alumno_email:  usuario.email,
        alumno_nombre: usuario.nombre,
        mensaje:       msg
      });
      crearNotificacion(tutorSolicitud.email, 'solicitud', '🎓 Nueva solicitud de clase', usuario.nombre + ' quiere tomar clases de ' + tutorSolicitud.materia, tutorSolicitud.id);
      $('modal-solicitud').classList.add('oculto');
      alert('✅ Solicitud enviada');
    };

    async function cargarSolicitudes() {
      cargando('lista-solicitudes');
      // Buscar mi tutor_id si soy tutor
      const { data: miTutor } = await db.from('tutores').select('id').eq('usuario_id', usuario.id).single();

      let solicitudes = [];
      if (miTutor) {
        const { data } = await db.from('solicitudes_clase').select('*').eq('tutor_id', miTutor.id).order('creado_el', { ascending: false });
        solicitudes = data || [];
      }

      // También mis solicitudes enviadas
      const { data: enviadas } = await db.from('solicitudes_clase').select('*, tutores(nombre, materia)').eq('alumno_email', usuario.email).order('creado_el', { ascending: false });

      const estadoColor = { pendiente: 'var(--muted2)', aceptada: 'var(--green)', rechazada: 'var(--red)' };
      const estadoEmoji = { pendiente: '⏳', aceptada: '✅', rechazada: '❌' };

      let html = '';

      if (solicitudes.length > 0) {
        html += `<div style="font-weight:600;margin-bottom:12px;font-family:var(--fhead)">📬 Solicitudes recibidas</div>`;
        html += solicitudes.map(s => `
          <div class="solicitud-card">
            <div class="solicitud-header">
              <span style="font-weight:500">👤 ${s.alumno_nombre}</span>
              <span style="color:${estadoColor[s.estado]}">${estadoEmoji[s.estado]} ${s.estado}</span>
            </div>
            <p style="font-size:13px;color:var(--muted2);margin:8px 0">${s.mensaje}</p>
            ${s.estado === 'pendiente' ? `
              <div class="form-row" style="margin-top:8px">
                <button class="btn btn-sm" onclick="responderSolicitud('${s.id}','aceptada')">✅ Aceptar</button>
                <button class="btn btn-ghost btn-sm" onclick="responderSolicitud('${s.id}','rechazada')">❌ Rechazar</button>
              </div>`
            : s.estado === 'aceptada' ? `
              <button class="btn btn-sm" style="margin-top:8px" onclick="abrirDM('${s.alumno_email}','${s.alumno_nombre}')">
                💬 Chatear con ${s.alumno_nombre}
              </button>` : ''}
          </div>`).join('');
      }

      if (enviadas && enviadas.length > 0) {
        html += `<div style="font-weight:600;margin:20px 0 12px;font-family:var(--fhead)">📤 Mis solicitudes enviadas</div>`;
        html += enviadas.map(s => `
          <div class="solicitud-card">
            <div class="solicitud-header">
              <span style="font-weight:500">🎓 ${s.tutores?.nombre || 'Tutor'} — ${s.tutores?.materia || ''}</span>
              <span style="color:${estadoColor[s.estado]}">${estadoEmoji[s.estado]} ${s.estado}</span>
            </div>
            <p style="font-size:13px;color:var(--muted2);margin:8px 0">${s.mensaje}</p>
            ${s.estado === 'aceptada' ? `
              <button class="btn btn-sm" style="margin-top:4px" onclick="abrirDMTutor('${s.tutor_id}')">
                💬 Chatear con el tutor
              </button>` : ''}
          </div>`).join('');
      }

      if (!html) { vacio('lista-solicitudes', '📬', 'No hay solicitudes todavía.'); return; }
      $('lista-solicitudes').innerHTML = html;
    }

    window.responderSolicitud = async (id, estado) => {
      await db.from('solicitudes_clase').update({ estado }).eq('id', id);
      cargarSolicitudes();
    };

    window.abrirDMTutor = async (tutorId) => {
      const { data: t } = await db.from('tutores').select('email, nombre').eq('id', tutorId).single();
      if (t) abrirDM(t.email, t.nombre);
    };

    // ── NOTIFICACIONES ───────────────────────────────────────────
    let notifSub = null;

    function iniciarNotificaciones() {
      // Escuchar notificaciones en tiempo real
      notifSub = db.channel('notif-' + usuario.email)
        .on('postgres_changes', {
          event:  'INSERT',
          schema: 'public',
          table:  'notificaciones',
          filter: `usuario_email=eq.${usuario.email}`
        }, payload => {
          const n = payload.new;
          actualizarBadgeNotif();
          // Notificación del navegador si está en segundo plano
          if (notifPermiso && document.visibilityState !== 'visible') {
            new Notification(n.titulo, { body: n.mensaje });
          }
          // Toast dentro de la app
          mostrarToast(n.titulo, n.mensaje);
        })
        .subscribe();
      actualizarBadgeNotif();
    }

    async function actualizarBadgeNotif() {
      if (!usuario?.email) return;
      const { count } = await db.from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_email', usuario.email)
        .eq('leida', false);
      const badge = $('notif-badge');
      if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.classList.remove('oculto'); }
      else badge.classList.add('oculto');
    }

    async function crearNotificacion(emailDestino, tipo, titulo, mensaje, linkId = '') {
      if (emailDestino === usuario.email) return; // no notificarse a uno mismo
      await db.from('notificaciones').insert({ usuario_email: emailDestino, tipo, titulo, mensaje, link_id: linkId });
    }

    function mostrarToast(titulo, mensaje) {
      const toast = document.createElement('div');
      toast.className = 'toast-notif';
      toast.innerHTML = `<strong>${titulo}</strong><p>${mensaje}</p>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('visible'), 10);
      setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 4000);
    }

    // Abrir/cerrar panel
    $('btn-notificaciones').onclick = async (e) => {
      e.stopPropagation();
      const panel = $('notif-panel');
      const overlay = $('notif-overlay');
      if (panel.classList.contains('oculto')) {
        panel.classList.remove('oculto');
        overlay.classList.remove('oculto');
        cargarNotificaciones();
      } else {
        panel.classList.add('oculto');
        overlay.classList.add('oculto');
      }
    };

    $('notif-overlay').onclick = () => {
      $('notif-panel').classList.add('oculto');
      $('notif-overlay').classList.add('oculto');
    };

    $('btn-marcar-leidas').onclick = async () => {
      if (!usuario?.email) return;
      await db.from('notificaciones').update({ leida: true }).eq('usuario_email', usuario.email).eq('leida', false);
      actualizarBadgeNotif();
      cargarNotificaciones();
    };

    async function cargarNotificaciones() {
      if (!usuario?.email) return;
      const { data } = await db.from('notificaciones')
        .select('*')
        .eq('usuario_email', usuario.email)
        .order('creado_el', { ascending: false })
        .limit(30);

      if (!data || data.length === 0) {
        $('notif-lista').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted2)">🔔 No hay notificaciones</div>';
        return;
      }

      const iconos = { mensaje: '💬', dm: '✉️', foro: '💬', solicitud: '🎓', sistema: '📢' };
      $('notif-lista').innerHTML = data.map(n => `
        <div class="notif-item ${n.leida ? '' : 'no-leida'}" onclick="marcarLeidaYNavegar('${n.id}','${n.tipo}','${n.link_id}')">
          <div class="notif-icon">${iconos[n.tipo] || '🔔'}</div>
          <div class="notif-datos">
            <div class="notif-titulo">${n.titulo}</div>
            <div class="notif-msg">${n.mensaje}</div>
            <div class="notif-hora">${new Date(n.creado_el).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
          </div>
          ${!n.leida ? '<div class="notif-dot"></div>' : ''}
        </div>`).join('');
    }

    window.marcarLeidaYNavegar = async (id, tipo, linkId) => {
      await db.from('notificaciones').update({ leida: true }).eq('id', id);
      actualizarBadgeNotif();
      $('notif-panel').classList.add('oculto');
      $('notif-overlay').classList.add('oculto');
      // Navegar según el tipo
      if (tipo === 'dm' && linkId) abrirDM(linkId, linkId.split('@')[0]);
      if (tipo === 'foro' && linkId) abrirPreguntaDesdeSearch(linkId);
    };

    // ── RESTAURAR PANTALLA ───────────────────────────────────────
    async function restaurarPantalla() {
      try {
        // Si sessionStorage tiene app_activa, ya estamos en la sesión correcta
        // Solo restaurar en recarga real (nueva sesión)
        if (sessionStorage.getItem('app_activa')) return;
        const pantalla = localStorage.getItem('pantalla_actual');
        const grupoId  = localStorage.getItem('grupo_actual_id');
        const grupoNombre = localStorage.getItem('grupo_actual_nombre');

        // Limpiar valores corruptos
        if (!grupoId || grupoId === 'undefined' || !grupoNombre || grupoNombre === 'undefined') {
          localStorage.removeItem('grupo_actual_id');
          localStorage.removeItem('grupo_actual_nombre');
        }

        if (pantalla === 'pantalla-grupo' && grupoId && grupoId !== 'undefined' && grupoNombre && grupoNombre !== 'undefined') {
          await entrarGrupo(grupoId, grupoNombre);
        } else if (pantalla === 'pantalla-foro') {
          ir('pantalla-foro');
          $('foro-avatar').textContent = usuario.nombre[0].toUpperCase();
          $('foro-nombre').textContent = usuario.nombre;
          mostrarListaForo();
          cargarPreguntas();
        } else if (pantalla === 'pantalla-clases') {
          irClases();
        } else if (pantalla === 'pantalla-ranking') {
          ir('pantalla-ranking');
          cargarRanking();
        } else if (pantalla === 'pantalla-bandeja') {
          ir('pantalla-bandeja');
          cargarBandeja();
        }
        // Para otras pantallas volvemos al inicio (login, registro, etc.)
      } catch(e) {}
    }

    // ── BÚSQUEDA GLOBAL ──────────────────────────────────────────
    function abrirBusqueda() {
      ir('pantalla-busqueda');
      setTimeout(() => $('search-input').focus(), 100);
    }

    $('btn-buscar').onclick         = abrirBusqueda;
    $('btn-volver-busqueda').onclick = () => ir('pantalla-inicio');

    let searchTimeout = null;
    $('search-input').addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const q = $('search-input').value.trim();
      if (!q) {
        $('search-resultados').innerHTML = `<div class="search-placeholder"><div style="font-size:48px;margin-bottom:12px">🔍</div><p style="color:var(--muted2)">Escribí algo para buscar</p></div>`;
        return;
      }
      $('search-resultados').innerHTML = '<p class="cargando">Buscando...</p>';
      searchTimeout = setTimeout(() => buscar(q), 350);
    });

    async function buscar(q) {
      const term = q.toLowerCase();
      const resultados = { grupos: [], preguntas: [], tutores: [], usuarios: [] };

      const [rGrupos, rPreguntas, rTutores, rUsuarios] = await Promise.all([
        db.from('grupos').select('id,nombre,materia,creador,privado,miembros').ilike('nombre', `%${q}%`).limit(5),
        db.from('foro_preguntas').select('id,titulo,categoria,autor').or(`titulo.ilike.%${q}%,descripcion.ilike.%${q}%`).limit(5),
        db.from('tutores').select('id,nombre,materia,precio_hora').eq('disponible', true).or(`nombre.ilike.%${q}%,materia.ilike.%${q}%`).limit(5),
        db.from('perfil_usuario').select('id,nombre,email,avatar_url,user_id').or(`nombre.ilike.%${q}%,user_id.ilike.%${q}%,telefono.ilike.%${q}%`).limit(5)
      ]);

      resultados.grupos    = rGrupos.data    || [];
      resultados.preguntas = rPreguntas.data || [];
      resultados.tutores   = rTutores.data   || [];
      resultados.usuarios  = rUsuarios.data  || [];

      const total = Object.values(resultados).reduce((a, b) => a + b.length, 0);

      if (total === 0) {
        $('search-resultados').innerHTML = `<div class="search-placeholder"><div style="font-size:48px;margin-bottom:12px">😕</div><p style="color:var(--muted2)">No se encontraron resultados para "<strong>${q}</strong>"</p></div>`;
        return;
      }

      let html = '';

      if (resultados.grupos.length) {
        html += `<div class="search-section"><div class="search-section-title">📚 Grupos</div>`;
        html += resultados.grupos.map(g => {
          const esMiembro = g.miembros && g.miembros.includes(usuario.email);
          const accion = esMiembro
            ? `onclick="entrarGrupo('${g.id}','${g.nombre}')"`
            : g.privado
              ? `onclick="alert('🔒 Este grupo es privado. El creador debe invitarte.')"`
              : `onclick="unirseYEntrar('${g.id}','${g.nombre}')"`;
          return `
          <div class="search-item" ${accion}>
            <div class="search-icon">${g.privado ? '🔒' : '📘'}</div>
            <div class="search-datos">
              <div class="search-nombre">${g.nombre}</div>
              <div class="search-sub">${g.materia} · ${g.creador}</div>
            </div>
            <span class="search-arrow">${esMiembro ? '→ Entrar' : g.privado ? '🔒 Privado' : '+ Unirse'}</span>
          </div>`;
        }).join('');
        html += `</div>`;
      }

      if (resultados.preguntas.length) {
        html += `<div class="search-section"><div class="search-section-title">💬 Preguntas del foro</div>`;
        html += resultados.preguntas.map(p => `
          <div class="search-item" onclick="abrirPreguntaDesdeSearch('${p.id}')">
            <div class="search-icon">❓</div>
            <div class="search-datos">
              <div class="search-nombre">${p.titulo}</div>
              <div class="search-sub">${p.categoria} · ${p.autor}</div>
            </div>
            <span class="search-arrow">→</span>
          </div>`).join('');
        html += `</div>`;
      }

      if (resultados.tutores.length) {
        html += `<div class="search-section"><div class="search-section-title">🎓 Tutores</div>`;
        html += resultados.tutores.map(t => `
          <div class="search-item" onclick="irClases()">
            <div class="search-icon">👨‍🏫</div>
            <div class="search-datos">
              <div class="search-nombre">${t.nombre}</div>
              <div class="search-sub">${t.materia} · ${t.precio_hora > 0 ? '$'+t.precio_hora+'/h' : 'Gratis'}</div>
            </div>
            <span class="search-arrow">→</span>
          </div>`).join('');
        html += `</div>`;
      }

      if (resultados.usuarios.length) {
        html += `<div class="search-section"><div class="search-section-title">👤 Usuarios</div>`;
        html += resultados.usuarios.map(u => {
          const avatar = u.avatar_url
            ? `<img src="${u.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />`
            : `<div class="search-icon">${(u.nombre||'?')[0].toUpperCase()}</div>`;
          const esMio = u.email === usuario.email;
          return `
            <div class="search-item" ${esMio ? `onclick="abrirPerfil()"` : `onclick="abrirDM('${u.email}','${u.nombre}')"`}>
              ${avatar}
              <div class="search-datos">
                <div class="search-nombre">${u.nombre} ${esMio ? '<span class="badge-vos">Vos</span>' : ''}</div>
                <div class="search-sub">${u.user_id ? u.user_id + ' · ' : ''}${esMio ? 'Ver mi perfil' : '💬 Enviar mensaje'}</div>
              </div>
              <span class="search-arrow">→</span>
            </div>`;
        }).join('');
        html += `</div>`;
      }

      $('search-resultados').innerHTML = `<p style="font-size:12px;color:var(--muted);margin-bottom:16px">${total} resultado${total !== 1 ? 's' : ''} para "<strong>${q}</strong>"</p>` + html;
    }

    window.unirseYEntrar = async (id, nombre) => {
      // Agregar al usuario como miembro y entrar
      const { data: grupo } = await db.from('grupos').select('miembros').eq('id', id).single();
      const miembros = grupo?.miembros || [];
      if (!miembros.includes(usuario.email)) {
        await db.from('grupos').update({ miembros: [...miembros, usuario.email] }).eq('id', id);
      }
      ir('pantalla-inicio');
      entrarGrupo(id, nombre);
    };

    window.abrirPreguntaDesdeSearch = (id) => {
      ir('pantalla-foro');
      $('foro-avatar').textContent = usuario.nombre[0].toUpperCase();
      $('foro-nombre').textContent = usuario.nombre;
      mostrarDetalleForo();
      abrirPregunta(id);
    };

    // ── ELIMINAR GRUPO / MIEMBROS ────────────────────────────────
    window.eliminarGrupo = async (id, nombre) => {
      if (!confirm(`¿Eliminár el grupo "${nombre}"? Esta acción no se puede deshacer.`)) return;
      await db.from('mensajes').delete().eq('grupo_id', id);
      await db.from('archivos').delete().eq('grupo_id', id);
      await db.from('eventos').delete().eq('grupo_id', id);
      await db.from('grupos').delete().eq('id', id);
      cargarGrupos();
    };

    window.eliminarMiembro = async (email) => {
      if (!confirm(`¿Eliminar a ${email} del grupo?`)) return;
      const { data: grupo } = await db.from('grupos').select('miembros').eq('id', grupoActual.id).single();
      const miembros = (grupo?.miembros || []).filter(e => e !== email);
      await db.from('grupos').update({ miembros }).eq('id', grupoActual.id);
      // Quedarse en la tab miembros
      cargarMiembros();
    };

    window.salirGrupo = async () => {
      if (!confirm('¿Salir del grupo?')) return;
      const { data: grupo } = await db.from('grupos').select('miembros').eq('id', grupoActual.id).single();
      const miembros = (grupo?.miembros || []).filter(e => e !== usuario.email);
      await db.from('grupos').update({ miembros }).eq('id', grupoActual.id);
      if (chatSub)    chatSub.unsubscribe();
      if (presenceSub) presenceSub.unsubscribe();
      grupoActual = null;
      ir('pantalla-inicio');
      cargarGrupos();
    };

    // ── REACCIONES ───────────────────────────────────────────────
    const EMOJIS_REACCION = ['👍','❤️','😂','😮','😢','🔥'];
    let pickerAbierto = null;

    window.mostrarPickerReaccion = (e, msgId) => {
      e.stopPropagation();
      // Cerrar picker anterior
      document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
      const picker = document.createElement('div');
      picker.className = 'emoji-picker';
      picker.innerHTML = EMOJIS_REACCION.map(em =>
        `<span onclick="toggleReaccion('${msgId}','${em}');this.closest('.emoji-picker').remove()">${em}</span>`
      ).join('');
      const btn = e.currentTarget || e.target;
      const rect = btn.getBoundingClientRect();
      picker.style.top  = (rect.top - 50) + 'px';
      picker.style.left = (rect.left - 60) + 'px';
      document.body.appendChild(picker);
      setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 50);
    };

    window.toggleReaccion = async (msgId, emoji) => {
      const { data: msg } = await db.from('mensajes').select('reacciones').eq('id', msgId).single();
      const reacs = msg?.reacciones || {};
      if (!reacs[emoji]) reacs[emoji] = [];
      const idx = reacs[emoji].indexOf(usuario.email);
      if (idx >= 0) reacs[emoji].splice(idx, 1);
      else reacs[emoji].push(usuario.email);
      await db.from('mensajes').update({ reacciones: reacs }).eq('id', msgId);
    };

    // ── QUOTE REPLY ──────────────────────────────────────────────

    window.responderMensaje = (id, texto, autor) => {
      replyActual = { id, texto, autor };
      const preview = $('reply-preview');
      if (!preview) return;
      preview.classList.remove('oculto');
      preview.innerHTML = `
        <div class="reply-inner">
          <span class="reply-autor">${autor}</span>
          <span class="reply-texto">${texto.slice(0,60)}${texto.length>60?'...':''}</span>
        </div>
        <button onclick="cancelarReply()" class="reply-cancel">✕</button>`;
      $('msg-input').focus();
    };

    window.cancelarReply = () => {
      replyActual = null;
      const p = $('reply-preview');
      if (p) { p.classList.add('oculto'); p.innerHTML = ''; }
    };



    // ── ESTADÍSTICAS DEL GRUPO ───────────────────────────────────
    async function cargarEstadisticasGrupo() {
      if (!grupoActual?.id) return;
      const [rMsg, rArch, rMiembros] = await Promise.all([
        db.from('mensajes').select('*', { count: 'exact', head: true }).eq('grupo_id', grupoActual.id),
        db.from('archivos').select('*', { count: 'exact', head: true }).eq('grupo_id', grupoActual.id),
        db.from('grupos').select('miembros').eq('id', grupoActual.id).single()
      ]);
      const stats = {
        mensajes: rMsg.count || 0,
        archivos: rArch.count || 0,
        miembros: rMiembros.data?.miembros?.length || 0
      };
      const el = $('tab-miembros');
      if (!el) return;
      let statsEl = document.getElementById('grupo-stats');
      if (!statsEl) {
        statsEl = document.createElement('div');
        statsEl.id = 'grupo-stats';
        statsEl.className = 'grupo-stats-wrap';
        el.querySelector('.tab-inner')?.prepend(statsEl);
      }
      statsEl.innerHTML = `
        <div class="stats-grid" style="margin-bottom:16px">
          <div class="stat-item"><span class="stat-val">${stats.mensajes}</span><span class="stat-label">Mensajes</span></div>
          <div class="stat-item"><span class="stat-val">${stats.archivos}</span><span class="stat-label">Archivos</span></div>
          <div class="stat-item"><span class="stat-val">${stats.miembros}</span><span class="stat-label">Miembros</span></div>
        </div>`;
    }

    // ── INSIGNIAS ────────────────────────────────────────────────
    const INSIGNIAS = [
      { id: 'primer_mensaje',  emoji: '💬', nombre: 'Primer mensaje',    condicion: (p) => p.mensajes_enviados >= 1 },
      { id: 'comunicador',     emoji: '📢', nombre: 'Comunicador',       condicion: (p) => p.mensajes_enviados >= 100 },
      { id: 'archivero',       emoji: '📂', nombre: 'Archivero',         condicion: (p) => p.archivos_subidos >= 5 },
      { id: 'sabio',           emoji: '🧠', nombre: 'Sabio',             condicion: (p) => p.respuestas_correctas >= 3 },
      { id: 'nivel_3',         emoji: '🎓', nombre: 'Avanzado',          condicion: (p) => (p.puntos||0) >= 6200 },
      { id: 'nivel_5',         emoji: '🏆', nombre: 'Maestro',           condicion: (p) => (p.puntos||0) >= 15000 },
      { id: 'leyenda',         emoji: '👑', nombre: 'Leyenda',           condicion: (p) => (p.puntos||0) >= 25000 },
    ];

    async function verificarInsignias() {
      const { data: perfil } = await db.from('perfil_usuario').select('*').eq('id', usuario.id).single();
      if (!perfil) return;
      const actuales = perfil.insignias || [];
      const nuevas = INSIGNIAS.filter(ins => !actuales.includes(ins.id) && ins.condicion(perfil));
      if (nuevas.length > 0) {
        const todas = [...actuales, ...nuevas.map(i => i.id)];
        await db.from('perfil_usuario').update({ insignias: todas }).eq('id', usuario.id);
        nuevas.forEach(ins => mostrarToast(`🏅 Nueva insignia: ${ins.emoji} ${ins.nombre}`, 'Felicitaciones!'));
      }
    }

    // ── EXPLORAR GRUPOS PÚBLICOS ─────────────────────────────────
    $('btn-ir-ranking').onclick = () => { ir('pantalla-ranking'); cargarRanking(); };

    async function cargarExplorar() {
      if (!$('explorar-lista')) return;
      cargando('explorar-lista');
      const { data } = await db.from('grupos')
        .select('id,nombre,materia,creador,miembros,descripcion,privado')
        .eq('privado', false)
        .order('creado_el', { ascending: false })
        .limit(30);

      if (!data || data.length === 0) { vacio('explorar-lista', '🔍', 'No hay grupos públicos todavía.'); return; }

      $('explorar-lista').innerHTML = data.map(g => {
        const esMiembro = g.miembros?.includes(usuario.email);
        return `<div class="grupo-card explorar-card" data-id="${g.id}" data-nombre="${g.nombre.replace(/"/g,'&quot;')}" data-miembro="${esMiembro}">
          <div class="grupo-info">
            <h3>📘 ${g.nombre}</h3>
            <p>${g.materia} · ${g.miembros?.length || 0} miembros · ${g.creador}</p>
            ${g.descripcion ? `<p style="color:var(--muted);font-size:11px;margin-top:2px">${g.descripcion}</p>` : ''}
          </div>
          <span class="tag">${esMiembro ? 'Entrar →' : '👁 Ver'}</span>
        </div>`;
      }).join('');

      document.querySelectorAll('.explorar-card').forEach(card => {
        card.addEventListener('click', () => {
          const id       = card.dataset.id;
          const nombre   = card.dataset.nombre;
          const esMiembro = card.dataset.miembro === 'true';
          if (esMiembro) entrarGrupo(id, nombre);
          else abrirVistaPrevia(id, nombre);
        });
      });
    }

    // ── VISTA PREVIA DE GRUPO ────────────────────────────────────
    async function abrirVistaPrevia(id, nombre) {
      ir('pantalla-vista-previa');
      $('preview-titulo').textContent = nombre;
      cargando('preview-mensajes');
      $('preview-unirse').dataset.id     = id;
      $('preview-unirse').dataset.nombre = nombre;

      const { data } = await db.from('mensajes')
        .select('autor,texto,imagen_url,hora')
        .eq('grupo_id', id)
        .order('hora', { ascending: false })
        .limit(20);

      if (!data || data.length === 0) {
        $('preview-mensajes').innerHTML = '<div class="vacio">💬 Este grupo todavía no tiene mensajes.</div>';
        return;
      }

      $('preview-mensajes').innerHTML = [...data].reverse().map(m => {
        const hora = m.hora ? new Date(m.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
        const contenido = m.imagen_url
          ? `<img src="${m.imagen_url}" class="msg-img" style="max-width:180px" />`
          : `<div class="texto">${m.texto}</div>`;
        return `<div class="mensaje otro">
          <div class="autor">${m.autor}</div>
          ${contenido}
          <div class="hora">${hora}</div>
        </div>`;
      }).join('');
    }

    $('btn-volver-preview').onclick = () => ir('pantalla-inicio');
    $('preview-unirse').onclick = () => {
      const id     = $('preview-unirse').dataset.id;
      const nombre = $('preview-unirse').dataset.nombre;
      unirseYEntrar(id, nombre);
    };

    // ── MODO CLARO/OSCURO ────────────────────────────────────────
    let temaOscuro = localStorage.getItem('tema') !== 'claro';

    function aplicarTema() {
      document.documentElement.setAttribute('data-tema', temaOscuro ? 'oscuro' : 'claro');
      $('btn-tema').textContent = temaOscuro ? '🌙' : '☀️';
      localStorage.setItem('tema', temaOscuro ? 'oscuro' : 'claro');
    }

    $('btn-tema').onclick = () => { temaOscuro = !temaOscuro; aplicarTema(); };
    aplicarTema();

    // ── COMPARTIR GRUPO ───────────────────────────────────────────
    $('btn-compartir-grupo').onclick = () => {
      const link = `${location.origin}?unirse=${grupoActual.id}`;
      $('compartir-link').value = link;
      $('modal-compartir').classList.remove('oculto');
    };

    $('btn-copiar-link').onclick = () => {
      navigator.clipboard.writeText($('compartir-link').value).then(() => {
        $('btn-copiar-link').textContent = '✅';
        setTimeout(() => $('btn-copiar-link').textContent = 'Copiar', 2000);
      });
    };

    $('btn-cerrar-compartir').onclick = () => $('modal-compartir').classList.add('oculto');

    // Manejar link de invitación al cargar
    const urlParams = new URLSearchParams(location.search);
    const grupoInvitacion = urlParams.get('unirse');
    if (grupoInvitacion) {
      // Guardar para procesar después del login
      localStorage.setItem('unirse_grupo', grupoInvitacion);
      history.replaceState({}, '', '/');
    }

    async function procesarInvitacion() {
      const gId = localStorage.getItem('unirse_grupo');
      if (!gId || !usuario) return;
      localStorage.removeItem('unirse_grupo');
      const { data: grupo } = await db.from('grupos').select('*').eq('id', gId).single();
      if (!grupo) return;
      const miembros = grupo.miembros || [];
      if (!miembros.includes(usuario.email)) {
        await db.from('grupos').update({ miembros: [...miembros, usuario.email] }).eq('id', gId);
      }
      entrarGrupo(gId, grupo.nombre);
    }

    // ── MENSAJES FIJADOS ─────────────────────────────────────────
    async function cargarMensajeFijado() {
      if (!grupoActual?.id) return;
      const { data } = await db.from('mensajes')
        .select('*').eq('grupo_id', grupoActual.id).eq('fijado', true)
        .order('hora', { ascending: false }).limit(1);

      const banner = $('mensaje-fijado-banner');
      const msg = data && data.length > 0 ? data[0] : null;
      if (msg) {
        banner.classList.remove('oculto');
        banner.innerHTML = `
          <div class="banner-fijado" onclick="scrollAMensajeFijado('${msg.id}')" style="cursor:pointer">
            <span>📌</span>
            <span class="banner-texto">${msg.imagen_url ? '📷 Imagen' : msg.texto}</span>
            <span class="banner-autor">— ${msg.autor}</span>
            <span style="color:var(--accent);font-size:11px;flex-shrink:0">Ver ↓</span>
          </div>`;
      } else {
        banner.classList.add('oculto');
      }
    }

    // ── ENCUESTAS ────────────────────────────────────────────────
    $('btn-encuesta').onclick = () => $('modal-encuesta').classList.remove('oculto');
    $('btn-cancelar-encuesta').onclick = () => {
      $('modal-encuesta').classList.add('oculto');
      $('encuesta-pregunta').value = '';
      $('encuesta-opciones').value = '';
    };

    $('btn-crear-encuesta').onclick = async () => {
      const pregunta = $('encuesta-pregunta').value.trim();
      const opcionesRaw = $('encuesta-opciones').value.trim();
      if (!pregunta) return alert('Escribí una pregunta');
      const opciones = opcionesRaw.split('\n').map(o => o.trim()).filter(o => o.length > 0);
      if (opciones.length < 2) return alert('Necesitás al menos 2 opciones');

      await db.from('mensajes').insert({
        grupo_id: grupoActual.id,
        autor:    usuario.nombre,
        email:    usuario.email,
        texto:    pregunta,
        tipo:     'encuesta',
        opciones,
        votos:    {}
      });
      $('btn-cancelar-encuesta').click();
    };

    async function votarEncuesta(msgId, opcion) {
      const { data: msg } = await db.from('mensajes').select('votos').eq('id', msgId).single();
      const votos = msg?.votos || {};
      // Remover voto anterior del usuario
      Object.keys(votos).forEach(op => {
        if (Array.isArray(votos[op])) votos[op] = votos[op].filter(e => e !== usuario.email);
      });
      // Agregar nuevo voto
      if (!votos[opcion]) votos[opcion] = [];
      votos[opcion].push(usuario.email);
      await db.from('mensajes').update({ votos }).eq('id', msgId);
    }

    // ── RANKING ─────────────────────────────────────────────────

    // ── NAV MÓVIL ────────────────────────────────────────────────
    function setupNavMobile() {
      const nav = document.querySelector('.nav-mobile');
      if (!nav) return;

      $('nav-grupos').onclick  = () => { ir('pantalla-inicio'); setNavActivo('nav-grupos'); };
      $('nav-buscar').onclick  = () => { abrirBusqueda(); setNavActivo('nav-buscar'); };
      $('nav-foro').onclick    = () => { ir('pantalla-foro');   $('foro-avatar').textContent = usuario.nombre[0].toUpperCase(); $('foro-nombre').textContent = usuario.nombre; mostrarListaForo(); cargarPreguntas(); setNavActivo('nav-foro'); };
      $('nav-clases').onclick  = () => { irClases(); setNavActivo('nav-clases'); };
      $('nav-ranking').onclick = () => { ir('pantalla-ranking'); cargarRanking(); setNavActivo('nav-ranking'); };
      $('nav-mensajes').onclick= () => { ir('pantalla-bandeja'); cargarBandeja(); setNavActivo('nav-mensajes'); };
      $('nav-perfil').onclick  = () => { abrirPerfil(); setNavActivo('nav-perfil'); };
    }

    function setNavActivo(id) {
      document.querySelectorAll('.nav-mobile-btn').forEach(b => b.classList.remove('activo'));
      const btn = $(id);
      if (btn) btn.classList.add('activo');
    }

    setupNavMobile();


    $('btn-volver-ranking').onclick = () => ir('pantalla-inicio');

    async function cargarRanking() {
      cargando('lista-ranking');
      const { data } = await db
        .from('perfil_usuario')
        .select('nombre, email, puntos, nivel, avatar_url')
        .order('puntos', { ascending: false })
        .limit(20);

      if (!data || data.length === 0) { vacio('lista-ranking', '🏆', 'Todavía no hay puntuaciones.'); return; }

      const medallas = ['🥇', '🥈', '🥉'];
      $('lista-ranking').innerHTML = data.map((p, i) => {
        const niv    = getNivel(p.puntos);
        const avatar = p.avatar_url
          ? `<img src="${p.avatar_url}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" />`
          : `<div class="ranking-avatar">${(p.nombre||'?')[0].toUpperCase()}</div>`;
        return `<div class="ranking-item ${p.email === usuario.email ? 'ranking-yo' : ''}">
          <span class="ranking-pos">${medallas[i] || (i+1)}</span>
          ${avatar}
          <div class="ranking-datos">
            <span class="ranking-nombre">${p.nombre} ${p.email === usuario.email ? '<span class="badge-vos">Vos</span>' : ''}</span>
            <span class="ranking-nivel">${niv.emoji} ${niv.nombre}</span>
          </div>
          <span class="ranking-pts">${p.puntos} pts</span>
        </div>`;
      }).join('');
    }

    // ── MENSAJES PRIVADOS ────────────────────────────────────────
    let dmSub        = null;
    let dmActual     = null; // { email, nombre }
    const dmRendered = new Set();

    $('btn-ir-bandeja').onclick    = () => { ir('pantalla-bandeja'); cargarBandeja(); };
    $('btn-volver-bandeja').onclick = () => ir('pantalla-inicio');
    $('btn-volver-dm').onclick     = () => {
      if (dmSub) { db.removeChannel(dmSub); dmSub = null; }
      dmActual = null;
      ir('pantalla-bandeja');
      cargarBandeja();
    };

    async function abrirDM(emailDest, nombreDest) {
      dmActual = { email: emailDest, nombre: nombreDest };
      dmRendered.clear();
      if (dmSub) { db.removeChannel(dmSub); dmSub = null; }

      ir('pantalla-dm');
      $('dm-titulo').textContent = '💬 ' + nombreDest;
      cargando('dm-mensajes');

      // Suscribir realtime
      if (dmSub) { await db.removeChannel(dmSub); dmSub = null; }
      dmSub = db.channel('dm-' + Date.now())
        .on('postgres_changes', {
          event:  '*',
          schema: 'public',
          table:  'mensajes_privados'
        }, payload => {
          if (payload.eventType !== 'INSERT') return;
          const m = payload.new;
          if (!m) return;
          const involucra = (m.de_email === usuario.email && m.para_email === emailDest) ||
                            (m.de_email === emailDest    && m.para_email === usuario.email);
          if (!involucra || dmRendered.has(m.id)) return;
          dmRendered.add(m.id);
          const vac = $('dm-mensajes').querySelector('.vacio');
          if (vac) $('dm-mensajes').innerHTML = '';
          $('dm-mensajes').insertAdjacentHTML('beforeend', htmlDM(m));
          $('dm-mensajes').scrollTop = $('dm-mensajes').scrollHeight;
          if (m.de_email !== usuario.email) {
            mostrarNotificacion(m.de_nombre, m.texto || '📷 Imagen');
            db.from('mensajes_privados').update({ leido: true }).eq('id', m.id).then(() => actualizarBadge());
          }
        })
        .subscribe(status => console.log('DM realtime:', status));

      // Cargar historial
      const { data } = await db.from('mensajes_privados')
        .select('*')
        .or(`and(de_email.eq.${usuario.email},para_email.eq.${emailDest}),and(de_email.eq.${emailDest},para_email.eq.${usuario.email})`)
        .order('hora', { ascending: true });

      // Marcar como leídos
      if (data?.length) {
        const noLeidos = data.filter(m => m.para_email === usuario.email && !m.leido).map(m => m.id);
        if (noLeidos.length) {
          await db.from('mensajes_privados').update({ leido: true }).in('id', noLeidos);
          actualizarBadge();
        }
      }

      if (!data || data.length === 0) {
        $('dm-mensajes').innerHTML = '<div class="vacio" style="margin:auto">💬 Empezá la conversación</div>';
      } else {
        $('dm-mensajes').innerHTML = data.map(m => { dmRendered.add(m.id); return htmlDM(m); }).join('');
        $('dm-mensajes').scrollTop = $('dm-mensajes').scrollHeight;
      }

      $('dm-input').disabled  = false;
      $('btn-dm-enviar').disabled = false;
      $('dm-input').focus();
    }

    function htmlDM(m) {
      const esPropio = m.de_email === usuario.email;
      const hora = m.hora
        ? new Date(m.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        : '';
      const contenido = m.imagen_url
        ? `<img src="${m.imagen_url}" class="msg-img" onclick="window.open('${m.imagen_url}','_blank')" />`
        : `<div class="texto">${m.texto}</div>`;
      return `<div class="mensaje ${esPropio ? 'propio' : 'otro'}">
        ${!esPropio ? `<div class="autor">${m.de_nombre}</div>` : ''}
        ${contenido}
        <div class="hora">${hora}${!esPropio && m.leido ? ' ✓' : ''}</div>
      </div>`;
    }

    $('btn-dm-enviar').onclick = enviarDM;
    $('dm-input').addEventListener('keypress', e => { if (e.key === 'Enter') enviarDM(); });

    async function enviarDM() {
      const texto = $('dm-input').value.trim();
      if (!texto || !dmActual) return;
      $('dm-input').value = '';
      $('dm-input').focus();
      db.from('mensajes_privados').insert({
        de_email:  usuario.email,
        de_nombre: usuario.nombre,
        para_email: dmActual.email,
        texto
      }).then(({ error }) => {
        if (error) console.error(error);
        else crearNotificacion(dmActual.email, 'dm', '✉️ ' + usuario.nombre, texto.slice(0, 60), usuario.email);
      });
    }

    // Foto en DM
    $('dm-foto-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !dmActual) return;
      const btn = document.querySelector('#pantalla-dm .btn-foto-chat');
      if (btn) btn.textContent = '⏳';
      try {
        const url = await subirImagenCloudinary(file, 'dm');
        await db.from('mensajes_privados').insert({
          de_email:   usuario.email,
          de_nombre:  usuario.nombre,
          para_email: dmActual.email,
          texto:      '',
          imagen_url: url
        });
      } catch(err) {
        alert('Error subiendo imagen: ' + err.message);
      } finally {
        e.target.value = '';
        if (btn) btn.textContent = '📷';
      }
    });

    // ── BANDEJA ──────────────────────────────────────────────────
    async function cargarBandeja() {
      cargando('lista-conversaciones');

      // Obtener todos los mensajes donde soy parte
      const { data } = await db.from('mensajes_privados')
        .select('*')
        .or(`de_email.eq.${usuario.email},para_email.eq.${usuario.email}`)
        .order('hora', { ascending: false });

      if (!data || data.length === 0) {
        vacio('lista-conversaciones', '✉️', 'No tenés mensajes todavía.');
        return;
      }

      // Agrupar por conversación
      const convs = {};
      data.forEach(m => {
        const otro = m.de_email === usuario.email ? m.para_email : m.de_email;
        const otroNombre = m.de_email === usuario.email ? m.para_email.split('@')[0] : m.de_nombre;
        if (!convs[otro]) convs[otro] = { email: otro, nombre: otroNombre, ultimo: m, noLeidos: 0 };
        if (m.para_email === usuario.email && !m.leido) convs[otro].noLeidos++;
      });

      $('lista-conversaciones').innerHTML = Object.values(convs).map(c => `
        <div class="conv-item" data-email="${c.email}" data-nombre="${c.nombre}">
          <div class="miembro-avatar">${c.nombre[0].toUpperCase()}</div>
          <div class="miembro-datos">
            <span style="font-weight:500">${c.nombre}</span>
            <span style="font-size:12px;color:var(--muted2)">${c.ultimo.texto || '📷 Imagen'}</span>
          </div>
          ${c.noLeidos > 0 ? `<span class="badge-noread">${c.noLeidos}</span>` : ''}
        </div>`).join('');

      document.querySelectorAll('.conv-item').forEach(item => {
        item.addEventListener('click', () => abrirDM(item.dataset.email, item.dataset.nombre));
      });
    }

    async function actualizarBadge() {
      const { count } = await db.from('mensajes_privados')
        .select('*', { count: 'exact', head: true })
        .eq('para_email', usuario.email)
        .eq('leido', false);
      const badge = $('badge-no-leidos');
      if (count > 0) {
        badge.textContent = count; badge.classList.remove('oculto');
        const badgeNav = $('badge-nav');
        if (badgeNav) { badgeNav.textContent = count; badgeNav.classList.remove('oculto'); }
      } else {
        badge.classList.add('oculto');
        const badgeNav = $('badge-nav');
        if (badgeNav) badgeNav.classList.add('oculto');
      }
    }

    // Verificar mensajes no leídos al cargar
    db.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) actualizarBadge();
    });

    // ── FORO ────────────────────────────────────────────────────
    let categoriaActual  = '';
    let preguntaActual   = null;

    $('btn-ir-foro').onclick = () => {
      ir('pantalla-foro');
      $('foro-avatar').textContent = usuario.nombre[0].toUpperCase();
      $('foro-nombre').textContent = usuario.nombre;
      mostrarListaForo();
      cargarPreguntas();
    };

    $('btn-volver-foro').onclick = () => ir('pantalla-inicio');

    $('btn-volver-lista').onclick = () => {
      mostrarListaForo();
      cargarPreguntas();
    };

    function mostrarListaForo() {
      $('foro-lista-wrap').classList.remove('oculto');
      $('foro-detalle-wrap').classList.add('oculto');
    }

    function mostrarDetalleForo() {
      $('foro-lista-wrap').classList.add('oculto');
      $('foro-detalle-wrap').classList.remove('oculto');
    }

    // Filtros
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        categoriaActual = btn.dataset.cat;
        cargarPreguntas();
      });
    });

    // Nueva pregunta
    $('btn-nueva-pregunta').onclick   = () => $('form-pregunta').classList.toggle('oculto');
    $('btn-cancelar-pregunta').onclick = () => {
      $('form-pregunta').classList.add('oculto');
      $('preg-titulo').value = '';
      $('preg-desc').value   = '';
      $('preg-foto-preview').innerHTML = '';
      $('preg-foto').value = '';
    };

    // Preview imagen pregunta
    $('preg-foto').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $('preg-foto-preview').innerHTML = `<img src="${url}" class="foto-preview" />`;
    });

    // Preview imagen respuesta
    $('resp-foto').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $('resp-foto-preview').innerHTML = `<img src="${url}" class="foto-preview" />`;
    });

    $('btn-publicar-pregunta').onclick = async () => {
      const titulo      = $('preg-titulo').value.trim();
      const descripcion = $('preg-desc').value.trim();
      const categoria   = $('preg-categoria').value;
      if (!titulo || !descripcion) return alert('Completá título y descripción');

      let imagen_url = null;
      const fotoFile = $('preg-foto').files[0];
      if (fotoFile) {
        try { imagen_url = await subirImagenCloudinary(fotoFile, 'foro'); }
        catch(e) { alert('Error subiendo imagen'); return; }
      }

      const { error } = await db.from('foro_preguntas').insert({
        titulo, descripcion, categoria, imagen_url,
        autor:       usuario.nombre,
        autor_email: usuario.email
      });

      if (error) { alert('Error: ' + error.message); return; }
      sumarPuntos(3);
      $('btn-cancelar-pregunta').click();
      cargarPreguntas();
    };

    async function cargarPreguntas() {
      cargando('lista-preguntas');
      let query = db
        .from('foro_preguntas')
        .select('*')
        .order('creado_el', { ascending: false });

      if (categoriaActual) query = query.eq('categoria', categoriaActual);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        vacio('lista-preguntas', '💬', 'No hay preguntas todavía. ¡Sé el primero!');
        return;
      }

      $('lista-preguntas').innerHTML = data.map(p => `
        <div class="pregunta-card ${p.resuelto ? 'resuelta' : ''}" data-id="${p.id}">
          <div class="pregunta-header">
            <span class="cat-badge">${p.categoria}</span>
            ${p.resuelto ? '<span class="resuelta-badge">✅ Resuelta</span>' : ''}
          </div>
          <h3 class="pregunta-titulo">${p.titulo}</h3>
          <p class="pregunta-desc">${p.descripcion.length > 120 ? p.descripcion.slice(0,120)+'...' : p.descripcion}</p>
          <div class="pregunta-meta">
            <span>👤 ${p.autor}</span>
            <span>📅 ${new Date(p.creado_el).toLocaleDateString('es-AR')}</span>
          </div>
        </div>`).join('');

      document.querySelectorAll('.pregunta-card').forEach(card => {
        card.addEventListener('click', () => abrirPregunta(card.dataset.id));
      });
    }

    async function abrirPregunta(id) {
      const { data: p } = await db.from('foro_preguntas').select('*').eq('id', id).single();
      if (!p) return;
      preguntaActual = p;
      mostrarDetalleForo();

      $('detalle-pregunta').innerHTML = `
        <div class="pregunta-detalle">
          <div class="pregunta-header">
            <span class="cat-badge">${p.categoria}</span>
            ${p.resuelto ? '<span class="resuelta-badge">✅ Resuelta</span>' : ''}
          </div>
          <h2>${p.titulo}</h2>
          ${p.imagen_url ? `<img src="${p.imagen_url}" class="foro-img" onclick="window.open('${p.imagen_url}','_blank')" />` : ''}
          <p style="color:var(--muted2);margin:12px 0;line-height:1.7">${p.descripcion}</p>
          <div class="pregunta-meta">
            <span>👤 ${p.autor}</span>
            <span>📅 ${new Date(p.creado_el).toLocaleDateString('es-AR')}</span>
          </div>
        </div>`;

      cargarRespuestas(id);
    }

    async function cargarRespuestas(preguntaId) {
      cargando('lista-respuestas');
      const { data } = await db
        .from('foro_respuestas')
        .select('*')
        .eq('pregunta_id', preguntaId)
        .order('votos', { ascending: false });

      if (!data || data.length === 0) {
        vacio('lista-respuestas', '💭', 'Todavía no hay respuestas. ¡Respondé vos!');
        return;
      }

      const esDuenio = preguntaActual?.autor_email === usuario.email;

      $('lista-respuestas').innerHTML = data.map(r => `
        <div class="respuesta-card ${r.es_correcta ? 'correcta' : ''}">
          ${r.es_correcta ? '<div class="correcta-banner">✅ Respuesta correcta</div>' : ''}
          ${r.imagen_url ? `<img src="${r.imagen_url}" class="foro-img" onclick="window.open('${r.imagen_url}','_blank')" />` : ''}
          <p class="respuesta-texto">${r.texto}</p>
          <div class="respuesta-meta">
            <span>👤 ${r.autor}</span>
            <span>📅 ${new Date(r.creado_el).toLocaleDateString('es-AR')}</span>
            <button class="btn-voto" data-id="${r.id}" data-votos="${r.votos}">
              👍 ${r.votos}
            </button>
            ${esDuenio && !preguntaActual.resuelto ? `
              <button class="btn-correcta" data-id="${r.id}">✅ Marcar correcta</button>
            ` : ''}
          </div>
        </div>`).join('');

      // Votar
      document.querySelectorAll('.btn-voto').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id    = btn.dataset.id;
          const votos = parseInt(btn.dataset.votos) + 1;
          await db.from('foro_respuestas').update({ votos }).eq('id', id);
          btn.dataset.votos = votos;
          btn.textContent   = '👍 ' + votos;
        });
      });

      // Marcar como correcta
      document.querySelectorAll('.btn-correcta').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          // Buscar email del autor de la respuesta para darle puntos
          const resp = data.find(r => r.id === id);
          await db.from('foro_respuestas').update({ es_correcta: true }).eq('id', id);
          await db.from('foro_preguntas').update({ resuelto: true }).eq('id', preguntaActual.id);
          // +15 pts al autor de la respuesta correcta
          if (resp && resp.autor_email === usuario.email) {
            sumarPuntos(15);
          } else if (resp) {
            // Buscar el id del autor de la respuesta y sumarle puntos
            const { data: perfilResp } = await db.from('perfil_usuario').select('id').eq('email', resp.autor_email).single();
            if (perfilResp) await db.rpc('sumar_puntos', { usuario_id: perfilResp.id, cantidad: 15 });
          }
          preguntaActual.resuelto = true;
          abrirPregunta(preguntaActual.id);
        });
      });
    }

    $('btn-publicar-respuesta').onclick = async () => {
      const texto    = $('resp-texto').value.trim();
      const fotoFile = $('resp-foto').files[0];
      if (!texto && !fotoFile) return alert('Escribí una respuesta o adjuntá una imagen');

      let imagen_url = null;
      if (fotoFile) {
        try { imagen_url = await subirImagenCloudinary(fotoFile, 'foro'); }
        catch(e) { alert('Error subiendo imagen'); return; }
      }

      await db.from('foro_respuestas').insert({
        pregunta_id: preguntaActual.id,
        texto:       texto || '',
        imagen_url,
        autor:       usuario.nombre,
        autor_email: usuario.email
      });

      sumarPuntos(5);
      // Notificar al autor de la pregunta
      if (preguntaActual.autor_email !== usuario.email) {
        crearNotificacion(preguntaActual.autor_email, 'foro', '💬 Nueva respuesta', usuario.nombre + ' respondió tu pregunta: ' + preguntaActual.titulo.slice(0,40), preguntaActual.id);
      }
      $('resp-texto').value = '';
      $('resp-foto').value  = '';
      $('resp-foto-preview').innerHTML = '';
      cargarRespuestas(preguntaActual.id);
    };
    // Registrar Service Worker (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registrado:', reg.scope))
        .catch(err => console.log('SW error:', err));
    }