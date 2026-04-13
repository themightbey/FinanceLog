import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';

import MainCard from 'ui-component/cards/MainCard';
import financeApi from 'api/finance';
import { formatMoney, formatDate, CATEGORY_COLORS } from 'utils/finance-format';

const ALL_CATEGORIES = [
  'groceries', 'dining', 'travel', 'utilities', 'shopping', 'entertainment',
  'fees', 'interest', 'payment', 'transfer', 'income', 'other'
];

export default function FinanceTransactions() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editTx, setEditTx] = useState(null);

  useEffect(() => {
    const urlQ = searchParams.get('q');
    if (urlQ) setQ(urlQ);
  }, [searchParams]);

  const key = useMemo(() => ['transactions', q, category, from, to], [q, category, from, to]);
  const { data, error, isLoading } = useSWR(key, () => financeApi.listTransactions({ q, category, from, to, limit: 1000 }));
  const { data: catData } = useSWR('categories', () => financeApi.listCategories());

  const rows = useMemo(() => data?.transactions || [], [data]);
  const categories = catData?.categories || [];

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of rows) {
      const a = Number(t.amount || 0);
      if (a > 0) expense += a;
      else income += -a;
    }
    return { income, expense, net: income - expense };
  }, [rows]);

  const exportUrl = financeApi.exportTransactionsUrl({ q, category, from, to });

  return (
    <Stack spacing={3}>
      <MainCard>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4">Transactions</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              component="a"
              href={exportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export CSV
            </Button>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="merchant or description"
              size="small"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }
              }}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} size="small" sx={{ minWidth: 180 }}>
              <MenuItem value="">All</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.category} value={c.category}>
                  {c.category} ({c.count})
                </MenuItem>
              ))}
            </TextField>
            <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`${rows.length} rows`} size="small" />
            <Chip color="error" variant="outlined" label={`Expense ${formatMoney(totals.expense)}`} size="small" />
            <Chip color="success" variant="outlined" label={`Income ${formatMoney(totals.income)}`} size="small" />
            <Chip color={totals.net >= 0 ? 'success' : 'warning'} label={`Net ${formatMoney(totals.net)}`} size="small" />
          </Stack>
        </Stack>
      </MainCard>

      <MainCard content={false}>
        {error && <Alert severity="error" sx={{ m: 2 }}>{error.message}</Alert>}
        <TableContainer sx={{ maxHeight: 640 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Account</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Box sx={{ py: 6 }}>
                      <Typography color="text.secondary">No transactions match your filters.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((t) => {
                const amount = Number(t.amount || 0);
                const isExpense = amount > 0;
                return (
                  <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEditTx(t)}>
                    <TableCell>{formatDate(t.tx_date || t.post_date)}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{t.description || '—'}</Typography>
                        {t.merchant && t.merchant !== t.description && (
                          <Typography variant="caption" color="text.secondary">{t.merchant}</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t.category || 'uncategorized'}
                        sx={{
                          bgcolor: CATEGORY_COLORS[t.category] || CATEGORY_COLORS.uncategorized,
                          color: '#fff',
                          fontWeight: 500
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {t.account_name || t.issuer || '—'}
                        {t.last_four ? ` •${t.last_four}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: isExpense ? 'error.main' : 'success.main' }}>
                        {isExpense ? '' : '+'}{formatMoney(Math.abs(amount), t.currency)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </MainCard>

      <EditTransactionDialog tx={editTx} onClose={() => setEditTx(null)} swrKey={key} />
    </Stack>
  );
}

function EditTransactionDialog({ tx, onClose, swrKey }) {
  const { mutate } = useSWRConfig();
  const [cat, setCat] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tx) setCat(tx.category || '');
  }, [tx]);

  const save = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      await financeApi.updateTransaction(tx.id, { category: cat || null });
      mutate(swrKey);
      mutate('categories');
      mutate('summary');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!tx) return null;
  const amount = Number(tx.amount || 0);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit transaction</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Description</Typography>
            <Typography variant="body1">{tx.description || '—'}</Typography>
          </Box>
          {tx.merchant && (
            <Box>
              <Typography variant="caption" color="text.secondary">Merchant</Typography>
              <Typography variant="body1">{tx.merchant}</Typography>
            </Box>
          )}
          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="caption" color="text.secondary">Date</Typography>
              <Typography variant="body1">{formatDate(tx.tx_date || tx.post_date)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Amount</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: amount > 0 ? 'error.main' : 'success.main' }}>
                {amount > 0 ? '' : '+'}{formatMoney(Math.abs(amount))}
              </Typography>
            </Box>
          </Stack>
          <Box>
            <Typography variant="caption" color="text.secondary">Account</Typography>
            <Typography variant="body1">{tx.account_name || tx.issuer || '—'}{tx.last_four ? ` •${tx.last_four}` : ''}</Typography>
          </Box>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select value={cat} label="Category" onChange={(e) => setCat(e.target.value)}>
              <MenuItem value="">uncategorized</MenuItem>
              {ALL_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: CATEGORY_COLORS[c] || CATEGORY_COLORS.other }} />
                    <span>{c}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
