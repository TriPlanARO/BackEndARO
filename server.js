import express from "express";
import { query } from "./conectarBD.js"; // conexión a Supabase/PostgreSQL
import bcrypt from "bcrypt";

const app = express();
app.use(express.json()); // para procesar JSON
const port = process.env.PORT || 10000;

//-------------------- PUNTOS --------------------

//-------------------- GET 
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

//-------------------- POST 
//Añadir punto 
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

//-------------------- PUT
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

//-------------------- DELETE
//Borrar punto de interés, borrando referencias de eventos y rutas
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


//-------------------- USUARIOS --------------------

//-------------------- GET 
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

// Obtener usuario por email
app.get("/usuarios/email/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const usuario = await query(
      "SELECT ID, NOMBRE_USUARIO, NOMBRE, APELLIDO, EMAIL, CONTRASENA, TELEFONO FROM usuarios WHERE email = $1",
      [email]
    );

    if (usuario.length === 0) {
      // No se encontró el ID
      return res.status(404).json({ error: `No se encontró el usuario con email ${email}` });
    } 

    res.json(usuario);
  } catch (err) {
    console.error("Error al seleccionar el usuario con email:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
});

//-------------------- POST
// Añadir usuario 
app.post("/usuarios", async (req, res) => {
  const { nombre_usuario, nombre, apellido, email, contraseña, telefono } = req.body;

  // Verificar campos obligatorios
  if (!nombre_usuario || !nombre || !apellido || !email || !contraseña || !telefono) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  
  try {
    // Verificar si ya existe el usuario o el email
    const existeUsuario = await query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );

    if (existeUsuario.length > 0) {
      return res.status(409).json({
        error: "El email ya está registrado"
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

//Comprobar credenciales login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuarios = await query("SELECT * FROM usuarios WHERE email = $1", [email]);
    if (usuarios.length === 0) return res.status(401).json({ error: "Email incorrecto" });

    const usuario = usuarios[0];
    const match = await bcrypt.compare(password, usuario.contrasena);
    if (!match) return res.status(401).json({ error: "Contraseña incorrecta" });

    res.json({ nombre: usuario.nombre, id: usuario.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

//-------------------- PUT

//Actualizar la contraseña de un usuario
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

//-------------------- DELETE
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


//-------------------- EVENTOS --------------------
//-------------------- GET 

// Obtener todos los eventos
app.get("/eventos", async (req, res) => {
  try {
    const eventos = await query(`
      SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.enlace,
        CASE
          WHEN e.punto_id IS NOT NULL THEN json_build_object(
            'id', p.id,
            'nombre', p.nombre,
            'tipo', p.tipo,
            'latitud', p.latitud,
            'longitud', p.longitud,
            'descripcion', p.descripcion,
            'imagen', p.imagen
          )
        END AS punto
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
      `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.enlace,
        CASE 
          WHEN e.punto_id IS NOT NULL THEN json_build_object(
            'id', p.id,
            'nombre', p.nombre,
            'tipo', p.tipo,
            'latitud', p.latitud,
            'longitud', p.longitud,
            'descripcion', p.descripcion,
            'imagen', p.imagen
          )
        END AS punto
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



// Obtener eventos por tipo
app.get("/eventos/tipo/:tipos", async (req, res) => {

  const tipos = req.params.tipos.split(',');

  if (tipos.length === 0) {
    return res.status(400).json({
      error: "Debe proporcionar al menos un tipo válido."
    });
  }

  try {
    const eventos = await query(
      `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.enlace,
              CASE
                WHEN e.punto_id IS NOT NULL THEN json_build_object(
                  'id', p.id,
                  'nombre', p.nombre,
                  'tipo', p.tipo,
                  'latitud', p.latitud,
                  'longitud', p.longitud,
                  'descripcion', p.descripcion,
                  'imagen', p.imagen
                )
              END AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      WHERE e.tipo = ANY($1)
      ORDER BY e.id`,
      [tipos]
    );


    res.json(eventos);
  } catch (err) {
    console.error("Error al consultar los eventos por tipo:", err);
    res.status(500).json({
      error: "Error en la base de datos",
      detalles: err.message
    });
  }
});

// Obtener eventos por nombre
app.get("/eventos/nombre/:nombre", async (req, res) => {
  const nombre = req.params.nombre;

  if (!nombre) {
    return res.status(400).json({
      error: "Debe proporcionar un nombre válido."
    });
  }

  try {
    const eventos = await query(
      `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.enlace,
              CASE
                WHEN e.punto_id IS NOT NULL THEN json_build_object(
                  'id', p.id,
                  'nombre', p.nombre,
                  'tipo', p.tipo,
                  'latitud', p.latitud,
                  'longitud', p.longitud,
                  'descripcion', p.descripcion,
                  'imagen', p.imagen
                )
              END AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      WHERE e.nombre ILIKE $1
      ORDER BY e.id`,
      [`%${nombre}%`] // búsqueda parcial, insensible a mayúsculas
    );

    res.json(eventos);
  } catch (err) {
    console.error("Error al consultar los eventos por nombre:", err);
    res.status(500).json({
      error: "Error en la base de datos",
      detalles: err.message
    });
  }
});

// Obtener eventos por fecha
app.get("/eventos/fecha/:fecha", async (req, res) => {
  const fecha = req.params.fecha;
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;

  if (!fecha || !regexFecha.test(fecha)) {
    return res.status(400).json({
      error: "Debe proporcionar una fecha válida (en formato YYYY-MM-DD)."
    });
  }


  const fechaObj = new Date(fecha);
  const fechaValida =
    fechaObj instanceof Date &&
    !isNaN(fechaObj) &&
    fechaObj.toISOString().startsWith(fecha);

  if (!fechaValida) {
    return res.status(400).json({
      error: "La fecha proporcionada no existe."
    });
  }

  try {
    const eventos = await query(
      `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.imagen, e.fecha_ini, e.fecha_fin, e.enlace,
              CASE
                WHEN e.punto_id IS NOT NULL THEN json_build_object(
                  'id', p.id,
                  'nombre', p.nombre,
                  'tipo', p.tipo,
                  'latitud', p.latitud,
                  'longitud', p.longitud,
                  'descripcion', p.descripcion,
                  'imagen', p.imagen
                )
              END AS punto
      FROM eventos e
      LEFT JOIN puntos_interes p ON e.punto_id = p.id
      WHERE $1::date BETWEEN e.fecha_ini::date AND COALESCE(e.fecha_fin::date, e.fecha_ini::date) 
      ORDER BY e.id`,
      [fecha] //COALESCE coge el primer valor no nulo, si el fin es null, comparará solo si la fecha ocurre el día de fecha_ini
    );

    res.json(eventos);
  } catch (err) {
    console.error("Error al consultar los eventos por fecha:", err);
    res.status(500).json({
      error: "Error en la base de datos",
      detalles: err.message
    });
  }
});


//-------------------- POST
// Añadir nuevo evento con fecha_fin opcional
app.post("/eventos", async (req, res) => {
  const { nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, enlace, punto_id } = req.body;

  // Validar campos obligatorios
  if (!nombre || !tipo || !fecha_ini) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  try {
    // Verificar si ya existe el evento
    const existeEvento = await query(
      "SELECT * FROM eventos WHERE nombre = $1 AND punto_id = $2 AND fecha_ini=$3 AND tipo=$4",
      [nombre, punto_id, fecha_ini, tipo]
    );

    if (existeEvento.length > 0) {
      return res.status(409).json({
        error: "El evento ya está registrado con el mismo nombre y punto en la fecha"
      });
    }
    // Insertar el evento
    const result = await query(
      `INSERT INTO eventos (nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id, enlace)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id`,
      [nombre, tipo, descripcion || null, imagen || null, fecha_ini, fecha_fin || null, punto_id || null, enlace || null]
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

//-------------------- PUT 
//Actualizar eventos
app.put("/eventos/:id/actualizar", async (req, res) => {
  const id = req.params.id; 
  const { nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id, enlace } = req.body; 
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

  if (enlace) {
    fieldsToUpdate.push('enlace = $' + (fieldsToUpdate.length + 1));
    values.push(enlace);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No se ha proporcionado ningún dato para actualizar" });
  }

  queryText += fieldsToUpdate.join(", ") + " WHERE id = $" + (fieldsToUpdate.length + 1)  + " RETURNING id, nombre, tipo, descripcion, imagen, fecha_ini, fecha_fin, punto_id, enlace";
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

//-------------------- DELETE 
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

//-------------------- RUTAS --------------------

//-------------------- GET 

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
//-------------------- POST 

// Añadir una nueva ruta con puntos, evitando duplicados y calculando duración
app.post("/rutas", async (req, res) => {
  const { nombre, descripcion, puntos } = req.body; // puntos es un array de IDs

  if (!nombre) return res.status(400).json({ error: "Falta el nombre de la ruta" });

  // Validación de puntos
  if (puntos && !Array.isArray(puntos)) {
    return res.status(400).json({ error: "Los puntos deben ser un array" });
  }

  try {
    // Verificar si ya existe una ruta con el mismo nombre
    const existeRuta = await query(
      "SELECT * FROM rutas WHERE nombre = $1",
      [nombre]
    );

    if (existeRuta.length > 0) {
      return res.status(409).json({
        error: "Ya existe una ruta con ese nombre",
        ruta_id: existeRuta[0].id
      });
    }

    // Crear la nueva ruta
    const resultRuta = await query(
      "INSERT INTO rutas (nombre, descripcion) VALUES ($1, $2) RETURNING *",
      [nombre, descripcion || null]
    );

    const nuevaRuta = resultRuta[0];

    if (puntos && puntos.length > 0) {
      await query("BEGIN");

      const añadidos = [];
      const duplicados = [];

      for (const punto_id of puntos) {
        // Verificar si ya existe la relación
        const existe = await query(
          "SELECT * FROM relacion_rutas_puntos WHERE ruta_id = $1 AND punto_id = $2",
          [nuevaRuta.id, punto_id]
        );

        if (existe.length > 0) {
          duplicados.push(punto_id);
        } else {
          await query(
            "INSERT INTO relacion_rutas_puntos (ruta_id, punto_id) VALUES ($1, $2)",
            [nuevaRuta.id, punto_id]
          );
          añadidos.push(punto_id);
        }
      }

      await query("COMMIT");

      // Actualizar duración total de la ruta recién creada
      const updateDuracionQuery = `
        UPDATE rutas
        SET duracion = ROUND(
          (
            WITH puntos_ruta AS (
                SELECT p.id, p.latitud, p.longitud
                FROM relacion_rutas_puntos rp
                JOIN puntos_interes p ON p.id = rp.punto_id
                WHERE rp.ruta_id = $1
            )
            SELECT SUM(min_dist)
            FROM (
                SELECT MIN(
                    haversine(p1.latitud, p1.longitud, p2.latitud, p2.longitud)
                ) AS min_dist
                FROM puntos_ruta p1
                JOIN puntos_ruta p2 ON p1.id <> p2.id
                GROUP BY p1.id
            ) sub
          ) / 5 * 60
        )
        WHERE id = $1
        RETURNING duracion;
      `;
      const duracionResult = await query(updateDuracionQuery, [nuevaRuta.id]);

      res.status(201).json({
        mensaje: "Ruta y puntos añadidos correctamente, duración calculada",
        ruta: {
          ...nuevaRuta,
          duracion: duracionResult[0].duracion
        },
        puntos_añadidos: añadidos,
        puntos_duplicados: duplicados
      });

    } else {
      res.status(201).json({
        mensaje: "Ruta añadida correctamente",
        ruta: nuevaRuta,
        puntos_asociados: [],
        duracion: 0
      });
    }

  } catch (err) {
    await query("ROLLBACK");
    console.error("Error al crear ruta y añadir puntos:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});


//Insertar uun punto a una ruta especifica (se actualiza su duracion sumandole el tiempo del punto añadido)
app.post("/rutas/:ruta_id/puntos", async (req, res) => {
  const { ruta_id } = req.params;
  const { punto_id } = req.body; 
  if (!punto_id) return res.status(400).json({ error: "Falta el id del punto" });

  try {
    // Obtener coordenadas del nuevo punto
    const nuevoPuntoResult = await query(
      "SELECT latitud, longitud FROM puntos_interes WHERE id = $1",
      [punto_id]
    );

    if (!nuevoPuntoResult || nuevoPuntoResult.length === 0) {
      return res.status(404).json({ error: "Punto no encontrado" });
    }

    const { latitud: lat_np, longitud: lon_np } = nuevoPuntoResult[0];

    // Insertar el nuevo punto en la ruta
    await query(
      "INSERT INTO relacion_rutas_puntos (ruta_id, punto_id) VALUES ($1, $2)",
      [ruta_id, punto_id]
    );

    // Actualizar la duración sumando el tiempo aproximado del nuevo punto
    const updateDuracionQuery = `
      UPDATE rutas
      SET duracion = duracion + ROUND(
        (
          SELECT MIN(haversine(p.latitud, p.longitud, $2, $3))
          FROM relacion_rutas_puntos rp
          JOIN puntos_interes p ON p.id = rp.punto_id
          WHERE rp.ruta_id = $1
        ) / 5 * 60
      )
      WHERE id = $1
      RETURNING duracion;
    `;

    const duracionResult = await query(updateDuracionQuery, [ruta_id, lat_np, lon_np]);

    res.status(201).json({
      mensaje: "Punto añadido y duración actualizada aproximadamente",
      ruta_id,
      punto_id,
      duracion: duracionResult[0].duracion
    });

  } catch (err) {
    console.error("Error al añadir punto y actualizar duración:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});



//-------------------- PUT 
//Actualizar rutas
app.put("/rutas/:id/actualizar", async (req, res) => {
  const { id } = req.params;
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
    return res.status(400).json({
      error: "No se ha proporcionado ningún dato para actualizar",
    });
  }

  values.push(id);

  const queryText = `
    UPDATE rutas
    SET ${fieldsToUpdate.join(", ")}
    WHERE id = $${values.length}
    RETURNING *;
  `;

  try {
    const result = await query(queryText, values);

    const rows = result.rows || result;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Ruta no encontrada" });
    }

    res.status(200).json({
      mensaje: "Ruta actualizada correctamente",
      ruta_actualizada: result[0],
    });

  } catch (err) {
   console.error("Error al actualizar el evento:", err);
    res.status(500).json({ 
      error: "Error en la base de datos",
      detalles: err.message 
    });
  }
  
});

// PUT /rutas/:id/actualizar-duracion
app.put("/rutas/:id/actualizar-duracion", async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: "Falta el id de la ruta" });

  try {
    // Actualizar la duracion usando Haversine y velocidad promedio 5 km/h
    const queryText = `
      UPDATE rutas
      SET duracion = ROUND(
        (
          WITH puntos_ruta AS (
              SELECT p.id, p.latitud, p.longitud
              FROM relacion_rutas_puntos rp
              JOIN puntos_interes p ON p.id = rp.punto_id
              WHERE rp.ruta_id = $1
          )
          SELECT SUM(min_dist)
          FROM (
              SELECT MIN(
                  haversine(p1.latitud, p1.longitud, p2.latitud, p2.longitud)
              ) AS min_dist
              FROM puntos_ruta p1
              JOIN puntos_ruta p2 ON p1.id <> p2.id
              GROUP BY p1.id
          ) sub
        ) / 5 * 60  -- velocidad promedio 5 km/h, minutos
      )
      WHERE id = $1
      RETURNING id, duracion;
    `;

    const result = await query(queryText, [id]);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: `Ruta con id ${id} no encontrada` });
    }

    res.json({
      mensaje: "Duración actualizada correctamente",
      ruta: result[0],
    });
  } catch (err) {
    console.error("Error al actualizar la duración de la ruta:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});


//-------------------- DELETE 

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

// Eliminar punto de todas las rutas y actualizar duracion
app.delete("/rutas/puntos/:id", async (req, res) => {
  const punto_id = req.params.id;

  try {
    // Obtener coordenadas del punto que se va a eliminar
    const puntoResult = await query(
      "SELECT latitud, longitud FROM puntos_interes WHERE id = $1",
      [punto_id]
    );

    if (!puntoResult || puntoResult.length === 0) {
      return res.status(404).json({ error: "Punto no encontrado" });
    }

    const { latitud: lat_np, longitud: lon_np } = puntoResult[0];

    // Obtener todas las rutas donde está este punto
    const rutasResult = await query(
      "SELECT ruta_id FROM relacion_rutas_puntos WHERE punto_id = $1",
      [punto_id]
    );

    if (!rutasResult || rutasResult.length === 0) {
      return res.status(404).json({ error: "El punto no está asociado a ninguna ruta" });
    }

    // Eliminar el punto de todas las rutas
    const deleted = await query(
      "DELETE FROM relacion_rutas_puntos WHERE punto_id = $1 RETURNING *",
      [punto_id]
    );

    // Actualizar duración aproximada de cada ruta restando el tiempo del punto eliminado
    for (const ruta of rutasResult) {
      const updateDuracionQuery = `
        UPDATE rutas
        SET duracion = GREATEST(duracion - ROUND(
          (
            SELECT MIN(haversine(p.latitud, p.longitud, $2, $3))
            FROM relacion_rutas_puntos rp
            JOIN puntos_interes p ON p.id = rp.punto_id
            WHERE rp.ruta_id = $1
          ) / 5 * 60
        ), 0)
        WHERE id = $1
        RETURNING duracion;
      `;
      await query(updateDuracionQuery, [ruta.ruta_id, lat_np, lon_np]);
    }

    res.status(200).json({
      mensaje: "Punto eliminado correctamente de todas las rutas y duración actualizada",
      punto_id,
      rutas_afectadas: rutasResult.map(r => r.ruta_id)
    });

  } catch (err) {
    console.error("Error al eliminar punto y actualizar duración:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});


// Eliminar un punto de una ruta específica y actualizar duración
app.delete("/rutas/:ruta_id/puntos/:punto_id", async (req, res) => {
  const { ruta_id, punto_id } = req.params;

  try {
    // Primero eliminar la relación
    const result = await query(
      "DELETE FROM relacion_rutas_puntos WHERE ruta_id = $1 AND punto_id = $2 RETURNING *",
      [ruta_id, punto_id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "No se encontró la relación ruta-punto" });
    }

    // Recalcular la duración de la ruta después de eliminar el punto
    const updateDuracionQuery = `
      UPDATE rutas
      SET duracion = ROUND(
        (
          WITH puntos_ruta AS (
              SELECT p.id, p.latitud, p.longitud
              FROM relacion_rutas_puntos rp
              JOIN puntos_interes p ON p.id = rp.punto_id
              WHERE rp.ruta_id = $1
          )
          SELECT SUM(min_dist)
          FROM (
              SELECT MIN(
                  haversine(p1.latitud, p1.longitud, p2.latitud, p2.longitud)
              ) AS min_dist
              FROM puntos_ruta p1
              JOIN puntos_ruta p2 ON p1.id <> p2.id
              GROUP BY p1.id
          ) sub
        ) / 5 * 60
      )
      WHERE id = $1
      RETURNING duracion;
    `;

    const duracionResult = await query(updateDuracionQuery, [ruta_id]);

    res.status(200).json({
      mensaje: "Punto eliminado y duración actualizada correctamente",
      ruta_id: result[0].ruta_id,
      punto_id: result[0].punto_id,
      duracion: duracionResult[0].duracion
    });

  } catch (err) {
    console.error("Error al eliminar punto de la ruta y actualizar duración:", err);
    res.status(500).json({ error: "Error en la base de datos", detalles: err.message });
  }
});




// -------------------- INICIAR SERVIDOR --------------------
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${port}`);
});
