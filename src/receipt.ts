import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export interface ReceiptItem {
  name: string;
  priceCents: number;
}

export async function captureReceiptPhoto(): Promise<string | null> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 70,
      saveToGallery: false,
    });
    if (!photo.base64String) return null;
    return `data:image/${photo.format || "jpeg"};base64,${photo.base64String}`;
  } catch {
    return null;
  }
}
