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

// Public health check
app.get('/', (req: Request, res: Response): Response => {
  return res.status(200).send('OK');
});

// SIMPLE REGISTER (Auth)
app.post(
  '/register',
  async (req: Request, res: Response): Promise<Response> => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      const userRecord = await admin
        .auth()
        .createUser({ email, password, displayName: name });
      await db.collection('users').doc(userRecord.uid).set({
        email,
        name,
        created: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ uid: userRecord.uid });
    } catch (err: any) {
      console.error('Register error:', err);
      return res.status(500).json({ message: err.message || 'Error interno' });
    }
  }
);

// SIMPLE LOGIN
app.post(
  '/login',
  async (req: Request, res: Response): Promise<Response> => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña requeridos' });
    }
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: 'API key no configurada' });
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
      if (data.error) {
        return res.status(401).json({ message: data.error.message });
      }
      return res.json({ token: data.idToken });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Error al iniciar sesión' });
    }
  }
);

// AUTH MIDDLEWARE
const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ status: 'denied', message: 'No autorizado' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    return next();
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(401).json({ status: 'denied', message: 'Token inválido' });
    return;
  }
};

// Apply auth to all /tarjetas routes
app.use('/tarjetas', authMiddleware);

// REGISTER CARD
app.post(
  '/tarjetas/registrar',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid, sobrenombre, estado, saldo } = req.body;
    if (!nfc_uid || !sobrenombre || estado == null || saldo == null) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      const ref = db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid);
      const docSnap = await ref.get();
      if (docSnap.exists) {
        return res.status(409).json({ message: 'Tarjeta ya registrada' });
      }
      await ref.set({
        nfc_uid,
        sobrenombre,
        estado,
        saldo,
        creada: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ message: 'Tarjeta registrada' });
    } catch (err: any) {
      console.error('Register card error:', err);
      return res
        .status(500)
        .json({ message: 'Error interno al registrar tarjeta' });
    }
  }
);

// GET ALL CARDS
app.get(
  '/tarjetas',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    try {
      const snap = await db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .get();
      const tarjetas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ tarjetas });
    } catch (err: any) {
      console.error('Get tarjetas error:', err);
      return res.status(500).json({ message: 'Error interno al listar tarjetas' });
    }
  }
);

// EDITAR ALIAS
app.put(
  '/tarjetas/editar',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid, nuevo_alias } = req.body;
    if (!nfc_uid || !nuevo_alias) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      const ref = db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ message: 'Tarjeta no encontrada' });
      }
      await ref.update({ sobrenombre: nuevo_alias });
      return res.json({ message: 'Alias actualizado' });
    } catch (err: any) {
      console.error('Edit card error:', err);
      return res
        .status(500)
        .json({ message: 'Error interno al editar alias' });
    }
  }
);

// RECARGAR SALDO
app.post(
  '/tarjetas/recargar',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid, saldo } = req.body;
    if (!nfc_uid || saldo == null) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    try {
      const ref = db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ message: 'Tarjeta no encontrada' });
      }
      await ref.update({
        saldo: admin.firestore.FieldValue.increment(saldo),
      });
      // Obtener el saldo actual después de la recarga
      const tarjetaActualizada = await ref.get();
      const nuevoSaldo = tarjetaActualizada.data()?.saldo || 0;
      
      return res.json({ 
        message: 'Recarga exitosa', 
        nuevoSaldo 
      });
    } catch (err: any) {
      console.error('Recharge error:', err);
      return res
        .status(500)
        .json({ message: 'Error interno al recargar' });
    }
  }
);

// DELETE CARD
app.delete(
  '/tarjetas/:nfc_uid',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid } = req.params;
    if (!nfc_uid) {
      return res.status(400).json({ message: 'nfc_uid es requerido' });
    }
    try {
      await db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid)
        .delete();
      return res.json({ message: 'Tarjeta eliminada' });
    } catch (err: any) {
      console.error('Delete card error:', err);
      return res
        .status(500)
        .json({ message: 'Error interno al eliminar tarjeta' });
    }
  }
);

