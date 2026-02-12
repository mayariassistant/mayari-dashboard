#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path resolution (handles local vs global workspace)
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || '/data/.openclaw/workspace';
const DASHBOARD_DIR = path.join(WORKSPACE_DIR, 'mayari-dashboard');

function updateStatus() {
    console.log('Gathering status data...');
    
    // Get session status using openclaw CLI for accurate token counts
    let statusData = { 
        total_tokens: 0, 
        prompt_tokens: 0, 
        completion_tokens: 0, 
        context: "0/0", 
        model: "unknown",
        last_sync: new Date().toISOString()
    };
    try {
        const statusOutput = execSync('openclaw status --json').toString();
        const fullStatus = JSON.parse(statusOutput);
        
        // Use agent-status.json if it exists at root
        const agentStatusPath = path.join(WORKSPACE_DIR, 'agent-status.json');
        if (fs.existsSync(agentStatusPath)) {
            const agentStatus = JSON.parse(fs.readFileSync(agentStatusPath, 'utf8'));
            statusData = { ...statusData, ...agentStatus };
        }

        // Find the main session in the new array structure
        const recentSessions = fullStatus?.sessions?.recent || [];
        const mainSession = recentSessions.find(s => s.key === 'agent:main:main');
        
        if (mainSession) {
            statusData.total_tokens = mainSession.inputTokens + mainSession.outputTokens || 0;
            statusData.prompt_tokens = mainSession.inputTokens || 0;
            statusData.completion_tokens = mainSession.outputTokens || 0;
            statusData.context = `${mainSession.inputTokens + mainSession.outputTokens}/${mainSession.contextTokens}` || "0/0";
            statusData.model = mainSession.model || "unknown";
        }
    } catch (e) {
        console.error('Failed to get session status via CLI:', e.message);
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
