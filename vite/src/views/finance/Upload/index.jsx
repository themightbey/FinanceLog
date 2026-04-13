import { useCallback, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';

import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';

import MainCard from 'ui-component/cards/MainCard';
import financeApi from 'api/finance';
import { formatMoney, formatDate } from 'utils/finance-format';

const STATUS = { idle: 'idle', uploading: 'uploading', done: 'done', error: 'error', duplicate: 'duplicate' };

function makeItem(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    status: STATUS.idle,
    message: '',
    result: null
  };
}

export default function FinanceUpload() {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const inputRef = useRef(null);

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!incoming.length) return;
    setSummary(null);
    setItems((prev) => [...prev, ...incoming.map(makeItem)]);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const uploadOne = async (target) => {
    if (!target) return null;
    const id = target.id;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: STATUS.uploading, message: 'Uploading & extracting…' } : it)));
    try {
      const res = await financeApi.uploadStatement(target.file);
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, status: STATUS.done, message: `Imported ${res.transactions_imported || 0} transactions`, result: res }
            : it
        )
      );
      return 'done';
    } catch (err) {
      if (err.status === 409) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, status: STATUS.duplicate, message: 'Already imported', result: err.payload?.existing || null } : it
          )
        );
        return 'duplicate';
      }
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: STATUS.error, message: err.message || 'Upload failed' } : it))
      );
      return 'error';
    }
  };

  const uploadAll = async () => {
    setRunning(true);
    setSummary(null);
    const pendingItems = items.filter((it) => it.status === STATUS.idle || it.status === STATUS.error);
    let done = 0;
    let errors = 0;
    let dupes = 0;
    for (const it of pendingItems) {
      const result = await uploadOne(it);
      if (result === 'done') done++;
      else if (result === 'duplicate') dupes++;
      else errors++;
    }
    setRunning(false);
    setSummary({ done, errors, dupes, total: pendingItems.length });
  };

  const clearDone = () => {
    setItems((prev) => prev.filter((it) => it.status !== STATUS.done && it.status !== STATUS.duplicate));
    setSummary(null);
  };

  const pending = items.filter((it) => it.status === STATUS.idle || it.status === STATUS.error).length;
  const uploading = items.some((it) => it.status === STATUS.uploading);
  const allFinished = items.length > 0 && !pending && !uploading && !running;

  return (
    <Stack spacing={3}>
      <MainCard>
        <Stack spacing={2}>
          <Typography variant="h4">Upload statements</Typography>
          <Typography variant="body2" color="text.secondary">
            Drop one or more PDF statements here. Each file is SHA-256 hashed so identical PDFs are rejected as duplicates. Mistral reads
            every page to pull out the statement metadata, interest rates, minimum payment, and every line-item transaction.
          </Typography>

          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !running && inputRef.current?.click()}
            sx={{
              border: `2px dashed ${dragging ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 2,
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              cursor: running ? 'wait' : 'pointer',
              bgcolor: dragging ? 'primary.light' : 'background.default',
              transition: 'all 0.2s ease',
              opacity: running ? 0.5 : 1
            }}
          >
            <CloudUploadOutlinedIcon sx={{ fontSize: 56, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ mt: 1 }}>
              Drop PDFs here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              or click to browse · up to 25&nbsp;MB per file
            </Typography>
            <input ref={inputRef} type="file" accept="application/pdf" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </Box>

          {running && (
            <Alert severity="info" icon={false}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Processing uploads — please don&apos;t refresh or navigate away.</Typography>
                <LinearProgress />
              </Stack>
            </Alert>
          )}

          {summary && !running && (
            <Alert severity={summary.errors > 0 ? 'warning' : 'success'}>
              Finished: {summary.done} imported, {summary.dupes} duplicates
              {summary.errors > 0 ? `, ${summary.errors} failed` : ''}.
              {summary.errors === 0 && ' Safe to refresh or navigate away.'}
            </Alert>
          )}

          {allFinished && !summary && (
            <Alert severity="success">All uploads complete. Safe to refresh or navigate away.</Alert>
          )}

          {items.length > 0 && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="text"
                onClick={clearDone}
                disabled={running || !items.some((it) => it.status === STATUS.done || it.status === STATUS.duplicate)}
              >
                Clear completed
              </Button>
              {allFinished && (
                <Button variant="outlined" component={RouterLink} to="/finance/overview">
                  Go to Overview
                </Button>
              )}
              <Button variant="contained" onClick={uploadAll} disabled={pending === 0 || running}>
                {running ? 'Uploading…' : `Upload ${pending > 0 ? `(${pending})` : ''}`}
              </Button>
            </Stack>
          )}
        </Stack>
      </MainCard>

      {items.length > 0 && (
        <MainCard title="Queue">
          <Stack divider={<Divider />} spacing={2}>
            {items.map((it) => (
              <UploadRow key={it.id} item={it} onRetry={() => uploadOne(it)} retryDisabled={running} />
            ))}
          </Stack>
        </MainCard>
      )}
    </Stack>
  );
}

function UploadRow({ item, onRetry, retryDisabled }) {
  const { file, status, message, result } = item;
  const color =
    status === STATUS.done ? 'success' : status === STATUS.error ? 'error' : status === STATUS.duplicate ? 'warning' : 'primary';

  const Icon =
    status === STATUS.done
      ? CheckCircleOutlineIcon
      : status === STATUS.error
        ? ErrorOutlineIcon
        : status === STATUS.duplicate
          ? ErrorOutlineIcon
          : PictureAsPdfOutlinedIcon;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        <Icon color={color === 'primary' ? 'action' : color} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap title={file.name}>
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {(file.size / 1024).toFixed(0)} KB · {status}
            {message ? ` · ${message}` : ''}
          </Typography>
          {status === STATUS.uploading && <LinearProgress sx={{ mt: 0.75 }} />}
        </Box>
      </Box>

      {status === STATUS.done && result && (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {result.extraction?.account_name && <Chip size="small" label={result.extraction.account_name} />}
          {result.extraction?.closing_balance != null && (
            <Chip size="small" color="error" variant="outlined" label={formatMoney(result.extraction.closing_balance)} />
          )}
          {result.extraction?.payment_due_date && (
            <Chip size="small" color="warning" variant="outlined" label={`due ${formatDate(result.extraction.payment_due_date)}`} />
          )}
          <Button size="small" component={RouterLink} to="/finance/statements">
            View
          </Button>
        </Stack>
      )}

      {status === STATUS.error && (
        <Button size="small" color="error" onClick={onRetry} disabled={retryDisabled}>
          Retry
        </Button>
      )}

      {status === STATUS.duplicate && (
        <Alert severity="warning" sx={{ py: 0 }}>
          Already imported{result?.statement_date ? ` on ${formatDate(result.statement_date)}` : ''}
        </Alert>
      )}
    </Stack>
  );
}
