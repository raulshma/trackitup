import { usePathname } from "expo-router";
import React from "react";

type AppSidebarContextValue = {
  isOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
};

type AppSidebarActionsValue = Pick<
  AppSidebarContextValue,
  "openSidebar" | "closeSidebar" | "toggleSidebar"
>;

const AppSidebarStateContext = React.createContext<boolean | null>(null);
const AppSidebarActionsContext =
  React.createContext<AppSidebarActionsValue | null>(null);
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

  const actions = React.useMemo<AppSidebarActionsValue>(
    () => ({
      openSidebar,
      closeSidebar,
      toggleSidebar,
    }),
    [closeSidebar, openSidebar, toggleSidebar],
  );

  const value = React.useMemo<AppSidebarContextValue>(
    () => ({
      isOpen,
      ...actions,
    }),
    [actions, isOpen],
  );

  return (
    <AppSidebarActionsContext.Provider value={actions}>
      <AppSidebarStateContext.Provider value={isOpen}>
        <AppSidebarContext.Provider value={value}>
          {children}
        </AppSidebarContext.Provider>
      </AppSidebarStateContext.Provider>
    </AppSidebarActionsContext.Provider>
  );
}

export function useAppSidebar() {
  const context = React.useContext(AppSidebarContext);

  if (!context) {
    throw new Error("useAppSidebar must be used inside AppSidebarProvider.");
  }

  return context;
}

export function useAppSidebarActions() {
  const context = React.useContext(AppSidebarActionsContext);

  if (!context) {
    throw new Error(
      "useAppSidebarActions must be used inside AppSidebarProvider.",
    );
  }

  return context;
}

export function useAppSidebarState() {
  const context = React.useContext(AppSidebarStateContext);

  if (context === null) {
    throw new Error(
      "useAppSidebarState must be used inside AppSidebarProvider.",
    );
  }

  return context;
}
