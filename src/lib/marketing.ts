// TODO: replace YOUR_WHATSAPP_NUMBER with your actual number (e.g. 2348012345678 for Nigeria +234)
export const WHATSAPP_NUMBER = "YOUR_WHATSAPP_NUMBER";

export const WHATSAPP_MSG = encodeURIComponent(
  "Hi, I would like to request a demo of Nexxos HQ",
);

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

export function openWhatsApp() {
  window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
}

export function comingSoon(page?: string) {
  return page ? `/coming-soon?page=${encodeURIComponent(page)}` : "/coming-soon";
}
