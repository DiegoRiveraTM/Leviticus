import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSpaceBg } from "./SpaceBg";
import "./App.css";

initSpaceBg();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Use contextBridge (solo si el preload expone ipcRenderer)
window.ipcRenderer?.on?.("main-process-message", (_event, message) => {
  console.log(message);
});
