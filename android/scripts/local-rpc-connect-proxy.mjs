import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Emulator diagnostic only. Relay encrypted bytes to the official RPC hostname;
// never terminate TLS, substitute RPC results, or forward to another destination.
export const RPC_HOST = 'api.mainnet.solana.com';
export function acceptsConnect(header) {
  if (Buffer.byteLength(header) > 8192) return false;
  const firstLine = header.split('\r\n', 1)[0];
  const match = /^CONNECT ([A-Za-z0-9.-]+):443 HTTP\/1\.[01]$/.exec(firstLine);
  return match?.[1].toLowerCase() === RPC_HOST;
}

export function startRpcProxy(port = 18843) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Expected a local port from 1024 to 65535.');
  const clients = new Set();
  let accepted = 0;
  const server = net.createServer(client => {
    if (clients.size >= 4) { client.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    clients.add(client);
    client.once('close', () => clients.delete(client));
    client.on('error', () => client.destroy());
    client.setTimeout(15000, () => client.destroy());
    let header = Buffer.alloc(0);
    const readHeader = chunk => {
      header = Buffer.concat([header, chunk]);
      const end = header.indexOf('\r\n\r\n');
      if (end < 0) {
        if (header.length > 8192) client.end('HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n');
        return;
      }
      client.removeListener('data', readHeader);
      client.pause();
      if (end > 8192 || !acceptsConnect(header.subarray(0, end + 4).toString('ascii'))) {
        client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return;
      }
      // net.connect uses the host OS resolver. The Android TLS client retains
      // api.mainnet.solana.com as its certificate/SNI hostname.
      const upstream = net.connect({ host: RPC_HOST, port: 443 });
      let established = false;
      upstream.setTimeout(15000, () => upstream.destroy());
      upstream.on('error', () => {
        if (established) client.destroy();
        else client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      });
      upstream.once('close', () => client.destroy());
      client.once('close', () => upstream.destroy());
      upstream.once('connect', () => {
        established = true;
        client.setTimeout(30000, () => client.destroy());
        upstream.setTimeout(30000, () => upstream.destroy());
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        const pendingBytes = header.subarray(end + 4);
        if (pendingBytes.length) upstream.write(pendingBytes);
        header = Buffer.alloc(0);
        client.pipe(upstream);
        upstream.pipe(client);
        client.resume();
        console.log(JSON.stringify({ event: 'official-rpc-tunnel-open', number: ++accepted, target: `${RPC_HOST}:443` }));
      });
    };
    client.on('data', readHeader);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ event: 'ready', bind: '127.0.0.1', port, emulatorProxy: `10.0.2.2:${port}`, target: `${RPC_HOST}:443`, tlsTerminated: false, rpcPayloadLogged: false, expiresAfterSeconds: 600 }));
  });
  const close = () => { for (const client of clients) client.destroy(); server.close(); };
  const expiry = setTimeout(close, 600000);
  expiry.unref();
  server.once('close', () => clearTimeout(expiry));
  return { server, close };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, close } = startRpcProxy(Number(process.argv[2] || 18843));
  server.on('error', error => { console.error(`Local RPC tunnel could not start: ${error.code || 'error'}`); process.exitCode = 1; });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
