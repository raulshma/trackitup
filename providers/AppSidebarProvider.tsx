import { usePathname } from "expo-router";
import React from "react";

type AppSidebarContextValue = {
  isOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
};

const AppSidebarContext = React.createContext<AppSidebarContextValue | null>(
  null,
);

export function AppSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  const openSidebar = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSidebar = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const value = React.useMemo<AppSidebarContextValue>(
    () => ({
      isOpen,
      openSidebar,
      closeSidebar,
      toggleSidebar,
    }),
    [closeSidebar, isOpen, openSidebar, toggleSidebar],
  );

  return (
    <AppSidebarContext.Provider value={value}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = React.useContext(AppSidebarContext);

  if (!context) {
    throw new Error("useAppSidebar must be used inside AppSidebarProvider.");
  }

  return context;
}
