// file: webview-ui/src/stores/userProfileStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './lib'; 
import { UserData, ProfileUiDiv } from '@/types'; 

type UserProfileStore = {
  userData: UserData;
  profileUiData: ProfileUiDiv[];
  setUserData: (data: UserData) => void;
  setProfileUiData: (data: ProfileUiDiv[]) => void;
};

export const useUserProfileStore = create<UserProfileStore>()(
  persist(
    (set) => ({
      userData: {} as UserData,
      profileUiData: [],
      setUserData: (data) => set({ userData: data }),
      setProfileUiData: (data) => set({ profileUiData: data }),
    }),
    {
      name: 'user-profile-store',
      storage: persistStorage,
    }
  )
);
