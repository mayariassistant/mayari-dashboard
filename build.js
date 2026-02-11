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

const memoryContent = safeRead('MEMORY.md');
const todayLog = safeRead(`memory/${new Date().toISOString().split('T')[0]}.md`);

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
    ejs.renderFile(templatePath, data, { filename: templatePath }, (err, str) => {
        if (err) {
            console.error(`Error rendering ${viewName}:`, err);
            return;
        }
        fs.writeFileSync(path.join(BUILD_DIR, outputPath), str);
        console.log(`Generated ${outputPath}`);
    });
};

// Render Pages
// 1. Index
renderPage('index', { 
    status: 'Online 🟢 (Static Build)', 
    uptime: process.uptime(),
    identity,
    tokens 
}, 'index.html');

// 2. Memory
renderPage('memory', {
    longTerm: memoryContent ? marked.parse(memoryContent) : 'No long-term memory found.',
    today: todayLog ? marked.parse(todayLog) : 'No daily log found for today.'
}, 'memory.html');

// 3. Files
renderPage('files', { files }, 'files.html');

// Copy CSS/Assets (if any)
// (None for now, using CDN CSS)
