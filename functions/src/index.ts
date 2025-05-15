import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Configure Express app
const app = express();
app.use(express.json());

// Health check endpoint (public)
app.get('/', (req: Request, res: Response) => {
  return res.status(200).send('OK');
});

// User registration endpoint (public)
app.post('/register', async (req: Request, res: Response) => {
  // 1. Basic input validation
  const { email, password, name, username, phoneNumber } = req.body as {
    email: string;
    password: string;
    name: string;
    username: string;
    phoneNumber: string;
  };
  
  if (!email || !password || !name || !username || !phoneNumber) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Formato de email inválido' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  // 2. Check for duplicates
  const existing = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    return res.status(409).json({ message: 'El usuario ya existe' });
  }

  let uid: string | null = null;
  try {
    // 3. Create in Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    uid = userRecord.uid;

    // 4. Save to Firestore
    await db.collection('users').doc(uid).set({
      email,
      name,
      username,
      phoneNumber,
      state: 'active',
      creation_date: admin.firestore.FieldValue.serverTimestamp(),
      last_access: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Respond without token; client will handle login
    return res.status(201).json({
      message: 'Usuario creado correctamente',
      user: { uid, email, name, username, phoneNumber }
    });

  } catch (err: any) {
    console.error('Error en /register:', err);

    // 6. Rollback in case of partial failure
    if (uid) {
      try {
        await admin.auth().deleteUser(uid);
        await db.collection('users').doc(uid).delete();
      } catch (cleanupErr) {
        console.error('Error limpiando datos tras fallo de registro:', cleanupErr);
      }
    }

    // 7. Generic error handling
    const isAuthConflict = err.code === 'auth/email-already-exists';
    return res.status(isAuthConflict ? 409 : 500).json({
      message: isAuthConflict
        ? 'El email ya está registrado'
        : err.message || 'Error interno al registrar usuario'
    });
  }
});
// Eliminar tarjeta NFC del usuario
app.delete('/tarjetas/:nfc_uid', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { nfc_uid } = req.params;

    if (!uid) {
      return res.status(401).json({ message: 'No autorizado: UID no encontrado' });
    }

    if (!nfc_uid) {
      return res.status(400).json({ message: 'nfc_uid es requerido' });
    }

    const tarjetaRef = db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid);

    const tarjetaSnap = await tarjetaRef.get();

    if (!tarjetaSnap.exists) {
      return res.status(404).json({ message: 'Tarjeta no encontrada' });
    }

    // Eliminar transacciones asociadas (si existen)
    const transaccionesSnap = await tarjetaRef.collection('transacciones').get();
    const batch = db.batch();

    transaccionesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    batch.delete(tarjetaRef);

    await batch.commit();

    return res.status(200).json({ message: 'Tarjeta eliminada exitosamente' });
  } catch (error: any) {
    console.error('Error en DELETE /tarjetas/:nfc_uid:', error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});


// User login endpoint (public)
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { 
      email: string; 
      password: string 
    };

    // Validate required data
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Verify credentials with Firebase Auth REST API
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('Firebase API key no configurada');
    }
    
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    const uid = data.localId;

    // Verify if user exists in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new Error('Usuario no encontrado en la base de datos');
    }

    // Update last_access in Firestore
    await db.collection('users').doc(uid).update({
      last_access: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userData = userDoc.data();

    return res.json({ 
      token: data.idToken, 
      user: { 
        uid, 
        email: data.email,
        name: userData?.name,
        username: userData?.username,
        phoneNumber: userData?.phoneNumber
      } 
    });
  } catch (error: any) {
    console.error('Error en /login:', error);
    return res.status(401).json({ 
      message: error.message || 'Error al iniciar sesión' 
    });
  }
});

// Authentication middleware for protected routes
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header faltante o inválido' });
  }
  
  const idToken = auth.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    // Type assertion to add uid to request object
    (req as any).uid = decoded.uid;
    return next();
  } catch (err) {
    console.error('Token inválido:', err);
    return res.status(401).json({ message: 'Token inválido' });
  }
};

// Apply authentication middleware to all /tarjetas routes
app.use('/tarjetas', authMiddleware);

