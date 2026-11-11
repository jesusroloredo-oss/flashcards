/* ======================================================================
   LÓGICA DE LA INTERFAZ: menú, pantalla de tema, alta de flashcards,
   giro de tarjetas y modo edición (selección múltiple).
   ====================================================================== */
import { BLOQUES, NOMBRES, bloqueDe } from "./temas.js";
import { crearAlmacen } from "./storage.js";

const $ = (id) => document.getElementById(id);

let almacen = null;
let usuario = null;          // null = sin sesión (solo en modo nube)
let desuscribir = null;
let datos = {};              // { tema: [tarjetas] }
let temaActual = null;
let editandoId = null;       // tarjeta que se está editando en el formulario
let modoEdicion = false;     // modo de selección para editar/borrar
const abiertas = new Set();  // tarjetas giradas (mostrando la respuesta)
const seleccion = new Set(); // tarjetas marcadas en modo edición

const cuenta = (n) => (datos[n] || []).length;

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;   // textContent: nada se interpreta como HTML
  return e;
}

function guardarSesion(clave, valor) {
  try {
    if (valor === undefined) return sessionStorage.getItem(clave);
    sessionStorage.setItem(clave, valor);
  } catch (e) { return null; }
}

let temporizador;
function aviso(texto) {
  const a = $("aviso");
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { a.hidden = true; }, 2200);
}

function ver(id) {
  ["vista-login", "vista-menu", "vista-tema"].forEach((v) => { $(v).hidden = v !== id; });
  window.scrollTo(0, 0);
}

/* ------------------------------ MENÚ ------------------------------ */
function pintarMenu() {
  const cont = $("bloques");
  cont.innerHTML = "";
  const abierto = guardarSesion("bloqueAbierto") ?? "juridicas";

  BLOQUES.forEach((b) => {
    const total = b.hasta - b.desde + 1;
    let tarjetas = 0;
    for (let n = b.desde; n <= b.hasta; n++) tarjetas += cuenta(n);

    const sec = el("div", "bloque" + (b.id === abierto ? " abierto" : ""));
    sec.style.setProperty("--acento", b.color);

    const cab = el("button", "bloque-cab");
    cab.setAttribute("aria-expanded", String(b.id === abierto));
    const titulo = el("div", "titulo");
    titulo.append(el("strong", "", b.nombre), el("span", "meta", `${total} temas · ${tarjetas} tarjetas`));
    const chev = el("span", "chevron", "›");
    chev.setAttribute("aria-hidden", "true");
    cab.append(titulo, chev);
    cab.addEventListener("click", () => {
      const abrir = !sec.classList.contains("abierto");
      sec.classList.toggle("abierto", abrir);
      cab.setAttribute("aria-expanded", String(abrir));
      guardarSesion("bloqueAbierto", abrir ? b.id : "");
    });

    const grid = el("div", "temas");
    for (let n = b.desde; n <= b.hasta; n++) {
      const c = cuenta(n);
      const t = el("button", "tema-btn");
      t.append(
        el("span", "tema-num", "Tema " + n),
        el("span", "tema-nombre", NOMBRES[n] || ""),
        el("span", "tema-cuenta", c === 0 ? "Sin tarjetas" : c + (c === 1 ? " tarjeta" : " tarjetas"))
      );
      t.addEventListener("click", () => { location.hash = "tema-" + n; });
      grid.appendChild(t);
    }
    sec.append(cab, grid);
    cont.appendChild(sec);
  });

  $("estado").textContent = almacen.modo === "nube"
    ? "Sincronizado con la nube"
    : "Modo local: las tarjetas solo se guardan en este dispositivo.";
  $("btn-salir").hidden = almacen.modo !== "nube";
}

/* ------------------------------ TEMA ------------------------------ */
function abrirTema(n) {
  const b = bloqueDe(n);
  if (!b) { location.hash = ""; return; }
  if (temaActual !== n) {
    temaActual = n;
    modoEdicion = false;
    seleccion.clear();
    abiertas.clear();
    cerrarFormulario();
  }
  temaActual = n;
  $("tema-titulo").textContent = "Tema " + n;
  $("tema-bloque").textContent = (NOMBRES[n] ? NOMBRES[n] + " · " : "") + b.nombre;
  pintarLista();
  ver("vista-tema");
}

