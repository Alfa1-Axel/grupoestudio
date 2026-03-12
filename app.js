// Guardamos usuarios en el navegador (por ahora sin servidor)
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
let usuarioActual = JSON.parse(localStorage.getItem('usuarioActual')) || null;

// Si ya hay sesión iniciada, mostrar inicio directo
if (usuarioActual) {
  mostrarInicio();
}

function registrarse() {
  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email-reg').value.trim();
  const password = document.getElementById('password-reg').value;

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
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

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
  document.getElementById('saludo').textContent = '👤 ' + usuarioActual.nombre;
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
  document.getElementById(id).classList.remove('oculto');
}

function ocultar(id) {
  document.getElementById(id).classList.add('oculto');
}
// ── GRUPOS ──────────────────────────────────────────────────────
let grupos = JSON.parse(localStorage.getItem('grupos')) || [];

function mostrarFormGrupo() {
  document.getElementById('form-grupo').classList.remove('oculto');
}

function ocultarFormGrupo() {
  document.getElementById('form-grupo').classList.add('oculto');
  document.getElementById('nombre-grupo').value = '';
  document.getElementById('materia-grupo').value = '';
}

function crearGrupo() {
  const nombre = document.getElementById('nombre-grupo').value.trim();
  const materia = document.getElementById('materia-grupo').value.trim();

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
    lista.innerHTML = '<div class="sin-grupos">📭 Todavía no tenés grupos.<br>¡Creá el primero!</div>';
    return;
  }

  lista.innerHTML = misGrupos.map(g => `
    <div class="grupo-card">
      <div class="grupo-info">
        <h3>📘 ${g.nombre}</h3>
        <p>${g.materia} · ${g.miembros.length} miembro(s) · Creado por ${g.creador}</p>
      </div>
      <button class="btn-entrar" onclick="entrarGrupo(${g.id})">Entrar →</button>
    </div>
  `).join('');
}
let grupoActual = null;

function entrarGrupo(id) {
  grupoActual = grupos.find(g => g.id === id);

  ocultar('pantalla-inicio');
  mostrar('pantalla-grupo');

  document.getElementById('nombre-grupo-actual').textContent = '📘 ' + grupoActual.nombre;
  document.getElementById('saludo-grupo').textContent = '👤 ' + usuarioActual.nombre;

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
    contenedor.innerHTML = '<div class="sin-mensajes">💬 Nadie escribió todavía.<br>¡Sé el primero!</div>';
    return;
  }

  contenedor.innerHTML = mensajes.map(m => {
    const esPropio = m.email === usuarioActual.email;
    return `
      <div class="mensaje ${esPropio ? 'propio' : 'otro'}">
        ${!esPropio ? `<div class="autor">${m.autor}</div>` : ''}
        ${m.texto}
        <div class="hora">${m.hora}</div>
      </div>
    `;
  }).join('');

  // Scroll al último mensaje
  contenedor.scrollTop = contenedor.scrollHeight;
}

// Renderizar grupos al cargar inicio
const _mostrarInicioOriginal = mostrarInicio;
mostrarInicio = function() {
  _mostrarInicioOriginal();
  renderizarGrupos();
}