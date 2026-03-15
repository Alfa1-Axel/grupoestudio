const btnTema = document.getElementById('btn-tema');

function aplicarTema(modo) {
  if (modo === 'claro') {
    document.body.classList.add('light');
    document.documentElement.setAttribute('data-tema', 'claro');
    if (btnTema) btnTema.textContent = '☀️';
  } else {
    document.body.classList.remove('light');
    document.documentElement.setAttribute('data-tema', 'oscuro');
    if (btnTema) btnTema.textContent = '🌙';
  }
  localStorage.setItem('tema_grupoestudio', modo);
}

if (btnTema) {
  btnTema.onclick = () => {
    const esClaro = document.body.classList.contains('light');
    console.log("se hizo click en el botón: ", esClaro)
    aplicarTema(esClaro ? 'oscuro' : 'claro');
  };
}
btnTema.addEventListener("click", ()=>{
  const esClaro = document.body.classList.contains('light');
    console.log("se hizo click en el botón: ", esClaro)
    aplicarTema(esClaro ? 'oscuro' : 'claro');
} )
// Cargar tema al iniciar la app
const temaGuardado = localStorage.getItem('tema_grupoestudio') || 'oscuro';
aplicarTema(temaGuardado);


// ── USUARIOS Y SESIÓN (LOCALSTORAGE) ─────────────────────────
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
let usuarioActual = JSON.parse(localStorage.getItem('usuarioActual')) || null;

// Si ya hay sesión iniciada, mostrar inicio directo
if (usuarioActual) {
  mostrarInicio();
}

function registrarse() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pass').value;

  if (!nombre || !email || !password) {
    alert('Completá todos los campos');
    return;
  }

  const yaExiste = usuarios.find(u => u.email === email);
  if (yaExiste) {
    alert('Ya existe una cuenta con ese correo');
    return;
  }

  const nuevoUsuario = { nombre, email, password };
  usuarios.push(nuevoUsuario);
  localStorage.setItem('usuarios', JSON.stringify(usuarios));

  alert('¡Cuenta creada! Ahora iniciá sesión.');
  mostrarLogin();
}

function iniciarSesion() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;

  const usuario = usuarios.find(u => u.email === email && u.password === password);

  if (!usuario) {
    alert('Correo o contraseña incorrectos');
    return;
  }

  localStorage.setItem('usuarioActual', JSON.stringify(usuario));
  usuarioActual = usuario;
  mostrarInicio();
}

function cerrarSesion() {
  localStorage.removeItem('usuarioActual');
  usuarioActual = null;
  mostrarLogin();
}

function mostrarInicio() {
  ocultar('pantalla-login');
  ocultar('pantalla-registro');
  mostrar('pantalla-inicio');
  
  const inicioNombre = document.getElementById('inicio-nombre');
  if (inicioNombre) inicioNombre.textContent = usuarioActual.nombre;
  
  const inicioAvatar = document.getElementById('inicio-avatar');
  if (inicioAvatar) inicioAvatar.textContent = usuarioActual.nombre[0].toUpperCase();

  renderizarGrupos();
}

function mostrarLogin() {
  ocultar('pantalla-registro');
  ocultar('pantalla-inicio');
  mostrar('pantalla-login');
}

function mostrarRegistro() {
  ocultar('pantalla-login');
  ocultar('pantalla-inicio');
  mostrar('pantalla-registro');
}

function mostrar(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('oculto');
}

function ocultar(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('oculto');
}

// ── GRUPOS ──────────────────────────────────────────────────────
let grupos = JSON.parse(localStorage.getItem('grupos')) || [];

function mostrarFormGrupo() {
  document.getElementById('form-grupo').classList.remove('oculto');
}

function ocultarFormGrupo() {
  document.getElementById('form-grupo').classList.add('oculto');
  document.getElementById('nuevo-nombre').value = '';
  document.getElementById('nuevo-materia').value = '';
}

