import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { IconSearch } from '@tabler/icons-react';

import financeApi from 'api/finance';
import { formatMoney, formatDate, CATEGORY_COLORS } from 'utils/finance-format';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchSection() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const debouncedQuery = useDebounce(value, 300);

  const { data } = useSWR(
    debouncedQuery.length >= 2 ? ['search', debouncedQuery] : null,
    () => financeApi.listTransactions({ q: debouncedQuery, limit: 8 }),
    { revalidateOnFocus: false }
  );

  const results = data?.transactions || [];

  useEffect(() => {
    setOpen(debouncedQuery.length >= 2 && results.length > 0);
  }, [debouncedQuery, results.length]);

  const handleSelect = useCallback(() => {
    navigate(`/finance/transactions?q=${encodeURIComponent(value)}`);
    setOpen(false);
    setValue('');
  }, [navigate, value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim()) {
      handleSelect();
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Box sx={{ ml: 2 }} ref={anchorRef}>
      <OutlinedInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => debouncedQuery.length >= 2 && results.length > 0 && setOpen(true)}
        placeholder="Search transactions…"
        startAdornment={
          <InputAdornment position="start">
            <IconSearch stroke={1.5} size="16px" color={theme.palette.grey[500]} />
          </InputAdornment>
        }
        size="small"
        sx={{
          width: { xs: 200, md: 280, lg: 400 },
          bgcolor: 'background.paper',
          borderRadius: 2,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.grey[200] }
        }}
      />
      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" sx={{ zIndex: 1300, width: { xs: 320, md: 400 } }}>
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper elevation={8} sx={{ borderRadius: 2, mt: 0.5, overflow: 'hidden' }}>
            <List dense disablePadding>
              {results.map((t) => (
                <ListItemButton
                  key={t.id}
                  onClick={() => {
                    navigate(`/finance/transactions?q=${encodeURIComponent(t.description || t.merchant || '')}`);
                    setOpen(false);
                    setValue('');
                  }}
                  sx={{ py: 1.5, px: 2 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>
                          {t.description || t.merchant || '—'}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: Number(t.amount) > 0 ? 'error.main' : 'success.main', whiteSpace: 'nowrap' }}
                        >
                          {formatMoney(Math.abs(t.amount))}
                        </Typography>
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(t.tx_date || t.post_date)}
                        </Typography>
                        {t.category && (
                          <Chip
                            size="small"
                            label={t.category}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: CATEGORY_COLORS[t.category] || CATEGORY_COLORS.other,
                              color: '#fff'
                            }}
                          />
                        )}
                        {(t.account_name || t.issuer) && (
                          <Typography variant="caption" color="text.secondary">
                            {t.account_name || t.issuer}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                </ListItemButton>
              ))}
              <ListItemButton onClick={handleSelect} sx={{ py: 1.5, px: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="primary" sx={{ width: '100%', textAlign: 'center', fontWeight: 500 }}>
                  View all results for &quot;{value}&quot;
                </Typography>
              </ListItemButton>
            </List>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}

SearchSection.propTypes = {};
