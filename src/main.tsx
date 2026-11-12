import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, savedTheme } from "./utils/theme";
import "./index.css";

// 首帧前应用已存主题（默认墨色夜窗）
applyTheme(savedTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
