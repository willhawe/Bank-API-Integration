import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { clearTrueLayerToken } from "../data";

const CLIENT_ID = "spendingwidget-9fdf0c";
const REDIRECT_URI = "https://spending-tracker-bramble.vercel.app/callback";

function buildAuthUrl(native: boolean) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: "accounts transactions",
    redirect_uri: REDIRECT_URI,
    providers: "uk-ob-all uk-oauth-all",
    ...(native ? { state: "native" } : {}),
  });
  return `https://auth.truelayer-sandbox.com/?${params.toString()}`;
}

async function openAuth() {
  const isNative = Capacitor.isNativePlatform();
  const url = buildAuthUrl(isNative);
  if (isNative) {
    await Browser.open({ url, presentationStyle: "popover" });
  } else {
    window.location.href = url;
  }
}

interface ConnectBanksProps {
  connected: boolean;
  onDisconnect: () => void;
}

export function ConnectBanks({ connected, onDisconnect }: ConnectBanksProps) {
  if (connected) {
    return (
      <div className="connect-banks connect-banks--connected">
        <span className="connect-banks__status">
          <span className="connect-banks__dot" />
          Live bank data
        </span>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            clearTrueLayerToken();
            onDisconnect();
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="connect-banks">
      <p className="connect-banks__label">Using demo data</p>
      <button
        type="button"
        className="connect-banks__btn"
        onClick={() => void openAuth()}
      >
        Connect your banks
      </button>
    </div>
  );
}
