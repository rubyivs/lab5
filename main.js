
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { Command } from 'commander';
import superagent from 'superagent';

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
     if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
        res.writeHead(405, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Allow': 'GET, PUT, DELETE'
        });
        res.end('Method Not Allowed');
        return;
      }

      const url = new URL(req.url, 'http://localhost');
      const match = url.pathname.match(/^\/(\d{3})$/);

      if (!match) {
        res.writeHead(404);
        res.end('Image not found');
        return;
      }

      const statusCode = Number(match[1]);

      if (statusCode < 100 || statusCode > 599) {
        res.writeHead(404);
        res.end('Image not found');
        return;
      }

      const imagePath = path.join(cacheDirectory, `${statusCode}.jpg`);

      if (req.method === 'GET') {
        try {
          let image;
          let source;

          try {
            image = await readFile(imagePath);
            source = 'cache';
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error;
            }

            let response;

            try {
              response = await superagent
                .get(`https://http.cat/${statusCode}`)
                .buffer(true);
            } catch (error) {
              res.writeHead(404);
              res.end('Image not found');
              return;
            }

            image = response.body;

            if (!Buffer.isBuffer(image) || image.length === 0) {
              res.writeHead(404);
              res.end('Image not found');
              return;
            }

            await writeFile(imagePath, image);
            source = 'http.cat';
          }

          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'X-Image-Source': source
          });

          res.end(image);
        } catch (error) {
          console.error(`Request error: ${error.message}`);

          res.writeHead(500, {
            'Content-Type': 'text/plain; charset=utf-8'
          });

          res.end('Internal Server Error');
        }
      }

      if (req.method === 'PUT') {
        try {
          const chunks = [];

          for await (const chunk of req) {
            chunks.push(chunk);
          }

          const image = Buffer.concat(chunks);

          if (image.length === 0) {
            res.writeHead(400);
            res.end('Empty image');
            return;
          }

          await writeFile(imagePath, image);

          res.writeHead(201, {
            'Content-Type': 'text/plain; charset=utf-8'
          });

          res.end('Image saved');
        } catch (error) {
          console.error(`Request error: ${error.message}`);

          res.writeHead(500, {
            'Content-Type': 'text/plain; charset=utf-8'
          });

          res.end('Internal Server Error');
        }
      }
            if (req.method === 'DELETE') {
        try {
          await unlink(imagePath);

          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8'
          });

          res.end('Image deleted');
        } catch (error) {
          if (error.code === 'ENOENT') {
            res.writeHead(404, {
              'Content-Type': 'text/plain; charset=utf-8'
            });

            res.end('Image not found');
            return;
          }

          console.error(`Request error: ${error.message}`);

          res.writeHead(500, {
            'Content-Type': 'text/plain; charset=utf-8'
          });

          res.end('Internal Server Error');
        }
      }
    });

    server.listen(port, options.host);

    console.log(`Server running at http://${options.host}:${port}`);
    console.log(`Cache directory: ${cacheDirectory}`);
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    process.exitCode = 1;
  }
}
