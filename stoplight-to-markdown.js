#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const INPUT_DIR = './stoplight-docs/nodes';
const OUTPUT_DIR = './stoplight-docs/markdown';

async function convertNodeToMarkdown(nodeData) {
  let markdown = '';

  // Extract title
  const title = nodeData.name || nodeData.title || 'Untitled';
  markdown += `# ${title}\n\n`;

  // Add metadata
  if (nodeData.type) {
    markdown += `**Type:** ${nodeData.type}\n\n`;
  }

  // Extract content based on type
  if (nodeData.data) {
    const data = nodeData.data;

    // Handle markdown content
    if (typeof data === 'string') {
      markdown += data + '\n\n';
    } else if (data.content) {
      markdown += data.content + '\n\n';
    } else if (data.markdown) {
      markdown += data.markdown + '\n\n';
    }

    // Handle OpenAPI/HTTP service specs
    if (data.paths) {
      markdown += '## API Endpoints\n\n';
      for (const [pathName, pathData] of Object.entries(data.paths)) {
        markdown += `### ${pathName}\n\n`;
        for (const [method, methodData] of Object.entries(pathData)) {
          if (typeof methodData === 'object') {
            markdown += `**${method.toUpperCase()}**\n\n`;
            if (methodData.summary) {
              markdown += `${methodData.summary}\n\n`;
            }
            if (methodData.description) {
              markdown += `${methodData.description}\n\n`;
            }
          }
        }
      }
    }

    // Handle models/schemas
    if (data.components?.schemas) {
      markdown += '## Schemas\n\n';
      for (const [schemaName, schemaData] of Object.entries(data.components.schemas)) {
        markdown += `### ${schemaName}\n\n`;
        if (schemaData.description) {
          markdown += `${schemaData.description}\n\n`;
        }
        if (schemaData.properties) {
          markdown += '**Properties:**\n\n';
          for (const [propName, propData] of Object.entries(schemaData.properties)) {
            markdown += `- **${propName}**`;
            if (propData.type) markdown += ` (${propData.type})`;
            if (propData.description) markdown += `: ${propData.description}`;
            markdown += '\n';
          }
          markdown += '\n';
        }
      }
    }
  }

  // Add raw JSON as details if no content was extracted
  if (markdown.length < 100) {
    markdown += '\n<details>\n<summary>Raw JSON Data</summary>\n\n```json\n';
    markdown += JSON.stringify(nodeData, null, 2);
    markdown += '\n```\n\n</details>\n';
  }

  return markdown;
}

async function main() {
  console.log('📝 Converting Stoplight docs to Markdown...\n');

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const files = await fs.readdir(INPUT_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`Found ${jsonFiles.length} JSON files to convert\n`);

    for (const file of jsonFiles) {
      const inputPath = path.join(INPUT_DIR, file);
      const outputPath = path.join(OUTPUT_DIR, file.replace('.json', '.md'));

      try {
        const content = await fs.readFile(inputPath, 'utf-8');
        const nodeData = JSON.parse(content);

        const markdown = await convertNodeToMarkdown(nodeData);
        await fs.writeFile(outputPath, markdown);

        console.log(`✓ Converted: ${file} -> ${path.basename(outputPath)}`);
      } catch (error) {
        console.error(`✗ Failed to convert ${file}: ${error.message}`);
      }
    }

    console.log('\n✅ Conversion complete!');
    console.log(`📁 Markdown files saved to: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
