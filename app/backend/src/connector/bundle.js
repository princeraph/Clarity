// The Claude Desktop extension (.mcpb): a zip holding manifest.json and the MCP
// server, built on demand so it carries this machine's connector token and the
// path to Clarity.exe (for the wake-up). Double-clicked, Claude Desktop installs
// it — no command to type, no configuration file to edit.
//
// The zip is written here (stored, not compressed: two small text files) rather
// than with a library, so the backend gains no dependency for it.

import { readFileSync } from 'fs';
import { crc32 } from 'zlib';
import { fileURLToPath } from 'url';
import { TOOLS } from './mcp-server.mjs';

export const SERVER_FILE = fileURLToPath(new URL('./mcp-server.mjs', import.meta.url));
export const DEFAULT_URL = 'http://127.0.0.1:3001';

export function manifest({ token, appPath, version, url = DEFAULT_URL, platform = process.platform }) {
  return {
    manifest_version: '0.3',
    name: 'clarity',
    display_name: 'Clarity',
    version,
    description: 'Your Clarity tasks, from Claude: what to do next, add tasks, mark them done, get unstuck.',
    long_description: 'Talks only to Clarity on this computer. Shares task titles, statuses, dates, tags and short descriptions — never Clarity’s notes, journal or profile. Turn it off in Clarity → Settings → AI assistant.',
    author: { name: 'Clarity' },
    server: {
      type: 'node',
      entry_point: 'server/index.mjs',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.mjs'],
        env: { CLARITY_CONNECTOR_TOKEN: token, CLARITY_URL: url, ...(appPath ? { CLARITY_APP: appPath } : {}) },
      },
    },
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    compatibility: { platforms: [platform] },
  };
}

/** The same server, for MCP clients other than Claude Desktop. */
export function manualConfig({ token, appPath, nodePath, url = DEFAULT_URL }) {
  return {
    mcpServers: {
      clarity: {
        command: nodePath,
        args: [SERVER_FILE],
        // Clarity.exe is Electron; this variable makes it run the file as Node.
        env: { ELECTRON_RUN_AS_NODE: '1', CLARITY_CONNECTOR_TOKEN: token, CLARITY_URL: url, ...(appPath ? { CLARITY_APP: appPath } : {}) },
      },
    },
  };
}

export function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);  // UTF-8 names
    local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 10);                                            // stored, no date
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function buildBundle(opts) {
  return zip([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest(opts), null, 2)) },
    { name: 'server/index.mjs', data: readFileSync(SERVER_FILE) },
  ]);
}
