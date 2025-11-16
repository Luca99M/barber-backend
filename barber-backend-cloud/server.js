const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Log richieste
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== API ENDPOINTS ====================

// Test connessione
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Backend online! ✅',
    timestamp: new Date().toISOString(),
    version: '2.0.0-cloud'
  });
});

// Get barbieri
app.get('/api/barbieri', (req, res) => {
  db.all('SELECT * FROM barbieri', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ barbieri: rows });
  });
});

// Get servizi
app.get('/api/servizi', (req, res) => {
  db.all('SELECT * FROM servizi', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ servizi: rows });
  });
});

// Get disponibilità per data e barbiere
app.get('/api/disponibilita/:barbiereId/:data', (req, res) => {
  const { barbiereId, data } = req.params;
  
  db.all(
    `SELECT p.ora, s.durata 
     FROM prenotazioni p
     JOIN servizi s ON p.servizio_id = s.id
     WHERE p.barbiere_id = ? AND p.data = ? AND p.stato != 'cancellata'
     ORDER BY p.ora`,
    [barbiereId, data],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Genera slot disponibili (9:00 - 19:00)
      const slots = [];
      const startHour = 9;
      const endHour = 19;
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute of [0, 15, 30, 45]) {
          const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          const isOccupied = rows.some(booking => {
            const bookingTime = booking.ora.split(':');
            const bookingMinutes = parseInt(bookingTime[0]) * 60 + parseInt(bookingTime[1]);
            const slotMinutes = hour * 60 + minute;
            const endMinutes = bookingMinutes + booking.durata;
            
            return slotMinutes >= bookingMinutes && slotMinutes < endMinutes;
          });
          
          if (!isOccupied) {
            slots.push(timeSlot);
          }
        }
      }
      
      res.json({ disponibilita: slots });
    }
  );
});

