/* ======================================================================
   CONFIGURACIÓN DE LA NUBE (Firebase)

   - Mientras FIREBASE_CONFIG sea null, la app funciona en modo LOCAL:
     las tarjetas se guardan solo en este navegador/dispositivo.
   - Para sincronizar entre dispositivos, pega aquí la configuración de
     tu proyecto de Firebase (ver instrucciones) y vuelve a subir el archivo.
   ====================================================================== */

   export const FIREBASE_CONFIG = {
     apiKey: "…",
     authDomain: "flashcards-pn.firebaseapp.com",
     projectId: "flashcards-pn",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "…"
   };

/* Ejemplo de cómo quedará:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "mi-proyecto.firebaseapp.com",
  projectId: "mi-proyecto",
  appId: "1:1234567890:web:abcdef"
};
*/
