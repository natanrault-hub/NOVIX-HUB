const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./keys.db', (err) => {
    if (err) console.error("Erreur base de données:", err.message);
    else console.log("Connecté à la base de données SQLite.");
});

db.run(`CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    expires_at INTEGER
)`);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: "Trop de requêtes, veuillez patienter."
});
app.use(limiter);

setInterval(() => {
    const now = Date.now();
    db.run(`DELETE FROM keys WHERE expires_at < ?`, [now], (err) => {
        if (!err) console.log("Nettoyage des clés expirées effectué.");
    });
}, 60 * 60 * 1000);

app.get('/', (req, res) => {
    const userKey = req.query.key;
    
    if (!userKey) {
        return res.send("invalid");
    }

    db.get(`SELECT * FROM keys WHERE key = ?`, [userKey], (err, row) => {
        if (err || !row) {
            return res.send("invalid");
        }

        if (Date.now() > row.expires_at) {
            db.run(`DELETE FROM keys WHERE key = ?`, [userKey]);
            return res.send("expired");
        }

        return res.send("valid");
    });
});

app.get('/admin', (req, res) => {
    db.all(`SELECT * FROM keys`, [], (err, rows) => {
        let keysHtml = '';
        if (rows) {
            rows.forEach(r => {
                const timeLeft = Math.max(0, Math.ceil((r.expires_at - Date.now()) / (1000 * 60 * 60)));
                keysHtml += `<div style="background: rgba(255,255,255,0.05); padding: 10px; margin: 5px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <code>${r.key}</code>
                    <span style="color: #a78bfa; font-size: 12px;">Expire dans ${timeLeft} heures</span>
                </div>`;
            });
        }

        res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Novix Ultra Hub - Key System</title>
            <style>
                body { background-color: #0b0b0f; color: #f5f5f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #15151d; padding: 30px; border-radius: 14px; border: 1px solid #262634; width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { color: #a78bfa; margin-top: 0; text-align: center; }
                button { background: #8b5cf6; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s; }
                button:hover { background: #7c3aed; }
                .list { margin-top: 20px; max-height: 200px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>NOVIX KEY GENERATOR</h2>
                <form action="/generate" method="POST">
                    <button type="submit">Générer une nouvelle clé (3 Jours)</button>
                </form>
                <div class="list">
                    <h4 style="color: #71717d; margin-bottom: 5px;">Clés Actives :</h4>
                    ${keysHtml || '<p style="color: #71717d; font-size: 12px;">Aucune clé active.</p>'}
                </div>
            </div>
        </body>
        </html>
        `);
    });
});

app.post('/generate', (req, res) => {
    const newKey = "NOVIX-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = Date.now() + (3 * 24 * 60 * 60 * 1000);

    db.run(`INSERT INTO keys (key, expires_at) VALUES (?, ?)`, [newKey, expiresAt], (err) => {
        res.redirect('/admin');
    });
});

app.listen(PORT, () => {
    console.log(\`Serveur démarré sur le port \${PORT}\`);
});