// Crea nuova prenotazione
app.post('/api/prenotazioni', (req, res) => {
  const {
    barbiere_id,
    servizio_id,
    cliente_nome,
    cliente_telefono,
    cliente_email,
    data,
    ora,
    note
  } = req.body;
  
  // Inserisci prenotazione
  db.run(
    `INSERT INTO prenotazioni 
     (barbiere_id, servizio_id, cliente_nome, cliente_telefono, cliente_email, data, ora, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [barbiere_id, servizio_id, cliente_nome, cliente_telefono, cliente_email, data, ora, note],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const prenotazioneId = this.lastID;
      
      // Ottieni info per SMS
      db.get(
        `SELECT p.*, b.nome as barbiere_nome, s.nome as servizio_nome
         FROM prenotazioni p
         JOIN barbieri b ON p.barbiere_id = b.id
         JOIN servizi s ON p.servizio_id = s.id
         WHERE p.id = ?`,
        [prenotazioneId],
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Crea SMS di conferma
          const message = `✅ Prenotazione Confermata\n\n` +
                         `Barbiere: ${row.barbiere_nome}\n` +
                         `Servizio: ${row.servizio_nome}\n` +
                         `Data: ${row.data}\n` +
                         `Ora: ${row.ora}\n\n` +
                         `Ci vediamo! 💈`;
          
          // Aggiungi SMS alla coda
          db.run(
            `INSERT INTO sms_queue (prenotazione_id, phone, message, tipo, cliente)
             VALUES (?, ?, ?, 'conferma', ?)`,
            [prenotazioneId, cliente_telefono, message, cliente_nome],
            (err) => {
              if (err) {
                console.error('❌ Errore creazione SMS:', err.message);
              } else {
                console.log('📱 SMS di conferma aggiunto alla coda');
              }
            }
          );
          
          res.json({
            success: true,
            prenotazione: row,
            message: 'Prenotazione creata con successo'
          });
        }
      );
    }
  );
});

// Get prenotazioni per data
app.get('/api/prenotazioni/:data', (req, res) => {
  const { data } = req.params;
  
  db.all(
    `SELECT p.*, b.nome as barbiere_nome, s.nome as servizio_nome, s.durata
     FROM prenotazioni p
     JOIN barbieri b ON p.barbiere_id = b.id
     JOIN servizi s ON p.servizio_id = s.id
     WHERE p.data = ? AND p.stato != 'cancellata'
     ORDER BY p.ora`,
    [data],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ prenotazioni: rows });
    }
  );
});

// Cancella prenotazione
app.delete('/api/prenotazioni/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT p.*, b.nome as barbiere_nome, s.nome as servizio_nome
     FROM prenotazioni p
     JOIN barbieri b ON p.barbiere_id = b.id
     JOIN servizi s ON p.servizio_id = s.id
     WHERE p.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Prenotazione non trovata' });
      }
      
      db.run(
        'UPDATE prenotazioni SET stato = ? WHERE id = ?',
        ['cancellata', id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const message = `❌ Prenotazione Cancellata\n\n` +
                         `La tua prenotazione del ${row.data} alle ${row.ora} ` +
                         `con ${row.barbiere_nome} è stata cancellata.\n\n` +
                         `Per info: chiama il negozio 💈`;
          
          db.run(
            `INSERT INTO sms_queue (prenotazione_id, phone, message, tipo, cliente)
             VALUES (?, ?, ?, 'cancellazione', ?)`,
            [id, row.cliente_telefono, message, row.cliente_nome],
            (err) => {
              if (err) {
                console.error('❌ Errore creazione SMS:', err.message);
              }
            }
          );
          
          res.json({
            success: true,
            message: 'Prenotazione cancellata'
          });
        }
      );
    }
  );
});

// ==================== SMS GATEWAY ENDPOINTS (POLLING) ====================

// ENDPOINT PER SMSGATE - Get SMS pendenti
app.get('/api/smsgate/pending', (req, res) => {
  db.all(
    `SELECT * FROM sms_queue 
     WHERE status = 'pending' 
     ORDER BY created_at ASC 
     LIMIT 10`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Formato per SMSGate
      const messages = rows.map(row => ({
        id: row.id,
        phoneNumber: row.phone,
        message: row.message,
        metadata: {
          tipo: row.tipo,
          cliente: row.cliente,
          prenotazione_id: row.prenotazione_id
        }
      }));
      
      console.log(`📱 SMSGate richiede SMS: ${messages.length} in coda`);
      
      res.json({
        success: true,
        count: messages.length,
        messages: messages
      });
    }
  );
});

// ENDPOINT PER SMSGATE - Marca SMS come inviato
app.post('/api/smsgate/sent', (req, res) => {
  const { id, messageId } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'ID mancante' });
  }
  
  db.run(
    `UPDATE sms_queue 
     SET status = 'sent', 
         sent_at = CURRENT_TIMESTAMP,
         external_id = ?
     WHERE id = ?`,
    [messageId || null, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      console.log(`✅ SMS ${id} marcato come inviato`);
      res.json({ success: true });
    }
  );
});

// ENDPOINT PER SMSGATE - Segnala errore
app.post('/api/smsgate/error', (req, res) => {
  const { id, error } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'ID mancante' });
  }
  
  db.run(
    `UPDATE sms_queue 
     SET status = 'error', 
         error = ?
     WHERE id = ?`,
    [error || 'Unknown error', id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      console.log(`❌ SMS ${id} errore: ${error}`);
      res.json({ success: true });
    }
  );
});

// Get statistiche SMS
app.get('/api/sms/stats', (req, res) => {
  db.get(
    `SELECT 
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as inviati,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendenti,
      COUNT(CASE WHEN status = 'error' THEN 1 END) as errori,
      COUNT(*) as totale
     FROM sms_queue`,
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    }
  );
});

// ==================== ADMIN ENDPOINTS ====================

// Get tutte le prenotazioni
app.get('/api/admin/prenotazioni', (req, res) => {
  db.all(
    `SELECT p.*, b.nome as barbiere_nome, s.nome as servizio_nome, s.durata
     FROM prenotazioni p
     JOIN barbieri b ON p.barbiere_id = b.id
     JOIN servizi s ON p.servizio_id = s.id
     ORDER BY p.data DESC, p.ora DESC
     LIMIT 100`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ prenotazioni: rows });
    }
  );
});

// Get storico SMS
app.get('/api/admin/sms', (req, res) => {
  db.all(
    `SELECT * FROM sms_queue ORDER BY created_at DESC LIMIT 100`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ sms: rows });
    }
  );
});

// Health check per monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== AVVIO SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   💈 Barber Booking System - CLOUD       ║
║                                            ║
║   🚀 Server online sulla porta ${PORT}      ║
║   🌐 Backend pronto per produzione        ║
║                                            ║
║   📱 SMSGate polling: /api/smsgate/pending║
║   📅 Prenotazioni: /api/prenotazioni      ║
║   ⚙️  Health: /health                      ║
╚════════════════════════════════════════════╝
  `);
});

// Gestione errori
process.on('uncaughtException', (err) => {
  console.error('❌ Errore critico:', err);
});

process.on('SIGTERM', () => {
  console.log('👋 Chiusura server in corso...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database chiuso.');
    process.exit(0);
  });
});
