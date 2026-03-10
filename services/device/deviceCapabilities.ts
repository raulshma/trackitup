import { Camera } from "expo-camera";
import * as Location from "expo-location";

import type { CapturedLocation } from "@/types/trackitup";

export async function getCameraPermissionStatusAsync() {
  return Camera.getCameraPermissionsAsync();
}

export async function requestCameraPermissionAsync() {
  return Camera.requestCameraPermissionsAsync();
}

export async function getLocationPermissionStatusAsync() {
  return Location.getForegroundPermissionsAsync();
}

export async function requestLocationPermissionAsync() {
  return Location.requestForegroundPermissionsAsync();
}

export async function getLastKnownLocationPreviewAsync() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position = await Location.getLastKnownPositionAsync();
  if (!position) return null;

  return toCapturedLocation(position);
}

export async function getCurrentLocationPreviewAsync() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return toCapturedLocation(position);
}

function toCapturedLocation(
  position: Location.LocationObject,
): CapturedLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

export function formatLocationPreview(value: CapturedLocation) {
  return `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)} • ±${Math.round(value.accuracy ?? 0)}m`;
}
