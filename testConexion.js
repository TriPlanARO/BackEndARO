import { testConnection } from "./conectarBD.js";

testConnection()
  .then(ok => console.log(ok ? "✅ Conexión exitosa" : "❌ Conexión fallida"))
  .catch(err => console.error("Error:", err.message));