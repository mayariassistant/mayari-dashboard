const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;
const WORKSPACE_DIR = '/data/.openclaw/workspace';

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Helper to safely read files
const safeRead = (filePath) => {
    try {
        const fullPath = path.join(WORKSPACE_DIR, filePath);
        // Basic jail to ensure we don't leave workspace
        if (!fullPath.startsWith(WORKSPACE_DIR)) return null;
        if (!fs.existsSync(fullPath)) return null;
        return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        return null;
    }
};

// Routes

// Home: Status + Links
app.get('/', (req, res) => {
    const memory = safeRead('MEMORY.md');
    // Simple parsing to extract "Identity" section
    const identityMatch = memory ? memory.match(/## Identity\n\n([\s\S]*?)\n##/) : null;
    const identity = identityMatch ? marked.parse(identityMatch[1]) : 'No identity found.';

    res.render('index', { 
        status: 'Online 🟢', 
        uptime: process.uptime(),
        identity 
    });
});

// Memory Browser
app.get('/memory', (req, res) => {
    const memoryContent = safeRead('MEMORY.md');
    const todayLog = safeRead(`memory/${new Date().toISOString().split('T')[0]}.md`);
    
    res.render('memory', {
        longTerm: memoryContent ? marked.parse(memoryContent) : 'No long-term memory found.',
        today: todayLog ? marked.parse(todayLog) : 'No daily log found for today.'
    });
});

// File Explorer (Simple list)
app.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true })
            .map(dirent => ({
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                size: dirent.isDirectory() ? '-' : fs.statSync(path.join(WORKSPACE_DIR, dirent.name)).size
            }));
        
        res.render('files', { files });
    } catch (err) {
        res.render('error', { message: 'Failed to read workspace directory.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Mayari Dashboard running on port ${PORT}`);
});
