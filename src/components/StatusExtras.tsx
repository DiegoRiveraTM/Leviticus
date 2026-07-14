import { useEffect, useState } from "react";

const SESSION_START = Date.now();

interface BatteryInfo {
  level: number;
  charging: boolean;
}

function two(n: number) {
  return String(n).padStart(2, "0");
}

export default function StatusExtras() {
  const [ram, setRam] = useState<number | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [now, setNow] = useState(() => new Date());

  // reloj y tiempo de sesión
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // RAM de la app cada 5 s
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const stats = await window.api.sysStats();
        if (alive) setRam(stats.ramMB);
      } catch {
        /* sin datos esta vuelta */
      }
    }
    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // batería del equipo (Battery Status API)
  useEffect(() => {
    let alive = true;
    let bat: BatteryManager | undefined;
    const update = () => {
      if (alive && bat) setBattery({ level: bat.level, charging: bat.charging });
    };
    void navigator.getBattery?.().then((b) => {
      bat = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });
    return () => {
      alive = false;
      bat?.removeEventListener("levelchange", update);
      bat?.removeEventListener("chargingchange", update);
    };
  }, []);

  const elapsed = now.getTime() - SESSION_START;
  const hrs = Math.floor(elapsed / 3600000);
  const min = Math.floor((elapsed % 3600000) / 60000);
  const sec = Math.floor((elapsed % 60000) / 1000);
  const session = hrs > 0 ? `${hrs}:${two(min)}:${two(sec)}` : `${two(min)}:${two(sec)}`;

  return (
    <div className="status-extras">
      {ram !== null && (
        <span className="sx-item" title="RAM usada por Levitico">
          {ram} MB
        </span>
      )}
      {battery && (
        <span
          className="sx-item"
          title={battery.charging ? "Batería · cargando" : "Batería"}
        >
          <svg width="17" height="9" viewBox="0 0 17 9">
            <rect
              x="0.5"
              y="0.5"
              width="13.5"
              height="8"
              rx="2.2"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.45"
            />
            <rect
              x="15.2"
              y="2.9"
              width="1.6"
              height="3.2"
              rx="0.8"
              fill="currentColor"
              fillOpacity="0.45"
            />
            <rect
              x="2"
              y="2"
              width={Math.max(1.2, 10.5 * battery.level)}
              height="5"
              rx="1.1"
              fill={
                battery.charging
                  ? "#30d158"
                  : battery.level <= 0.2
                    ? "#ff453a"
                    : "currentColor"
              }
            />
          </svg>
          {Math.round(battery.level * 100)}%
        </span>
      )}
      <span className="sx-item" title="Hora">
        {two(now.getHours())}:{two(now.getMinutes())}
      </span>
      <span className="sx-item" title="Tiempo de sesión">
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeLinecap="round"
        >
          <circle cx="5" cy="5" r="4" />
          <path d="M5 2.8V5l1.6 1" />
        </svg>
        {session}
      </span>
    </div>
  );
}
