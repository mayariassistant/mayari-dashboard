const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const { execSync } = require('child_process');

const app = express();
const PORT = 3001; 
const WORKSPACE_DIR = '/data/.openclaw/workspace';

// Environment for GSuite tools
const GOG_ENV = {
    GOG_KEYRING_PASSWORD: "mayari-secure-2024",
    GOG_ACCOUNT: "mayari.assistant@gmail.com",
    PATH: process.env.PATH // Ensure gog is in path
};

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Helper to safely read files
const safeRead = (filePath) => {
    try {
        const fullPath = path.join(WORKSPACE_DIR, filePath);
        if (!fullPath.startsWith(WORKSPACE_DIR)) return null;
        if (!fs.existsSync(fullPath)) return null;
        return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        return null;
    }
};

// GSuite Helpers
const getCalendar = () => {
    try {
        const start = new Date().toISOString().split('T')[0];
        const end = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const output = execSync(`gog calendar events "d39kir8d4h2q7on0i79r33vcjc@group.calendar.google.com" --from ${start} --to ${end} --json`, { env: { ...process.env, ...GOG_ENV } });
        return JSON.parse(output);
    } catch (e) {
        console.error('Calendar error:', e.message);
        return [];
    }
};

const getEmails = () => {
    try {
        const output = execSync(`gog gmail search 'in:inbox' --max 5 --json`, { env: { ...process.env, ...GOG_ENV } });
        return JSON.parse(output);
    } catch (e) {
        console.error('Gmail error:', e.message);
        return [];
    }
};

// Routes
app.get('/', (req, res) => {
    const memory = safeRead('MEMORY.md');
    const identityMatch = memory ? memory.match(/## Identity\n\n([\s\S]*?)\n##/) : null;
    const identity = identityMatch ? marked.parse(identityMatch[1]) : 'No identity found.';

    let tokens = null;
    try {
        const tokenPath = path.join(WORKSPACE_DIR, 'mayari-dashboard/status.json');
        if (fs.existsSync(tokenPath)) {
            tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        }
    } catch (e) {}

    res.render('index', { 
        status: 'Online', 
        uptime: process.uptime(),
        identity,
        tokens,
        calendar: getCalendar(),
        emails: getEmails()
    });
});

app.get('/memory', (req, res) => {
    const memoryContent = safeRead('MEMORY.md');
    const todayLog = safeRead(`memory/${new Date().toISOString().split('T')[0]}.md`);
    
    res.render('memory', {
        longTerm: memoryContent ? marked.parse(memoryContent) : 'No long-term memory found.',
        today: todayLog ? marked.parse(todayLog) : 'No daily log found for today.'
    });
});

app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true })
            .map(dirent => {
                const stat = fs.statSync(path.join(WORKSPACE_DIR, dirent.name));
                return {
                    name: dirent.name,
                    isDirectory: dirent.isDirectory(),
                    size: dirent.isDirectory() ? '-' : (stat.size / 1024).toFixed(1) + ' KB'
                };
            });
        
        res.render('files', { files });
    } catch (err) {
        res.render('error', { message: 'Failed to read workspace directory.' });
    }
});

app.listen(PORT, () => {
    console.log(`Mayari Dashboard running on port ${PORT}`);
});
