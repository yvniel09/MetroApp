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
    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({ email, password });
    const uid = userRecord.uid;

    // Guardar datos en Firestore
    await db.collection('users').doc(uid).set({
      email,
      name,
      user_name: username,
      phone_number: phoneNumber,
      state: 'active',
      creation_date: admin.firestore.FieldValue.serverTimestamp(),
      last_access: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Generar token custom
    const token = await admin.auth().createCustomToken(uid);

    return res.status(201).json({ token, user: { uid, email, name, username, phoneNumber } });
  } catch (error: any) {
    console.error('Error en /register:', error);
    return res.status(400).json({ message: error.message });
  }
});

// Ruta de login de usuario
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    // Verificar credenciales con Firebase Auth REST API
    const apiKey = functions.config().firebase.api_key;
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
    // Actualizar last_access en Firestore
    await db.collection('users').doc(uid).update({
      last_access: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ token: data.idToken, user: { uid, email: data.email } });
  } catch (error: any) {
    console.error('Error en /login:', error);
    return res.status(401).json({ message: error.message });
  }
});

// Exponer Express como función HTTP
export const api = functions.https.onRequest(app);
