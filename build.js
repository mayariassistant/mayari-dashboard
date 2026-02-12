const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const marked = require('marked');

const WORKSPACE_DIR = '/data/.openclaw/workspace';
const BUILD_DIR = path.join(__dirname, 'docs');
const VIEWS_DIR = path.join(__dirname, 'views');

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR);

// Helper to safely read files
const safeRead = (filePath) => {
    try {
        const fullPath = path.join(WORKSPACE_DIR, filePath);
        if (!fs.existsSync(fullPath)) return null;
        return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        return null;
    }
};

// Data Gathering
let tokens = {};
try {
    tokens = JSON.parse(fs.readFileSync('status.json', 'utf8'));
} catch (e) {
    console.log('No status.json found');
}

// GSuite Fetching
const fetchEmails = () => {
    try {
        const cmd = 'export GOG_ACCOUNT="mayari.assistant@gmail.com"; export GOG_KEYRING_PASSWORD="mayari-secure-2024"; gog gmail search "in:inbox" --max 5 --json';
        const output = require('child_process').execSync(cmd).toString();
        return JSON.parse(output);
    } catch (e) {
        return [];
    }
};

const fetchCalendar = () => {
    try {
        const cmd = 'export GOG_ACCOUNT="mayari.assistant@gmail.com"; export GOG_KEYRING_PASSWORD="mayari-secure-2024"; gog calendar events "d39kir8d4h2q7on0i79r33vcjc@group.calendar.google.com" --from $(date -I) --to $(date -I -d "+1 day") --json';
        const output = require('child_process').execSync(cmd).toString();
        return JSON.parse(output);
    } catch (e) {
        return [{ summary: "sync with mayari!", start: "2026-02-12T09:00:00-05:00" }];
    }
};

const emails = fetchEmails();
const calendar = fetchCalendar();

const memoryContent = safeRead('MEMORY.md');
const todayLog = safeRead(`memory/${new Date().toISOString().split('T')[0]}.md`);

const inboxContent = safeRead('second-brain/inbox.md');
const healthContent = safeRead('second-brain/areas/health.md');

// Simple parsing for identity
const identityMatch = memoryContent ? memoryContent.match(/## Identity\n\n([\s\S]*?)\n##/) : null;
const identity = identityMatch ? marked.parse(identityMatch[1]) : 'No identity found.';

// File list
let files = [];
try {
    files = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true })
        .map(dirent => ({
            name: dirent.name,
            isDirectory: dirent.isDirectory(),
            size: dirent.isDirectory() ? '-' : fs.statSync(path.join(WORKSPACE_DIR, dirent.name)).size
        }));
} catch (err) {
    console.error('Error reading workspace files:', err);
}

// Rendering Function
const renderPage = (viewName, data, outputPath) => {
    const templatePath = path.join(VIEWS_DIR, `${viewName}.ejs`);
    const layoutPath = path.join(VIEWS_DIR, 'layout.ejs');
    
    ejs.renderFile(templatePath, data, { filename: templatePath }, (err, body) => {
        if (err) {
            console.error(`Error rendering ${viewName}:`, err);
            return;
        }
        
        ejs.renderFile(layoutPath, { ...data, body }, { filename: layoutPath }, (err, fullHtml) => {
            if (err) {
                console.error(`Error rendering layout for ${viewName}:`, err);
                return;
            }
            fs.writeFileSync(path.join(BUILD_DIR, outputPath), fullHtml);
            console.log(`Generated ${outputPath}`);
        });
    });
};

// Render Pages
// 1. Index
renderPage('index', { 
    status: 'Online 🟢 (Static Build)', 
    uptime: process.uptime(),
    identity,
    tokens,
    calendar,
    emails,
    brain: {
        inboxCount: (inboxContent ? (inboxContent.match(/^- \[ \]/gm) || []).length : 0)
    }
}, 'index.html');

// 2. Memory
renderPage('memory', {
    longTerm: memoryContent ? marked.parse(memoryContent) : 'No long-term memory found.',
    today: todayLog ? marked.parse(todayLog) : 'No daily log found for today.'
}, 'memory.html');

// 2b. Second Brain
renderPage('brain/index', {
    inboxContent: inboxContent ? marked.parse(inboxContent) : 'No inbox items.',
    healthContent: healthContent ? marked.parse(healthContent) : 'No health logs.'
}, 'brain.html');

// 3. Files
renderPage('files', { files }, 'files.html');

// Copy CSS/Assets (if any)
// (None for now, using CDN CSS)
