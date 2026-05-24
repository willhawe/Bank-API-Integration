import { clearTrueLayerToken } from "../data";

const CLIENT_ID = "sandbox-spendingwidget-9fdf0c";
const REDIRECT_URI = "https://spending-tracker-bramble.vercel.app/callback";
const AUTH_URL =
  `https://auth.truelayer-sandbox.com/?response_type=code` +
  `&client_id=${CLIENT_ID}` +
  `&scope=accounts%20transactions` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&providers=uk-ob-all%20uk-oauth-all`;

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
      <a href={AUTH_URL} className="connect-banks__btn">
        Connect your banks
      </a>
    </div>
  );
}
