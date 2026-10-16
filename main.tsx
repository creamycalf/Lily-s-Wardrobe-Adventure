import { createRoot } from "react-dom/client";
import DressboxGame from "./components/DressboxGame";
import "./app/globals.css";

const buildProfile = import.meta.env.VITE_BUILD_PROFILE;
document.documentElement.dataset.buildProfile = typeof buildProfile === "string" ? buildProfile : "web";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<DressboxGame />);
}
