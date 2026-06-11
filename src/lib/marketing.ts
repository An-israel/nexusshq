// TODO: replace YOUR_WHATSAPP_NUMBER with your actual number (e.g. 2348012345678 for Nigeria +234)
export const WHATSAPP_NUMBER = "YOUR_WHATSAPP_NUMBER";

export const WHATSAPP_MSG = encodeURIComponent("Hi, I would like to request a demo of Nexxos HQ");

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

export function openWhatsApp() {
  window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
}

export function comingSoon(page?: string) {
  return page ? `/coming-soon?page=${encodeURIComponent(page)}` : "/coming-soon";
}

export const DEMO_EMAIL = "hello@nexxoshq.io";
export const DEMO_EMAIL_SUBJECT = encodeURIComponent("Demo Request — Nexxos HQ");
export const DEMO_EMAIL_BODY = encodeURIComponent(
  "Hi Nexxos HQ team,\n\nI'd like to request a demo of Nexxos HQ for my organisation.\n\nCompany name:\nTeam size:\nPreferred date/time:\n\nThanks!",
);
export const DEMO_MAILTO_URL = `mailto:${DEMO_EMAIL}?subject=${DEMO_EMAIL_SUBJECT}&body=${DEMO_EMAIL_BODY}`;
