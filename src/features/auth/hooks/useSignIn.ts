import { useMutation } from '@tanstack/react-query';
import { signIn } from '../api';
import { signInInput, type SignInInput } from '../model';

export function useSignIn() {
  return useMutation({
    mutationFn: (input: SignInInput) => {
      const parsed = signInInput.parse(input);
      return signIn(parsed.email, parsed.password);
    },
  });
}
