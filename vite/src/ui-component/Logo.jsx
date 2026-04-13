// ==============================|| LOGO ||============================== //

import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';

export default function Logo() {
  const theme = useTheme();
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="8" fill={theme.vars?.palette?.primary?.main || theme.palette.primary.main} />
        <path
          d="M7 9.5C7 8.67 7.67 8 8.5 8H12.5C13.33 8 14 8.67 14 9.5V11.5C14 12.33 13.33 13 12.5 13H8.5C7.67 13 7 12.33 7 11.5V9.5Z"
          fill="rgba(255,255,255,0.9)"
        />
        <path
          d="M15.5 9.5C15.5 8.67 16.17 8 17 8H19.5C20.33 8 21 8.67 21 9.5V18.5C21 19.33 20.33 20 19.5 20H17C16.17 20 15.5 19.33 15.5 18.5V9.5Z"
          fill="rgba(255,255,255,0.5)"
        />
        <path
          d="M7 15C7 14.17 7.67 13.5 8.5 13.5H12.5C13.33 13.5 14 14.17 14 15V18.5C14 19.33 13.33 20 12.5 20H8.5C7.67 20 7 19.33 7 18.5V15Z"
          fill="rgba(255,255,255,0.7)"
        />
      </svg>
      <Typography variant="h4" sx={{ fontWeight: 700, color: theme.vars?.palette?.grey?.[900] || theme.palette.grey[900], letterSpacing: '-0.02em' }}>
        FinanceLog
      </Typography>
    </Stack>
  );
}
