import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';

import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';

import Chart from 'react-apexcharts';

import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';
import financeApi from 'api/finance';
import { formatMoney, formatDate, formatMonth, percent, CATEGORY_COLORS } from 'utils/finance-format';

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
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 100,
          height: 100,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%',
          bottom: -30,
          left: -20
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

function MonthlyChart({ byMonth }) {
  const theme = useTheme();
  const months = [...byMonth].reverse();
  const categories = months.map((m) => formatMonth(m.month));
  const options = {
    chart: { toolbar: { show: false }, stacked: false, fontFamily: 'inherit' },
    colors: [theme.palette.error.main, theme.palette.success.main],
    dataLabels: { enabled: false },
    xaxis: { categories, labels: { style: { colors: theme.palette.text.primary } } },
    yaxis: {
      labels: {
        style: { colors: theme.palette.text.primary },
        formatter: (v) => formatMoney(v)
      }
    },
    grid: { borderColor: theme.palette.divider },
    legend: { position: 'top', horizontalAlign: 'right' },
    tooltip: { y: { formatter: (v) => formatMoney(v) } },
    stroke: { curve: 'smooth', width: 3 }
  };
  const series = [
    { name: 'Expenses', data: months.map((m) => Number(m.expenses || 0)) },
    { name: 'Income', data: months.map((m) => Number(m.income || 0)) }
  ];

  if (!months.length) {
    return <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No transactions yet. Upload a statement to get started.</Box>;
  }
  return <Chart options={options} series={series} type="area" height={340} />;
}

function CategoryChart({ byCategory }) {
  const theme = useTheme();
  if (!byCategory.length) {
    return <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>No spending data yet.</Box>;
  }
  const labels = byCategory.map((c) => c.category);
  const series = byCategory.map((c) => Number(c.spend || 0));
  const colors = labels.map((l) => CATEGORY_COLORS[l] || theme.palette.primary.main);
  const options = {
    labels,
    colors,
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v) => formatMoney(v) } },
    stroke: { width: 0 }
  };
  return <Chart options={options} series={series} type="donut" height={340} />;
}

export default function FinanceOverview() {
  const [apiError, setApiError] = useState(null);
  const { data, error, isLoading } = useSWR('summary', () => financeApi.summary(), {
    refreshInterval: 0,
    revalidateOnFocus: false
  });

  useEffect(() => {
    if (error) setApiError(error.message);
  }, [error]);

  const totals = data?.totals || {};
  const byMonth = data?.by_month || [];
  const byCategory = data?.by_category || [];
  const upcoming = data?.upcoming_payments || [];
  const accounts = data?.accounts || [];

  const net = Number(totals.total_income || 0) - Number(totals.total_expenses || 0);

  return (
    <Grid container spacing={gridSpacing}>
      {apiError && (
        <Grid size={12}>
          <Alert severity="warning" onClose={() => setApiError(null)}>
            Couldn&apos;t reach the FinanceLog API ({apiError}). Check your API URL in{' '}
            <RouterLink to="/finance/settings">Settings</RouterLink>.
          </Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard label="Total Expenses" value={formatMoney(totals.total_expenses)} sub="across all imported statements" color="error" />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard label="Total Income" value={formatMoney(totals.total_income)} sub="deposits & refunds" color="success" />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard
            label="Net"
            value={formatMoney(net)}
            sub={net >= 0 ? 'in the black' : 'in the red'}
            color={net >= 0 ? 'success' : 'warning'}
          />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        {isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : (
          <StatCard label="Transactions" value={Number(totals.tx_count || 0).toLocaleString()} sub="imported line items" color="primary" />
        )}
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <MainCard
          title="Cashflow by month"
          secondary={
            <Button component={RouterLink} to="/finance/transactions" variant="text" size="small">
              View all transactions
            </Button>
          }
        >
          {isLoading ? <Skeleton variant="rounded" height={340} /> : <MonthlyChart byMonth={byMonth} />}
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <MainCard title="Spend by category">
          {isLoading ? <Skeleton variant="rounded" height={340} /> : <CategoryChart byCategory={byCategory} />}
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <MainCard title="Upcoming payments">
          {isLoading ? (
            <Skeleton variant="rounded" height={220} />
          ) : upcoming.length === 0 ? (
            <Typography color="text.secondary">No upcoming payments detected in imported statements.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {upcoming.map((p) => (
                <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle1">{p.account_name || p.issuer || 'Account'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due {formatDate(p.payment_due_date)}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end">
                    <Typography variant="subtitle1" color="error.main">
                      {formatMoney(p.minimum_payment, p.currency)} min
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      balance {formatMoney(p.closing_balance, p.currency)}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <MainCard title="Accounts">
          {isLoading ? (
            <Skeleton variant="rounded" height={220} />
          ) : accounts.length === 0 ? (
            <Typography color="text.secondary">
              Upload a statement on the <RouterLink to="/finance/upload">Upload</RouterLink> page and accounts will appear here.
            </Typography>
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {accounts.map((a, i) => (
                <Stack key={`${a.account_name}-${a.last_four}-${i}`} direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle1">
                      {a.account_name || a.issuer || 'Account'}
                      {a.last_four ? ` •${a.last_four}` : ''}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      {a.account_type && <Chip size="small" label={a.account_type.replace('_', ' ')} />}
                      {a.interest_rate_purchase != null && (
                        <Chip size="small" color="warning" variant="outlined" label={`APR ${percent(a.interest_rate_purchase)}`} />
                      )}
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle1">{formatMoney(a.closing_balance)}</Typography>
                    {a.credit_limit != null && (
                      <Typography variant="caption" color="text.secondary">
                        of {formatMoney(a.credit_limit)} limit
                      </Typography>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}
