const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const sessions = new Map();

const createSession = async (sessionId) => {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_${sessionId}`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['KAWAN Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if(qr) {
            // Generate QR Code
            qrcode.toDataURL(qr, (err, url) => {
                io.emit('qr', { sessionId, url });
            });
        }

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) {
                createSession(sessionId);
            }
        } else if(connection === 'open') {
            io.emit('ready', { sessionId });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        // Existing message handling logic here
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            // Your existing message handling code
        }
    });

    sessions.set(sessionId, sock);
};

io.on('connection', (socket) => {
    socket.on('create-session', async (sessionId) => {
        if(!sessions.has(sessionId)) {
            await createSession(sessionId);
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
