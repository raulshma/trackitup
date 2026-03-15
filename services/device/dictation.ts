type NativeSpeechRecognitionResult = {
  transcript?: string;
};

type NativeSpeechRecognitionEventMap = {
  result: {
    results?: ArrayLike<NativeSpeechRecognitionResult>;
    isFinal?: boolean;
  };
  start: undefined;
  end: undefined;
  error: {
    error?: string;
    message?: string;
  };
};

type NativeSpeechRecognitionSubscription = { remove: () => void };

type NativeSpeechRecognitionModuleLike = {
  requestPermissionsAsync: () => Promise<{
    granted: boolean;
    canAskAgain?: boolean;
    status?: string;
  }>;
  start: (options: {
    lang?: string;
    interimResults?: boolean;
    continuous?: boolean;
  }) => void;
  stop: () => void;
  addListener: <EventName extends keyof NativeSpeechRecognitionEventMap>(
    eventName: EventName,
    listener: (event: NativeSpeechRecognitionEventMap[EventName]) => void,
  ) => NativeSpeechRecognitionSubscription;
};

export type DictationCaptureResult = {
  mode: "speech-recognition" | "device-keyboard";
  transcript?: string;
  message: string;
};

type CaptureDictationOptions = {
  onTranscript?: (transcript: string) => void;
  signal?: AbortSignal;
};

type DictationRuntime = "web" | "native" | "node";

function getRuntimePlatform() {
  const runtime = globalThis as typeof globalThis & {
    navigator?: { product?: string };
    document?: object;
  };

  return runtime.document
    ? "web"
    : runtime.navigator?.product === "ReactNative"
      ? "native"
      : "node";
}

function joinNativeTranscript(
  results: ArrayLike<NativeSpeechRecognitionResult>,
) {
  const primary = Array.from(results).find(
    (result) => typeof result?.transcript === "string" && result.transcript,
  );
  return primary?.transcript?.trim() ?? "";
}

function mergeStreamingTranscript(current: string, next: string) {
  const currentText = current.trim();
  const nextText = next.trim();

  if (!nextText) return currentText;
  if (!currentText) return nextText;
  if (nextText === currentText) return currentText;
  if (nextText.startsWith(currentText)) return nextText;
  if (currentText.startsWith(nextText)) return currentText;
  if (currentText.endsWith(nextText)) return currentText;
  if (nextText.endsWith(currentText)) return nextText;

  const currentWords = currentText.split(/\s+/);
  const nextWords = nextText.split(/\s+/);
  const overlapLimit = Math.min(currentWords.length, nextWords.length);
  let overlapCount = 0;

  for (let size = overlapLimit; size > 0; size -= 1) {
    const currentSuffix = currentWords
      .slice(currentWords.length - size)
      .join(" ")
      .toLowerCase();
    const nextPrefix = nextWords.slice(0, size).join(" ").toLowerCase();
    if (currentSuffix === nextPrefix) {
      overlapCount = size;
      break;
    }
  }

  if (overlapCount === nextWords.length) {
    return currentText;
  }

  const nonOverlappingTail = nextWords.slice(overlapCount).join(" ");
  return appendDictationTranscript(currentText, nonOverlappingTail);
}

async function getExpoSpeechRecognitionModule() {
  const runtimePlatform = getRuntimePlatform() as DictationRuntime;
  if (runtimePlatform === "node") {
    return null;
  }

  const globalRuntime = globalThis as typeof globalThis & {
    ExpoSpeechRecognitionModule?: NativeSpeechRecognitionModuleLike;
  };

  if (globalRuntime.ExpoSpeechRecognitionModule) {
    return globalRuntime.ExpoSpeechRecognitionModule;
  }

  try {
    const module = (await import("expo-speech-recognition")) as {
      ExpoSpeechRecognitionModule?: NativeSpeechRecognitionModuleLike;
      default?: {
        ExpoSpeechRecognitionModule?: NativeSpeechRecognitionModuleLike;
      };
    };
    return (
      module.ExpoSpeechRecognitionModule ??
      module.default?.ExpoSpeechRecognitionModule ??
      null
    );
  } catch {
    return null;
  }
}

async function captureExpoTranscript(
  module: NativeSpeechRecognitionModuleLike,
  options?: CaptureDictationOptions,
) {
  const permission = await module.requestPermissionsAsync();
  if (!permission.granted) {
    return {
      mode: "device-keyboard" as const,
      message:
        permission.canAskAgain === false
          ? "Microphone permission is blocked. Enable it in device settings, or use keyboard dictation."
          : "Microphone permission is required for live dictation. Use keyboard dictation or grant access and try again.",
    };
  }

  const transcript = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let latestTranscript = "";
    const subscriptions: NativeSpeechRecognitionSubscription[] = [];

    const removeAll = () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
      options?.signal?.removeEventListener("abort", stopOnAbort);
    };

    const finish = (nextTranscript: string) => {
      if (settled) return;
      settled = true;
      removeAll();
      resolve(nextTranscript);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      removeAll();
      reject(error);
    };

    const stopOnAbort = () => {
      try {
        module.stop();
      } catch {
        finish(latestTranscript.trim());
      }
    };

    subscriptions.push(
      module.addListener("result", (event) => {
        const nextTranscriptChunk = event?.results
          ? joinNativeTranscript(event.results)
          : "";
        if (!nextTranscriptChunk) return;
        latestTranscript = mergeStreamingTranscript(
          latestTranscript,
          nextTranscriptChunk,
        );
        options?.onTranscript?.(latestTranscript);
      }),
    );
    subscriptions.push(
      module.addListener("error", (event) => {
        if (options?.signal?.aborted) {
          finish(latestTranscript.trim());
          return;
        }

        fail(
          new Error(
            event?.message ?? event?.error ?? "Speech recognition failed.",
          ),
        );
      }),
    );
    subscriptions.push(
      module.addListener("end", () => {
        finish(latestTranscript.trim());
      }),
    );

    options?.signal?.addEventListener("abort", stopOnAbort);

    try {
      module.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
      });
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error("Speech recognition failed to start."),
      );
      return;
    }

    if (options?.signal?.aborted) {
      stopOnAbort();
    }
  });

  return transcript
    ? {
        mode: "speech-recognition" as const,
        transcript,
        message: "Dictation captured from the active microphone.",
      }
    : {
        mode: "speech-recognition" as const,
        message: "No speech was detected. Try again or type manually.",
      };
}

export function appendDictationTranscript(
  currentValue: string,
  transcript: string,
) {
  const base = currentValue.trim();
  const addition = transcript.trim();

  if (!addition) return currentValue;
  if (!base) return addition;
  return `${base}${/[\s\n]$/.test(currentValue) ? "" : " "}${addition}`;
}

export async function captureDictationAsync(
  options?: CaptureDictationOptions,
): Promise<DictationCaptureResult> {
  const runtime = getRuntimePlatform() as DictationRuntime;

  if (runtime === "node") {
    return {
      mode: "device-keyboard",
      message:
        "Speech recognition is unavailable in this runtime. Use your keyboard dictation or type manually.",
    };
  }

  const speechModule = await getExpoSpeechRecognitionModule();
  if (!speechModule) {
    return {
      mode: "device-keyboard",
      message:
        "Speech recognition is unavailable on this device. Use your keyboard dictation or type manually.",
    };
  }

  return captureExpoTranscript(speechModule, options);
}
