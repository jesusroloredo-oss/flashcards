/* ======================================================================
   ALMACÉN DE DATOS
   Dos implementaciones con la misma interfaz:
     - Local  (localStorage): solo este dispositivo.
     - Nube   (Firebase Firestore): sincronizado entre dispositivos.
   app.js no sabe cuál usa: solo llama a sesion / suscribir / añadir /
   editar / borrar.
   ====================================================================== */
import { FIREBASE_CONFIG } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.14.1/";

/* Agrupa la lista plana de tarjetas por tema: { 2: [tarjeta, ...] } */
function agrupar(lista) {
  const porTema = {};
  for (const c of lista) {
    if (!porTema[c.tema]) porTema[c.tema] = [];
    porTema[c.tema].push(c);
  }
  for (const k in porTema) porTema[k].sort((a, b) => a.creada - b.creada);
  return porTema;
}

/* ---------------------------- LOCAL ---------------------------- */
function crearLocal() {
  const KEY = "flashcards-v1";
  let lista = [];
  let aviso = () => {};
  try { lista = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { lista = []; }

  const guardar = () => {
    try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch (e) {}
    aviso(agrupar(lista));
  };
  const nuevoId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));

  return {
    modo: "local",
    sesion(cb) { cb({ local: true }); return () => {}; },
    async login() {},
    async logout() {},
    suscribir(cb) { aviso = cb; cb(agrupar(lista)); return () => { aviso = () => {}; }; },
    async añadir(tema, pregunta, respuesta) {
      lista.push({ id: nuevoId(), tema, pregunta, respuesta, creada: Date.now() });
      guardar();
    },
    async editar(id, pregunta, respuesta) {
      const c = lista.find((x) => x.id === id);
      if (c) { c.pregunta = pregunta; c.respuesta = respuesta; guardar(); }
    },
    async borrar(id) {
      lista = lista.filter((x) => x.id !== id);
      guardar();
    },
  };
}

/* ----------------------------- NUBE ---------------------------- */
async function crearNube() {
  const [appMod, fs, au] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-firestore.js"),
    import(FB + "firebase-auth.js"),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);

  // Caché sin conexión: la app abre y deja añadir tarjetas aunque no haya
  // internet, y se sincroniza sola al recuperar la conexión.
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const auth = au.getAuth(app);
  const col = fs.collection(db, "flashcards");

  return {
    modo: "nube",
    sesion: (cb) => au.onAuthStateChanged(auth, cb),
    login: (email, pass) => au.signInWithEmailAndPassword(auth, email, pass),
    logout: () => au.signOut(auth),
    suscribir(cb) {
      return fs.onSnapshot(col, (snap) => {
        cb(agrupar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
      });
    },
    async añadir(tema, pregunta, respuesta) {
      await fs.addDoc(col, { tema, pregunta, respuesta, creada: Date.now() });
    },
    async editar(id, pregunta, respuesta) {
      await fs.updateDoc(fs.doc(db, "flashcards", id), { pregunta, respuesta });
    },
    async borrar(id) {
      await fs.deleteDoc(fs.doc(db, "flashcards", id));
    },
  };
}

export async function crearAlmacen() {
  const hayNube = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey;
  return hayNube ? crearNube() : crearLocal();
}
