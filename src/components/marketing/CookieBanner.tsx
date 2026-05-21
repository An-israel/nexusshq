import * as React from "react";
import { Link } from "@tanstack/react-router";

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // Only show if user hasn't already accepted
    if (!localStorage.getItem("nexus_cookie_consent")) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem("nexus_cookie_consent", "accepted");
    setVisible(false);
  }

  function handleManage() {
    // For now just close the banner — in future could open a preference modal
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111111] border-t border-[#1E1E1E] p-4">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-400 flex-1">
          We use essential cookies to keep Nexxos HQ running. No tracking. No ads.{" "}
          <Link
            to="/cookies"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            Learn more
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleManage}
            className="rounded-lg border border-[#1E1E1E] hover:border-gray-600 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Manage Preferences
          </button>
          <button
            onClick={handleAccept}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
