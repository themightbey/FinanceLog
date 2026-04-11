import { useEffect, useState } from 'react';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

import MainCard from 'ui-component/cards/MainCard';
import financeApi from 'api/finance';

export default function FinanceSettings() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUrl(financeApi.baseUrl());
  }, []);

  const save = () => {
    financeApi.setBaseUrl(url.trim());
    setStatus({ severity: 'success', msg: 'Saved. Reload the page for the change to take effect.' });
  };

  const testConnection = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await financeApi.health();
      setStatus({ severity: 'success', msg: `Connected: ${JSON.stringify(res)}` });
    } catch (err) {
      setStatus({ severity: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    // The cleanest way to clear Basic Auth creds is to hit a 401 with a
    // bogus Authorization header — the browser then forgets the cached
    // credentials for this origin.
    fetch('/api/summary', { headers: { Authorization: 'Basic ' + btoa('logout:logout') }, cache: 'no-store' })
      .catch(() => {})
      .finally(() => window.location.reload());
  };

  return (
    <Stack spacing={3}>
      <MainCard title="FinanceLog settings">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            The site is hosted end-to-end by a single Cloudflare Worker, so the SPA and the API are on the same origin. The Worker gates
            every request behind HTTP Basic Auth — that&apos;s the password prompt you got when you first loaded the page.
          </Typography>

          <Button variant="outlined" color="warning" onClick={logout} sx={{ alignSelf: 'flex-start' }}>
            Sign out (clear browser credentials)
          </Button>
        </Stack>
      </MainCard>

      <MainCard title="Advanced — custom API host">
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Only touch this if you&apos;re running the SPA against a different worker (e.g. local dev without the vite proxy). Leave blank
            to use the current origin.
          </Typography>
          <TextField
            label="API URL override"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="leave blank for same-origin"
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={save}>
              Save
            </Button>
            <Button variant="outlined" onClick={testConnection} disabled={busy}>
              {busy ? 'Testing…' : 'Test connection'}
            </Button>
          </Stack>
          {status && <Alert severity={status.severity}>{status.msg}</Alert>}
        </Stack>
      </MainCard>

      <MainCard title="How it works">
        <Stack spacing={1.5}>
          <Typography variant="body2">
            <b>1. Upload.</b> PDFs are hashed (SHA-256) in the worker. If the hash already exists in D1 you get a 409 and nothing else
            happens — no duplicate Mistral spend, no duplicate data.
          </Typography>
          <Typography variant="body2">
            <b>2. Store.</b> The raw PDF goes into R2 keyed by its hash so you always have the source of truth.
          </Typography>
          <Typography variant="body2">
            <b>3. Extract.</b> Mistral OCR turns the PDF into markdown, then <code>mistral-large-latest</code> produces a strict JSON object
            with statement fields and every transaction.
          </Typography>
          <Typography variant="body2">
            <b>4. Persist.</b> The worker writes one row to <code>statements</code> and one row per line item to <code>transactions</code>{' '}
            in D1, all inside a batch.
          </Typography>
        </Stack>
      </MainCard>
    </Stack>
  );
}
