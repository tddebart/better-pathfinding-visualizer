import React from 'react';
import './App.css';
import Visualizer from "./Visualizer/visualizer";
import gitLogo from "./GitHub-Mark-64px.png"

function App() {
  return (
    <div className="App">
      <header className="App-header">
          <a href="https://github.com/tddebart/better-pathfinding-visualizer" target="_blank">
            <img className={"github"} src={gitLogo} alt={"github"} />
          </a>
          <Visualizer/>
      </header>
    </div>
  );
}

export default App;
