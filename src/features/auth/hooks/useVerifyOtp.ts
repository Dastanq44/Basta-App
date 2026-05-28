import { useMutation } from '@tanstack/react-query';
import { verifyOtp } from '../api';
import { verifyOtpInput, type VerifyOtpInput } from '../model';

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (input: VerifyOtpInput) => {
      const parsed = verifyOtpInput.parse(input);
      return verifyOtp(parsed.email, parsed.token);
    },
  });
}