function crearGrupo() {
  const nombre = document.getElementById('nuevo-nombre').value.trim();
  const materia = document.getElementById('nuevo-materia').value.trim();

  if (!nombre || !materia) {
    alert('Completá nombre y materia');
    return;
  }

  const nuevoGrupo = {
    id: Date.now(),
    nombre,
    materia,
    creador: usuarioActual.nombre,
    miembros: [usuarioActual.email],
    fecha: new Date().toLocaleDateString('es-AR')
  };

  grupos.push(nuevoGrupo);
  localStorage.setItem('grupos', JSON.stringify(grupos));
  ocultarFormGrupo();
  renderizarGrupos();
}

function renderizarGrupos() {
  const lista = document.getElementById('lista-grupos');
  if (!lista) return;

  // Solo mostrar grupos donde el usuario es miembro
  const misGrupos = grupos.filter(g => g.miembros.includes(usuarioActual.email));

  if (misGrupos.length === 0) {
    lista.innerHTML = '<div class="vacio"><span>📭</span>Todavía no tenés grupos.<br>¡Creá el primero!</div>';
    return;
  }

  lista.innerHTML = misGrupos.map(g => `
    <div class="grupo-card">
      <div class="grupo-info">
        <h3>📘 ${g.nombre}</h3>
        <p>${g.materia} · ${g.miembros.length} miembro(s) · Creado por ${g.creador}</p>
      </div>
      <button class="tag" style="border:none; cursor:pointer;" onclick="entrarGrupo(${g.id})">Entrar →</button>
    </div>
  `).join('');
}

let grupoActual = null;

function entrarGrupo(id) {
  grupoActual = grupos.find(g => g.id === id);

  ocultar('pantalla-inicio');
  mostrar('pantalla-grupo');

  document.getElementById('grupo-titulo').textContent = grupoActual.nombre;
  
  const grupoNombreUsuario = document.getElementById('grupo-nombre-usuario');
  if (grupoNombreUsuario) grupoNombreUsuario.textContent = usuarioActual.nombre;
  
  const grupoAvatar = document.getElementById('grupo-avatar');
  if (grupoAvatar) grupoAvatar.textContent = usuarioActual.nombre[0].toUpperCase();

  renderizarMensajes();
}

function volverAGrupos() {
  grupoActual = null;
  ocultar('pantalla-grupo');
  mostrar('pantalla-inicio');
  renderizarGrupos();
}

function enviarMensaje() {
  const input = document.getElementById('msg-input');
  const texto = input.value.trim();
  if (!texto || !grupoActual) return;

  // Cargar mensajes existentes
  const key = 'mensajes_' + grupoActual.id;
  const mensajes = JSON.parse(localStorage.getItem(key)) || [];

  // Agregar nuevo mensaje
  mensajes.push({
    autor: usuarioActual.nombre,
    email: usuarioActual.email,
    texto,
    hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  });

  localStorage.setItem(key, JSON.stringify(mensajes));
  input.value = '';
  renderizarMensajes();
}

function renderizarMensajes() {
  const key = 'mensajes_' + grupoActual.id;
  const mensajes = JSON.parse(localStorage.getItem(key)) || [];
  const contenedor = document.getElementById('mensajes');

  if (mensajes.length === 0) {
    contenedor.innerHTML = '<div class="vacio" style="margin:auto"><span>💬</span> Nadie escribió todavía.<br>¡Sé el primero!</div>';
    return;
  }

  contenedor.innerHTML = mensajes.map(m => {
    const esPropio = m.email === usuarioActual.email;
    return `
      <div class="mensaje ${esPropio ? 'propio' : 'otro'}">
        ${!esPropio ? <div class="autor">${m.autor}</div> : ''}
        <div class="texto">${m.texto}</div>
        <div class="hora">${m.hora}</div>
      </div>
    `;
  }).join('');

  // Scroll al último mensaje
  contenedor.scrollTop = contenedor.scrollHeight;
}