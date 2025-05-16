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
    res.status(401).json({ message: 'No autorizado' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).uid = decoded.uid;
    return next();
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(401).json({ message: 'Token inválido' });
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

// GET ALL CARDS (renombrado a `tarjetas`)
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
      return res.json({ tarjetas });                // ← Aquí
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
      return res.json({ message: 'Recarga exitosa' });
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


app.post('/tarjetas/verificar', authMiddleware, async (req: Request, res: Response): Promise<Response> => {
  const uid = (req as any).uid;
  const { nfc_uid } = req.body;

  if (!nfc_uid) {
    return res.status(400).json({ status: 'denied', message: 'Falta UID de la tarjeta' });
  }

  try {
    const tarjetaDoc = await db
      .collection('users')
      .doc(uid)
      .collection('tarjetas')
      .doc(nfc_uid)
      .get();

    if (!tarjetaDoc.exists) {
      return res.status(404).json({ status: 'denied', message: 'Tarjeta no encontrada' });
    }

    const tarjeta = tarjetaDoc.data()!;
    const viajeCosto = 20;  // Cambio aquí a 20 RDS

    if (!tarjeta.estado) {
      return res.status(403).json({ status: 'denied', message: 'Tarjeta desactivada' });
    }

    if (tarjeta.saldo < viajeCosto) {
      return res.status(403).json({ status: 'denied', message: 'Saldo insuficiente' });
    }

    const nuevoSaldo = tarjeta.saldo - viajeCosto;

    await tarjetaDoc.ref.update({ saldo: nuevoSaldo });

    await tarjetaDoc.ref.collection('transacciones').add({
      tipo: 'viaje',
      monto: -viajeCosto,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ status: 'ok', message: 'Viaje verificado', nuevoSaldo });
  } catch (err: any) {
    console.error('Error en verificarTarjeta:', err);
    return res.status(500).json({ status: 'denied', message: 'Error del servidor' });
  }
});


// Export as Cloud Function
export const api = functions.https.onRequest(app);
