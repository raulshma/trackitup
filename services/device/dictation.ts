type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang?: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<
          ArrayLike<{ transcript?: string }> & { isFinal?: boolean }
        >;
      }) => void)
    | null;
  start: () => void;
  stop: () => void;
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

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (getRuntimePlatform() !== "web") {
    return null;
  }

  const webWindow = globalThis as typeof globalThis & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };

  return (
    webWindow.SpeechRecognition ?? webWindow.webkitSpeechRecognition ?? null
  );
}

function captureBrowserTranscript(
  Ctor: new () => SpeechRecognitionLike,
  options?: CaptureDictationOptions,
) {
  return new Promise<string>((resolve, reject) => {
    const recognition = new Ctor();
    let settled = false;
    let latestTranscript = "";
    const stopOnAbort = () => {
      recognition.stop();
    };

    function finish(transcript: string) {
      if (settled) return;
      settled = true;
      options?.signal?.removeEventListener("abort", stopOnAbort);
      resolve(transcript);
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      options?.signal?.removeEventListener("abort", stopOnAbort);
      reject(error);
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((item) => item.transcript ?? "")
        .join(" ")
        .trim();

      latestTranscript = transcript;
      if (transcript) {
        options?.onTranscript?.(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (options?.signal?.aborted) {
        finish(latestTranscript.trim());
        return;
      }

      fail(new Error(event.error ?? "Speech recognition failed."));
    };

    recognition.onend = () => {
      finish(latestTranscript.trim());
    };

    options?.signal?.addEventListener("abort", stopOnAbort);

    recognition.start();

    if (options?.signal?.aborted) {
      stopOnAbort();
    }
  });
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
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (!SpeechRecognitionCtor) {
    return {
      mode: "device-keyboard",
      message:
        getRuntimePlatform() === "web"
          ? "Browser speech recognition is unavailable here. Use your keyboard's dictation or type manually."
          : "Field focused. Use your device keyboard dictation or mic key to speak.",
    };
  }

  const transcript = await captureBrowserTranscript(
    SpeechRecognitionCtor,
    options,
  );
  return transcript
    ? {
        mode: "speech-recognition",
        transcript,
        message: "Dictation captured from the active microphone.",
      }
    : {
        mode: "speech-recognition",
        message: "No speech was detected. Try again or type manually.",
      };
}