/* Muestra u oculta los controles según el modo (normal / edición) */
function aplicarModo() {
  const formAbierto = !$("form-card").hidden;
  const hayTarjetas = cuenta(temaActual) > 0;
  document.body.classList.toggle("modo-edicion", modoEdicion);
  $("btn-nueva").hidden = modoEdicion || formAbierto;
  $("btn-modo").hidden = !hayTarjetas && !modoEdicion;
  $("btn-modo").textContent = modoEdicion ? "Listo" : "Editar";
  $("btn-sel-todas").hidden = !modoEdicion;
  $("barra-edicion").hidden = !modoEdicion;
  actualizarBarra();
}

function actualizarBarra() {
  const n = seleccion.size;
  const total = cuenta(temaActual);
  $("barra-cuenta").textContent = n === 1 ? "1 seleccionada" : n + " seleccionadas";
  $("btn-editar-sel").disabled = n !== 1;
  $("btn-borrar-sel").disabled = n === 0;
  $("btn-sel-todas").textContent = n > 0 && n === total ? "Quitar selección" : "Seleccionar todas";
}

function pintarLista() {
  const cont = $("lista");
  cont.innerHTML = "";
  const tarjetas = datos[temaActual] || [];

  // Si se borraron tarjetas (aquí o desde otro dispositivo), limpia lo marcado
  const ids = new Set(tarjetas.map((c) => c.id));
  [...seleccion].forEach((id) => { if (!ids.has(id)) seleccion.delete(id); });
  if (tarjetas.length === 0) modoEdicion = false;

  if (tarjetas.length === 0) {
    cont.appendChild(el("div", "vacio-caja", "Este tema aún no tiene tarjetas. Pulsa «Añadir flashcard» para crear la primera."));
    aplicarModo();
    return;
  }

  tarjetas.forEach((c) => {
    const giro = el("div", "card-giro");
    giro.setAttribute("role", "button");
    giro.tabIndex = 0;

    const inner = el("div", "card-inner");
    const frente = el("div", "cara frente");
    frente.append(el("span", "card-q", c.pregunta), el("span", "card-pista", "Toca para girar"));
    const dorso = el("div", "cara dorso");
    dorso.append(el("span", "cara-etiqueta", "Respuesta"), el("span", "card-a", c.respuesta));
    inner.append(frente, dorso);

    const marca = el("span", "marca");
    marca.setAttribute("aria-hidden", "true");
    giro.append(inner, marca);

    const pintarEstado = () => {
      const girada = !modoEdicion && abiertas.has(c.id);
      const marcada = modoEdicion && seleccion.has(c.id);
      giro.classList.toggle("volteada", girada);
      giro.classList.toggle("seleccionada", marcada);
      if (modoEdicion) {
        giro.setAttribute("aria-pressed", String(marcada));
        giro.removeAttribute("aria-expanded");
      } else {
        giro.setAttribute("aria-expanded", String(girada));
        giro.removeAttribute("aria-pressed");
      }
      frente.setAttribute("aria-hidden", String(girada));
      dorso.setAttribute("aria-hidden", String(!girada));
    };

    const accionar = () => {
      const lista = modoEdicion ? seleccion : abiertas;
      if (lista.has(c.id)) lista.delete(c.id); else lista.add(c.id);
      pintarEstado();
      if (modoEdicion) actualizarBarra();
    };
    giro.addEventListener("click", accionar);
    giro.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); accionar(); }
    });

    pintarEstado();
    cont.appendChild(giro);
  });

  aplicarModo();
}

/* ------------------------- MODO EDICIÓN ------------------------- */
$("btn-modo").addEventListener("click", () => {
  modoEdicion = !modoEdicion;
  seleccion.clear();
  if (!$("form-card").hidden) cerrarFormulario();
  pintarLista();
});

$("btn-sel-todas").addEventListener("click", () => {
  const tarjetas = datos[temaActual] || [];
  if (seleccion.size === tarjetas.length) seleccion.clear();
  else tarjetas.forEach((c) => seleccion.add(c.id));
  pintarLista();
});

$("btn-editar-sel").addEventListener("click", () => {
  if (seleccion.size !== 1) return;
  const id = [...seleccion][0];
  const c = (datos[temaActual] || []).find((x) => x.id === id);
  if (!c) return;
  seleccion.clear();
  pintarLista();
  empezarEdicion(c);
});

$("btn-borrar-sel").addEventListener("click", () => {
  const n = seleccion.size;
  if (n === 0) return;
  const pregunta = n === 1 ? "¿Borrar esta flashcard?" : `¿Borrar ${n} flashcards?`;
  if (!confirm(pregunta)) return;
  const ids = [...seleccion];
  seleccion.clear();
  ids.forEach((id) => {
    abiertas.delete(id);
    almacen.borrar(id).catch(errorGuardar);
  });
  aviso(n === 1 ? "Flashcard borrada" : n + " flashcards borradas");
  pintarLista();
});