// VERIFICAR TARJETA - ENDPOINT MEJORADO
app.post(
  '/tarjetas/verificar', 
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid } = req.body;

    if (!nfc_uid) {
      return res.status(400).json({ 
        status: 'denied', 
        message: 'Falta UID de la tarjeta', 
        nuevoSaldo: 0 
      });
    }

    try {
      console.log(`Verificando tarjeta con UID: ${nfc_uid} para usuario: ${uid}`);
      
      const tarjetaRef = db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid);
      
      const tarjetaDoc = await tarjetaRef.get();

      if (!tarjetaDoc.exists) {
        console.log(`Tarjeta ${nfc_uid} no encontrada para usuario ${uid}`);
        return res.status(404).json({ 
          status: 'denied', 
          message: 'Tarjeta no encontrada', 
          nuevoSaldo: 0 
        });
      }

      const tarjeta = tarjetaDoc.data()!;
      console.log(`Datos de tarjeta:`, tarjeta);
      
      const viajeCosto = 20;  // Costo del viaje en RDS

      if (!tarjeta.estado) {
        console.log(`Tarjeta ${nfc_uid} desactivada`);
        return res.status(403).json({ 
          status: 'denied', 
          message: 'Tarjeta desactivada', 
          nuevoSaldo: tarjeta.saldo 
        });
      }

      if (tarjeta.saldo < viajeCosto) {
        console.log(`Saldo insuficiente: ${tarjeta.saldo} < ${viajeCosto}`);
        return res.status(403).json({ 
          status: 'denied', 
          message: 'Saldo insuficiente', 
          nuevoSaldo: tarjeta.saldo 
        });
      }

      const nuevoSaldo = tarjeta.saldo - viajeCosto;
      console.log(`Nuevo saldo después de cobro: ${nuevoSaldo}`);

      await tarjetaRef.update({ saldo: nuevoSaldo });

      await tarjetaRef.collection('transacciones').add({
        tipo: 'viaje',
        monto: -viajeCosto,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Verificación exitosa para tarjeta ${nfc_uid}`);
      return res.status(200).json({ 
        status: 'ok', 
        message: 'Viaje verificado', 
        nuevoSaldo 
      });
    } catch (err: any) {
      console.error('Error en verificarTarjeta:', err);
      return res.status(500).json({ 
        status: 'denied', 
        message: 'Error del servidor', 
        nuevoSaldo: 0 
      });
    }
  }
);

// GET TRANSACCIONES DE UNA TARJETA
app.get(
  '/tarjetas/:nfc_uid/transacciones',
  async (req: Request, res: Response): Promise<Response> => {
    const uid = (req as any).uid;
    const { nfc_uid } = req.params;

    if (!nfc_uid) {
      return res.status(400).json({ message: 'nfc_uid es requerido' });
    }

    try {
      // Verificamos que la tarjeta existe
      const tarjetaRef = db
        .collection('users')
        .doc(uid)
        .collection('tarjetas')
        .doc(nfc_uid);
      const tarjetaDoc = await tarjetaRef.get();
      if (!tarjetaDoc.exists) {
        return res.status(404).json({ message: 'Tarjeta no encontrada' });
      }

      // Leemos la subcolección ordenada por timestamp descendente
      const transSnap = await tarjetaRef
        .collection('transacciones')
        .orderBy('timestamp', 'desc')
        .get();

      const transacciones = transSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { tipo: string; monto: number; timestamp: any }),
      }));

      return res.json({ transacciones });
    } catch (err: any) {
      console.error('Error al obtener transacciones:', err);
      return res
        .status(500)
        .json({ message: 'Error interno al obtener transacciones' });
    }
  }
);



// Export as Cloud Function
export const api = functions.https.onRequest(app);