// Registrar una tarjeta NFC en la colección del usuario
app.post('/tarjetas/registrar', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { nfc_uid, sobrenombre, estado, saldo } = req.body;

    if (!nfc_uid || !sobrenombre || estado == null || saldo == null) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    const tarjetaRef = db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid);

    const tarjetaDoc = await tarjetaRef.get();

    if (tarjetaDoc.exists) {
      return res.status(409).json({ message: 'Esta tarjeta ya fue registrada por este usuario' });
    }

    // Busca si esta tarjeta está registrada por otro usuario
    const snapshot = await db.collectionGroup('tarjetas')
      .where(admin.firestore.FieldPath.documentId(), '==', nfc_uid)
      .get();

    if (!snapshot.empty) {
      return res.status(403).json({ message: 'Esta tarjeta ya fue registrada por otro usuario' });
    }

    await tarjetaRef.set({
      sobrenombre,
      estado,
      saldo,
      creada: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: 'Tarjeta registrada exitosamente' });
  } catch (error: any) {
    console.error('Error en /tarjetas/registrar:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});



// 2. Get all cards for a user
app.get('/tarjetas', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .get();
      
    const tarjetas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ tarjetas });
  } catch (error: any) {
    console.error('Error en /tarjetas:', error);
    return res.status(500).json({ message: error.message });
  }
});
app.get('/tarjetas/transacciones', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;  // Obtener el UID del usuario desde el token de autenticación

    // Consulta a la colección de tarjetas del usuario
    const tarjetasSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .get();

    // Si no se encuentran tarjetas para el usuario
    if (tarjetasSnapshot.empty) {
      return res.status(404).json({ message: 'No se encontraron tarjetas para este usuario' });
    }

    // Obtener las transacciones de cada tarjeta
    const transaccionesPromises = tarjetasSnapshot.docs.map(async (tarjetaDoc) => {
      const transaccionesSnapshot = await tarjetaDoc.ref.collection('transacciones').get();
      return transaccionesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Resolver las promesas de todas las tarjetas
    const transacciones = await Promise.all(transaccionesPromises);

    // Aplanar el array de transacciones
    const transaccionesFlattened = transacciones.flat();

    // Si no se encontraron transacciones
    if (transaccionesFlattened.length === 0) {
      return res.status(404).json({ message: 'No se encontraron transacciones para estas tarjetas' });
    }

    return res.status(200).json({ transacciones: transaccionesFlattened });
  } catch (error: any) {
    console.error('Error en /tarjetas/transacciones:', error);
    return res.status(500).json({ message: error.message });
  }
});


// 3. Edit card alias
app.put('/tarjetas/editar', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { nfc_uid, nuevo_alias } = req.body;
    
    if (!nfc_uid || !nuevo_alias) {
      return res.status(400).json({ message: 'Campos requeridos faltantes' });
    }
    
    const tarjetaRef = db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid);
      
    await tarjetaRef.update({ sobrenombre: nuevo_alias });
    return res.status(200).json({ message: 'Tarjeta actualizada correctamente' });
  } catch (error: any) {
    console.error('Error en /tarjetas/editar:', error);
    return res.status(500).json({ message: error.message });
  }
});

// 4. Recharge card
app.post('/tarjetas/recargar', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { nfc_uid, saldo } = req.body;
    
    if (!nfc_uid || saldo == null) {
      return res.status(400).json({ message: 'Campos requeridos faltantes' });
    }
    
    const tarjetaRef = db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid);
      
    await tarjetaRef.update({
      saldo: admin.firestore.FieldValue.increment(saldo),
    });
    
    return res.status(200).json({ message: 'Tarjeta recargada correctamente' });
  } catch (error: any) {
    console.error('Error en /tarjetas/recargar:', error);
    return res.status(500).json({ message: error.message });
  }
});

// 5. Use card (save transaction) con manejo de errores
app.post('/tarjetas/usar', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).uid;
    const { nfc_uid, saldo, estacion, hora } = req.body;

    // 1. Validar campos requeridos
    if (!nfc_uid || saldo == null || !estacion || !hora) {
      return res.status(400).json({ message: 'Campos requeridos faltantes' });
    }

    const tarjetaRef = db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid);
    
    // 2. Obtener datos de la tarjeta
    const tarjetaSnap = await tarjetaRef.get();
    if (!tarjetaSnap.exists) {
      return res.status(404).json({ message: 'Tarjeta no encontrada' });
    }
    const tarjeta = tarjetaSnap.data()!;  // ya sabemos que existe

    // 3. Verificar estado de la tarjeta
    if (!tarjeta.estado) {
      return res.status(400).json({ message: 'La tarjeta está inactiva' });
    }

    // 4. Verificar saldo suficiente
    if (tarjeta.saldo < saldo) {
      return res.status(400).json({ message: 'Saldo insuficiente' });
    }

    // 5. Descontar saldo
    await tarjetaRef.update({
      saldo: admin.firestore.FieldValue.increment(-saldo),
    });

    // 6. Registrar transacción
    await tarjetaRef.collection('transacciones').add({
      saldo,       // monto usado
      estacion,    // estación donde se usó
      hora,        // hora reportada por el cliente
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Uso de tarjeta registrado correctamente' });
  } catch (error: any) {
    console.error('Error en /tarjetas/usar:', error);
    return res.status(500).json({ message: 'Error interno al procesar la transacción' });
  }
});



// Export Express app as Firebase Function
export const api = functions.https.onRequest(app);