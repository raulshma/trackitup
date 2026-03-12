import { Platform, Vibration } from "react-native";

function canProvideFeedback() {
  return Platform.OS !== "web";
}

export function triggerSelectionFeedback() {
  if (!canProvideFeedback()) return;
  Vibration.vibrate(8);
}

export function triggerSuccessFeedback() {
  if (!canProvideFeedback()) return;
  Vibration.vibrate([0, 14, 24, 10]);
}

export function triggerWarningFeedback() {
  if (!canProvideFeedback()) return;
  Vibration.vibrate([0, 10, 18, 10, 18, 12]);
}
