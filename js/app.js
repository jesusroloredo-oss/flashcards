/* ======================================================================
   LÓGICA DE LA INTERFAZ: menú, pantalla de tema y alta de flashcards.
   ====================================================================== */
import { BLOQUES, NOMBRES, bloqueDe } from "./temas.js";
import { crearAlmacen } from "./storage.js";

const $ = (id) => document.getElementById(id);

let almacen = null;
let usuario = null;          // null = sin sesión (solo en modo nube)
let desuscribir = null;
let datos = {};              // { tema: [tarjetas] }
let temaActual = null;
let editandoId = null;
const abiertas = new Set();  // tarjetas con la respuesta visible

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
  if (temaActual !== n) { cerrarFormulario(); abiertas.clear(); }
  temaActual = n;
  $("tema-titulo").textContent = "Tema " + n;
  $("tema-bloque").textContent = (NOMBRES[n] ? NOMBRES[n] + " · " : "") + b.nombre;
  pintarLista();
  ver("vista-tema");
}

function pintarLista() {
  const cont = $("lista");
  cont.innerHTML = "";
  const tarjetas = datos[temaActual] || [];

  if (tarjetas.length === 0) {
    cont.appendChild(el("div", "vacio-caja", "Este tema aún no tiene tarjetas. Pulsa «Añadir flashcard» para crear la primera."));
    return;
  }

  tarjetas.forEach((c) => {
    const art = el("article", "card");

    const cuerpo = el("button", "card-cuerpo");
    cuerpo.append(el("span", "card-q", c.pregunta));
    const respuesta = el("div", "card-a", c.respuesta);
    const pista = el("span", "card-pista", "Toca para ver la respuesta");
    const mostrar = (si) => {
      respuesta.hidden = !si;
      pista.hidden = si;
      cuerpo.setAttribute("aria-expanded", String(si));
    };
    mostrar(abiertas.has(c.id));
    cuerpo.addEventListener("click", () => {
      if (abiertas.has(c.id)) abiertas.delete(c.id); else abiertas.add(c.id);
      mostrar(abiertas.has(c.id));
    });
    cuerpo.append(pista, respuesta);

    const acciones = el("div", "card-acciones");
    const bEditar = el("button", "", "Editar");
    const bBorrar = el("button", "", "Borrar");
    bEditar.addEventListener("click", () => empezarEdicion(c));
    bBorrar.addEventListener("click", () => {
      if (confirm("¿Borrar esta flashcard?")) {
        almacen.borrar(c.id).catch(errorGuardar);
        aviso("Flashcard borrada");
      }
    });
    acciones.append(bEditar, bBorrar);

    art.append(cuerpo, acciones);
    cont.appendChild(art);
  });
}

/* ------------------------ FORMULARIO DE TARJETAS ------------------------ */
function abrirFormulario() {
  $("form-card").hidden = false;
  $("btn-nueva").hidden = true;
  $("in-pregunta").focus();
}
function cerrarFormulario() {
  editandoId = null;
  $("form-card").reset();
  $("form-card").hidden = true;
  $("btn-nueva").hidden = false;
  $("btn-guardar").textContent = "Guardar";
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
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "La apiKey de config.js no es válida. Vuelve a copiarla de la consola.",
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
