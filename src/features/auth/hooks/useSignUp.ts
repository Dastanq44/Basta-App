import { useMutation } from '@tanstack/react-query';
import { signUp } from '../api';
import { signUpInput, type SignUpInput } from '../model';

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) => {
      const parsed = signUpInput.parse(input);
      return signUp(parsed.email, parsed.password);
    },
  });
}
