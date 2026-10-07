import { create } from 'zustand';

const noticeTimeout = 8500;
let timer: ReturnType<typeof setTimeout> | undefined;

interface NoticeState {
  notice: string;
  notify: (message: string) => void;
  dismiss: () => void;
}

export const useNotice = create<NoticeState>()((set) => ({
  notice: '',
  notify: (notice) => {
    clearTimeout(timer);
    set({ notice });
    if (notice) timer = setTimeout(() => set({ notice: '' }), noticeTimeout);
  },
  dismiss: () => {
    clearTimeout(timer);
    set({ notice: '' });
  },
}));

export const notify = (message: string) => useNotice.getState().notify(message);
