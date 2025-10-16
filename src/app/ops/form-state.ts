export type OpsActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

export const defaultOpsActionState: OpsActionState = { status: 'idle' };
