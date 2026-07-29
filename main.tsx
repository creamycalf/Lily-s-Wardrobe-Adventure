import { createRoot } from "react-dom/client";
import DressboxGame from "./components/DressboxGame";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(<DressboxGame />);
}
