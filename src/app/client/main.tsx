import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";

import { App } from "./App";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
);

(import.meta.hot.data.root ??= createRoot(elem)).render(app);
