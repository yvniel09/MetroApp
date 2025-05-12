import 'dotenv/config';
import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

// Inicializa la app de Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Configura Express
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Ruta de registro de usuario
app.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, username, phoneNumber } = req.body as {
      email: string;
      password: string;
      name: string;
      username: string;
      phoneNumber: string;
    };

    // Validar datos requeridos
    if (!email || !password || !name || !username || !phoneNumber) {
      return res.status(400).json({ 
        message: 'Todos los campos son requeridos' 
      });
    }

    // Verificar si el usuario ya existe
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (!snapshot.empty) {
      return res.status(400).json({ 
        message: 'El usuario ya existe' 
      });
    }

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({ 
      email, 
      password,
      displayName: name
    });
    const uid = userRecord.uid;

    // Crear timestamp
    const now = new Date();

    // Guardar datos en Firestore
    await db.collection('users').doc(uid).set({
      email,
      name,
      username,
      phoneNumber,
      state: 'active',
      creation_date: now,
      last_access: now,
    });

    // Obtener token de ID usando Firebase Auth REST API
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

    return res.status(201).json({ 
      token: data.idToken, 
      user: { 
        uid, 
        email, 
        name, 
        username, 
        phoneNumber 
      } 
    });
  } catch (error: any) {
    console.error('Error en /register:', error);
    return res.status(400).json({ 
      message: error.message || 'Error al registrar usuario' 
    });
  }
});

// Ruta de login de usuario
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { 
      email: string; 
      password: string 
    };

    // Validar datos requeridos
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Verificar credenciales con Firebase Auth REST API
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

    // Verificar si el usuario existe en Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new Error('Usuario no encontrado en la base de datos');
    }

    // Actualizar last_access en Firestore
    const now = new Date();
    await db.collection('users').doc(uid).update({
      last_access: now,
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

// Exponer Express como función HTTP
export const api = functions.https.onRequest(app);
