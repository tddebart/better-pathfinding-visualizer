import React, {Component} from 'react';
import "./visualizer.css"
import {dijkstra, getNodesInShortestPathOrder} from '../algorithms/dijkstra'
import {recursiveDivisionMaze} from '../mazeAlgorithms/recursive'
import 'rc-slider/assets/index.css';
import Rainbow from 'rainbowvis.js'

const resolution = 29
let width = getWidth()
let height =  getHeight()

let START_NODE_COL = 5;
let START_NODE_ROW = 5;

let FINISH_NODE_COL = 20
let FINISH_NODE_ROW = 5;

let timeouts = [];

let canvas;
let ctx;

let speed = 0;

const FRAMES_PER_SECOND = 60;  // Valid values are 60,30,20,15,10...
// set the mim time to render the next frame
const FRAME_MIN_TIME = (1000/60) * (60 / FRAMES_PER_SECOND) - (1000/60) * 0.5;
var lastFrameTime = 0;  // the last frame time

let lastMousePos = {x:0,y:0}

let mouseStillPressed = false;

let rects = [];

function getWidth() {
    let howManyCells = 0
    let less = 0
    while(howManyCells % 2 === 0) {
        howManyCells = Math.floor(window.innerWidth/resolution)-less;
        less++
    }
    return howManyCells*resolution;
}

function getHeight() {
    let howManyCells = 0
    let less = 0
    while(howManyCells % 2 === 0) {
        howManyCells = Math.floor(window.innerHeight*0.85/resolution)-less;
        less++
    }
    return howManyCells*resolution;
}

class roundNode {
    constructor(x, y, width, height, radius, gradient) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.color = "Black";
        this.time = 0;
        this.gradient = gradient;
    }

    draw(time) {
        this.time += time;

        this.frame = Math.floor(this.time)/847

        // if(this.gradient === undefined) {
        //     this.color = "Yellow";
        // } else {
        //     this.color = "Blue"
        // }

        ctx.clearRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = "#"+this.gradient.colourAt(this.frame)

        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x + this.width - this.radius, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + this.radius);
        ctx.lineTo(this.x + this.width, this.y + this.height - this.radius);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - this.radius, this.y + this.height);
        ctx.lineTo(this.x + this.radius, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - this.radius);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.quadraticCurveTo(this.x, this.y, this.x + this.radius, this.y);
        ctx.closePath();
        ctx.fill()


        if(this.radius > 0) {
            this.radius -= 0.56
        } else {
            rects.splice(rects.indexOf(this), 1);
        }
    }
}

