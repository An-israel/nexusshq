export const DEMO_EMAIL = "hello@nexxoshq.io";
export const DEMO_EMAIL_SUBJECT = encodeURIComponent("Demo Request — Nexxos HQ");
export const DEMO_EMAIL_BODY = encodeURIComponent(
  "Hi Nexxos HQ team,\n\nI'd like to request a demo of Nexxos HQ for my organisation.\n\nCompany name:\nTeam size:\nPreferred date/time:\n\nThanks!",
);
export const DEMO_MAILTO_URL = `mailto:${DEMO_EMAIL}?subject=${DEMO_EMAIL_SUBJECT}&body=${DEMO_EMAIL_BODY}`;

// Set VITE_WHATSAPP_NUMBER (e.g. 2348012345678 for Nigeria +234) to enable a
// WhatsApp contact link. When unset, WhatsApp links fall back to the demo
// request mailto link so they're never a dead "wa.me/undefined" URL.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;

export const WHATSAPP_MSG = encodeURIComponent("Hi, I would like to request a demo of Nexxos HQ");

export const WHATSAPP_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`
  : DEMO_MAILTO_URL;

export function openWhatsApp() {
  window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
}

export function comingSoon(page?: string) {
  return page ? `/coming-soon?page=${encodeURIComponent(page)}` : "/coming-soon";
}
