const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crea/apri il database
const db = new sqlite3.Database(path.join(__dirname, 'barber.db'), (err) => {
  if (err) {
    console.error('❌ Errore apertura database:', err.message);
  } else {
    console.log('✅ Database connesso');
    initDatabase();
  }
});

// Inizializza le tabelle
function initDatabase() {
  // Tabella barbieri
  db.run(`
    CREATE TABLE IF NOT EXISTS barbieri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT,
      telefono TEXT
    )
  `);

  // Tabella servizi
  db.run(`
    CREATE TABLE IF NOT EXISTS servizi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      durata INTEGER NOT NULL,
      prezzo REAL
    )
  `);

  // Tabella prenotazioni
  db.run(`
    CREATE TABLE IF NOT EXISTS prenotazioni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barbiere_id INTEGER NOT NULL,
      servizio_id INTEGER NOT NULL,
      cliente_nome TEXT NOT NULL,
      cliente_telefono TEXT NOT NULL,
      cliente_email TEXT,
      data TEXT NOT NULL,
      ora TEXT NOT NULL,
      stato TEXT DEFAULT 'confermata',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (barbiere_id) REFERENCES barbieri(id),
      FOREIGN KEY (servizio_id) REFERENCES servizi(id)
    )
  `);

  // Tabella SMS - AGGIORNATA per SMSGate
  db.run(`
    CREATE TABLE IF NOT EXISTS sms_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prenotazione_id INTEGER,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      tipo TEXT NOT NULL,
      cliente TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error TEXT,
      external_id TEXT,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prenotazione_id) REFERENCES prenotazioni(id)
    )
  `, (err) => {
    if (!err) {
      console.log('✅ Tabelle create/verificate');
      insertDefaultData();
    }
  });
}

// Inserisci dati di default
function insertDefaultData() {
  // Inserisci barbieri se non esistono
  db.get('SELECT COUNT(*) as count FROM barbieri', (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO barbieri (nome, telefono) VALUES ('Michele', '+39xxxxxxxxxx')`);
      db.run(`INSERT INTO barbieri (nome, telefono) VALUES ('Lucio', '+39xxxxxxxxxx')`);
      console.log('✅ Barbieri inseriti');
    }
  });

  // Inserisci servizi se non esistono
  db.get('SELECT COUNT(*) as count FROM servizi', (err, row) => {
    if (!err && row.count === 0) {
      db.run(`INSERT INTO servizi (nome, durata, prezzo) VALUES ('Taglio', 30, 20.00)`);
      db.run(`INSERT INTO servizi (nome, durata, prezzo) VALUES ('Barba', 15, 10.00)`);
      db.run(`INSERT INTO servizi (nome, durata, prezzo) VALUES ('Taglio + Barba', 45, 25.00)`);
      db.run(`INSERT INTO servizi (nome, durata, prezzo) VALUES ('Lavoro Speciale', 60, 35.00)`);
      console.log('✅ Servizi inseriti');
    }
  });
}

module.exports = db;
