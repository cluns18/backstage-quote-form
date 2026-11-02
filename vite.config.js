import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` never talks to the production mail service. The form posts to
// /__mock/send_lead in dev (see src/config.js) and this answers it: the lead is printed
// in this terminal and goes nowhere. Set MOCK_LEAD_STATUS=500 before `npm run dev` to
// rehearse a failed send.
const mockLeadEndpoint = () => ({
  name: 'mock-lead-endpoint',
  configureServer(server) {
    server.middlewares.use('/__mock/send_lead', (req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw || '{}'); } catch { /* printed as empty */ }
        const { attachments = [], ...rest } = body;
        const status = Number(process.env.MOCK_LEAD_STATUS) || 200;
        console.log(`\n[mock send_lead] ${raw.length} bytes received, answering ${status}. NOT sent anywhere.`);
        console.log(JSON.stringify({
          ...rest,
          attachments: attachments.map((a) => ({ name: a.name, type: a.type, base64_chars: (a.data || '').length })),
        }, null, 2));
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(status === 200 ? { ok: true, mock: true } : { ok: false, error: 'mock failure' }));
      });
    });
  },
});

// The same promise for artwork: in dev a picked file is "uploaded" to this server, which
// keeps nothing and hands back a link that goes nowhere. The real file bucket is only
// ever reached from a production build.
const mockUploadEndpoint = () => ({
  name: 'mock-upload-endpoint',
  configureServer(server) {
    server.middlewares.use('/__mock/upload', (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const name = url.searchParams.get('name') || 'uploads/file';
      const status = Number(process.env.MOCK_UPLOAD_STATUS) || 200;
      console.log(`\n[mock upload] ${name} (${url.searchParams.get('bytes') || '?'} bytes), answering ${status}. NOT stored anywhere.`);
      req.resume();
      req.on('end', () => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: `http://127.0.0.1:5391/__mock/files/${encodeURIComponent(name)}` }));
      });
    });
  },
});

// This form has its OWN ports and binds 127.0.0.1 only, so it can never be confused with
// another client's form left running on the Vite defaults (prodigal-design-quote-request
// vite.config.js has the story). 5391 and 4391 are this form's.
export default defineConfig({
  plugins: [react(), mockLeadEndpoint(), mockUploadEndpoint()],
  server: { host: '127.0.0.1', port: 5391, strictPort: true },
  preview: { host: '127.0.0.1', port: 4391, strictPort: true },
});
