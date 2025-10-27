#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Configuration - UPDATE THESE VALUES
const PROJECT_ID = 'cHJqOjI4NDA4Mw';
const BRANCH_ID = 'YnI6MTA0OTgxOTc';
const BEARER_TOKEN = process.env.STOPLIGHT_TOKEN || 'YOUR_TOKEN_HERE';
const OUTPUT_DIR = './stoplight-docs';
const BASE_URL = 'https://stoplight.io/api/v1';

// Track what we've downloaded
const downloadedNodes = new Set();
const failedNodes = [];

async function fetchAPI(url) {
  console.log(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'authorization': `Bearer ${BEARER_TOKEN}`,
      'origin': 'https://developer.buildops.com',
      'referer': 'https://developer.buildops.com/',
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function saveJSON(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename);
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log(`✓ Saved: ${filename}`);
}

async function fetchNode(nodeId) {
  if (downloadedNodes.has(nodeId)) {
    return null;
  }

  try {
    const url = `${BASE_URL}/projects/${PROJECT_ID}/nodes/${nodeId}`;
    const data = await fetchAPI(url);
    downloadedNodes.add(nodeId);
    return data;
  } catch (error) {
    console.error(`✗ Failed to fetch node ${nodeId}: ${error.message}`);
    failedNodes.push({ nodeId, error: error.message });
    return null;
  }
}

function extractNodeIds(obj, ids = new Set()) {
  if (!obj || typeof obj !== 'object') return ids;

  // Look for node IDs in various properties
  if (obj.id && typeof obj.id === 'string' && obj.id.length > 5) {
    ids.add(obj.id);
  }

  if (obj.uri && typeof obj.uri === 'string') {
    // Extract node ID from URI if present
    const match = obj.uri.match(/\/nodes\/([^\/]+)/);
    if (match) ids.add(match[1]);
  }

  // Recursively search common container properties
  const containerProps = ['children', 'items', 'nodes', 'entries', 'data', 'toc', 'tree'];
  for (const prop of containerProps) {
    if (Array.isArray(obj[prop])) {
      obj[prop].forEach(item => extractNodeIds(item, ids));
    } else if (obj[prop]) {
      extractNodeIds(obj[prop], ids);
    }
  }

  // Also check all object values
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      extractNodeIds(value, ids);
    }
  }

  return ids;
}

async function main() {
  console.log('🚀 Stoplight Documentation Downloader\n');

  if (BEARER_TOKEN === 'YOUR_TOKEN_HERE') {
    console.error('❌ Error: Please set STOPLIGHT_TOKEN environment variable or update the script');
    console.error('Usage: STOPLIGHT_TOKEN="your_token_here" node stoplight-downloader.js');
    process.exit(1);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Step 1: Try to get the table of contents
  console.log('📋 Step 1: Fetching table of contents...\n');
  let toc = null;
  let nodeIds = new Set();

  try {
    toc = await fetchAPI(`${BASE_URL}/projects/${PROJECT_ID}/table-of-contents`);
    await saveJSON('_table-of-contents.json', toc);
    nodeIds = extractNodeIds(toc);
    console.log(`Found ${nodeIds.size} nodes in table of contents\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch table of contents: ${error.message}`);
  }

  // Step 2: Try to get project info
  console.log('📦 Step 2: Fetching project info...\n');
  try {
    const project = await fetchAPI(`${BASE_URL}/projects/${PROJECT_ID}`);
    await saveJSON('_project-info.json', project);
    const projectNodeIds = extractNodeIds(project);
    projectNodeIds.forEach(id => nodeIds.add(id));
    console.log(`Found ${projectNodeIds.size} additional nodes in project info\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch project info: ${error.message}\n`);
  }

  // Step 3: Try to get branch info
  console.log('🌿 Step 3: Fetching branch info...\n');
  try {
    const branch = await fetchAPI(`${BASE_URL}/projects/${PROJECT_ID}/branches/${BRANCH_ID}`);
    await saveJSON('_branch-info.json', branch);
    const branchNodeIds = extractNodeIds(branch);
    branchNodeIds.forEach(id => nodeIds.add(id));
    console.log(`Found ${branchNodeIds.size} additional nodes in branch info\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch branch info: ${error.message}\n`);
  }

  // Step 4: Download all discovered nodes
  if (nodeIds.size === 0) {
    console.log('❌ No nodes discovered. Check your token and try again.');
    process.exit(1);
  }

  console.log(`📥 Step 4: Downloading ${nodeIds.size} documentation nodes...\n`);

  let count = 0;
  for (const nodeId of nodeIds) {
    count++;
    console.log(`[${count}/${nodeIds.size}] Downloading node: ${nodeId}`);

    const nodeData = await fetchNode(nodeId);
    if (nodeData) {
      const sanitizedId = nodeId.replace(/[^a-z0-9-]/gi, '_');
      await saveJSON(`nodes/${sanitizedId}.json`, nodeData);

      // Look for more nodes referenced in this node
      const nestedIds = extractNodeIds(nodeData);
      nestedIds.forEach(id => {
        if (!downloadedNodes.has(id) && !nodeIds.has(id)) {
          nodeIds.add(id);
        }
      });
    }

    // Rate limiting - be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Step 5: Summary
  console.log('\n✅ Download complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   - Total nodes discovered: ${nodeIds.size}`);
  console.log(`   - Successfully downloaded: ${downloadedNodes.size}`);
  console.log(`   - Failed: ${failedNodes.length}`);
  console.log(`   - Output directory: ${OUTPUT_DIR}`);

  if (failedNodes.length > 0) {
    await saveJSON('_failed-nodes.json', failedNodes);
    console.log(`\n⚠️  Failed nodes saved to _failed-nodes.json`);
  }

  // Create a manifest
  const manifest = {
    downloadDate: new Date().toISOString(),
    projectId: PROJECT_ID,
    branchId: BRANCH_ID,
    totalNodes: nodeIds.size,
    downloadedNodes: downloadedNodes.size,
    failedNodes: failedNodes.length,
    nodeList: Array.from(downloadedNodes),
  };
  await saveJSON('_manifest.json', manifest);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
