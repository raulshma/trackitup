import "react-native-url-polyfill/auto";

import { ClerkProvider, useAuth, useSSO, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    type ReactNode,
} from "react";

WebBrowser.maybeCompleteAuthSession();

type AuthActionResult = {
  status: "success" | "cancelled" | "error";
  message: string;
};

type AuthContextValue = {
  clerkPublishableKeyConfigured: boolean;
  status: "partial" | "implemented";
  note: string;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  displayName: string | null;
  primaryEmailAddress: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthActionResult>;
  signInWithApple: () => Promise<AuthActionResult>;
};

const AuthFoundationContext = createContext<AuthContextValue>({
  clerkPublishableKeyConfigured: false,
  status: "partial",
  note: "Clerk foundation is disabled until EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set.",
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  displayName: null,
  primaryEmailAddress: null,
  getToken: async () => null,
  signOut: async () => undefined,
  signInWithGoogle: async () => ({
    status: "error",
    message: "Clerk is not configured for this workspace.",
  }),
  signInWithApple: async () => ({
    status: "error",
    message: "Clerk is not configured for this workspace.",
  }),
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Authentication could not be completed.";
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { user } = useUser();
  const { startSSOFlow } = useSSO();

  const startStrategy = useCallback(
    async (
      strategy: "oauth_google" | "oauth_apple",
    ): Promise<AuthActionResult> => {
      try {
        const redirectUrl = AuthSession.makeRedirectUri({
          scheme: "trackitup",
          path: "account",
        });

        const { createdSessionId, setActive, authSessionResult } =
          await startSSOFlow({ strategy, redirectUrl });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          return {
            status: "success",
            message: "Signed in successfully.",
          };
        }

        const resultType = authSessionResult?.type;
        return {
          status: "cancelled",
          message:
            resultType === "cancel"
              ? "The sign-in flow was cancelled."
              : "Sign-in was started but no session was created.",
        };
      } catch (error) {
        return {
          status: "error",
          message: getErrorMessage(error),
        };
      }
    },
    [startSSOFlow],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      clerkPublishableKeyConfigured: true,
      status: "implemented",
      note: "Clerk authentication is available for optional sign-in and future premium sync.",
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn ?? false,
      userId: auth.userId ?? null,
      displayName:
        user?.fullName ??
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ??
        null,
      primaryEmailAddress: user?.primaryEmailAddress?.emailAddress ?? null,
      getToken: async () => auth.getToken(),
      signOut: async () => {
        await auth.signOut();
      },
      signInWithGoogle: () => startStrategy("oauth_google"),
      signInWithApple: () => startStrategy("oauth_apple"),
    }),
    [auth, startStrategy, user],
  );

  return (
    <AuthFoundationContext.Provider value={value}>
      {children}
    </AuthFoundationContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const foundationState = useMemo<AuthContextValue>(
    () => ({
      clerkPublishableKeyConfigured: Boolean(publishableKey),
      status: publishableKey ? "implemented" : "partial",
      note: publishableKey
        ? "Clerk provider is active through the Expo-55-compatible bridge package."
        : "Clerk package is installed, but auth stays disabled until EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is configured.",
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      displayName: null,
      primaryEmailAddress: null,
      getToken: async () => null,
      signOut: async () => undefined,
      signInWithGoogle: async () => ({
        status: "error",
        message: "Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to enable sign-in.",
      }),
      signInWithApple: async () => ({
        status: "error",
        message: "Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to enable sign-in.",
      }),
    }),
    [publishableKey],
  );

  if (!publishableKey) {
    return (
      <AuthFoundationContext.Provider value={foundationState}>
        {children}
      </AuthFoundationContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useAuthFoundation() {
  return useContext(AuthFoundationContext);
}

export function useAppAuth() {
  return useContext(AuthFoundationContext);
}
