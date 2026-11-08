import http from 'node:http';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Command } from 'commander';

const program = new Command();

program
  .helpOption('-?, --help', 'Показати довідку')
  .requiredOption('-h, --host <address>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до теки кешу');

program.parse(process.argv);

const options = program.opts();

const port = Number(options.port);
const cacheDirectory = path.resolve(options.cache);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Порт має бути числом від 1 до 65535.');
  process.exitCode = 1;
} else {
  try {
    await mkdir(cacheDirectory, { recursive: true });

    const server = http.createServer(async (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8'
      });

      res.end('Proxy server is running');
    });

    server.listen(port, options.host);

    console.log(`Server running at http://${options.host}:${port}`);
    console.log(`Cache directory: ${cacheDirectory}`);
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    process.exitCode = 1;
  }
}
