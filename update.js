#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = '/data/.openclaw/workspace';
const DASHBOARD_DIR = path.join(WORKSPACE_DIR, 'mayari-dashboard');

function updateStatus() {
    console.log('Gathering status data...');
    
    // Get session status using openclaw CLI for accurate token counts
    let statusData = { in: "0", out: "0", context: "0/0", model: "unknown" };
    try {
        const statusOutput = execSync('openclaw status --json').toString();
        const fullStatus = JSON.parse(statusOutput);
        const mainSession = fullStatus.sessions.find(s => s.key === 'agent:main:main');
        if (mainSession) {
            statusData.in = mainSession.tokensIn || "0";
            statusData.out = mainSession.tokensOut || "0";
            statusData.context = mainSession.contextUsage || "0/0";
            statusData.model = mainSession.model || "unknown";
        }
    } catch (e) {
        console.error('Failed to get session status via CLI, falling back to basic info.');
    }

    // Write to status.json
    fs.writeFileSync(path.join(DASHBOARD_DIR, 'status.json'), JSON.stringify(statusData, null, 2));
}

function runBuild() {
    console.log('Running build.js...');
    try {
        execSync(`node ${path.join(DASHBOARD_DIR, 'build.js')}`, { cwd: DASHBOARD_DIR });
        console.log('Build complete.');
    } catch (e) {
        console.error('Build failed:', e.message);
    }
}

function gitPush() {
    console.log('Pushing to GitHub...');
    try {
        execSync('git add .', { cwd: DASHBOARD_DIR });
        execSync('git commit -m "Dashboard Auto-Update: ' + new Date().toISOString() + '"', { cwd: DASHBOARD_DIR });
        execSync('git push origin main', { cwd: DASHBOARD_DIR });
        console.log('Push complete.');
    } catch (e) {
        console.error('Git push failed (likely no changes or network issue):', e.message);
    }
}

// Execution
updateStatus();
runBuild();
gitPush();
