// ====================================================================
// STOPLIGHT DOCUMENTATION SCRAPER
// ====================================================================
// Run this directly in the browser console on developer.buildops.com
// ====================================================================

console.log('%c🕷️ Stoplight Documentation Scraper', 'font-size: 20px; color: #4ec9b0; font-weight: bold;');
console.log('%cStep 1: Finding all documentation links on this page...', 'color: #9cdcfe;');

// Step 1: Extract all node IDs from the current page
const nodeIds = new Set();

// Method 1: From navigation links
document.querySelectorAll('a[href*="/docs/"]').forEach(link => {
    const match = link.href.match(/\/docs\/[^\/]+\/([^\/\?#]+)/);
    if (match && match[1]) {
        nodeIds.add(match[1]);
    }
});

// Method 2: From any data attributes
document.querySelectorAll('[data-node-id], [data-id]').forEach(el => {
    if (el.dataset.nodeId) nodeIds.add(el.dataset.nodeId);
    if (el.dataset.id && el.dataset.id.length > 10) nodeIds.add(el.dataset.id);
});

// Method 3: Check if there's Stoplight data in window
if (window.__STOPLIGHT_DATA__) {
    console.log('%c Found window.__STOPLIGHT_DATA__!', 'color: #4ec9b0;');
    console.log(window.__STOPLIGHT_DATA__);
}

console.log(`%c✅ Found ${nodeIds.size} potential node IDs`, 'color: #4ec9b0; font-weight: bold;');

if (nodeIds.size > 0) {
    console.log('%cNode IDs found:', 'color: #9cdcfe;');
    Array.from(nodeIds).forEach(id => console.log(`  - ${id}`));
    console.log('');
}

// Step 2: Get the auth token from network requests
console.log('%cStep 2: Looking for auth token in recent requests...', 'color: #9cdcfe;');

// We can't access network requests directly, so we need the user to provide the token
console.log('%c⚠️  Please provide your token:', 'color: #ffc107;');
console.log('%cOption 1: Set it manually:', 'color: #9cdcfe;');
console.log('%c  window.STOPLIGHT_TOKEN = "your_token_here"', 'background: #2d2d2d; padding: 5px;');
console.log('');
console.log('%cOption 2: Copy from Network tab:', 'color: #9cdcfe;');
console.log('  1. Open Network tab');
console.log('  2. Look for requests to stoplight.io');
console.log('  3. Copy the Authorization header (starts with "Bearer ")');
console.log('  4. Paste it when prompted');
console.log('');

// Function to download all nodes
async function downloadAllNodes(token, nodeIdsToDownload) {
    const PROJECT_ID = 'cHJqOjI4NDA4Mw';
    const BASE_URL = 'https://stoplight.io/api/v1';

    const results = {
        nodes: {},
        errors: [],
        stats: {
            total: nodeIdsToDownload.size,
            success: 0,
            failed: 0
        }
    };

    console.log(`%c📥 Starting download of ${results.stats.total} nodes...`, 'color: #4ec9b0; font-size: 16px; font-weight: bold;');

    let count = 0;
    for (const nodeId of nodeIdsToDownload) {
        count++;
        try {
            const url = `${BASE_URL}/projects/${PROJECT_ID}/nodes/${nodeId}`;
            console.log(`[${count}/${results.stats.total}] Fetching: ${nodeId}`);

            const response = await fetch(url, {
                headers: {
                    'accept': '*/*',
                    'authorization': `Bearer ${token}`,
                    'origin': 'https://developer.buildops.com',
                    'stoplight-elements-version': '3.0.8',
                }
            });

            if (response.ok) {
                const data = await response.json();
                results.nodes[nodeId] = data;
                results.stats.success++;
                console.log(`%c  ✓ Success`, 'color: #4ec9b0;');

                // Extract more node IDs from this node
                const newNodeIds = extractNodeIdsFromObject(data);
                newNodeIds.forEach(newId => {
                    if (!nodeIdsToDownload.has(newId) && !results.nodes[newId]) {
                        nodeIdsToDownload.add(newId);
                        results.stats.total++;
                    }
                });
            } else {
                const error = `HTTP ${response.status}: ${await response.text()}`;
                results.errors.push({ nodeId, error });
                results.stats.failed++;
                console.log(`%c  ✗ Failed: ${response.status}`, 'color: #f48771;');
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            results.errors.push({ nodeId, error: error.message });
            results.stats.failed++;
            console.log(`%c  ✗ Error: ${error.message}`, 'color: #f48771;');
        }
    }

    console.log('');
    console.log(`%c✅ Download Complete!`, 'color: #4ec9b0; font-size: 18px; font-weight: bold;');
    console.log(`%c   Success: ${results.stats.success}`, 'color: #4ec9b0;');
    console.log(`%c   Failed: ${results.stats.failed}`, 'color: #f48771;');
    console.log('');

    return results;
}

function extractNodeIdsFromObject(obj, ids = new Set()) {
    if (!obj || typeof obj !== 'object') return ids;

    if (obj.id && typeof obj.id === 'string' && obj.id.match(/^[a-z0-9-_]+$/i) && obj.id.length > 10) {
        ids.add(obj.id);
    }

    if (obj.slug && typeof obj.slug === 'string') {
        ids.add(obj.slug);
    }

    if (obj.uri && typeof obj.uri === 'string') {
        const match = obj.uri.match(/\/nodes\/([^\/\?]+)/);
        if (match) ids.add(match[1]);
    }

    for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
            extractNodeIdsFromObject(value, ids);
        }
    }

    return ids;
}

function saveResults(results) {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stoplight-docs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('%c💾 File downloaded!', 'color: #4ec9b0; font-weight: bold;');
}

// Main execution function
async function startDownload() {
    let token = window.STOPLIGHT_TOKEN;

    if (!token) {
        token = prompt('Please paste your Bearer token (just the token part, not "Bearer"):');
        if (!token) {
            console.log('%c❌ No token provided. Aborted.', 'color: #f48771;');
            return;
        }
        window.STOPLIGHT_TOKEN = token;
    }

    console.log('%c🚀 Starting download...', 'color: #4ec9b0; font-weight: bold;');

    const results = await downloadAllNodes(token, new Set(nodeIds));

    console.log('%cResults stored in window.downloadedDocs', 'color: #9cdcfe;');
    window.downloadedDocs = results;

    console.log('');
    console.log('%cTo save the results:', 'color: #9cdcfe; font-weight: bold;');
    console.log('%c  saveResults(window.downloadedDocs)', 'background: #2d2d2d; padding: 5px;');
    console.log('');

    // Auto-save
    const shouldSave = confirm('Download complete! Save the file now?');
    if (shouldSave) {
        saveResults(results);
    }
}

// Expose functions to window
window.startDownload = startDownload;
window.saveResults = saveResults;
window.discoveredNodeIds = nodeIds;

console.log('');
console.log('%c📋 Quick Start:', 'color: #ce9178; font-size: 16px; font-weight: bold;');
console.log('%c1. Set your token:', 'color: #9cdcfe;');
console.log('%c   window.STOPLIGHT_TOKEN = "your_token"', 'background: #2d2d2d; padding: 5px;');
console.log('');
console.log('%c2. Start download:', 'color: #9cdcfe;');
console.log('%c   await startDownload()', 'background: #2d2d2d; padding: 5px;');
console.log('');
console.log('%c3. Or do it all at once (you\'ll be prompted for token):', 'color: #9cdcfe;');
console.log('%c   await startDownload()', 'background: #2d2d2d; padding: 5px;');
console.log('');
console.log('%c✨ Ready to go! Run "await startDownload()" when ready.', 'color: #4ec9b0; font-size: 14px; font-weight: bold;');
