import express from "express";
import { query } from "./conectarBD.js"; // conexión a Supabase/PostgreSQL

const app = express();
app.use(express.json()); // para procesar JSON
const port = process.env.PORT || 10000;

// -------------------- RUTAS PUNTOS --------------------

// Obtener todos los puntos de interés
app.get("/puntos", async (req, res) => {
  try {
    const puntos = await query(
      "SELECT ID, NOMBRE, TIPO, LATITUD , LONGITUD, DESCRIPCION, IMAGEN FROM puntos_interes"
    );
    res.json(puntos);
  } catch (err) {
    console.error("Error al consultar la BD:", err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener punto por ID
app.get("/puntos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await query(
      "SELECT ID, NOMBRE, TIPO,  LATITUD , LONGITUD, DESCRIPCION, IMAGEN FROM puntos_interes WHERE ID = $1",
      [id]
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener puntos por tipo
app.get("/puntos/tipo/:tipo", async (req, res) => {
  const tipo = req.params.tipo;
  try {
    const puntos = await query(
      "SELECT ID, NOMBRE, TIPO,  LATITUD , LONGITUD, DESCRIPCION FROM puntos_interes WHERE TIPO = $1",
      [tipo]
    );
    res.json(puntos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// -------------------- RUTAS USUARIOS --------------------

// Obtener todos los usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await query(
      "SELECT ID, NOMBRE_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, TELEFONO FROM usuarios"
    );
    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener usuario por ID
app.get("/usuarios/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const usuario = await query(
      "SELECT ID, NOMBRE_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, TELEFONO FROM usuarios WHERE ID = $1",
      [id]
    );
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// -------------------- RUTAS EVENTOS --------------------

// Obtener todos los eventos
app.get("/eventos", async (req, res) => {
  try {
    const eventos = await query(`
      SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.punto_id, json_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'latitud', p.latitud, 'longitud', p.longitud, 'descripcion', p.descripcion, 'imagen', p.imagen) AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      ORDER BY e.id;
    `);
    res.json(eventos);
  } catch (err) {
    console.error("Error al consultar la BD:", err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// Obtener evento por ID
app.get("/eventos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const evento = await query(
      "SELECT ID, NOMBRE, TIPO, DESCRIPCION, IMAGEN, FECHA_INI, FECHA_FIN, PUNTO_ID FROM eventos WHERE ID = $1",
      [id]
    );
    res.json(evento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

//---------------------POSTS ----------------------

//Añadir puntos con POST
app.post("/puntos", async (req, res) => {
  const { nombre, tipo, latitud, longitud, descripcion } = req.body;

  // Validar campos obligatorios
  if (!nombre || !tipo || latitud === undefined || longitud === undefined) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Insertar el punto de interés
    const result = await query(
      `INSERT INTO puntos_interes (nombre, tipo, latitud, longitud, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, tipo, latitud, longitud, descripcion`,
      [nombre, tipo, latitud, longitud, descripcion || null]
    );

    res.status(201).json({
      mensaje: "Punto de interés añadido correctamente",
      punto: result[0],
    });
  } catch (err) {
    console.error("Error al insertar punto:", err);
    res.status(500).json({ error: "Error al insertar punto de interés" });
  }
});


// Añadir usuario con POST
app.post("/usuarios", async (req, res) => {
  const { nombre_usuario, nombre, apellido, email, contraseña, telefono } = req.body;

  // Verificar campos obligatorios
  if (!nombre_usuario || !nombre || !apellido || !email || !contraseña) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Insertar en la base de datos
    const result = await query(
      `INSERT INTO usuarios (nombre_usuario, nombre, apellido, email, contrasena, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre_usuario, nombre, apellido, email, telefono`,
      [nombre_usuario, nombre, apellido, email, contraseña, telefono || null]
    );

    res.status(201).json({
      mensaje: "Usuario añadido correctamente",
      usuario: result[0],
    });
  } catch (err) {
    console.error("Error al insertar usuario:", err);
    res.status(500).json({ error: "Error al insertar usuario" });
  }
});

// Añadir nuevo evento (POST) con fecha_fin opcional
app.post("/eventos", async (req, res) => {
  const { nombre, tipo, coordenadas, descripcion, imagen, fecha_ini, fecha_fin } = req.body;

  // Validar campos obligatorios
  if (!nombre || !tipo || !coordenadas || !fecha_ini) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Insertar el evento
    const result = await query(
      `INSERT INTO eventos (nombre, tipo, coordenadas, descripcion, imagen, fecha_ini, fecha_fin)
       VALUES ($1, $2, ST_GeographyFromText($3), $4, $5, $6, $7)
       RETURNING id, nombre, tipo, coordenadas::text AS coordenadas, descripcion, imagen, fecha_ini, fecha_fin`,
      [nombre, tipo, coordenadas, descripcion || null, imagen || null, fecha_ini, fecha_fin || null]
    );

    res.status(201).json({
      mensaje: "Evento añadido correctamente",
      evento: result[0],
    });
  } catch (err) {
    console.error("Error al insertar evento:", err);
    res.status(500).json({ error: "Error al insertar evento" });
  }
});


// -------------------- INICIAR SERVIDOR --------------------
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
