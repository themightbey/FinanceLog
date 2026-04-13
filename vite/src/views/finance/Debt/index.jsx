import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';

import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LinearProgress from '@mui/material/LinearProgress';
import { useTheme } from '@mui/material/styles';

import Chart from 'react-apexcharts';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';
import financeApi from 'api/finance';
import { formatMoney, formatDate, percent } from 'utils/finance-format';

const STAT_GRADIENTS = {
  error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  success: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  primary: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
};

function StatCard({ label, value, sub, color = 'primary' }) {
  return (
    <MainCard
      sx={{
        background: STAT_GRADIENTS[color] || STAT_GRADIENTS.primary,
        color: '#fff',
        border: 'none',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 160,
          height: 160,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '50%',
          top: -60,
          right: -40
        }
      }}
    >
      <Stack spacing={0.5} sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#fff' }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {sub}
          </Typography>
        )}
      </Stack>
    </MainCard>
  );
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function urgencyColor(days) {
  if (days === null) return 'default';
  if (days <= 0) return 'error';
  if (days <= 90) return 'warning';
  return 'success';
}

export default function FinanceDebt() {
  const { data, error, isLoading } = useSWR('debt-summary', () => financeApi.debtSummary(), {
    revalidateOnFocus: false
  });

  const d = data || {};
  const accounts = d.accounts || [];
  const priority = d.priority_payoff || [];
  const promos = d.expiring_promos || [];

  if (error) {
    return (
      <Alert severity="error">
        Failed to load debt data: {error.message}.{' '}
        <RouterLink to="/finance/upload">Upload some statements</RouterLink> first.
      </Alert>
    );
  }

  return (
    <Grid container spacing={gridSpacing}>
      {/* Top stat cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard label="Total debt" value={formatMoney(d.total_debt)} sub="across all accounts" color="error" />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard
            label="Promotional"
            value={formatMoney(d.total_promo_debt)}
            sub="at 0% or reduced APR"
            color="success"
          />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard
            label="Interest-bearing"
            value={formatMoney(d.total_standard_debt)}
            sub="at standard APR"
            color="warning"
          />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard
            label="Est. monthly interest"
            value={formatMoney(d.estimated_monthly_interest)}
            sub={`${formatMoney(d.estimated_annual_interest)} / year`}
            color="error"
          />
        )}
      </Grid>

      {/* Priority payoff */}
      <Grid size={12}>
        <MainCard
          title="Priority payoff order"
          secondary={
            <Typography variant="caption" color="text.secondary">
              Pay these first to minimise interest costs
            </Typography>
          }
        >
          {isLoading ? (
            <Skeleton variant="rounded" height={200} />
          ) : priority.length === 0 ? (
            <Typography color="text.secondary">No outstanding balance segments found. Upload statements to populate.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Segment</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>APR</TableCell>
                    <TableCell align="right">Monthly interest</TableCell>
                    <TableCell>Promo expires</TableCell>
                    <TableCell>Why</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {priority.map((p, i) => {
                    const days = daysUntil(p.promo_expiry_date);
                    const isExpiringSoon = p.is_promotional && days !== null && days <= 90;
                    const isExpired = p.is_promotional && days !== null && days <= 0;
                    return (
                      <TableRow key={`${p.issuer}-${p.last_four}-${p.description}-${i}`} hover>
                        <TableCell>
                          <Chip size="small" label={i + 1} color={i === 0 ? 'error' : i < 3 ? 'warning' : 'default'} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {p.issuer || p.account_name || '—'}
                            {p.last_four ? ` •${p.last_four}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>{p.description || '—'}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatMoney(p.outstanding_balance)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={percent(p.interest_rate)}
                            color={p.interest_rate === 0 ? 'success' : p.interest_rate >= 20 ? 'error' : 'warning'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ color: p.monthly_interest > 0 ? 'error.main' : 'text.secondary' }}>
                          {p.monthly_interest > 0 ? formatMoney(p.monthly_interest) : '—'}
                        </TableCell>
                        <TableCell>
                          {p.promo_expiry_date ? (
                            <Chip
                              size="small"
                              icon={isExpiringSoon || isExpired ? <WarningAmberIcon /> : undefined}
                              label={
                                isExpired
                                  ? `Expired ${formatDate(p.promo_expiry_date)}`
                                  : days !== null
                                    ? `${formatDate(p.promo_expiry_date)} (${days}d)`
                                    : formatDate(p.promo_expiry_date)
                              }
                              color={urgencyColor(days)}
                              variant={isExpiringSoon || isExpired ? 'filled' : 'outlined'}
                            />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {isExpired
                              ? 'Promo expired — now accruing full APR'
                              : isExpiringSoon
                                ? `Reverts to ${percent(p.interest_rate === 0 ? 24.9 : p.interest_rate)} soon`
                                : p.interest_rate >= 20
                                  ? 'High APR — reducing saves the most'
                                  : p.is_promotional
                                    ? 'Protected by promo rate for now'
                                    : 'Standard rate'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </MainCard>
      </Grid>

      {/* Promo expiry timeline */}
      {promos.length > 0 && (
        <Grid size={12}>
          <MainCard title="Promotional rate expiry timeline">
            <Stack divider={<Divider />} spacing={2}>
              {promos.map((p, i) => {
                const days = daysUntil(p.promo_expiry_date);
                return (
                  <Stack
                    key={`promo-${i}`}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="subtitle1">
                        {p.issuer || p.account_name}
                        {p.last_four ? ` •${p.last_four}` : ''} — {p.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatMoney(p.outstanding_balance)} at {percent(p.interest_rate)}
                      </Typography>
                    </Box>
                    <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={0.5}>
                      <Chip
                        size="small"
                        icon={days !== null && days <= 90 ? <WarningAmberIcon /> : undefined}
                        label={days !== null && days > 0 ? `Expires ${formatDate(p.promo_expiry_date)} (${days} days)` : `Expired ${formatDate(p.promo_expiry_date)}`}
                        color={urgencyColor(days)}
                      />
                      {p.reverts_to_rate != null && (
                        <Typography variant="caption" color="error.main">
                          Reverts to {percent(p.reverts_to_rate)} — est. {formatMoney(p.monthly_interest_after)}/mo interest
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </MainCard>
        </Grid>
      )}

      {/* Per-account breakdown */}
      <Grid size={12}>
        <MainCard title="Debt by account">
          {isLoading ? (
            <Skeleton variant="rounded" height={300} />
          ) : accounts.length === 0 ? (
            <Typography color="text.secondary">
              No debt-carrying accounts found. <RouterLink to="/finance/upload">Upload statements</RouterLink> to see your debt breakdown.
            </Typography>
          ) : (
            <Stack divider={<Divider />} spacing={3}>
              {accounts.map((a) => {
                const utilisation = a.credit_limit ? (a.closing_balance / a.credit_limit) * 100 : null;
                return (
                  <Box key={a.account_id}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                      <Box>
                        <Typography variant="h5">
                          {a.account_name || a.issuer || 'Account'}
                          {a.last_four ? ` •${a.last_four}` : ''}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          {a.account_type && <Chip size="small" label={a.account_type.replace('_', ' ')} />}
                          {a.interest_rate_purchase != null && (
                            <Chip size="small" color="warning" variant="outlined" label={`Purchase APR ${percent(a.interest_rate_purchase)}`} />
                          )}
                          <Chip size="small" label={`stmt ${formatDate(a.statement_date)}`} />
                        </Stack>
                      </Box>
                      <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                        <Typography variant="h4" color="error.main">
                          {formatMoney(a.closing_balance)}
                        </Typography>
                        {a.minimum_payment != null && (
                          <Typography variant="caption" color="text.secondary">
                            min {formatMoney(a.minimum_payment)} due {formatDate(a.payment_due_date)}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>

                    {utilisation !== null && (
                      <Box sx={{ mt: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Credit utilisation
                          </Typography>
                          <Typography variant="caption" color={utilisation > 75 ? 'error.main' : utilisation > 50 ? 'warning.main' : 'success.main'}>
                            {utilisation.toFixed(0)}% of {formatMoney(a.credit_limit)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(utilisation, 100)}
                          color={utilisation > 75 ? 'error' : utilisation > 50 ? 'warning' : 'success'}
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                    )}

                    {a.segments.length > 0 && (
                      <TableContainer sx={{ mt: 1.5 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Segment</TableCell>
                              <TableCell>APR</TableCell>
                              <TableCell align="right">Balance</TableCell>
                              <TableCell align="right">Interest this period</TableCell>
                              <TableCell>Promo expires</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {a.segments.map((s, si) => (
                              <TableRow key={si}>
                                <TableCell>
                                  {s.description}
                                  {s.is_promotional ? (
                                    <Chip size="small" label="PROMO" color="success" sx={{ ml: 1 }} />
                                  ) : null}
                                </TableCell>
                                <TableCell>{percent(s.interest_rate)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  {formatMoney(s.outstanding_balance)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: Number(s.interest_amount) > 0 ? 'error.main' : 'text.secondary' }}>
                                  {Number(s.interest_amount) > 0 ? formatMoney(s.interest_amount) : '—'}
                                </TableCell>
                                <TableCell>
                                  {s.promo_expiry_date ? (
                                    <Chip size="small" label={formatDate(s.promo_expiry_date)} color={urgencyColor(daysUntil(s.promo_expiry_date))} variant="outlined" />
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}
