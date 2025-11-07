import express from "express";
import { query } from "./conectarBD.js"; // conexión a Supabase/PostgreSQL
import bcrypt from "bcrypt";

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
    console.error("Error al consultar la base de datos de puntos:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Obtener punto por ID
app.get("/puntos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await query(
      "SELECT ID, NOMBRE, TIPO, LATITUD, LONGITUD, DESCRIPCION, IMAGEN FROM puntos_interes WHERE ID = $1",
      [id]
    );

    if (result.length === 0) {
      // No se encontró el ID
      return res.status(404).json({ error: `No se encontró el punto con ID ${id}` });
    }

    res.json(result[0]); // Devolver solo el objeto
  } catch (err) {
    console.error("Error al seleccionar el punto de id:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});


// Obtener puntos por tipo
app.get("/puntos/tipo/:tipos", async (req, res) => {
  const tipos = req.params.tipos.split(',');  
  
  if (tipos.length === 0) {
    return res.status(400).json({
      error: "Debe proporcionar al menos un tipo válido."
    });
  }

  try {
    const puntos = await query(
      "SELECT ID, NOMBRE, TIPO, LATITUD, LONGITUD, DESCRIPCION, IMAGEN FROM puntos_interes WHERE TIPO = ANY($1)",
      [tipos]  
    );
    
    if (puntos.length === 0) {
      return res.status(404).json({
        error: "No se encontraron puntos para los tipos proporcionados",
        tipos
      });
    }

    res.json(puntos);
  } catch (err) {
    console.error("Error al consultar los puntos por tipo:", err);
    res.status(500).json({
      error: "Error en la base de datos",
      detalles: err.message
    });
  }
});

// Obtener puntos por nombre 
app.get("/puntos/nombre/:nombre", async (req, res) => {
  const nombre = req.params.nombre;
  try {
    const puntos = await query(
      "SELECT ID, NOMBRE, TIPO, LATITUD, LONGITUD, DESCRIPCION, IMAGEN FROM puntos_interes WHERE NOMBRE ILIKE $1",
      [`%${nombre}%`]  // `%` es para hacer una búsqueda parcial (LIKE en SQL)
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
    console.error("Error al consultar la base de datos de usuarios:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
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

    if (usuario.length === 0) {
      // No se encontró el ID
      return res.status(404).json({ error: `No se encontró el usuario con ID ${id}` });
    } 

    res.json(usuario);
  } catch (err) {
    console.error("Error al seleccionar el usuario con id:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// -------------------- RUTAS EVENTOS --------------------

// Obtener todos los eventos
app.get("/eventos", async (req, res) => {
  try {
    const eventos = await query(`
      SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, json_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'latitud', p.latitud, 'longitud', p.longitud, 'descripcion', p.descripcion, 'imagen', p.imagen) AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      ORDER BY e.id;
    `);
    res.json(eventos);
  } catch (err) {
    console.error("Error al consultar la base de datos de eventos:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Obtener evento por ID
app.get("/eventos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const evento = await query(
    `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, json_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'latitud', p.latitud, 'longitud', p.longitud, 'descripcion', p.descripcion, 'imagen', p.imagen) AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      WHERE e.id = $1
      ORDER BY e.id;`,
      [id]
    );

    if (evento.length === 0) {
      // No se encontró el ID
      return res.status(404).json({ error: `No se encontró el evento con ID ${id}` });
    }

    res.json(evento);
  } catch (err) {
    console.error("Error al seleccionar evento de id:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// -------------------- RUTAS --------------------

// Obtener todos las rutas
app.get("/rutas", async (req, res) => {
  try {
    const rutas = await query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'id', p.id, 
                  'nombre', p.nombre, 
                  'tipo', p.tipo, 
                  'latitud', p.latitud, 
                  'longitud', p.longitud, 
                  'descripcion', p.descripcion, 
                  'imagen', p.imagen
                )
              ) AS puntos_interes
       FROM rutas r
       LEFT JOIN relacion_rutas_puntos r2 ON r.id = r2.ruta_id
       LEFT JOIN puntos_interes p ON r2.punto_id = p.id
       GROUP BY r.id
       ORDER BY r.id ASC`
    );
    res.json(rutas);
  } catch (err) {
    console.error("Error al consultar la base de datos de rutas:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Obtener una ruta por ID
app.get("/rutas/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'id', p.id, 
                  'nombre', p.nombre, 
                  'tipo', p.tipo, 
                  'latitud', p.latitud, 
                  'longitud', p.longitud, 
                  'descripcion', p.descripcion, 
                  'imagen', p.imagen
                )
              ) AS puntos_interes
       FROM rutas r
       LEFT JOIN relacion_rutas_puntos r2 ON r.id = r2.ruta_id
       LEFT JOIN puntos_interes p ON r2.punto_id = p.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id]
    );

    if (result.length === 0) {
      // No se encontró el ID
      return res.status(404).json({ error: `No se encontró la ruta con ID ${id}` });
    }

    res.json(result[0]); // Devolver solo el objeto
  } catch (err) {
    console.error("Error al seleccionar la ruta de id:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});


//---------------------POSTS ----------------------

//Añadir puntos con POST
app.post("/puntos", async (req, res) => {
  const { nombre, tipo, latitud, longitud, descripcion, imagen } = req.body;

  // Validar campos obligatorios
  if (!nombre || !tipo || latitud === undefined || longitud === undefined) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Insertar el punto de interés
    const result = await query(
      `INSERT INTO puntos_interes (nombre, tipo, latitud, longitud, descripcion, imagen)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, tipo, latitud, longitud, descripcion, imagen`,
      [nombre, tipo, latitud, longitud, descripcion || null, imagen || null]
    );

    res.status(201).json({
      mensaje: "Punto de interés añadido correctamente",
      punto: result[0],
    });
  } catch (err) {
    console.error("Error al insertar el punto:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Añadir un nuevo tipo de punto (tipo_enum)
app.post("/puntos/tipo", async (req, res) => {
  const { nuevoTipo } = req.body;

  // Validar campo obligatorio
  if (!nuevoTipo) {
    return res.status(400).json({ error: "Debe enviar el nuevo tipo" });
  }

  if (!/^[a-zA-Z0-9]+$/.test(nuevoTipo)) {
    return res.status(400).json({ error: "Tipo inválido" });
  }

  try {
    // Insertar el nuevo tipo en el enum
    await query(`ALTER TYPE tipo_enum ADD VALUE IF NOT EXISTS '${nuevoTipo}'`);

    res.status(201).json({
      mensaje: `Tipo '${nuevoTipo}' añadido correctamente`,
      tipo: nuevoTipo
    });
  } catch (err) {
    console.error("Error al añadir el tipo:", err);
    res.status(500).json({
      error: "Error en la base de datos",
      detalles: err.message
    });
  }
});


app.post("/rutas", async (req, res) => {
  const { nombre, descripcion, puntos } = req.body; // puntos es un array de IDs de los puntos
  if (!nombre) return res.status(400).json({ error: "Falta el nombre de la ruta" });

  // Validación de que los puntos sean un array y que contengan al menos un punto
  if (puntos && !Array.isArray(puntos)) {
    return res.status(400).json({ error: "Los puntos deben ser un array" });
  }

  if (puntos && puntos.length === 0) {
    return res.status(400).json({ error: "Debe haber al menos un punto asociado a la ruta" });
  }

  try {

    const resultRuta = await query(
      "INSERT INTO rutas (nombre, descripcion, fecha_creacion) VALUES ($1, $2, NOW()) RETURNING *",
      [nombre, descripcion || null]
    );

    const nuevaRuta = resultRuta[0];
    await query("BEGIN");

    for (let i = 0; i < puntos.length; i++) {
      const punto_id = puntos[i];
      const orden = i + 1; 

      await query(
        "INSERT INTO relacion_rutas_puntos (ruta_id, punto_id, orden) VALUES ($1, $2, $3)",
        [nuevaRuta.id, punto_id, orden]
      );
    }

    await query("COMMIT");

    res.status(201).json({
      mensaje: "Ruta y puntos añadidos correctamente",
      ruta: nuevaRuta,
      puntos_asociados: puntos || []
    });

  } catch (err) {
    await query("ROLLBACK");
    console.error("Error al crear ruta y añadir puntos:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});


// Añadir usuario con POST
app.post("/usuarios", async (req, res) => {
  const { nombre_usuario, nombre, apellido, email, contraseña, telefono } = req.body;

  // Verificar campos obligatorios
  if (!nombre_usuario || !nombre || !apellido || !email || !contraseña || !telefono) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  
  try {
    // Verificar si ya existe el usuario o el email
    const existeUsuario = await query(
      "SELECT * FROM usuarios WHERE nombre_usuario = $1",
      [nombre_usuario]
    );

    if (existeUsuario.length > 0) {
      return res.status(409).json({
        error: "El nombre de usuario ya está registrado"
      });
    }

    const saltRounds = 10; // número de rondas de hashing
    const hashedPassword = await bcrypt.hash(contraseña, saltRounds);

    // Insertar en la base de datos
    const result = await query(
      `INSERT INTO usuarios (nombre_usuario, nombre, apellido, email, contrasena, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre_usuario, nombre, apellido, email, contrasena, telefono`,
      [nombre_usuario, nombre, apellido, email, hashedPassword, telefono]
    );

    res.status(201).json({
      mensaje: "Usuario añadido correctamente",
      usuario: result[0],
    });
  } catch (err) {
    console.error("Error al insertar el usuario:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Añadir nuevo evento (POST) con fecha_fin opcional
app.post("/eventos", async (req, res) => {
  const { nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id } = req.body;

  // Validar campos obligatorios
  if (!nombre || !tipo || !fecha_ini) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Insertar el evento
    const result = await query(
      `INSERT INTO eventos (nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id`,
      [nombre, tipo, descripcion || null, imagen || null, fecha_ini, fecha_fin || null, punto_id || null]
    );

    res.status(201).json({
      mensaje: "Evento añadido correctamente",
      evento: result[0],
    });
  } catch (err) {
    console.error("Error al insertar el evento:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//--------------------- DELETES ----------------------
//Borrar punto de interés
app.delete("/puntos/:id", async (req, res) => {
  const id = req.params.id;

  try {

    await query("DELETE FROM eventos WHERE punto_id = $1", [id]);
    
    await query("DELETE FROM relacion_rutas_puntos WHERE punto_id = $1", [id]);
    
    const result = await query(
      "DELETE FROM puntos_interes WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.length === 0){
      return res.status(404).json({ error: "Punto de interés no encontrado" });
    }

    res.status(200).json({
      mensaje: "Punto eliminado correctamente",
      punto_id: result[0].id,
    });
  } catch (err) {
    console.error("Error al eliminar el punto:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

// Eliminar ruta
app.delete("/rutas/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await query(
      "DELETE FROM relacion_rutas_puntos WHERE ruta_id = $1 ",
      [id]
    );
    const result = await query(
      "DELETE FROM rutas WHERE id = $1 RETURNING *",
       [id]
    );
    if (result.length === 0) {
      return res.status(404).json({ error: "Ruta no encontrada" });
    }
    res.status(200).json({
      mensaje: "Ruta eliminada correctamente",
      ruta_id: result[0].id,
    });
  } catch (err) {
    console.error("Error al eliminar ruta:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
       detalles: err.message 
    });
  }
});



//Borrar evento
app.delete("/eventos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await query(
      "DELETE FROM eventos WHERE ID = $1 RETURNING ID",
      [id]
    );

    if (result.length === 0){
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    res.status(200).json({
      mensaje: "Evento eliminado correctamente",
      evento_id: result[0].id,
    });
  } catch (err) {
    console.error("Error al eliminar el evento:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//Borrar usuario
app.delete("/usuarios/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await query(
      "DELETE FROM usuarios WHERE ID = $1 RETURNING ID",
      [id]
    );

    if (result.length === 0){
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.status(200).json({
      mensaje: "Usuario eliminado correctamente",
      usuario_id: result[0].id,
    });
  } catch (err) {
    console.error("Error al eliminar el usuario:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//--------------------- UPDATES ----------------------
//Actualizar puntos de interés
app.put("/puntos/:id/actualizar", async (req, res) => {
  const id = req.params.id; 
  const { nombre, tipo, latitud, longitud, descripcion, imagen } = req.body; 
  const fieldsToUpdate = [];
  const values = [];

  let queryText = "UPDATE puntos_interes SET ";

  if (nombre) {
    fieldsToUpdate.push('nombre = $' + (fieldsToUpdate.length + 1));
    values.push(nombre);
  }

  if (tipo) {
    fieldsToUpdate.push('tipo = $' + (fieldsToUpdate.length + 1));
    values.push(tipo);
  }

  if (latitud) {
    fieldsToUpdate.push('latitud = $' + (fieldsToUpdate.length + 1));
    values.push(latitud);
  }

  if (longitud) {
    fieldsToUpdate.push('longitud = $' + (fieldsToUpdate.length + 1));
    values.push(longitud);
  }
  
  if (descripcion) {
    fieldsToUpdate.push('descripcion = $' + (fieldsToUpdate.length + 1));
    values.push(descripcion);
  }

  if (imagen) {
    fieldsToUpdate.push('imagen = $' + (fieldsToUpdate.length + 1));
    values.push(imagen);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  queryText += fieldsToUpdate.join(", ") + " WHERE id = $" + (fieldsToUpdate.length + 1)  + " RETURNING id, nombre, tipo, latitud, longitud, descripcion, imagen ";
  values.push(id);


  try {

    const result = await query(queryText, values);

    if (result.length === 0) {
      return res.status(404).json({ error: "Punto no encontrado" });
    }

    res.status(200).json({
      mensaje: "Punto actualizado correctamente",
      punto: result[0],
    });
  } catch (err) {
    console.error("Error al actualizar el punto:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//actualizar informacion de una ruta especifica
app.put("/rutas/:id/actualizar", async (req, res) => {
  const id = req.params.id;
  const { nombre, descripcion } = req.body;
  const fieldsToUpdate = [];
  const values = [];

  if (nombre) {
    fieldsToUpdate.push('nombre = $' + (fieldsToUpdate.length + 1));
    values.push(nombre);
  }

  if (descripcion) {
    fieldsToUpdate.push('descripcion = $' + (fieldsToUpdate.length + 1));
    values.push(descripcion);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  const queryText = "UPDATE rutas SET " + fieldsToUpdate.join(", ") + 
                    " WHERE id = $" + (fieldsToUpdate.length + 1) + " RETURNING id, nombre, descripcion, fecha_creacion";
  values.push(id);

  try {
    const result = await query(queryText, values);
    if (result.length === 0) {
      return res.status(404).json({ error: "Ruta no encontrada" });
    }
    res.status(200).json({ mensaje: "Ruta actualizada correctamente", ruta: result[0] });
  } catch (err) {
    console.error("Error al actualizar ruta:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});

//actualizar punto de una ruta
app.put("/relacion_rutas_puntos/:ruta_id/:punto_id", async (req, res) => {
  const { ruta_id, punto_id } = req.params;
  const { nuevo_ruta_id, nuevo_punto_id, orden } = req.body; // nuevos valores opcionales
  const fieldsToUpdate = [];
  const values = [];

  if (nuevo_ruta_id) {
    fieldsToUpdate.push('ruta_id = $' + (fieldsToUpdate.length + 1));
    values.push(nuevo_ruta_id);
  }

  if (nuevo_punto_id) {
    fieldsToUpdate.push('punto_id = $' + (fieldsToUpdate.length + 1));
    values.push(nuevo_punto_id);
  }

  if (orden !== undefined) {
    fieldsToUpdate.push('orden = $' + (fieldsToUpdate.length + 1));
    values.push(orden);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  // Condición para encontrar la fila original
  const queryText = "UPDATE relacion_rutas_puntos SET " + fieldsToUpdate.join(", ") +
                    " WHERE ruta_id = $" + (fieldsToUpdate.length + 1) +
                    " AND punto_id = $" + (fieldsToUpdate.length + 2) +
                    " RETURNING ruta_id, punto_id, orden";
  values.push(ruta_id, punto_id);

  try {
    const result = await query(queryText, values);
    if (result.length === 0) {
      return res.status(404).json({ error: "Relación no encontrada" });
    }
    res.status(200).json({ mensaje: "Relación actualizada correctamente", relacion: result[0] });
  } catch (err) {
    console.error("Error al actualizar relación:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});



//Actualizar eventos
app.put("/eventos/:id/actualizar", async (req, res) => {
  const id = req.params.id; 
  const { nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id } = req.body; 
  const fieldsToUpdate = [];
  const values = [];

  let queryText = "UPDATE eventos SET ";

  if (nombre) {
    fieldsToUpdate.push('nombre = $' + (fieldsToUpdate.length + 1));
    values.push(nombre);
  }

  if (tipo) {
    fieldsToUpdate.push('tipo = $' + (fieldsToUpdate.length + 1));
    values.push(tipo);
  }
  
  if (descripcion) {
    fieldsToUpdate.push('descripcion = $' + (fieldsToUpdate.length + 1));
    values.push(descripcion);
  }

  if (imagen) {
    fieldsToUpdate.push('imagen = $' + (fieldsToUpdate.length + 1));
    values.push(imagen);
  }
  
  if (fecha_ini) {
    fieldsToUpdate.push('fecha_ini = $' + (fieldsToUpdate.length + 1));
    values.push(fecha_ini);
  }

  if (fecha_fin) {
    fieldsToUpdate.push('fecha_fin = $' + (fieldsToUpdate.length + 1));
    values.push(fecha_fin);
  }

  if (punto_id) {
    fieldsToUpdate.push('punto_id = $' + (fieldsToUpdate.length + 1));
    values.push(punto_id);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  queryText += fieldsToUpdate.join(", ") + " WHERE id = $" + (fieldsToUpdate.length + 1)  + " RETURNING id, nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id";
  values.push(id);


  try {

    const result = await query(queryText, values);

    if (result.length === 0) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    res.status(200).json({
      mensaje: "Evento actualizado correctamente",
      evento: result[0],
    });
  } catch (err) {
    console.error("Error al actualizar el evento:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }

});


//Update de la contraseña de un usuario
app.put("/usuarios/:id/cambiar-contrasena", async (req, res) => {
  const id = req.params.id; 
  const { nueva_contraseña, vieja_contraseña } = req.body; 

  if (!nueva_contraseña || !vieja_contraseña) {
    return res.status(400).json({ error: "Hay que añadir tanto la nueva como la vieja contraseña" });
  }

  try {

    const result = await query("SELECT contrasena FROM usuarios WHERE id = $1", [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const match = await bcrypt.compare(vieja_contraseña, result[0].contrasena);

    if (!match) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }
    const saltRounds = 10; 
    const hashedPassword = await bcrypt.hash(nueva_contraseña, saltRounds);

    const resultUpdate = await query(
      "UPDATE usuarios SET contrasena = $1 WHERE id = $2 RETURNING id, nombre_usuario, nombre, apellido, email, telefono",
      [hashedPassword, id]
    );

    if (resultUpdate.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json({
      mensaje: "Contraseña actualizada correctamente",
      usuario: resultUpdate[0],
    });
  } catch (err) {
    console.error("Error al actualizar contraseña del usuario:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//Actualizar cualquier campo de usuarios
app.put("/usuarios/:id/actualizar", async (req, res) => {
  const id = req.params.id; 
  const { nombre_usuario, nombre, apellido, email, telefono } = req.body; 

  const fieldsToUpdate = [];
  const values = [];

  let queryText = "UPDATE usuarios SET ";

  if (nombre_usuario) {
    fieldsToUpdate.push('nombre_usuario = $' + (fieldsToUpdate.length + 1));
    values.push(nombre_usuario);
  }

  if (nombre) {
    fieldsToUpdate.push('nombre = $' + (fieldsToUpdate.length + 1));
    values.push(nombre);
  }

  if (apellido) {
    fieldsToUpdate.push('apellido = $' + (fieldsToUpdate.length + 1));
    values.push(apellido);
  }

  if (email) {
    fieldsToUpdate.push('email = $' + (fieldsToUpdate.length + 1));
    values.push(email);
  }

  if (telefono) {
    fieldsToUpdate.push('telefono = $' + (fieldsToUpdate.length + 1));
    values.push(telefono);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  queryText += fieldsToUpdate.join(", ") + " WHERE id = $" + (fieldsToUpdate.length + 1)  + " RETURNING id, nombre_usuario, nombre, apellido, email, telefono";
  values.push(id);


  try {

    const result = await query(queryText, values);

    if (result.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json({
      mensaje: "Usuario actualizado correctamente",
      usuario: result[0],
    });
  } catch (err) {
    console.error("Error al actualizar el usuario:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});



// -------------------- INICIAR SERVIDOR --------------------
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
