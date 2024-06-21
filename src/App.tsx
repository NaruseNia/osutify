import { useEffect, useState } from "react";
import "./App.css";

export const App = () => {
  const [debugData, setDebugData] = useState<string>("");

  useEffect(() => {
    window.ipcRenderer.on("debug-data", (_, data) => {
      setDebugData(data);
    });
  });

  return (
    <div className="app">
      <div className="flex flex-col">
        <span>Data: {debugData}</span>
        <button onClick={() => window.ipcRenderer.invoke("get-lazer-data")}>
          Fetch
        </button>
      </div>
    </div>
  );
};

export default App;
