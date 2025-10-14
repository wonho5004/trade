import { create } from 'zustand';

interface UIState {
  isOrderTicketOpen: boolean;
  setOrderTicketOpen: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOrderTicketOpen: true,
  setOrderTicketOpen: (value) => set({ isOrderTicketOpen: value })
}));