export default class Visualizer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            grid: [],
            mouseIsPressed: false,
            isDraggingStart: false,
            isDraggingFinish: false,
        };
    }

    resize = () =>  {
        width = getWidth();
        height = getHeight();
        this.forceUpdate()
        this.fullReset()
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resize)
    }

    componentDidMount() {
        this.setState({ grid: getInitialGrid() });
        this.createGrid();
        window.addEventListener('resize', this.resize)
    }

    //#region grid

    createGrid() {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d')

        canvas.width = width
        canvas.height = height

        for (let y = 0; y < canvas.height; y+= resolution) {
            for (let x = 0; x < canvas.width; x+= resolution) {
                this.createPartGrid(x,y)
                if(x/resolution === START_NODE_COL && y/resolution === START_NODE_ROW) {
                    ctx.fillStyle = 'Green'
                    this.drawCube(x/resolution,y/resolution)
                }
                if(x/resolution === FINISH_NODE_COL && y/resolution === FINISH_NODE_ROW) {
                    ctx.fillStyle = 'Red'
                    this.drawCube(x/resolution,y/resolution)
                }
            }
        }
        this.drawLine(0,canvas.height,canvas.width,canvas.height)
        this.drawLine(canvas.width,0,canvas.width,canvas.height)

        window.requestAnimationFrame(this.draw.bind(this));
    }

    draw(time) {
        const deltaTime = time - lastFrameTime
        if(deltaTime < FRAME_MIN_TIME) {
            window.requestAnimationFrame(this.draw.bind(this));
            return;
        }
        lastFrameTime = time;
        for (const rect of rects) {
            rect.draw(deltaTime)
        }

        window.requestAnimationFrame(this.draw.bind(this));
    }

    createPartGrid(x,y) {
        ctx.strokeStyle = 'Black'
        this.drawLine(x,y, x, y+resolution)
        this.drawLine(x,y, x+resolution, y)
    }

    //#endregion

    //#region mouse
    getCursorPositionInPixels(event) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        return {x: x, y: y}
    }

    getCursorPositionInGrid(event) {
        const pos = this.getCursorPositionInPixels(event)
        return {x: Math.floor(pos.x/resolution), y: Math.floor(pos.y/resolution)}
    }

    handleMouseDown(e) {
        if(this.busy) return;

        const cursPos = this.getCursorPositionInGrid(e)
        const {grid} = this.state;
        if(grid[cursPos.y][cursPos.x].isStart) {
            this.setState({isDraggingStart: true})
        } else if(grid[cursPos.y][cursPos.x].isFinish) {
            this.setState({isDraggingFinish: true})
        }

        this.setState({mouseIsPressed: true});
        mouseStillPressed = true;
    }

    handleMouseMove(e) {
        if(this.busy) return;

        // console.log(this.getCursorPosition(e).x + " | " + this.getCursorPosition(e).y)
        if (!this.state.mouseIsPressed) return;
        if(this.state.isDraggingStart) {
            const pos = this.getCursorPositionInGrid(e)
            this.moveStart(pos.x,pos.y)
        } else if(this.state.isDraggingFinish) {
            const pos = this.getCursorPositionInGrid(e)
            this.moveFinish(pos.x,pos.y)
        } else {
            this.calculateWall(e);
        }
        mouseStillPressed = false;
    }

    handleMouseUp(e) {
        if(this.busy) return;

        this.setState({mouseIsPressed: false, isDraggingStart: false, isDraggingFinish: false});
        if(mouseStillPressed && !this.state.isDraggingStart && !this.state.isDraggingFinish) {
            lastMousePos.x++;
            this.calculateWall(e);
        }
    }

    //#endregion

    //#region dijkstra visual

    animateDijkstra(visitedNodesInOrder, nodesInShortestPathOrder) {
        this.clearVisualization(true);
        for (let i = 0; i < visitedNodesInOrder.length; i++) {
            if(i===0) continue;
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                if(i === visitedNodesInOrder.length-1) {
                    this.shortPath(nodesInShortestPathOrder);
                } else {
                    const node = visitedNodesInOrder[i];
                    if(speed !== "0") {
                        let gradient = new Rainbow();
                        gradient.setSpectrum('Yellow', 'Blue', 'Aqua')
                        gradient.setNumberRange(0,0.6)
                        rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, resolution-2, resolution-2, resolution/1.5, gradient))
                    } else {
                        ctx.fillStyle = 'Aqua'
                        this.drawCube(node.col,node.row)
                    }
                }
            }, speed*i))
        }
    }

    shortPath(nodesInShortestPathOrder) {
        for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
            if(i===0 || i===nodesInShortestPathOrder.length-1) continue;
            // eslint-disable-next-line no-loop-func
            timeouts.push(setTimeout(() => {
                const node = nodesInShortestPathOrder[i];
                if(speed !== "0") {
                    let gradient = new Rainbow();
                    gradient.setSpectrum('Red', 'Yellow')
                    gradient.setNumberRange(0,0.5)
                    rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, resolution-2, resolution-2, resolution/1.5, gradient))
                } else {
                    ctx.fillStyle = 'Yellow'
                    this.drawCube(node.col,node.row)
                }
            }, speed!=="0" ? 35 * i : 0));
            timeouts.push(setTimeout(() => {
                this.busy = false;
            }, speed!=="0" ? 35*nodesInShortestPathOrder.length : 0))
        }
    }

    visualizeDijkstra() {
        if(this.busy) return;
        this.busy = true;
        const {grid} = this.state;
        const startNode = grid[START_NODE_ROW][START_NODE_COL];
        const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COL];
        const visitedNodesInOrder = dijkstra(grid, startNode, finishNode);
        const nodesInShortestPathOrder = getNodesInShortestPathOrder(finishNode);
        this.animateDijkstra(visitedNodesInOrder, nodesInShortestPathOrder);
    }

    //#endregion

    //#region moving start & finish

    moveStart(x,y) {
        ctx.clearRect(START_NODE_COL*resolution+1, START_NODE_ROW*resolution+1, resolution-2, resolution-2)
        this.drawStartOrFinish(x,y, true)
        START_NODE_COL = x;
        START_NODE_ROW = y;
    }

    moveFinish(x,y) {
        // const pos = this.getCursorPositionInGrid(e)
        ctx.clearRect(FINISH_NODE_COL*resolution+1, FINISH_NODE_ROW*resolution+1, resolution-2, resolution-2)
        this.drawStartOrFinish(x,y, false)
        FINISH_NODE_COL = x;
        FINISH_NODE_ROW = y;

        // const prevSpeed = speed;
        // speed = 0;
        // this.visualizeDijkstra();
        // speed = prevSpeed;
    }

    drawStartOrFinish(x,y, start) {
        const {grid} = this.state;
        const newGrid = grid.slice();
        const node = newGrid[y][x]
        if(start) {
            newGrid[START_NODE_ROW][START_NODE_COL] = {
                ...newGrid[START_NODE_ROW][START_NODE_COL],
                isStart: false
            }
            newGrid[y][x] = {
                ...node,
                isStart: true,
            };
            ctx.fillStyle = 'Green'
        } else {
            newGrid[FINISH_NODE_ROW][FINISH_NODE_COL] = {
                ...newGrid[FINISH_NODE_ROW][FINISH_NODE_COL],
                isFinish: false
            }
            newGrid[y][x] = {
                ...node,
                isFinish: true,
            };
            ctx.fillStyle = 'Red'
        }
        this.drawCube(x, y)
        this.setState({grid: newGrid})
    }

    //#endregion

    visualizeMaze() {
        if(this.busy) return;
        this.resetWalls()
        this.clearVisualization()
        const {grid} = this.state;
        const startNode = grid[START_NODE_ROW][START_NODE_COL];
        const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COL];
        const maze = recursiveDivisionMaze(grid, startNode,finishNode)
        if(speed === "0") {
            for (const mazeElement of maze) {
                this.drawWall(mazeElement[0], mazeElement[1])
            }
        } else {
            for (let i = 0; i < maze.length; i++) {
                const mazeElement = maze[i]
                timeouts.push(setTimeout(() => this.drawWall(mazeElement[0], mazeElement[1]), speed*i))

            }
        }
    }

    drawLine(x,y, xd, yd) {
        ctx.beginPath();
        ctx.moveTo(x,y)
        ctx.lineTo(xd, yd)
        ctx.stroke();
    }

    drawCube(col,row) {
        ctx.beginPath();
        ctx.fillRect(col*resolution+1, row*resolution+1, resolution-2, resolution-2)
        ctx.stroke();
    }

    calculateWall(e) {
        const pos = this.getCursorPositionInGrid(e)
        if(this.state.grid[pos.y][pos.x].isStart || this.state.grid[pos.y][pos.x].isFinish) {
            return;
        }

        if(lastMousePos.x === pos.x && lastMousePos.y === pos.y) return;
        lastMousePos = pos;
        this.drawWall(pos.x,pos.y)
    }

    drawWall(x,y) {
        const {grid} = this.state;
        const newGrid = grid.slice();
        let widthIn = Math.round(width/resolution)-1
        let heightIn = Math.round(height/resolution)-1
        if(x > widthIn || x < 0 || y > heightIn || y < 0) {
            return;
        }
        const node = newGrid[y][x]
        newGrid[y][x] = {
            ...node,
            isWall: !node.isWall,
        };
        if(newGrid[y][x].isWall) {
            // ctx.fillStyle = 'Black'
            // this.drawCube(x, y)
            if(speed !== "0") {
                let gradient = new Rainbow();
                gradient.setSpectrum('White', 'Black')
                gradient.setNumberRange(0,0.5)
                rects.push(new roundNode(node.col*resolution+1, node.row*resolution+1, resolution-2, resolution-2, resolution/1.5, gradient))
            } else {
                ctx.fillStyle = 'Black'
                this.drawCube(x, y)
            }
        } else {
            ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2,resolution-2)
        }
        this.setState({grid: newGrid})
    }

    showStart() {
        const {grid} = this.state;
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if(grid[i][j].isStart) {
                    console.log("Start is at x:" + j + " y:" + i)
                }
            }
        }
    }

    //#region reset

    clearVisualization(skipBusyCheck = false) {
        if(!skipBusyCheck && this.busy) return;
        rects = [];
        const {grid} = this.state;
        const newGrid = grid.slice()
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if(!grid[y][x].isWall && !grid[y][x].isStart && !grid[y][x].isFinish) {
                    ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2, resolution-2)
                }
                newGrid[y][x].isVisited = false;
                newGrid[y][x].distance = Infinity;
            }
        }
        this.setState({grid: newGrid})
    }

    resetWalls(skipBusyCheck = false) {
        if(!skipBusyCheck && this.busy) return;
        rects = [];
        const {grid} = this.state;
        const newGrid = grid.slice();
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                if(grid[y][x].isWall) {
                    newGrid[y][x].isWall = false;
                    ctx.clearRect(x*resolution+1, y*resolution+1, resolution-2, resolution-2)
                }
            }
        }
    }

    fullReset() {
        START_NODE_COL = 5;
        START_NODE_ROW = 5;

        FINISH_NODE_COL = 20
        FINISH_NODE_ROW = 5;

        this.busy = false;

        rects = []
        this.setState({ grid: getInitialGrid() });
        ctx.clearRect(0,0,canvas.width, canvas.height)
        this.createGrid()
        for (let i = 0; i < timeouts.length; i++) {
            clearTimeout(timeouts[i]);
        }
        timeouts = []
    }

    //#endregion


    // sliderChanged(id, val) {
    //     if(id===0) {
    //         this.setState({width: val})
    //     } else if(id===1) {
    //         this.setState({height: val})
    //     }
    //     this.reDrawGrid()
    // }


    render() {
        // const {width,height} = this.state;

        return (
            <>
                {/*<div style={{width: 100}}>*/}
                {/*    <div>*/}
                {/*        <Slider min={4} max={100} defaultValue={width} tipFormatter={value => `${value}%`} onChange={(val) => this.sliderChanged(0,val)}/>*/}
                {/*        <label>{width}</label>*/}
                {/*    </div>*/}
                {/*    <div style={{height: 10}}/>*/}
                {/*    <>*/}
                {/*        <Slider min={4} max={100} defaultValue={height} onChange={(val) => this.sliderChanged(1,val)}/>*/}
                {/*        <label>{height}</label>*/}
                {/*    </>*/}
                {/*</div>*/}
                <div>
                    <select id={"speed"} defaultValue={"0"} style={{textAlign: 'center'}} onChange={() => {
                        const select = document.getElementById('speed');
                        speed = select.options[select.selectedIndex].value
                        console.log(select.options[select.selectedIndex].value)
                    }}>
                        <option value="80">Slow</option>
                        <option value="30">Fast</option>
                        <option value="15">Faster</option>
                        <option value="5">Extra Fast</option>
                        <option value="0">Instant</option>
                    </select>
                </div>
                <div>
                    <button onClick={() => this.visualizeDijkstra()}>Visualize</button>
                    <button onClick={() => this.fullReset()}>Reset</button>
                    <button onClick={() => this.resetWalls()}>Clear walls</button>
                    <button onClick={() => this.showStart()}>Start</button>
                    <button onClick={() => this.clearVisualization()}>Clear path</button>
                </div>
                <div>
                    <button onClick={() => this.visualizeMaze()}>Generate maze</button>
                </div>
                <canvas
                    id={"canvas"}
                    // onClick={(e) =>  this.calculateWall(e)}
                    onMouseDown={(e) => this.handleMouseDown(e)}
                    onMouseMove={(e) =>
                        this.handleMouseMove(e)
                    }
                    onMouseUp={(e) => this.handleMouseUp(e)}
                />
            </>
        )
    }
}

const createNode = (col, row) => {
    return {
        col,
        row,
        isStart: row === START_NODE_ROW && col === START_NODE_COL,
        isFinish: row === FINISH_NODE_ROW && col === FINISH_NODE_COL,
        distance: Infinity,
        isVisited: false,
        isWall: false,
        prevNode: null,
    }
}

// eslint-disable-next-line no-unused-vars
function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

const getInitialGrid = () => {
    const grid = []
    for (let row = 0; row < height/resolution; row++) {
        const currentRow = []
        for (let col = 0; col < width/resolution; col++) {
            currentRow.push(createNode(col, row));
        }
        grid.push(currentRow);
    }
    return grid;
};