import { useRef, useState } from 'react';
import Note from './Note';
import { SHOP } from '../config';
import { stripControl } from '../utils/sanitize';
import { uploadFile, uploadsEnabled, MAX_UPLOAD_BYTES } from '../utils/uploads';

// One uploader per print location. Grafted from prodigal-design-quote-request, where it
// replaced the Local Threads calculator's bare uploadBytes call (that one sent a link
// only, held no attachment, and had no timeout). `form` here is ONE location
// ({ files, artFailures }) and `update` patches that location.
//
// Each file goes two ways (see utils/uploads.js): up to the file bucket for a download
// link, and, when it is small enough, into the lead request as a real email attachment.
// A file is kept if EITHER way worked. It is only reported as failed when both did not.
//
// The attachment limit is measured on the ENCODED size (base64 is 4/3 of the raw file),
// not the raw file size, because the mail service takes attachments inside the JSON
// body and Vercel rejects a body over 4.5MB before the handler ever runs. 3.4MB encoded
// is about 2.5MB of files, and leaves room for every other field under the 3.8MB send
// budget in emailService.js.
const MAX_ATTACH_ENCODED = Math.floor(3.4 * 1024 * 1024);
const MAX_FILES = 5;
// A file that never finishes loading must not strand the customer on this step.
const READ_TIMEOUT_MS = 20000;

const encodedSize = (rawBytes) => Math.ceil(rawBytes / 3) * 4;

const prettySize = (bytes) => (bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))}KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)}MB`);

const cleanName = (name) => stripControl(name).replace(/[<>]/g, '').trim().slice(0, 120) || 'artwork';

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  const timer = setTimeout(() => {
    try { reader.abort(); } catch { /* already done */ }
    reject(new Error('timeout'));
  }, READ_TIMEOUT_MS);
  // Strip the "data:<type>;base64," prefix; the mail service wants raw base64.
  reader.onload = () => { clearTimeout(timer); resolve(String(reader.result || '').split(',')[1] || ''); };
  reader.onerror = () => { clearTimeout(timer); reject(new Error('unreadable')); };
  reader.onabort = () => { clearTimeout(timer); reject(new Error('timeout')); };
  reader.readAsDataURL(file);
});

const Uploader = ({ form, update, busy, setBusy, noun = 'File', usedElsewhere = 0 }) => {
  const fileRef = useRef(null);
  const [working, setWorking] = useState('');
  const { files, artFailures } = form;

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // let the customer pick the same file again after removing it
    if (!picked.length) return;

    setBusy(true);
    let current = files.slice();
    const failed = [];
    const landed = [];

    for (const file of picked) {
      const name = cleanName(file.name);
      // Picking a file with a name that is already here replaces it, but only if the
      // new one actually lands. A failed replacement leaves the old file in place.
      const others = current.filter((a) => a.name !== name);
      const replacing = others.length !== current.length;
      if (!replacing && current.length >= MAX_FILES) {
        failed.push({ name, reason: `over the ${MAX_FILES} file limit` });
        continue;
      }
      // The attachment budget is shared by every location on the quote.
      const used = usedElsewhere + others.reduce((sum, a) => sum + (a.data ? a.data.length : 0), 0);
      const fitsAttachment = used + encodedSize(file.size) <= MAX_ATTACH_ENCODED;
      // Checked BEFORE reading, so a 200MB file is never pulled into memory.
      if (uploadsEnabled ? file.size > MAX_UPLOAD_BYTES : !fitsAttachment) {
        failed.push({ name, reason: `${prettySize(file.size)}, too large to send with this form` });
        continue;
      }

      setWorking(name);
      let data = null;
      let url = null;
      let reason = 'could not be read';
      if (fitsAttachment) {
        try {
          data = await readAsBase64(file);
          if (!data) throw new Error('unreadable');
        } catch (err) {
          data = null;
          if (err.message === 'timeout') reason = 'took too long to load';
        }
      }
      if (uploadsEnabled) {
        try {
          url = await uploadFile(file, name);
        } catch (err) {
          console.error('Artwork upload failed:', err);
          if (!fitsAttachment) reason = err.message === 'timeout' ? 'the upload took too long' : 'the upload did not go through';
        }
      }

      if (data || url) {
        current = [...others, { name, type: file.type || 'application/octet-stream', size: file.size, data, url }];
        landed.push(name);
      } else {
        failed.push({ name, reason });
      }
    }

    // Never silent. A file that did not make it is listed here for the customer and
    // rides to the shop by name, and the request still sends without it.
    update((f) => {
      const cleared = f.artFailures.filter((x) => !landed.includes(x.name) && !failed.some((n) => n.name === x.name));
      return { files: current, artFailures: [...cleared, ...failed].slice(0, 10) };
    });
    setWorking('');
    setBusy(false);
  };

  const removeFile = (name) => update((f) => ({ files: f.files.filter((a) => a.name !== name) }));
  const removeFailure = (name) => update((f) => ({ artFailures: f.artFailures.filter((a) => a.name !== name) }));

  return (
    <>
      <div className={`qf-block qf-upload${files.length ? ' has-files' : ''}`}>
        <button
          type='button'
          className='qf-btn qf-btn--ghost'
          onClick={() => fileRef.current?.click()}
          disabled={busy || files.length >= MAX_FILES}
          data-add-file
        >
          {busy ? 'Loading' : (files.length ? `Add Another ${noun}` : `Upload ${noun}`)}
        </button>
        <input
          ref={fileRef}
          type='file'
          multiple
          accept='image/*,.pdf,.ai,.eps,.svg,.psd'
          onChange={handleFileChange}
          hidden
          data-file-input
        />
        <p className='qf-help'>
          Any image, PDF, AI, EPS or PSD. Up to {MAX_FILES} files
          {uploadsEnabled ? `, ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB each.` : ', about 2.5MB in all.'}
        </p>
      </div>

      {busy && working && (
        <Note live data-uploading>Sending {working}. This can take a moment for a large file.</Note>
      )}

      {files.length > 0 && (
        <ul className='qf-files' aria-label='Files added'>
          {files.map((a) => (
            <li key={a.name} className='qf-file' data-attached={a.name} data-linked={a.url ? 'yes' : 'no'}>
              <span className='qf-file__dot' aria-hidden='true' />
              <span className='qf-file__name'>{a.name}</span>
              <span className='qf-file__size'>{a.size ? prettySize(a.size) : 'Added earlier'}</span>
              <button type='button' className='qf-btn qf-btn--ghost qf-btn--sm' onClick={() => removeFile(a.name)} disabled={busy} aria-label={`Remove ${a.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {artFailures.length > 0 && (
        <Note tone='error' live data-art-failures>
          <p>These did not attach. Keep going, your request still sends, and you can email them to {SHOP.email} after.</p>
          <ul className='qf-files qf-files--failed'>
            {artFailures.map((f) => (
              <li key={f.name} className='qf-file' data-failed={f.name}>
                <span className='qf-file__name'>{f.name}</span>
                <span className='qf-file__size'>{f.reason}</span>
                <button type='button' className='qf-btn qf-btn--ghost qf-btn--sm' onClick={() => removeFailure(f.name)} aria-label={`Clear ${f.name}`}>
                  Clear
                </button>
              </li>
            ))}
          </ul>
        </Note>
      )}
    </>
  );
};

export default Uploader;
