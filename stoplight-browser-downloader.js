// Browser Console Script - Stoplight Documentation Downloader
// Copy and paste this entire script into your browser's console while on https://developer.buildops.com
// Then call: downloadAllDocs()

const PROJECT_ID = 'cHJqOjI4NDA4Mw';
const BASE_URL = 'https://stoplight.io/api/v1';

// Storage for downloaded content
const downloadedData = {
  nodes: {},
  toc: null,
  project: null,
  manifest: {}
};

// Get the authorization token from localStorage or sessionStorage
function getAuthToken() {
  // Try to find the token in storage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (value && value.includes('eyJ')) {
      console.log('Found potential token in localStorage:', key);
      return value;
    }
  }

  // If not found, user needs to provide it
  console.log('⚠️  Could not auto-detect token. Please set it manually:');
  console.log('window.STOPLIGHT_TOKEN = "your_bearer_token_here"');
  return window.STOPLIGHT_TOKEN || prompt('Please paste your Bearer token:');
}

async function fetchAPI(url) {
  const token = getAuthToken();

  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'accept': '*/*',
      'authorization': `Bearer ${token}`,
      'stoplight-elements-version': '3.0.8',
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function extractNodeIds(obj, ids = new Set()) {
  if (!obj || typeof obj !== 'object') return ids;

  if (obj.id && typeof obj.id === 'string' && obj.id.length > 5) {
    ids.add(obj.id);
  }

  if (obj.uri && typeof obj.uri === 'string') {
    const match = obj.uri.match(/\/nodes\/([^\/\?]+)/);
    if (match) ids.add(match[1]);
  }

  const containerProps = ['children', 'items', 'nodes', 'entries', 'data', 'toc', 'tree'];
  for (const prop of containerProps) {
    if (Array.isArray(obj[prop])) {
      obj[prop].forEach(item => extractNodeIds(item, ids));
    } else if (obj[prop]) {
      extractNodeIds(obj[prop], ids);
    }
  }

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      extractNodeIds(value, ids);
    }
  }

  return ids;
}

async function fetchNode(nodeId) {
  try {
    const url = `${BASE_URL}/projects/${PROJECT_ID}/nodes/${nodeId}`;
    const data = await fetchAPI(url);
    downloadedData.nodes[nodeId] = data;
    console.log(`✓ Downloaded node: ${nodeId}`);
    return data;
  } catch (error) {
    console.error(`✗ Failed to fetch node ${nodeId}:`, error.message);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadAllDocs() {
  console.log('🚀 Starting Stoplight Documentation Download...\n');

  const startTime = Date.now();
  let nodeIds = new Set();

  // Step 1: Get Table of Contents
  console.log('📋 Fetching table of contents...');
  try {
    downloadedData.toc = await fetchAPI(`${BASE_URL}/projects/${PROJECT_ID}/table-of-contents`);
    const tocIds = extractNodeIds(downloadedData.toc);
    tocIds.forEach(id => nodeIds.add(id));
    console.log(`✓ Found ${tocIds.size} nodes in TOC\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch TOC: ${error.message}\n`);
  }

  // Step 2: Get Project Info
  console.log('📦 Fetching project info...');
  try {
    downloadedData.project = await fetchAPI(`${BASE_URL}/projects/${PROJECT_ID}`);
    const projectIds = extractNodeIds(downloadedData.project);
    projectIds.forEach(id => nodeIds.add(id));
    console.log(`✓ Found ${projectIds.size} additional nodes in project\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch project: ${error.message}\n`);
  }

  // Step 3: Download all nodes
  console.log(`📥 Downloading ${nodeIds.size} documentation nodes...`);
  console.log('This may take a few minutes...\n');

  let count = 0;
  const total = nodeIds.size;

  for (const nodeId of nodeIds) {
    count++;
    console.log(`[${count}/${total}] ${nodeId}`);

    await fetchNode(nodeId);

    // Rate limiting - be nice to the API
    await sleep(300);

    // Update progress every 10 items
    if (count % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (count / elapsed).toFixed(1);
      const remaining = ((total - count) / rate).toFixed(0);
      console.log(`Progress: ${count}/${total} (${rate}/sec, ~${remaining}s remaining)`);
    }
  }

  // Create manifest
  downloadedData.manifest = {
    downloadDate: new Date().toISOString(),
    projectId: PROJECT_ID,
    totalNodes: nodeIds.size,
    downloadedNodes: Object.keys(downloadedData.nodes).length,
    duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    nodeList: Array.from(nodeIds),
  };

  console.log('\n✅ Download complete!');
  console.log(`📊 Downloaded ${Object.keys(downloadedData.nodes).length} nodes`);
  console.log(`⏱️  Duration: ${downloadedData.manifest.duration}`);
  console.log('\n💾 To save the data, run:');
  console.log('   downloadDataAsFiles()');

  return downloadedData;
}

function downloadDataAsFiles() {
  console.log('💾 Preparing downloads...\n');

  // Download the complete dataset as one file
  const blob = new Blob([JSON.stringify(downloadedData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stoplight-docs-complete-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('✓ Downloaded complete dataset');

  // Also download individual files
  setTimeout(() => {
    for (const [nodeId, nodeData] of Object.entries(downloadedData.nodes)) {
      const blob = new Blob([JSON.stringify(nodeData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `node-${nodeId.replace(/[^a-z0-9-]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    console.log(`✓ Downloaded ${Object.keys(downloadedData.nodes).length} individual node files`);
  }, 1000);

  // Download manifest
  setTimeout(() => {
    const blob = new Blob([JSON.stringify(downloadedData.manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('✓ Downloaded manifest');
  }, 2000);

  console.log('\n✅ All files queued for download!');
  console.log('Note: Your browser may ask you to allow multiple downloads.');
}

// Convenience function to download and save in one go
async function downloadAndSave() {
  await downloadAllDocs();
  setTimeout(() => {
    downloadDataAsFiles();
  }, 1000);
}

// Instructions
console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Stoplight Documentation Downloader (Browser Version)     ║
╚══════════════════════════════════════════════════════════════╝

📖 Instructions:

1. Make sure you're on https://developer.buildops.com
2. Run: await downloadAllDocs()
   This will fetch all documentation nodes

3. After download completes, run: downloadDataAsFiles()
   This will download all files to your computer

4. OR run both steps at once: await downloadAndSave()

🔍 Utility functions:

- window.STOPLIGHT_TOKEN = "your_token" - Set token manually
- downloadedData - View all downloaded data
- downloadedData.nodes - View all downloaded nodes

Ready to start!
`);
