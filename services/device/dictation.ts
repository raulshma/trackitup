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
    let resolved = false;
    let latestTranscript = "";

    recognition.continuous = false;
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

      const hasFinalResult = Array.from(event.results).some(
        (result) => result.isFinal,
      );

      if (!hasFinalResult) {
        return;
      }

      resolved = true;
      recognition.stop();
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      resolved = true;
      reject(new Error(event.error ?? "Speech recognition failed."));
    };

    recognition.onend = () => {
      if (!resolved) {
        resolved = true;
        resolve(latestTranscript.trim());
      }
    };

    recognition.start();
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