/* ------------------------ FORMULARIO DE TARJETAS ------------------------ */
function abrirFormulario() {
  $("form-card").hidden = false;
  aplicarModo();
  $("in-pregunta").focus();
}
function cerrarFormulario() {
  editandoId = null;
  $("form-card").reset();
  $("form-card").hidden = true;
  $("btn-guardar").textContent = "Guardar";
  aplicarModo();
}
function empezarEdicion(c) {
  editandoId = c.id;
  abrirFormulario();
  $("in-pregunta").value = c.pregunta;
  $("in-respuesta").value = c.respuesta;
  $("btn-guardar").textContent = "Guardar cambios";
  $("form-card").scrollIntoView({ behavior: "smooth", block: "start" });
}
function errorGuardar(e) {
  console.error(e);
  aviso("No se pudo guardar. Revisa la conexión y los permisos.");
}

$("btn-nueva").addEventListener("click", abrirFormulario);
$("btn-cancelar").addEventListener("click", cerrarFormulario);

$("form-card").addEventListener("submit", (e) => {
  e.preventDefault();
  const pregunta = $("in-pregunta").value.trim();
  const respuesta = $("in-respuesta").value.trim();
  if (!pregunta || !respuesta) { aviso("Escribe la pregunta y la respuesta."); return; }

  // No esperamos (await) a la nube: Firestore ya refleja el cambio en la app
  // al instante y lo sube en cuanto hay conexión.
  if (editandoId) {
    almacen.editar(editandoId, pregunta, respuesta).catch(errorGuardar);
    aviso("Cambios guardados");
    cerrarFormulario();
  } else {
    almacen.añadir(temaActual, pregunta, respuesta).catch(errorGuardar);
    aviso("Flashcard guardada");
    $("form-card").reset();          // el formulario sigue abierto para añadir la siguiente
    $("in-pregunta").focus();
  }
});

/* ------------------------------ SESIÓN ------------------------------ */
/* Traduce el código de error de Firebase a un mensaje útil */
function mensajeLogin(ex) {
  const code = (ex && ex.code) || "";
  const m = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/user-not-found": "No existe ningún usuario con ese correo en este proyecto de Firebase.",
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/operation-not-allowed": "El acceso con correo y contraseña no está activado en Firebase (Authentication > Método de acceso).",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication > Configuración > Dominios autorizados).",
    "auth/configuration-not-found": "Authentication no está iniciado en Firebase: pulsa «Comenzar» en Authentication.",
    "auth/invalid-api-key": "La apiKey de config.js no es válida. Vuelve a copiarla de la consola.",
    "auth/network-request-failed": "Sin conexión o bloqueado por la red.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    "auth/user-disabled": "Este usuario está deshabilitado en Firebase.",
  };
  return (m[code] || "Error al entrar.") + (code ? " (" + code + ")" : "");
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error");
  err.hidden = true;
  try {
    await almacen.login($("in-email").value.trim(), $("in-pass").value);
    $("in-pass").value = "";
  } catch (ex) {
    console.error(ex);
    err.textContent = mensajeLogin(ex);
    err.hidden = false;
  }
});
$("btn-salir").addEventListener("click", () => almacen.logout());
$("btn-volver").addEventListener("click", () => { location.hash = ""; });

/* ------------------------------ RUTAS ------------------------------ */
function enrutar() {
  if (!usuario) { ver("vista-login"); return; }
  const m = location.hash.match(/^#tema-(\d+)$/);
  if (m) { abrirTema(parseInt(m[1], 10)); return; }
  temaActual = null;
  modoEdicion = false;
  seleccion.clear();
  cerrarFormulario();
  pintarMenu();
  ver("vista-menu");
}
window.addEventListener("hashchange", enrutar);

function refrescar() {
  if (temaActual) pintarLista(); else if (!$("vista-menu").hidden) pintarMenu();
}

async function iniciar() {
  try {
    almacen = await crearAlmacen();
  } catch (e) {
    console.error(e);
    document.querySelector("main").textContent = "No se pudo cargar la app. Revisa js/config.js.";
    return;
  }
  almacen.sesion((u) => {
    usuario = u;
    if (u && !desuscribir) {
      desuscribir = almacen.suscribir((d) => { datos = d; refrescar(); });
    } else if (!u && desuscribir) {
      desuscribir(); desuscribir = null; datos = {};
    }
    enrutar();
  });
}
iniciar();
