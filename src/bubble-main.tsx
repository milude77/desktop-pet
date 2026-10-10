import React from "react";
import ReactDOM from "react-dom/client";
import { BubbleWindow } from "./components/BubbleWindow";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BubbleWindow />
  </React.StrictMode>,
);