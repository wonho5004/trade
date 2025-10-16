export type FormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const myPageDefaultState: FormState = { status: 'idle' };
