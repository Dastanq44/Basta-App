import { useMutation } from '@tanstack/react-query';
import { reportTarget } from '../api';
import type { ReportInput } from '../model';

export function useReport() {
  return useMutation({ mutationFn: (input: ReportInput) => reportTarget(input) });
}
