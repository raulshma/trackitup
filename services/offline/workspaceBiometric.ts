export type WorkspaceBiometricAvailability =
  | {
      status: "available";
      label: string;
    }
  | {
      status: "unavailable";
      label: string;
      reason: "unsupported" | "not-available" | "not-enrolled" | "error";
    };

type WorkspaceBiometricModule = {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync?(): Promise<number[]>;
  authenticateAsync(options?: Record<string, unknown>): Promise<
    | { success: true }
    | { success: false; error?: string; warning?: string }
  >;
};

let workspaceBiometricModuleForTests:
  | WorkspaceBiometricModule
  | null
  | undefined;

function describeAuthenticationTypes(types: number[] | undefined) {
  const labels = new Set<string>();
  if (types?.includes(2)) labels.add("Face ID / face unlock");
  if (types?.includes(1)) labels.add("Fingerprint");
  if (types?.includes(3)) labels.add("Iris");
  return [...labels].join(" + ") || "Biometrics";
}

function mapAuthenticationError(error?: string) {
  switch (error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return "Biometric unlock was cancelled.";
    case "not_enrolled":
      return "No biometric or device credential is enrolled on this device.";
    case "not_available":
    case "passcode_not_set":
      return "Biometric unlock is not available on this device right now.";
    case "lockout":
      return "Biometric unlock is temporarily locked. Use the device credential fallback if prompted and try again.";
    case "authentication_failed":
      return "Biometric unlock did not verify. Please try again.";
    default:
      return "Biometric unlock could not be completed. Please try again.";
  }
}

async function loadWorkspaceBiometricModule() {
  if (workspaceBiometricModuleForTests !== undefined) {
    return workspaceBiometricModuleForTests;
  }

  try {
    return await import("expo-local-authentication");
  } catch {
    return null;
  }
}

export function __setWorkspaceBiometricModuleForTests(
  module: WorkspaceBiometricModule | null,
) {
  workspaceBiometricModuleForTests = module;
}

export async function getWorkspaceBiometricAvailability(): Promise<WorkspaceBiometricAvailability> {
  const module = await loadWorkspaceBiometricModule();
  if (!module) {
    return {
      status: "unavailable",
      label: "Unavailable",
      reason: "unsupported",
    };
  }

  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      module.hasHardwareAsync(),
      module.isEnrolledAsync(),
      module.supportedAuthenticationTypesAsync?.(),
    ]);

    if (!hasHardware) {
      return {
        status: "unavailable",
        label: "Unavailable",
        reason: "not-available",
      };
    }

    if (!isEnrolled) {
      return {
        status: "unavailable",
        label: "Not enrolled",
        reason: "not-enrolled",
      };
    }

    return {
      status: "available",
      label: describeAuthenticationTypes(supportedTypes),
    };
  } catch {
    return {
      status: "unavailable",
      label: "Unavailable",
      reason: "error",
    };
  }
}

export function getWorkspaceBiometricDescription({
  availability,
  enabled,
  privacyMode,
}: {
  availability: WorkspaceBiometricAvailability;
  enabled: boolean;
  privacyMode: "protected" | "compatibility";
}) {
  if (availability.status === "available") {
    if (enabled && privacyMode === "protected") {
      return `Biometric lock is enabled. TrackItUp will require ${availability.label.toLowerCase()} or the device credential fallback before protected local workspace data is loaded on this device.`;
    }

    if (enabled) {
      return `Biometric lock is enabled and will activate whenever Protected mode is active on this device.`;
    }

    return `Use ${availability.label.toLowerCase()} to gate protected local workspace access on this device.`;
  }

  switch (availability.reason) {
    case "not-enrolled":
      return "No biometric or device credential is enrolled. Set up Face ID, Touch ID, fingerprint, or the device credential before enabling biometric lock.";
    case "not-available":
      return "This device does not currently expose biometric authentication for TrackItUp.";
    case "unsupported":
      return "Biometric authentication is unavailable in this environment.";
    default:
      return "TrackItUp could not determine whether biometric authentication is ready on this device.";
  }
}

export async function authenticateWorkspaceBiometric(options?: {
  promptMessage?: string;
}) {
  const module = await loadWorkspaceBiometricModule();
  if (!module) {
    return {
      status: "error" as const,
      message: "Biometric authentication is unavailable in this environment.",
    };
  }

  try {
    const result = await module.authenticateAsync({
      promptMessage:
        options?.promptMessage ?? "Unlock your protected TrackItUp workspace",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      fallbackLabel: "Use device credential",
    });
    if (result.success) {
      return {
        status: "success" as const,
        message: "Workspace unlocked.",
      };
    }

    return {
      status: "error" as const,
      message: mapAuthenticationError(result.error),
    };
  } catch {
    return {
      status: "error" as const,
      message: "Biometric authentication could not be started. Please try again.",
    };
  }
}